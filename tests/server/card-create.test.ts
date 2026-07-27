import { afterEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import type { AiProvider } from '../../server/ai/provider';
import { createApp } from '../../server/app';
import { createCardRouter } from '../../server/cards/routes';
import { createCardService } from '../../server/cards/service';
import type {
  CreateCardInput,
  NormalizeCardInput,
  NormalizedCard,
  OriginalCardRewriteInput,
} from '../../shared/contracts';
import { createTestDatabase } from '../helpers/testDatabase';

const now = new Date('2026-07-17T10:00:00.000Z');

const baseNormalized: NormalizedCard = {
  normalized_statement: '广陵与扬州为对应关系',
  question_type: 'bidirectional',
  wrong_point: '',
  analysis: '广陵=扬州',
  mnemonic: '',
  extension: '',
  notes: '',
  tags: ['地名对应'],
  quiz_items: [
    { direction: 'forward', question: '广陵=？', answer: '扬州' },
    { direction: 'reverse', question: '扬州=？', answer: '广陵' },
  ],
};

const baseInput: CreateCardInput = {
  entryMode: 'knowledge',
  rawInput: '广陵=扬州',
  rawContentJson: null,
  wrongPoint: '',
  analysis: '',
  mnemonic: '',
  extension: '',
  notes: '',
  categoryIds: ['常识判断', '常识判断/文史'],
  userTags: [],
  template: '常识判断',
  sourceType: 'unknown',
  sourceDetail: '',
  attachments: [],
};

type TestDatabase = ReturnType<typeof createTestDatabase>;
type ProviderResult = NormalizedCard | Error;

function input(overrides: Partial<CreateCardInput> = {}): CreateCardInput {
  return {
    ...baseInput,
    categoryIds: [...baseInput.categoryIds],
    userTags: [...baseInput.userTags],
    attachments: [...baseInput.attachments],
    ...overrides,
  };
}

function normalized(overrides: Partial<NormalizedCard> = {}): NormalizedCard {
  return {
    ...baseNormalized,
    tags: [...baseNormalized.tags],
    quiz_items: baseNormalized.quiz_items.map((item) => ({ ...item })),
    ...overrides,
  };
}

function originalRewriteInput(
  overrides: Partial<OriginalCardRewriteInput> = {},
): OriginalCardRewriteInput {
  return {
    rawInput: '新的用户初始稿',
    rawContentJson: JSON.stringify({
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: '新的用户初始稿' }] }],
    }),
    wrongPoint: '新易错点',
    analysis: '新解析',
    mnemonic: '新口诀',
    extension: '新拓展',
    notes: '新笔记',
    categoryIds: ['政治理论', '政治理论/马原'],
    userTags: ['新版标签'],
    template: '政治理论',
    sourceType: '教材',
    sourceDetail: '2026 新版',
    ...overrides,
  };
}

function sequencedProvider(results: ProviderResult[], calls: NormalizeCardInput[] = []): AiProvider {
  let index = 0;
  return {
    async normalize(normalizeInput) {
      calls.push(structuredClone(normalizeInput));
      const result = results[Math.min(index, results.length - 1)];
      index += 1;
      if (result instanceof Error) throw result;
      return structuredClone(result);
    },
  };
}

function insertCard(
  database: TestDatabase,
  id: string,
  aiStatus: 'processing' | 'pending',
  updatedAt: string,
) {
  database.db
    .prepare(`
      INSERT INTO cards (
        id, entry_mode, raw_input, template, mastery, ai_status, created_at, updated_at
      ) VALUES (?, 'knowledge', ?, '常识判断', 'unseen', ?, ?, ?)
    `)
    .run(id, `原文-${id}`, aiStatus, updatedAt, updatedAt);
  database.db
    .prepare('INSERT INTO card_categories (card_id, category_id) VALUES (?, ?)')
    .run(id, '常识判断');
  database.db
    .prepare('INSERT INTO card_categories (card_id, category_id) VALUES (?, ?)')
    .run(id, '常识判断/文史');
}

