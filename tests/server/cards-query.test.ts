import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AiProvider } from '../../server/ai/provider';
import { createApp } from '../../server/app';
import { createCardService } from '../../server/cards/service';
import type { CreateCardInput, NormalizeCardInput, NormalizedCard } from '../../shared/contracts';
import { createTestDatabase } from '../helpers/testDatabase';

const fixedNow = new Date('2026-07-17T10:00:00.000Z');
const firstCategory = ['常识判断', '常识判断/文史'];
const secondCategory = ['言语理解', '言语理解/逻辑填空'];

const baseInput: CreateCardInput = {
  entryMode: 'knowledge',
  rawInput: '原始卡片',
  rawContentJson: null,
  wrongPoint: '',
  analysis: '',
  mnemonic: '',
  extension: '',
  notes: '',
  categoryIds: firstCategory,
  userTags: [],
  template: '常识模板',
  sourceType: 'manual',
  sourceDetail: '',
  attachments: [],
};

const baseNormalized: NormalizedCard = {
  normalized_statement: '规范表述',
  question_type: 'single',
  wrong_point: '错误点',
  analysis: '解析',
  mnemonic: '口诀',
  extension: '拓展',
  notes: '笔记',
  tags: ['AI标签'],
  quiz_items: [{ direction: 'single', question: '问题', answer: '答案' }],
};

type TestDatabase = ReturnType<typeof createTestDatabase>;

interface InsertCardOptions {
  id: string;
  rawInput?: string;
  rawContentJson?: string | null;
  normalizedStatement?: string;
  analysis?: string;
  mnemonic?: string;
  extension?: string;
  notes?: string;
  categoryIds?: string[];
  tags?: Array<{ id: string; name: string; origin?: 'user' | 'ai' }>;
  rating?: number;
  mastery?: 'unseen' | 'again' | 'hard' | 'good';
  aiStatus?: 'processing' | 'ready' | 'pending' | 'needs_input';
  archived?: boolean;
  createdAt?: string;
}

function normalized(overrides: Partial<NormalizedCard> = {}): NormalizedCard {
  return {
    ...baseNormalized,
    tags: [...baseNormalized.tags],
    quiz_items: baseNormalized.quiz_items.map((item) => ({ ...item })),
    ...overrides,
  };
}

function createInput(overrides: Partial<CreateCardInput> = {}): CreateCardInput {
  return {
    ...baseInput,
    categoryIds: [...baseInput.categoryIds],
    userTags: [...baseInput.userTags],
    attachments: [],
    ...overrides,
  };
}