describe('卡片自动整理服务', () => {
  const resources: TestDatabase[] = [];

  afterEach(() => {
    resources.splice(0).forEach((resource) => resource.dispose());
  });

  function setup(results: ProviderResult[]) {
    const database = createTestDatabase();
    resources.push(database);
    const calls: NormalizeCardInput[] = [];
    const service = createCardService({
      database: database.manager,
      aiProvider: sequencedProvider(results, calls),
      now: () => new Date(now),
    });
    return { database, service, calls };
  }

  it('提交原始卡片及关联后才调用 AI，并写入双向题面', async () => {
    const database = createTestDatabase();
    resources.push(database);
    const normalize = vi.fn(async (normalizeInput: NormalizeCardInput) => {
      expect(database.db.prepare('SELECT raw_input, template FROM cards').get()).toEqual({
        raw_input: '广陵=扬州',
        template: '常识判断',
      });
      expect(database.db.prepare('SELECT COUNT(*) AS count FROM card_categories').get()).toEqual({ count: 2 });
      expect(database.db.prepare('SELECT COUNT(*) AS count FROM card_tags').get()).toEqual({ count: 1 });
      expect(database.db.prepare('SELECT COUNT(*) AS count FROM attachments').get()).toEqual({ count: 1 });
      expect(normalizeInput).toEqual({
        entry_mode: 'knowledge',
        raw_input: '广陵=扬州',
        selected_categories: ['常识判断', '常识判断/文史'],
        template: '常识判断',
        existing_fields: {
          wrong_point: '易混地名',
          analysis: '',
          mnemonic: '',
          extension: '',
          notes: '',
        },
      });
      return normalized();
    });
    const service = createCardService({
      database: database.manager,
      aiProvider: { normalize },
      now: () => new Date(now),
    });

    const detail = await service.create(
      input({
        wrongPoint: '易混地名',
        userTags: [' 用户标签 '],
        attachments: [
          {
            id: 'attachment-1',
            storedName: 'stored-image.png',
            originalName: '原图.png',
            mimeType: 'image/png',
            byteSize: 128,
          },
        ],
      }),
    );

    expect(detail.aiStatus).toBe('ready');
    expect(detail.template).toBe('常识判断');
    expect(detail.quizItems.map(({ direction }) => direction)).toEqual(['forward', 'reverse']);
    expect(detail.quizItems.every(({ dueAt }) => dueAt === now.toISOString())).toBe(true);
    expect(
      database.db.prepare('SELECT mastery, created_at, due_at FROM quiz_items ORDER BY direction').all(),
    ).toEqual([
      { mastery: 'unseen', created_at: now.toISOString(), due_at: now.toISOString() },
      { mastery: 'unseen', created_at: now.toISOString(), due_at: now.toISOString() },
    ]);
    expect(normalize).toHaveBeenCalledTimes(1);
  });

  it('AI 调用失败时保留原文并标记为 pending 且只保存稳定错误码', async () => {
    const { database, service } = setup([new Error('SQL password=secret 原始异常')]);

    const detail = await service.create(input());
    const stored = database.db
      .prepare('SELECT raw_input, ai_status, ai_error_code FROM cards WHERE id = ?')
      .get(detail.id) as { raw_input: string; ai_status: string; ai_error_code: string };

    expect(detail.aiStatus).toBe('pending');
    expect(detail.rawInput).toBe('广陵=扬州');
    expect(detail.quizItems).toEqual([]);
    expect(stored).toEqual({ raw_input: '广陵=扬州', ai_status: 'pending', ai_error_code: 'ai_error' });
    expect(JSON.stringify(stored)).not.toContain('secret');
    expect(JSON.stringify(stored)).not.toContain('SQL');
  });

  it('AI 未配置时保留原文并保存明确的 not_configured 错误码', async () => {
    const error = Object.assign(new Error('本机未配置密钥'), { code: 'not_configured' });
    const { database, service } = setup([error]);

    const detail = await service.create(input());

    expect(detail.aiStatus).toBe('pending');
    expect(database.db.prepare('SELECT ai_error_code FROM cards WHERE id = ?').get(detail.id)).toEqual({
      ai_error_code: 'not_configured',
    });
  });

  it('AI 无安全题面时标记为 needs_input 且不写题面', async () => {
    const unstructured = normalized({
      normalized_statement: '广陵，扬州',
      question_type: 'unstructured',
      analysis: '广陵，扬州',
      quiz_items: [],
    });
    const { service } = setup([unstructured]);

    const detail = await service.create(input());

    expect(detail.aiStatus).toBe('needs_input');
    expect(detail.normalizedStatement).toBe('广陵，扬州');
    expect(detail.quizItems).toEqual([]);
  });

  it('AI 返回多个单向题面时拆成多张独立可背诵卡片', async () => {
    const multiQuestion = normalized({
      normalized_statement: '年均增长率速算表',
      question_type: 'single',
      analysis: '原文给出多个速算对应值。',
      tags: ['年均增长率', '速算表'],
      quiz_items: [
        { direction: 'single', question: '5% 对应多少？', answer: '1.215' },
        { direction: 'single', question: '10% 对应多少？', answer: '1.46' },
        { direction: 'single', question: '15% 对应多少？', answer: '1.75' },
      ],
    });
    const { database, service } = setup([multiQuestion]);

    const detail = await service.create(input({ userTags: ['资料速记'], rawInput: '5%=1.215；10%=1.46；15%=1.75' }));

    expect(detail.aiStatus).toBe('ready');
    expect(detail.quizItems).toEqual([
      expect.objectContaining({ direction: 'single', question: '5% 对应多少？', answer: '1.215' }),
    ]);
    expect(database.db.prepare('SELECT COUNT(*) AS count FROM cards').get()).toEqual({ count: 3 });
    expect(database.db.prepare('SELECT COUNT(*) AS count FROM quiz_items').get()).toEqual({ count: 3 });
    const cardTitles = (
      database.db.prepare('SELECT normalized_statement FROM cards').all() as Array<{
        normalized_statement: string;
      }>
    ).map(({ normalized_statement }) => normalized_statement);
    expect(cardTitles).toContain('5% 对应多少？');
    expect(cardTitles).toContain('10% 对应多少？');
    expect(cardTitles).toContain('15% 对应多少？');
    expect(
      database.db
        .prepare(`
          SELECT cards.id, COUNT(quiz_items.id) AS count
          FROM cards
          LEFT JOIN quiz_items ON quiz_items.card_id = cards.id
          GROUP BY cards.id
          ORDER BY cards.created_at, cards.id
        `)
        .all(),
    ).toEqual([
      expect.objectContaining({ count: 1 }),
      expect.objectContaining({ count: 1 }),
      expect.objectContaining({ count: 1 }),
    ]);
    expect(
      database.db
        .prepare(`
          SELECT quiz_items.question, quiz_items.answer
          FROM quiz_items
          ORDER BY quiz_items.answer
        `)
        .all(),
    ).toEqual([
      { question: '5% 对应多少？', answer: '1.215' },
      { question: '10% 对应多少？', answer: '1.46' },
      { question: '15% 对应多少？', answer: '1.75' },
    ]);
    expect(
      database.db
        .prepare(`
          SELECT cards.id, COUNT(card_categories.category_id) AS count
          FROM cards
          JOIN card_categories ON card_categories.card_id = cards.id
          GROUP BY cards.id
        `)
        .all(),
    ).toEqual([
      expect.objectContaining({ count: 2 }),
      expect.objectContaining({ count: 2 }),
      expect.objectContaining({ count: 2 }),
    ]);
    expect(
      database.db
        .prepare(`
          SELECT tags.name, COUNT(*) AS count
          FROM card_tags
          JOIN tags ON tags.id = card_tags.tag_id
          GROUP BY tags.name
          ORDER BY tags.name
        `)
        .all(),
    ).toEqual([
      { name: '年均增长率', count: 3 },
      { name: '资料速记', count: 3 },
      { name: '速算表', count: 3 },
    ]);
  });

  it.each([
    { initial: new Error('timeout'), expected: 'pending' },
    {
      initial: normalized({ question_type: 'unstructured', quiz_items: [] }),
      expected: 'needs_input',
    },
  ])('允许 $expected 卡片重试到 ready', async ({ initial, expected }) => {
    const { database, service } = setup([initial, normalized()]);
    const created = await service.create(input());

    expect(created.aiStatus).toBe(expected);
    const retried = await service.retryAi(created.id);

    expect(retried.aiStatus).toBe('ready');
    expect(retried.quizItems).toHaveLength(2);
    expect(
      database.db.prepare('SELECT ai_attempt_count FROM cards WHERE id = ?').get(created.id),
    ).toEqual({ ai_attempt_count: 2 });
  });

  it('拒绝重试 ready 卡片并区分不存在卡片', async () => {
    const { service } = setup([normalized()]);
    const ready = await service.create(input());

    await expect(service.retryAi(ready.id)).rejects.toMatchObject({ code: 'invalid_state' });
    await expect(service.retryAi('missing-card')).rejects.toMatchObject({ code: 'not_found' });
  });

  it('事务 A 失败时不留下卡片、分类、标签或附件', async () => {
    const database = createTestDatabase();
    resources.push(database);
    database.db.exec(`
      CREATE TRIGGER fail_attachment BEFORE INSERT ON attachments
      BEGIN
        SELECT RAISE(ABORT, '事务 A 敏感故障');
      END
    `);
    const normalize = vi.fn(async () => normalized());
    const service = createCardService({
      database: database.manager,
      aiProvider: { normalize },
      now: () => new Date(now),
    });

    await expect(
      service.create(
        input({
          userTags: ['用户标签'],
          attachments: [
            {
              id: 'attachment-failure',
              storedName: 'failure.png',
              originalName: '故障.png',
              mimeType: 'image/png',
              byteSize: 64,
            },
          ],
        }),
      ),
    ).rejects.toThrow();

    for (const table of ['cards', 'card_categories', 'card_tags', 'tags', 'attachments']) {
      expect(database.db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get()).toEqual({ count: 0 });
    }
    expect(normalize).not.toHaveBeenCalled();
  });

  it('事务 B 半写失败时回滚 AI 字段、标签和题面并补偿为 pending', async () => {
    const { database, service } = setup([normalized()]);
    database.db.exec(`
      CREATE TRIGGER fail_reverse BEFORE INSERT ON quiz_items
      WHEN NEW.direction = 'reverse'
      BEGIN
        SELECT RAISE(ABORT, '事务 B 敏感故障');
      END
    `);

    const detail = await service.create(input());

    expect(detail.aiStatus).toBe('pending');
    expect(detail.normalizedStatement).toBe('');
    expect(detail.quizItems).toEqual([]);
    expect(database.db.prepare("SELECT COUNT(*) AS count FROM card_tags WHERE origin = 'ai'").get()).toEqual({
      count: 0,
    });
    expect(database.db.prepare('SELECT ai_error_code FROM cards WHERE id = ?').get(detail.id)).toEqual({
      ai_error_code: 'storage_error',
    });
  });

  it('空 AI 字段不清空用户内容，重试时保留用户标签并替换 AI 标签', async () => {
    const calls: NormalizeCardInput[] = [];
    const first = normalized({
      wrong_point: '',
      analysis: '',
      mnemonic: '',
      extension: '',
      notes: '',
      tags: ['共同标签', '旧 AI'],
    });
    const second = normalized({
      wrong_point: '',
      analysis: '',
      mnemonic: '',
      extension: '',
      notes: '',
      tags: ['共同标签', '新 AI'],
    });
    const database = createTestDatabase();
    resources.push(database);
    const service = createCardService({
      database: database.manager,
      aiProvider: sequencedProvider([first, second], calls),
      now: () => new Date(now),
    });
    const createInput = input({
      wrongPoint: '用户错误点',
      analysis: '用户解析',
      mnemonic: '用户口诀',
      extension: '用户拓展',
      notes: '用户笔记',
      userTags: [' 共同标签 ', '用户标签', '用户标签', ' '],
      template: '资料分析',
    });

    const created = await service.create(createInput);
    database.db.prepare("UPDATE cards SET ai_status = 'pending' WHERE id = ?").run(created.id);
    const retried = await service.retryAi(created.id);

    expect(retried).toMatchObject({
      wrongPoint: '用户错误点',
      analysis: '用户解析',
      mnemonic: '用户口诀',
      extension: '用户拓展',
      notes: '用户笔记',
      template: '资料分析',
    });
    expect(Object.fromEntries(retried.tags.map((tag) => [tag.name, tag.origin]))).toEqual({
      共同标签: 'user',
      用户标签: 'user',
      '新 AI': 'ai',
    });
    expect(calls).toHaveLength(2);
    expect(calls[0]).toEqual({
      entry_mode: 'knowledge',
      raw_input: '广陵=扬州',
      selected_categories: ['常识判断', '常识判断/文史'],
      template: '资料分析',
      existing_fields: {
        wrong_point: '用户错误点',
        analysis: '用户解析',
        mnemonic: '用户口诀',
        extension: '用户拓展',
        notes: '用户笔记',
      },
    });
    expect(calls[1]).toEqual(calls[0]);
  });

  it('仅回收超过或等于五分钟的 processing 卡片', () => {
    const { database, service } = setup([normalized()]);
    insertCard(database, 'stale-card', 'processing', '2026-07-17T09:55:00.000Z');
    insertCard(database, 'fresh-card', 'processing', '2026-07-17T09:55:00.001Z');

    expect(service.recoverStaleProcessing(now)).toBe(1);
    expect(database.db.prepare('SELECT id, ai_status FROM cards ORDER BY id').all()).toEqual([
      { id: 'fresh-card', ai_status: 'processing' },
      { id: 'stale-card', ai_status: 'pending' },
    ]);
  });

  it('批量重试最多处理二十张并在单张失败后继续', async () => {
    const database = createTestDatabase();
    resources.push(database);
    for (let index = 1; index <= 22; index += 1) {
      insertCard(database, `batch-${String(index).padStart(2, '0')}`, 'pending', now.toISOString());
    }
    let calls = 0;
    const aiProvider: AiProvider = {
      async normalize() {
        calls += 1;
        if (calls === 1) throw new Error('首张失败');
        return normalized();
      },
    };
    const service = createCardService({
      database: database.manager,
      aiProvider,
      now: () => new Date(now),
    });

    const result = await service.retryPendingBatch(20);

    expect(result).toEqual({ attempted: 20, ready: 19, stillPending: 1 });
    expect(calls).toBe(20);
    expect(database.db.prepare("SELECT ai_status FROM cards WHERE id = 'batch-02'").get()).toEqual({
      ai_status: 'ready',
    });
    expect(database.db.prepare("SELECT COUNT(*) AS count FROM cards WHERE ai_status = 'pending'").get()).toEqual({
      count: 3,
    });
  });

  it('解构 retryPendingBatch 后仍执行实际重试', async () => {
    const { database, service } = setup([normalized()]);
    insertCard(database, 'detached-1', 'pending', now.toISOString());
    insertCard(database, 'detached-2', 'pending', now.toISOString());
    const { retryPendingBatch } = service;

    const result = await retryPendingBatch(2);

    expect(result).toEqual({ attempted: 2, ready: 2, stillPending: 0 });
    expect(database.db.prepare("SELECT COUNT(*) AS count FROM cards WHERE ai_status = 'ready'").get()).toEqual({
      count: 2,
    });
  });
});