function insertCard(database: TestDatabase, options: InsertCardOptions) {
  const createdAt = options.createdAt ?? '2026-07-17T09:00:00.000Z';
  database.db
    .prepare(`
      INSERT INTO cards (
        id, entry_mode, raw_input, template, normalized_statement,
        analysis, mnemonic, extension, notes, rating, mastery,
        ai_status, archived, created_at, updated_at
      ) VALUES (?, 'knowledge', ?, '模板', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .run(
      options.id,
      options.rawInput ?? '',
      options.normalizedStatement ?? '',
      options.analysis ?? '',
      options.mnemonic ?? '',
      options.extension ?? '',
      options.notes ?? '',
      options.rating ?? 1,
      options.mastery ?? 'unseen',
      options.aiStatus ?? 'ready',
      options.archived ? 1 : 0,
      createdAt,
      createdAt,
    );
  if (options.rawContentJson !== undefined) {
    database.db
      .prepare('UPDATE cards SET raw_content_json = ? WHERE id = ?')
      .run(options.rawContentJson, options.id);
  }

  const insertCategory = database.db.prepare(
    'INSERT INTO card_categories (card_id, category_id) VALUES (?, ?)',
  );
  for (const categoryId of options.categoryIds ?? firstCategory) {
    insertCategory.run(options.id, categoryId);
  }

  for (const tag of options.tags ?? []) {
    database.db.prepare('INSERT OR IGNORE INTO tags (id, name) VALUES (?, ?)').run(tag.id, tag.name);
    database.db
      .prepare('INSERT INTO card_tags (card_id, tag_id, origin) VALUES (?, ?, ?)')
      .run(options.id, tag.id, tag.origin ?? 'user');
  }
}

describe('卡片查询、管理与批量操作', () => {
  const resources: TestDatabase[] = [];

  afterEach(() => {
    resources.splice(0).forEach((resource) => resource.dispose());
  });

  function setup(normalizeImplementation?: (input: NormalizeCardInput) => Promise<NormalizedCard>) {
    const database = createTestDatabase();
    resources.push(database);
    const uploadsDirectory = path.join(database.directory, 'uploads');
    mkdirSync(uploadsDirectory, { recursive: true });
    const normalize = vi.fn(
      normalizeImplementation ?? (async () => normalized()),
    ) as AiProvider['normalize'];
    const service = createCardService({
      database: database.manager,
      aiProvider: { normalize },
      now: () => new Date(fixedNow),
      uploadsDirectory,
    });
    const app = createApp({ cardService: service, uploadsDirectory });
    return { app, database, normalize, service, uploadsDirectory };
  }

  it('按片段命中文本、易错点、题目、答案和标签，并把特殊字符按字面处理', async () => {
    const { app, database } = setup();
    const searchable = [
      ['raw', { rawInput: '命中-raw' }],
      ['statement', { normalizedStatement: '命中-statement' }],
      ['analysis', { analysis: '命中-analysis' }],
      ['mnemonic', { mnemonic: '命中-mnemonic' }],
      ['extension', { extension: '命中-extension' }],
      ['notes', { notes: '命中-notes' }],
    ] as const;
    for (const [id, fields] of searchable) {
      insertCard(database, { id, ...fields });
    }
    insertCard(database, {
      id: 'tag',
      tags: [{ id: 'tag-search-id', name: '命中-tag', origin: 'ai' }],
    });
    insertCard(database, { id: 'wrong-point' });
    database.db
      .prepare("UPDATE cards SET wrong_point = '易错点片段命中' WHERE id = 'wrong-point'")
      .run();
    insertCard(database, { id: 'quiz' });
    database.db
      .prepare(`
        INSERT INTO quiz_items (
          id, card_id, direction, question, answer, due_at, created_at
        ) VALUES (
          'quiz-search', 'quiz', 'single', '题目片段命中', '答案片段命中', ?, ?
        )
      `)
      .run(fixedNow.toISOString(), fixedNow.toISOString());
    insertCard(database, { id: 'literal', rawInput: '百分号%和下划线_' });
    insertCard(database, { id: 'wildcard-lookalike', rawInput: '百分号X和下划线Y' });
    insertCard(database, { id: 'other', rawInput: '普通内容' });

    for (const [id] of [...searchable, ['tag']] as const) {
      const response = await request(app).get('/api/cards').query({ query: `命中-${id}` });
      expect(response.status).toBe(200);
      expect(response.body.items.map((item: { id: string }) => item.id)).toEqual([id]);
    }

    const partial = await request(app).get('/api/cards').query({ query: '中-ra' });
    expect(partial.status).toBe(200);
    expect(partial.body.items.map((item: { id: string }) => item.id)).toEqual(['raw']);

    for (const [query, id] of [
      ['错点片段', 'wrong-point'],
      ['题目片段', 'quiz'],
      ['答案片段', 'quiz'],
    ] as const) {
      const response = await request(app).get('/api/cards').query({ query });
      expect(response.status).toBe(200);
      expect(response.body.items.map((item: { id: string }) => item.id)).toEqual([id]);
    }

    const literal = await request(app).get('/api/cards').query({ query: '%和下划线_' });
    expect(literal.status).toBe(200);
    expect(literal.body.items.map((item: { id: string }) => item.id)).toEqual(['literal']);

    const injection = await request(app).get('/api/cards').query({ query: "' OR 1=1 --" });
    expect(injection.status).toBe(200);
    expect(injection.body.total).toBe(0);
  });

  it('空格分隔的多个关键词可跨字段模糊组合且必须全部命中', async () => {
    const { app, database } = setup();
    insertCard(database, {
      id: 'combined-match',
      rawInput: '行政执法流程',
      analysis: '适用比例原则',
    });
    insertCard(database, {
      id: 'single-term-only',
      rawInput: '行政执法流程',
      analysis: '其他内容',
    });

    const response = await request(app).get('/api/cards').query({ query: '  行政   比例  ' });

    expect(response.status).toBe(200);
    expect(response.body.items.map((item: { id: string }) => item.id)).toEqual([
      'combined-match',
    ]);
  });

  it('分别执行全部筛选并按 AND 组合，分类和标签只匹配精确关系', async () => {
    const { app, database } = setup();
    const common = {
      rawInput: '组合目标',
      categoryIds: firstCategory,
      tags: [{ id: 'target-tag', name: '精确标签' }],
      aiStatus: 'ready' as const,
      archived: true,
      createdAt: '2026-07-15T12:00:00.000Z',
    };
    insertCard(database, { id: 'target', ...common });
    insertCard(database, { id: 'different-category', ...common, categoryIds: secondCategory });
    insertCard(database, {
      id: 'different-tag',
      ...common,
      tags: [{ id: 'other-tag', name: '精确标签扩展' }],
    });
    insertCard(database, { id: 'different-status', ...common, aiStatus: 'pending' });
    insertCard(database, { id: 'different-archive', ...common, archived: false });
    insertCard(database, {
      id: 'different-date',
      ...common,
      createdAt: '2026-07-01T12:00:00.000Z',
    });

    const cases = [
      [{ categoryIds: '常识判断/文史', archived: 'true' }, 'different-category'],
      [{ tagIds: 'target-tag', archived: 'true' }, 'different-tag'],
      [{ aiStatus: 'ready', archived: 'true' }, 'different-status'],
      [{ archived: 'true' }, 'different-archive'],
      [
        { createdFrom: '2026-07-15', createdTo: '2026-07-15', archived: 'true' },
        'different-date',
      ],
    ] as const;
    for (const [query, excludedId] of cases) {
      const response = await request(app).get('/api/cards').query(query);
      expect(response.status).toBe(200);
      const ids = response.body.items.map((item: { id: string }) => item.id);
      expect(ids).toContain('target');
      expect(ids).not.toContain(excludedId);
    }

    const combined = await request(app).get('/api/cards').query({
      query: '组合目标',
      categoryIds: ['常识判断/文史', '不存在分类'],
      tagIds: ['target-tag', 'missing-tag'],
      aiStatus: 'ready',
      archived: 'true',
      createdFrom: '2026-07-15T00:00:00.000Z',
      createdTo: '2026-07-15T23:59:59.999Z',
      page: '1',
      pageSize: '20',
    });
    expect(combined.status).toBe(200);
    expect(combined.body.items.map((item: { id: string }) => item.id)).toEqual(['target']);
    expect(combined.body.total).toBe(1);
  });

  it('默认排除归档卡片，日期仅值覆盖 UTC 当日完整边界', async () => {
    const { app, database } = setup();
    insertCard(database, { id: 'active', createdAt: '2026-07-17T12:00:00.000Z' });
    insertCard(database, { id: 'archived', archived: true, createdAt: '2026-07-17T12:00:00.000Z' });
    insertCard(database, { id: 'day-start', createdAt: '2026-07-16T00:00:00.000Z' });
    insertCard(database, { id: 'day-end', createdAt: '2026-07-16T23:59:59.999Z' });
    insertCard(database, { id: 'next-day', createdAt: '2026-07-17T00:00:00.000Z' });

    const defaults = await request(app).get('/api/cards');
    expect(defaults.status).toBe(200);
    expect(defaults.body.items.map((item: { id: string }) => item.id)).not.toContain('archived');

    const day = await request(app)
      .get('/api/cards')
      .query({ createdFrom: '2026-07-16', createdTo: '2026-07-16', pageSize: '100' });
    expect(day.status).toBe(200);
    expect(day.body.items.map((item: { id: string }) => item.id).sort()).toEqual([
      'day-end',
      'day-start',
    ]);
  });

  it('分页先计数并按创建时间、卡片编号稳定倒序', async () => {
    const { app, database } = setup();
    insertCard(database, { id: 'a', createdAt: '2026-07-17T08:00:00.000Z' });
    insertCard(database, { id: 'b', createdAt: '2026-07-17T08:00:00.000Z' });
    insertCard(database, { id: 'c', createdAt: '2026-07-17T09:00:00.000Z' });

    const first = await request(app).get('/api/cards').query({ page: '1', pageSize: '2' });
    const second = await request(app).get('/api/cards').query({ page: '2', pageSize: '2' });

    expect(first.status).toBe(200);
    expect(first.body).toMatchObject({ total: 3, page: 1, pageSize: 2 });
    expect(first.body.items.map((item: { id: string }) => item.id)).toEqual(['c', 'b']);
    expect(second.body.items.map((item: { id: string }) => item.id)).toEqual(['a']);
  });

  it('用户初始稿先按源稿去重分页，并完整返回当页每份源稿的衍生卡片', async () => {
    const { app, database } = setup();
    for (let index = 0; index < 25; index += 1) {
      const source = `第 ${String(index).padStart(2, '0')} 份源稿`;
      insertCard(database, {
        id: `source-${String(index).padStart(2, '0')}-a`,
        rawInput: source,
        rawContentJson: JSON.stringify({ type: 'doc', content: [{ type: 'text', text: source }] }),
        createdAt: `2026-07-${String(index + 1).padStart(2, '0')}T09:00:00.000Z`,
      });
    }
    const sharedContent = JSON.stringify({
      type: 'doc',
      content: [{ type: 'text', text: '第 24 份源稿' }],
    });
    insertCard(database, {
      id: 'source-24-b',
      rawInput: '这段文本不同，但有效富文本相同',
      rawContentJson: sharedContent,
      createdAt: '2026-07-25T08:00:00.000Z',
    });
    insertCard(database, {
      id: 'source-24-c-filtered-out',
      rawInput: '第 24 份源稿',
      rawContentJson: sharedContent,
      categoryIds: secondCategory,
      createdAt: '2026-07-25T07:00:00.000Z',
    });

    const first = await request(app).get('/api/cards').query({
      contentVersion: 'original',
      categoryIds: firstCategory[1],
      page: '1',
      pageSize: '20',
    });
    const second = await request(app).get('/api/cards').query({
      contentVersion: 'original',
      categoryIds: firstCategory[1],
      page: '2',
      pageSize: '20',
    });

    expect(first.status).toBe(200);
    expect(first.body).toMatchObject({ total: 25, page: 1, pageSize: 20 });
    expect(new Set(first.body.items.map((item: { rawContentJson: string }) => item.rawContentJson)).size).toBe(20);
    expect(first.body.items.map((item: { id: string }) => item.id)).toEqual(
      expect.arrayContaining(['source-24-a', 'source-24-b']),
    );
    expect(first.body.items.map((item: { id: string }) => item.id)).not.toContain(
      'source-24-c-filtered-out',
    );
    expect(second.status).toBe(200);
    expect(second.body).toMatchObject({ total: 25, page: 2, pageSize: 20 });
    expect(new Set(second.body.items.map((item: { rawContentJson: string }) => item.rawContentJson)).size).toBe(5);

    const optimized = await request(app).get('/api/cards').query({
      contentVersion: 'optimized',
      categoryIds: firstCategory[1],
      page: '1',
      pageSize: '20',
    });
    expect(optimized.status).toBe(200);
    expect(optimized.body).toMatchObject({ total: 26, page: 1, pageSize: 20 });
    expect(optimized.body.items).toHaveLength(20);
  });

  it.each([
    ['rating', { rating: '1.0' }],
    ['page', { page: '0' }],
    ['pageSize', { pageSize: '101' }],
    ['mastery', { mastery: 'mastered' }],
    ['aiStatus', { aiStatus: 'done' }],
    ['contentVersion', { contentVersion: 'raw' }],
    ['archived', { archived: 'yes' }],
    ['date', { createdFrom: '2026-02-31' }],
    ['range', { createdFrom: '2026-07-18', createdTo: '2026-07-17' }],
    ['unknown', { unexpected: 'value' }],
  ])('非法查询参数 %s 返回安全的 400', async (_name, query) => {
    const { app } = setup();
    const response = await request(app).get('/api/cards').query(query);

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ code: 'invalid_request', message: expect.any(String) });
    expect(JSON.stringify(response.body)).not.toMatch(/SQL|\\|AAA错题/i);
  });

  it('获取详情并对不存在卡片返回 404', async () => {
    const { app, database } = setup();
    insertCard(database, { id: 'detail', rawInput: '详情原文' });

    const detail = await request(app).get('/api/cards/detail');
    const missing = await request(app).get('/api/cards/missing');

    expect(detail.status).toBe(200);
    expect(detail.body).toMatchObject({ id: 'detail', rawInput: '详情原文' });
    expect(missing.status).toBe(404);
  });

  it('原子更新普通字段和分类，并替换用户标签同时保留 AI 标签和升级同名关系', async () => {
    const { app, normalize } = setup(async () =>
      normalized({ tags: ['AI保留', '同名标签'] }),
    );
    const created = await request(app).post('/api/cards').send(createInput({ userTags: ['旧用户标签'] }));

    const response = await request(app)
      .patch(`/api/cards/${created.body.id}`)
      .send({
        rawInput: '  更新原文  ',
        rawContentJson: '{"type":"doc"}',
        normalizedStatement: '人工规范表述',
        wrongPoint: '人工错误点',
        analysis: '人工解析',
        mnemonic: '人工口诀',
        extension: '人工拓展',
        notes: '人工笔记',
        categoryIds: secondCategory,
        userTags: [' 同名标签 ', '新用户标签', '新用户标签', ' '],
        template: '新模板',
        sourceType: 'book',
        sourceDetail: '第十页',
        archived: true,
      });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      rawInput: '更新原文',
      rawContentJson: '{"type":"doc"}',
      normalizedStatement: '人工规范表述',
      wrongPoint: '人工错误点',
      analysis: '人工解析',
      mnemonic: '人工口诀',
      extension: '人工拓展',
      notes: '人工笔记',
      template: '新模板',
      sourceType: 'book',
      sourceDetail: '第十页',
      archived: true,
    });
    expect(response.body.categories.map(({ id }: { id: string }) => id)).toEqual(secondCategory);
    expect(response.body.tags).toEqual([
      expect.objectContaining({ name: 'AI保留', origin: 'ai' }),
      expect.objectContaining({ name: '同名标签', origin: 'user' }),
      expect.objectContaining({ name: '新用户标签', origin: 'user' }),
    ]);
    expect(normalize).toHaveBeenCalledTimes(1);

    const cleared = await request(app)
      .patch(`/api/cards/${created.body.id}`)
      .send({ userTags: [] });
    expect(cleared.status).toBe(200);
    expect(cleared.body.tags).toEqual([
      expect.objectContaining({ name: 'AI保留', origin: 'ai' }),
    ]);
  });

  it('分类校验失败时回滚同一补丁内的字段，并严格拒绝空补丁和额外字段', async () => {
    const { app } = setup();
    const created = await request(app).post('/api/cards').send(createInput());

    const invalidCategory = await request(app)
      .patch(`/api/cards/${created.body.id}`)
      .send({ notes: '不应落库', categoryIds: ['常识判断'] });
    const detail = await request(app).get(`/api/cards/${created.body.id}`);
    const empty = await request(app).patch(`/api/cards/${created.body.id}`).send({});
    const extra = await request(app)
      .patch(`/api/cards/${created.body.id}`)
      .send({ notes: '不应接受额外字段', extra: true });
    const missing = await request(app).patch('/api/cards/missing').send({ notes: '缺失卡片' });

    expect(invalidCategory.status).toBe(400);
    expect(detail.body.notes).toBe('笔记');
    expect(empty.status).toBe(400);
    expect(extra.status).toBe(400);
    expect(missing.status).toBe(404);
  });

  it('仅在 needs_input 卡片原文实际变化后自动重试，并保留升级后的用户标签', async () => {
    let call = 0;
    const calls: NormalizeCardInput[] = [];
    const { app, normalize } = setup(async (input) => {
      calls.push(structuredClone(input));
      call += 1;
      return call === 1
        ? normalized({
            question_type: 'unstructured',
            quiz_items: [],
            tags: ['同名标签', 'AI旧标签'],
          })
        : normalized({ tags: ['AI新标签'] });
    });
    const created = await request(app).post('/api/cards').send(createInput());
    expect(created.body.aiStatus).toBe('needs_input');

    const sameRaw = await request(app)
      .patch(`/api/cards/${created.body.id}`)
      .send({ rawInput: '  原始卡片  ' });
    const metadataOnly = await request(app)
      .patch(`/api/cards/${created.body.id}`)
      .send({ userTags: ['同名标签'], archived: true });

    expect(sameRaw.status).toBe(200);
    expect(metadataOnly.status).toBe(200);
    expect(normalize).toHaveBeenCalledTimes(1);

    const changed = await request(app)
      .patch(`/api/cards/${created.body.id}`)
      .send({ rawInput: '修改后的原文' });

    expect(changed.status).toBe(200);
    expect(changed.body.aiStatus).toBe('ready');
    expect(normalize).toHaveBeenCalledTimes(2);
    expect(calls[1].raw_input).toBe('修改后的原文');
    expect(changed.body.tags).toEqual([
      expect.objectContaining({ name: 'AI新标签', origin: 'ai' }),
      expect.objectContaining({ name: '同名标签', origin: 'user' }),
    ]);
  });

  it('整理进行中只允许安全元数据更新，并原子拒绝包含 AI 相关字段的补丁', async () => {
    let reportStarted!: (input: NormalizeCardInput) => void;
    let completeAi!: (result: NormalizedCard) => void;
    const started = new Promise<NormalizeCardInput>((resolve) => {
      reportStarted = resolve;
    });
    const completion = new Promise<NormalizedCard>((resolve) => {
      completeAi = resolve;
    });
    const { app, database } = setup(async (input) => {
      reportStarted(structuredClone(input));
      return completion;
    });
    insertCard(database, {
      id: 'processing-card',
      rawInput: '旧原文',
      aiStatus: 'pending',
      mastery: 'unseen',
    });

    const retry = request(app)
      .post('/api/cards/processing-card/retry-ai')
      .send({})
      .then((response) => response);
    const normalizeInput = await started;
    expect(normalizeInput.raw_input).toBe('旧原文');

    const safePatch = await request(app)
      .patch('/api/cards/processing-card')
      .send({ userTags: ['安全标签'], archived: true });
    const mixedConflict = await request(app)
      .patch('/api/cards/processing-card')
      .send({ rawInput: '新原文', userTags: ['新标签'] });
    const deprecatedConflict = await request(app)
      .patch('/api/cards/processing-card')
      .send({ mastery: 'hard' });

    expect(safePatch.status).toBe(200);
    expect(mixedConflict.status).toBe(409);
    expect(mixedConflict.body).toEqual({
      code: 'processing_conflict',
      message: '卡片正在整理，请稍后再编辑相关内容',
    });
    expect(deprecatedConflict.status).toBe(400);
    expect(
      database.db
        .prepare('SELECT raw_input, mastery, archived FROM cards WHERE id = ?')
        .get('processing-card'),
    ).toEqual({ raw_input: '旧原文', mastery: 'unseen', archived: 1 });

    completeAi(
      normalized({
        normalized_statement: '旧原文规范表述',
        quiz_items: [{ direction: 'single', question: '旧原文题目', answer: '旧原文答案' }],
      }),
    );
    const retried = await retry;

    expect(retried.status).toBe(200);
    expect(retried.body).toMatchObject({
      rawInput: '旧原文',
      normalizedStatement: '旧原文规范表述',
      archived: true,
      aiStatus: 'ready',
    });
    expect(retried.body.tags).toHaveLength(2);
    expect(retried.body.tags).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: '安全标签', origin: 'user' }),
        expect.objectContaining({ name: 'AI标签', origin: 'ai' }),
      ]),
    );
    expect(retried.body.quizItems).toEqual([
      expect.objectContaining({ question: '旧原文题目', answer: '旧原文答案' }),
    ]);
  });

  it('批量加标签和归档时去重编号、忽略缺失卡片并返回实际命中数', async () => {
    const { app, database } = setup();
    insertCard(database, {
      id: 'bulk-a',
      tags: [{ id: 'shared-tag', name: '批量标签', origin: 'ai' }],
    });
    insertCard(database, { id: 'bulk-b' });

    const response = await request(app)
      .patch('/api/cards/bulk')
      .send({
        ids: ['bulk-a', 'bulk-a', 'missing', 'bulk-b'],
        tags: [' 批量标签 ', '批量标签', '新增标签', ' '],
        archived: true,
      });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ updated: 2 });
    for (const id of ['bulk-a', 'bulk-b']) {
      const detail = await request(app).get(`/api/cards/${id}`);
      expect(detail.body).toMatchObject({ archived: true });
      expect(detail.body.tags).toHaveLength(2);
      expect(detail.body.tags).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: '新增标签', origin: 'user' }),
          expect.objectContaining({ name: '批量标签', origin: 'user' }),
        ]),
      );
    }
  });

  it('批量路由优先于动态编号路由，任一卡片写入失败时整个事务回滚', async () => {
    const { app, database } = setup();
    insertCard(database, { id: 'bulk-a', rating: 1 });
    insertCard(database, { id: 'bulk-b', rating: 1 });
    database.db.exec(`
      CREATE TRIGGER reject_bulk_b
      BEFORE UPDATE OF archived ON cards
      WHEN NEW.id = 'bulk-b'
      BEGIN
        SELECT RAISE(ABORT, 'private SQL detail');
      END
    `);

    const response = await request(app)
      .patch('/api/cards/bulk')
      .send({ ids: ['bulk-a', 'bulk-b'], archived: true });

    expect(response.status).toBe(500);
    expect(JSON.stringify(response.body)).not.toContain('private SQL detail');
    expect(
      database.db.prepare("SELECT id, archived FROM cards WHERE id LIKE 'bulk-%' ORDER BY id").all(),
    ).toEqual([
      { id: 'bulk-a', archived: 0 },
      { id: 'bulk-b', archived: 0 },
    ]);
  });

  it('未调整时新卡在前，置顶和置底后立即按人工顺序移动', async () => {
    const { app, database } = setup();
    insertCard(database, { id: 'order-old', createdAt: '2026-07-15T09:00:00.000Z' });
    insertCard(database, { id: 'order-new', createdAt: '2026-07-19T09:00:00.000Z' });
    insertCard(database, { id: 'order-newest', createdAt: '2026-07-20T09:00:00.000Z' });

    const initial = await request(app).get('/api/cards');
    expect(initial.body.items.map((item: { id: string }) => item.id)).toEqual([
      'order-newest',
      'order-new',
      'order-old',
    ]);

    const top = await request(app)
      .patch('/api/cards/bulk')
      .send({ ids: ['order-old'], position: 'top' });
    const afterTop = await request(app).get('/api/cards');
    const bottom = await request(app)
      .patch('/api/cards/bulk')
      .send({ ids: ['order-newest'], position: 'bottom' });
    const afterBottom = await request(app).get('/api/cards');

    expect(top.body).toEqual({ updated: 1 });
    expect(afterTop.body.items.map((item: { id: string }) => item.id)).toEqual([
      'order-old',
      'order-newest',
      'order-new',
    ]);
    expect(bottom.body).toEqual({ updated: 1 });
    expect(afterBottom.body.items.map((item: { id: string }) => item.id)).toEqual([
      'order-old',
      'order-new',
      'order-newest',
    ]);
  });

  it('新录入卡片取得当前最大顺序并排在已有置顶卡前', async () => {
    const { app, database } = setup();
    insertCard(database, { id: 'existing-pinned', createdAt: '2026-07-15T09:00:00.000Z' });
    await request(app)
      .patch('/api/cards/bulk')
      .send({ ids: ['existing-pinned'], position: 'top' });

    const created = await request(app).post('/api/cards').send(createInput({ rawInput: '刚录入的新卡片' }));
    const ordered = await request(app).get('/api/cards');
    const manualOrders = database.db
      .prepare('SELECT id, manual_order FROM cards ORDER BY manual_order DESC')
      .all() as Array<{ id: string; manual_order: number }>;

    expect(created.status).toBe(201);
    expect(manualOrders).toEqual([
      { id: created.body.id, manual_order: 2 },
      { id: 'existing-pinned', manual_order: 1 },
    ]);
    expect(ordered.body.items.map((item: { id: string }) => item.id)).toEqual([
      created.body.id,
      'existing-pinned',
    ]);
  });

  it('用户初始稿的分组代表、组间和组内均以人工顺序优先', async () => {
    const { app, database } = setup();
    insertCard(database, {
      id: 'original-a-old',
      rawInput: 'shared source A',
      createdAt: '2026-07-15T09:00:00.000Z',
    });
    insertCard(database, {
      id: 'original-a-new',
      rawInput: 'shared source A',
      createdAt: '2026-07-17T09:00:00.000Z',
    });
    insertCard(database, {
      id: 'original-a-bottom',
      rawInput: 'shared source A',
      createdAt: '2026-07-20T09:00:00.000Z',
    });
    insertCard(database, {
      id: 'original-b',
      rawInput: 'separate source B',
      createdAt: '2026-07-18T09:00:00.000Z',
    });
    insertCard(database, {
      id: 'original-c-bottom',
      rawInput: 'separate source C',
      createdAt: '2026-07-19T09:00:00.000Z',
    });

    const top = await request(app)
      .patch('/api/cards/bulk')
      .send({ ids: ['original-a-old', 'original-a-new', 'original-a-bottom'], position: 'top' });
    const bottom = await request(app)
      .patch('/api/cards/bulk')
      .send({ ids: ['original-c-bottom'], position: 'bottom' });
    expect(top.body).toEqual({ updated: 3 });
    expect(bottom.body).toEqual({ updated: 1 });

    const response = await request(app).get('/api/cards').query({ contentVersion: 'original' });
    expect(response.body).toMatchObject({ total: 3 });
    expect(response.body.items.map((item: { id: string }) => item.id)).toEqual([
      'original-a-bottom',
      'original-a-new',
      'original-a-old',
      'original-b',
      'original-c-bottom',
    ]);
  });

  it('随机初始稿排除归档和空原稿，并按来源去重后返回最新代表', async () => {
    const { app, database } = setup();
    insertCard(database, {
      id: 'random-old-pinned',
      rawInput: '同一份用户初始稿',
      createdAt: '2026-07-15T09:00:00.000Z',
    });
    insertCard(database, {
      id: 'random-new-low',
      rawInput: '同一份用户初始稿',
      createdAt: '2026-07-17T09:00:00.000Z',
    });
    insertCard(database, {
      id: 'random-new-high',
      rawInput: '同一份用户初始稿',
      createdAt: '2026-07-17T09:00:00.000Z',
    });
    insertCard(database, {
      id: 'random-archived',
      rawInput: '已归档初始稿',
      archived: true,
      createdAt: '2026-07-19T09:00:00.000Z',
    });
    insertCard(database, {
      id: 'random-empty',
      rawInput: '   ',
      rawContentJson: JSON.stringify({ type: 'doc', content: [{ type: 'text', text: '空原稿' }] }),
      createdAt: '2026-07-20T09:00:00.000Z',
    });

    await request(app)
      .patch('/api/cards/bulk')
      .send({ ids: ['random-new-high'], position: 'top' });
    await request(app)
      .patch('/api/cards/bulk')
      .send({ ids: ['random-old-pinned'], position: 'top' });

    const response = await request(app).get('/api/cards/random-original');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ card: expect.objectContaining({ id: 'random-new-high' }) });
  });

  it('随机初始稿在空库返回空卡片', async () => {
    const { app } = setup();

    const response = await request(app).get('/api/cards/random-original');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ card: null });
  });

  it('随机初始稿按 ANY 筛选，一级板块包含其子板块且二级板块保持精确', async () => {
    const { app, database } = setup();
    insertCard(database, {
      id: 'random-child-only',
      rawInput: '子分类原稿',
      categoryIds: [firstCategory[1]],
    });
    insertCard(database, {
      id: 'random-unrelated',
      rawInput: '其他板块原稿',
      categoryIds: [secondCategory[1]],
    });

    const child = await request(app)
      .get('/api/cards/random-original')
      .query({ categoryIds: ['不存在分类', firstCategory[1], firstCategory[1]] });
    const parent = await request(app)
      .get('/api/cards/random-original')
      .query({ categoryIds: firstCategory[0] });

    expect(child.status).toBe(200);
    expect(child.body).toEqual({ card: expect.objectContaining({ id: 'random-child-only' }) });
    expect(parent.status).toBe(200);
    expect(parent.body).toEqual({ card: expect.objectContaining({ id: 'random-child-only' }) });
  });

  it('随机初始稿先按日期筛选，再从匹配范围内选择同源最新代表', async () => {
    const { app, database } = setup();
    insertCard(database, {
      id: 'random-same-source-in-range-old',
      rawInput: '日期范围内同源原稿',
      createdAt: '2026-07-15T00:00:00.000Z',
    });
    insertCard(database, {
      id: 'random-same-source-in-range-new',
      rawInput: '日期范围内同源原稿',
      createdAt: '2026-07-15T23:59:59.999Z',
    });
    insertCard(database, {
      id: 'random-same-source-outside',
      rawInput: '日期范围内同源原稿',
      createdAt: '2026-07-16T00:00:00.000Z',
    });
    insertCard(database, {
      id: 'random-other-date',
      rawInput: '其他日期原稿',
      createdAt: '2026-07-14T23:59:59.999Z',
    });

    const response = await request(app)
      .get('/api/cards/random-original')
      .query({ createdFrom: '2026-07-15', createdTo: '2026-07-15' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      card: expect.objectContaining({ id: 'random-same-source-in-range-new' }),
    });
  });

  it('随机初始稿范围没有匹配来源时返回空卡片', async () => {
    const { app, database } = setup();
    insertCard(database, {
      id: 'random-no-match',
      rawInput: '不在筛选范围内',
      categoryIds: [firstCategory[0]],
      createdAt: '2026-07-15T12:00:00.000Z',
    });

    const byCategory = await request(app)
      .get('/api/cards/random-original')
      .query({ categoryIds: secondCategory[1] });
    const byDate = await request(app)
      .get('/api/cards/random-original')
      .query({ createdFrom: '2026-07-16', createdTo: '2026-07-16' });

    expect(byCategory.status).toBe(200);
    expect(byCategory.body).toEqual({ card: null });
    expect(byDate.status).toBe(200);
    expect(byDate.body).toEqual({ card: null });
  });

  it('随机初始稿计数与抽取使用相同范围，并按原始来源去重', async () => {
    const { app, database } = setup();
    insertCard(database, {
      id: 'count-matched-old',
      rawInput: '同一份匹配初始稿',
      categoryIds: [firstCategory[1]],
      createdAt: '2026-07-15T08:00:00.000Z',
    });
    insertCard(database, {
      id: 'count-matched-new',
      rawInput: '同一份匹配初始稿',
      categoryIds: [firstCategory[1]],
      createdAt: '2026-07-15T09:00:00.000Z',
    });
    insertCard(database, {
      id: 'count-second-source',
      rawInput: '另一份匹配初始稿',
      categoryIds: [firstCategory[0]],
      createdAt: '2026-07-15T10:00:00.000Z',
    });
    insertCard(database, {
      id: 'count-other-category',
      rawInput: '未选板块初始稿',
      categoryIds: secondCategory,
      createdAt: '2026-07-15T10:00:00.000Z',
    });
    insertCard(database, {
      id: 'count-archived',
      rawInput: '已归档初始稿',
      categoryIds: firstCategory,
      archived: true,
      createdAt: '2026-07-15T10:00:00.000Z',
    });
    insertCard(database, {
      id: 'count-empty',
      rawInput: '   ',
      categoryIds: firstCategory,
      createdAt: '2026-07-15T10:00:00.000Z',
    });
    insertCard(database, {
      id: 'count-outside-date',
      rawInput: '日期外初始稿',
      categoryIds: firstCategory,
      createdAt: '2026-07-16T00:00:00.000Z',
    });

    const response = await request(app)
      .get('/api/cards/random-original/count')
      .query({ categoryIds: firstCategory[0], createdFrom: '2026-07-15', createdTo: '2026-07-15' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ totalAvailable: 2 });
  });

  it.each([
    ['非法日期', { createdTo: '2026-02-31' }],
    ['反向日期范围', { createdFrom: '2026-07-18', createdTo: '2026-07-17' }],
    ['重复日期标量', { createdTo: ['2026-07-17', '2026-07-18'] }],
    ['未知参数', { unexpected: 'value' }],
  ])('随机初始稿计数拒绝%s并返回安全的 400', async (_name, query) => {
    const { app } = setup();

    const response = await request(app).get('/api/cards/random-original/count').query(query);

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ code: 'invalid_request', message: expect.any(String) });
    expect(JSON.stringify(response.body)).not.toMatch(/SQL|\\\\|AAA错题/i);
  });

  it.each([
    ['非法日期', { createdFrom: '2026-02-31' }],
    ['反向日期范围', { createdFrom: '2026-07-18', createdTo: '2026-07-17' }],
    ['重复日期标量', { createdFrom: ['2026-07-17', '2026-07-18'] }],
    ['未知参数', { unexpected: 'value' }],
  ])('随机初始稿拒绝%s并返回安全的 400', async (_name, query) => {
    const { app } = setup();

    const response = await request(app).get('/api/cards/random-original').query(query);

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ code: 'invalid_request', message: expect.any(String) });
    expect(JSON.stringify(response.body)).not.toMatch(/SQL|\\\\|AAA错题/i);
  });

  it('rejects invalid position requests and rolls back a failed positioning transaction', async () => {
    const { app, database } = setup();
    insertCard(database, { id: 'position-a' });
    insertCard(database, { id: 'position-b' });
    database.db.exec(`
      CREATE TRIGGER reject_position_b
      BEFORE UPDATE OF manual_order ON cards
      WHEN NEW.id = 'position-b'
      BEGIN
        SELECT RAISE(ABORT, 'private manual order detail');
      END
    `);

    for (const body of [
      { ids: ['position-a'] },
      { ids: ['position-a'], position: 'middle' },
      { ids: ['position-a'], position: 'top', extra: true },
    ]) {
      expect((await request(app).patch('/api/cards/bulk').send(body)).status).toBe(400);
    }

    const failed = await request(app)
      .patch('/api/cards/bulk')
      .send({ ids: ['position-a', 'position-b'], position: 'top' });
    expect(failed.status).toBe(500);
    expect(JSON.stringify(failed.body)).not.toContain('private manual order detail');
    expect(
      database.db.prepare("SELECT id, manual_order FROM cards WHERE id LIKE 'position-%' ORDER BY id").all(),
    ).toEqual([
      { id: 'position-a', manual_order: 0 },
      { id: 'position-b', manual_order: 0 },
    ]);
  });

  it.each([
    [{ ids: [], archived: true }],
    [{ ids: ['a'] }],
    [{ ids: ['a'], archived: true, extra: true }],
    [{ ids: ['a'], rating: 3 }],
  ])('严格拒绝非法批量请求 %#', async (body) => {
    const { app } = setup();
    const response = await request(app).patch('/api/cards/bulk').send(body);
    expect(response.status).toBe(400);
  });

  it('拒绝空数组和归一化后为空的批量标签且不修改更新时间', async () => {
    const { app, database } = setup();
    insertCard(database, { id: 'empty-tags' });
    const before = database.db
      .prepare('SELECT updated_at FROM cards WHERE id = ?')
      .get('empty-tags');

    const empty = await request(app)
      .patch('/api/cards/bulk')
      .send({ ids: ['empty-tags'], tags: [] });
    const blank = await request(app)
      .patch('/api/cards/bulk')
      .send({ ids: ['empty-tags'], tags: [' ', '  '] });

    expect(empty.status).toBe(400);
    expect(blank.status).toBe(400);
    expect(
      database.db.prepare('SELECT updated_at FROM cards WHERE id = ?').get('empty-tags'),
    ).toEqual(before);
  });

  it('删除卡片提交后删除图片，并级联清理全部卡片关联记录', async () => {
    const { app, database, uploadsDirectory } = setup();
    const storedName = '11111111-1111-4111-8111-111111111111.png';
    const attachmentPath = path.join(uploadsDirectory, storedName);
    insertCard(database, {
      id: 'delete-me',
      tags: [{ id: 'delete-tag', name: '待删标签' }],
    });
    database.db
      .prepare(`
        INSERT INTO attachments (
          id, card_id, stored_name, original_name, mime_type, byte_size, sort_order, created_at
        ) VALUES ('delete-attachment', 'delete-me', ?, '原图.png', 'image/png', 3, 0, ?)
      `)
      .run(storedName, fixedNow.toISOString());
    database.db
      .prepare(`
        INSERT INTO quiz_items (
          id, card_id, direction, question, answer, due_at, created_at
        ) VALUES ('delete-quiz', 'delete-me', 'single', '题目', '答案', ?, ?)
      `)
      .run(fixedNow.toISOString(), fixedNow.toISOString());
    database.db
      .prepare(`
        INSERT INTO review_logs (
          id, quiz_item_id, card_id, rating, previous_due_at, next_due_at, reviewed_at
        ) VALUES ('delete-review', 'delete-quiz', 'delete-me', 'good', ?, ?, ?)
      `)
      .run(fixedNow.toISOString(), fixedNow.toISOString(), fixedNow.toISOString());
    writeFileSync(attachmentPath, Buffer.from('png'));

    const rejected = await request(app).delete('/api/cards/delete-me');

    expect(rejected.status).toBe(409);
    expect(rejected.body).toMatchObject({ code: 'invalid_state' });
    expect(JSON.stringify(rejected.body)).not.toContain(attachmentPath);
    expect(database.db.prepare('SELECT COUNT(*) AS count FROM cards').get()).toEqual({ count: 1 });
    expect(database.db.prepare('SELECT COUNT(*) AS count FROM attachments').get()).toEqual({ count: 1 });
    expect(existsSync(attachmentPath)).toBe(true);

    const archived = await request(app).patch('/api/cards/delete-me').send({ archived: true });
    expect(archived.status).toBe(200);

    const response = await request(app).delete('/api/cards/delete-me');

    expect(response.status).toBe(204);
    for (const table of [
      'cards',
      'card_categories',
      'card_tags',
      'attachments',
      'quiz_items',
      'review_logs',
    ]) {
      expect(database.db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get()).toEqual({ count: 0 });
    }
    expect(existsSync(attachmentPath)).toBe(false);
    expect((await request(app).delete('/api/cards/delete-me')).status).toBe(404);
  });
});