describe('卡片创建与重试接口', () => {
  const resources: TestDatabase[] = [];

  afterEach(() => {
    resources.splice(0).forEach((resource) => resource.dispose());
  });

  function setup(results: ProviderResult[]) {
    const database = createTestDatabase();
    resources.push(database);
    const service = createCardService({
      database: database.manager,
      aiProvider: sequencedProvider(results),
      now: () => new Date(now),
    });
    return { database, service, app: createApp({ cardService: service }) };
  }

  it('通过接口创建 pending 卡片并重试到 ready', async () => {
    const { app } = setup([new Error('暂时失败'), normalized()]);

    const created = await request(app).post('/api/cards').send(input());
    const retried = await request(app).post(`/api/cards/${created.body.id}/retry-ai`).send({});

    expect(created.status).toBe(201);
    expect(created.body.aiStatus).toBe('pending');
    expect(retried.status).toBe(200);
    expect(retried.body.aiStatus).toBe('ready');
    expect(retried.body.quizItems).toHaveLength(2);
  });

  it('编辑用户初始稿后用新问题整组替换旧衍生卡片', async () => {
    const oldQuestions = normalized({
      normalized_statement: '旧初始稿',
      question_type: 'single',
      tags: ['旧AI标签'],
      quiz_items: [
        { direction: 'single', question: '旧问题一？', answer: '旧答案一' },
        { direction: 'single', question: '旧问题二？', answer: '旧答案二' },
        { direction: 'single', question: '旧问题三？', answer: '旧答案三' },
      ],
    });
    const newQuestions = normalized({
      normalized_statement: '新初始稿',
      question_type: 'single',
      wrong_point: '',
      analysis: '',
      mnemonic: '',
      extension: '',
      notes: '',
      tags: ['新AI标签'],
      quiz_items: [
        { direction: 'single', question: '新问题一？', answer: '新答案一' },
        { direction: 'single', question: '新问题二？', answer: '新答案二' },
      ],
    });
    const { app, database, service } = setup([oldQuestions, newQuestions]);
    const created = await service.create(input({
      rawInput: '旧的用户初始稿',
      userTags: ['旧版标签'],
      attachments: [{
        id: 'attachment-original-rewrite',
        storedName: 'original-rewrite.png',
        originalName: '初始稿图片.png',
        mimeType: 'image/png',
        byteSize: 128,
      }],
    }));
    expect(database.db.prepare('SELECT COUNT(*) AS count FROM cards').get()).toEqual({ count: 3 });
    database.db.prepare('UPDATE cards SET manual_order = -27 WHERE raw_input = ?').run('旧的用户初始稿');

    const rewriteBody = originalRewriteInput();
    const response = await request(app)
      .put(`/api/cards/${created.id}/original`)
      .send(rewriteBody);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      derivedCount: 2,
      card: {
        id: created.id,
        rawInput: rewriteBody.rawInput,
        rawContentJson: rewriteBody.rawContentJson,
        wrongPoint: rewriteBody.wrongPoint,
        analysis: rewriteBody.analysis,
        mnemonic: rewriteBody.mnemonic,
        extension: rewriteBody.extension,
        notes: rewriteBody.notes,
        template: rewriteBody.template,
        sourceType: rewriteBody.sourceType,
        sourceDetail: rewriteBody.sourceDetail,
        aiStatus: 'ready',
      },
    });
    expect(database.db.prepare('SELECT COUNT(*) AS count FROM cards').get()).toEqual({ count: 2 });
    expect(database.db.prepare('SELECT COUNT(*) AS count FROM quiz_items').get()).toEqual({ count: 2 });
    expect(database.db.prepare('SELECT manual_order FROM cards ORDER BY id').all()).toEqual([
      { manual_order: -27 },
      { manual_order: -27 },
    ]);
    expect(
      database.db.prepare('SELECT DISTINCT raw_input FROM cards').all(),
    ).toEqual([{ raw_input: rewriteBody.rawInput }]);
    expect(
      database.db.prepare('SELECT question, answer FROM quiz_items ORDER BY question').all(),
    ).toEqual([
      { question: '新问题一？', answer: '新答案一' },
      { question: '新问题二？', answer: '新答案二' },
    ]);
    expect(
      database.db.prepare(`
        SELECT category_id, COUNT(*) AS count
        FROM card_categories
        GROUP BY category_id
        ORDER BY category_id
      `).all(),
    ).toEqual([
      { category_id: '政治理论', count: 2 },
      { category_id: '政治理论/马原', count: 2 },
    ]);
    expect(
      database.db.prepare(`
        SELECT tags.name, card_tags.origin, COUNT(*) AS count
        FROM card_tags
        JOIN tags ON tags.id = card_tags.tag_id
        GROUP BY tags.name, card_tags.origin
        ORDER BY tags.name
      `).all(),
    ).toEqual([
      { name: '新AI标签', origin: 'ai', count: 2 },
      { name: '新版标签', origin: 'user', count: 2 },
    ]);
    expect(
      database.db.prepare('SELECT card_id, stored_name FROM attachments').all(),
    ).toEqual([{ card_id: created.id, stored_name: 'original-rewrite.png' }]);
  });

  it('重写未归档初始稿时不被同原文已归档卡片阻断或计入衍生数', async () => {
    const oldQuestions = normalized({
      question_type: 'single',
      quiz_items: [
        { direction: 'single', question: '未归档旧问题一？', answer: '旧答案一' },
        { direction: 'single', question: '未归档旧问题二？', answer: '旧答案二' },
      ],
    });
    const archivedQuestion = normalized({
      normalized_statement: '已归档同文卡片',
      question_type: 'single',
      quiz_items: [{ direction: 'single', question: '已归档问题？', answer: '已归档答案' }],
    });
    const newQuestions = normalized({
      question_type: 'single',
      quiz_items: [
        { direction: 'single', question: '新问题一？', answer: '新答案一' },
        { direction: 'single', question: '新问题二？', answer: '新答案二' },
      ],
    });
    const { app, database, service } = setup([oldQuestions, archivedQuestion, newQuestions]);
    const sameRawInput = '未归档与已归档都使用的初始稿';
    const active = await service.create(input({ rawInput: sameRawInput }));
    const archived = await service.create(input({ rawInput: sameRawInput }));
    database.db.prepare('UPDATE cards SET archived = 1 WHERE id = ?').run(archived.id);

    const response = await request(app)
      .put(`/api/cards/${active.id}/original`)
      .send(originalRewriteInput());

    expect(response.status).toBe(200);
    expect(response.body.derivedCount).toBe(2);
    expect(
      database.db.prepare('SELECT id, archived, raw_input FROM cards ORDER BY archived, id').all(),
    ).toEqual(expect.arrayContaining([
      expect.objectContaining({ archived: 0, raw_input: '新的用户初始稿' }),
      expect.objectContaining({ archived: 0, raw_input: '新的用户初始稿' }),
      { id: archived.id, archived: 1, raw_input: sameRawInput },
    ]));
    expect(database.db.prepare('SELECT COUNT(*) AS count FROM cards').get()).toEqual({ count: 3 });
    expect(
      database.db.prepare('SELECT normalized_statement FROM cards WHERE id = ?').get(archived.id),
    ).toEqual({ normalized_statement: '已归档同文卡片' });
  });

  it('用户初始稿重新衍生失败时保留一张已更新的 pending 卡片', async () => {
    const oldQuestions = normalized({
      question_type: 'single',
      quiz_items: [
        { direction: 'single', question: '旧问题一？', answer: '旧答案一' },
        { direction: 'single', question: '旧问题二？', answer: '旧答案二' },
      ],
    });
    const { app, database, service } = setup([oldQuestions, new Error('临时不可用')]);
    const created = await service.create(input({ rawInput: '旧的用户初始稿' }));

    const rewriteBody = originalRewriteInput({ rawInput: '失败时也要保留的新初始稿' });
    const response = await request(app)
      .put(`/api/cards/${created.id}/original`)
      .send(rewriteBody);

    expect(response.status).toBe(200);
    expect(response.body.card).toMatchObject({
      id: created.id,
      rawInput: rewriteBody.rawInput,
      aiStatus: 'pending',
      quizItems: [],
    });
    expect(database.db.prepare('SELECT COUNT(*) AS count FROM cards').get()).toEqual({ count: 1 });
    expect(database.db.prepare('SELECT COUNT(*) AS count FROM quiz_items').get()).toEqual({ count: 0 });
    expect(
      database.db.prepare('SELECT raw_input, ai_status FROM cards').get(),
    ).toEqual({ raw_input: rewriteBody.rawInput, ai_status: 'pending' });
  });

  it('通过接口手动修正已整理题面和答案且保留复习调度字段', async () => {
    const { app, database } = setup([normalized()]);
    const created = await request(app).post('/api/cards').send(input());
    const firstQuizItem = created.body.quizItems[0];
    const before = database.db
      .prepare('SELECT due_at, mastery, stability, reps FROM quiz_items WHERE id = ?')
      .get(firstQuizItem.id);

    const updated = await request(app)
      .patch(`/api/cards/${created.body.id}`)
      .send({
        quizItems: [
          {
            id: firstQuizItem.id,
            question: '广陵现在对应哪座城市？',
            answer: '扬州',
          },
        ],
      });

    expect(updated.status).toBe(200);
    expect(updated.body.quizItems[0]).toMatchObject({
      id: firstQuizItem.id,
      question: '广陵现在对应哪座城市？',
      answer: '扬州',
    });
    expect(
      database.db
        .prepare('SELECT question, answer FROM quiz_items WHERE id = ?')
        .get(firstQuizItem.id),
    ).toEqual({ question: '广陵现在对应哪座城市？', answer: '扬州' });
    expect(
      database.db
        .prepare('SELECT due_at, mastery, stability, reps FROM quiz_items WHERE id = ?')
        .get(firstQuizItem.id),
    ).toEqual(before);
  });

  it.each([
    ['空题目', (id: string) => ({ quizItems: [{ id, question: '   ', answer: '扬州' }] })],
    ['空答案', (id: string) => ({ quizItems: [{ id, question: '广陵对应哪里？', answer: '   ' }] })],
    ['重复题面编号', (id: string) => ({ quizItems: [
      { id, question: '题目一', answer: '答案一' },
      { id, question: '题目二', answer: '答案二' },
    ] })],
    ['不存在题面编号', () => ({ quizItems: [{ id: 'missing-quiz', question: '题目', answer: '答案' }] })],
    ['额外题面字段', (id: string) => ({ quizItems: [{ id, question: '题目', answer: '答案', dueAt: now.toISOString() }] })],
  ])('拒绝手动修正题面时的%s', async (_name, bodyFactory) => {
    const { app } = setup([normalized()]);
    const created = await request(app).post('/api/cards').send(input());
    const firstQuizItem = created.body.quizItems[0];

    const response = await request(app).patch(`/api/cards/${created.body.id}`).send(bodyFactory(firstQuizItem.id));

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ code: 'invalid_request', message: '请求参数不合法' });
  });

  it('正在整理中的卡片拒绝手动修正题面', async () => {
    const { app, database } = setup([normalized()]);
    const created = await request(app).post('/api/cards').send(input());
    const firstQuizItem = created.body.quizItems[0];
    database.db.prepare("UPDATE cards SET ai_status = 'processing' WHERE id = ?").run(created.body.id);

    const response = await request(app)
      .patch(`/api/cards/${created.body.id}`)
      .send({
        quizItems: [
          { id: firstQuizItem.id, question: '人工题目', answer: '人工答案' },
        ],
      });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ code: 'processing_conflict', message: '卡片正在整理，请稍后再编辑相关内容' });
    expect(
      database.db
        .prepare('SELECT question, answer FROM quiz_items WHERE id = ?')
        .get(firstQuizItem.id),
    ).toEqual({ question: firstQuizItem.question, answer: firstQuizItem.answer });
  });

  it.each([
    ['未知字段', { ...input(), unexpected: true }],
    ['空原文', { ...input(), rawInput: '   ' }],
    ['分类不存在', { ...input(), categoryIds: ['常识判断', '不存在/考点'] }],
    ['缺少一级分类', { ...input(), categoryIds: ['常识判断/文史'] }],
    ['缺少二级考点', { ...input(), categoryIds: ['常识判断'] }],
    ['错误录入模式', { ...input(), entryMode: 'other' }],
    ['废弃星级字段', { ...input(), rating: 3 }],
    ['废弃掌握度字段', { ...input(), initialMastery: 'unseen' }],
    [
      'HTTP 请求携带附件元数据',
      {
        ...input(),
        attachments: [
          {
            id: 'not-verified',
            storedName: 'not-verified.png',
            originalName: '未验证.png',
            mimeType: 'image/png',
            byteSize: 1,
          },
        ],
      },
    ],
  ])('拒绝%s', async (_name, body) => {
    const { app } = setup([normalized()]);

    const response = await request(app).post('/api/cards').send(body);

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ code: 'invalid_request', message: '请求参数不合法' });
  });

  it('对不存在、非法状态和额外重试请求体返回稳定错误', async () => {
    const { app } = setup([normalized(), new Error('等待重试')]);
    const ready = await request(app).post('/api/cards').send(input());
    const invalidState = await request(app).post(`/api/cards/${ready.body.id}/retry-ai`).send({});
    const notFound = await request(app).post('/api/cards/missing/retry-ai').send({});

    const pendingSetup = setup([new Error('等待重试')]);
    const pending = await request(pendingSetup.app).post('/api/cards').send(input());
    const extraBody = await request(pendingSetup.app)
      .post(`/api/cards/${pending.body.id}/retry-ai`)
      .send({ unexpected: true });

    expect(invalidState.status).toBe(409);
    expect(invalidState.body).toEqual({ code: 'invalid_state', message: '当前卡片状态不允许此操作' });
    expect(notFound.status).toBe(404);
    expect(notFound.body).toEqual({ code: 'not_found', message: '卡片不存在' });
    expect(extraBody.status).toBe(400);
    expect(extraBody.body).toEqual({ code: 'invalid_request', message: '请求参数不合法' });
  });

  it('重试接口拒绝显式 JSON null 请求体', async () => {
    const { database, service } = setup([new Error('等待重试'), normalized()]);
    const pending = await service.create(input());
    const app = express();
    app.use(express.json({ strict: false }));
    app.use('/api/cards', createCardRouter(service));

    const response = await request(app)
      .post(`/api/cards/${pending.id}/retry-ai`)
      .set('Content-Type', 'application/json')
      .send('null');

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ code: 'invalid_request', message: '请求参数不合法' });
    expect(database.db.prepare('SELECT ai_attempt_count FROM cards WHERE id = ?').get(pending.id)).toEqual({
      ai_attempt_count: 1,
    });
  });

  it('内部数据库错误不向 HTTP 响应泄露异常或 SQL', async () => {
    const { database, app } = setup([normalized()]);
    database.db.exec(`
      CREATE TRIGGER fail_route_category BEFORE INSERT ON card_categories
      BEGIN
        SELECT RAISE(ABORT, 'secret SQL details');
      END
    `);

    const response = await request(app).post('/api/cards').send(input());

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ code: 'internal_error', message: '请求处理失败' });
    expect(JSON.stringify(response.body)).not.toMatch(/secret|SQL/i);
  });
});
