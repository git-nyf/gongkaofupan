import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import Database from 'better-sqlite3';
import request from 'supertest';
import { createApp } from '../../server/app';
import type { AiProvider } from '../../server/ai/provider';
import { createCardService } from '../../server/cards/service';
import { migrate } from '../../server/db/migrations';
import { createTestDatabase } from '../helpers/testDatabase';

const initialTime = new Date('2026-07-26T08:00:00.000Z');
const unusedAiProvider: AiProvider = {
  async normalize() {
    throw new Error('本测试不应调用 AI');
  },
};

type TestDatabase = ReturnType<typeof createTestDatabase>;

describe('卡片库用户初始稿文件夹', () => {
  const resources: TestDatabase[] = [];

  afterEach(() => {
    resources.splice(0).forEach((resource) => resource.dispose());
  });

  function setup(aiProvider: AiProvider = unusedAiProvider) {
    const database = createTestDatabase();
    resources.push(database);
    let currentTime = new Date(initialTime);
    const service = createCardService({
      database: database.manager,
      aiProvider,
      now: () => new Date(currentTime),
    });
    return {
      database,
      service,
      app: createApp({ cardService: service }),
      setTime(value: string) {
        currentTime = new Date(value);
      },
    };
  }

  function insertCard(
    database: TestDatabase,
    {
      id,
      rawInput,
      rawContentJson = null,
      manualOrder = 0,
      createdAt = initialTime.toISOString(),
    }: {
      id: string;
      rawInput: string;
      rawContentJson?: string | null;
      manualOrder?: number;
      createdAt?: string;
    },
  ) {
    database.db
      .prepare(`
        INSERT INTO cards (
          id, entry_mode, raw_input, raw_content_json, manual_order,
          normalized_statement, ai_status, created_at, updated_at
        ) VALUES (?, 'knowledge', ?, ?, ?, ?, 'ready', ?, ?)
      `)
      .run(id, rawInput, rawContentJson, manualOrder, `题面-${id}`, createdAt, createdAt);
  }

  it('从版本 4 追加迁移两张文件夹表并保留旧卡片', () => {
    const database = new Database(':memory:');
    try {
      database.pragma('foreign_keys = ON');
      for (const migration of [
        '001_initial.sql',
        '002_card_template.sql',
        '003_distinct_split_card_titles.sql',
        '004_card_manual_order.sql',
      ]) {
        database.exec(
          readFileSync(resolve(process.cwd(), 'server', 'db', 'migrations', migration), 'utf8'),
        );
      }
      for (const version of [1, 2, 3, 4]) {
        database
          .prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)')
          .run(version, initialTime.toISOString());
      }
      database
        .prepare(`
          INSERT INTO cards (id, entry_mode, raw_input, ai_status, created_at, updated_at)
          VALUES ('legacy-card', 'knowledge', '迁移前原文', 'ready', ?, ?)
        `)
        .run(initialTime.toISOString(), initialTime.toISOString());

      migrate(database);
      migrate(database);

      expect(database.prepare('SELECT version FROM schema_migrations ORDER BY version').all()).toEqual([
        { version: 1 },
        { version: 2 },
        { version: 3 },
        { version: 4 },
        { version: 5 },
      ]);
      expect(
        database
          .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'card_folder%' ORDER BY name")
          .all(),
      ).toEqual([{ name: 'card_folder_items' }, { name: 'card_folders' }]);
      expect(database.prepare("SELECT raw_input FROM cards WHERE id = 'legacy-card'").get()).toEqual({
        raw_input: '迁移前原文',
      });
      expect(database.prepare("SELECT COUNT(*) AS count FROM pragma_foreign_key_list('card_folder_items') WHERE on_delete = 'CASCADE'").get()).toEqual({
        count: 2,
      });
      expect(
        database
          .prepare("SELECT name FROM pragma_index_info('idx_card_folder_items_card_id') ORDER BY seqno")
          .all(),
      ).toEqual([{ name: 'card_id' }]);
    } finally {
      database.close();
    }
  });

  it('创建时裁剪名称并在列表中返回空文件夹概要', async () => {
    const { app } = setup();

    const created = await request(app).post('/api/cards/folders').send({ name: '  高频常识  ' });
    const listed = await request(app).get('/api/cards/folders');

    expect(created.status).toBe(201);
    expect(created.body).toEqual({
      id: expect.any(String),
      name: '高频常识',
      originalCount: 0,
      cardIds: [],
      createdAt: initialTime.toISOString(),
      updatedAt: initialTime.toISOString(),
    });
    expect(listed.status).toBe(200);
    expect(listed.body).toEqual([created.body]);
  });

  it.each([
    ['空名称', { name: '   ' }],
    ['超长名称', { name: '文'.repeat(41) }],
    ['未知字段', { name: '合法名称', unexpected: true }],
  ])('拒绝%s', async (_name, body) => {
    const { app } = setup();

    const response = await request(app).post('/api/cards/folders').send(body);

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ code: 'invalid_request', message: '请求参数不合法' });
  });

  it('文件夹名称大小写不敏感且同名返回冲突', async () => {
    const { app } = setup();
    await request(app).post('/api/cards/folders').send({ name: 'Current Affairs' });

    const response = await request(app).post('/api/cards/folders').send({ name: 'current affairs' });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ code: 'folder_name_conflict', message: '文件夹名称已存在' });
  });

  it('加入前去重并按初始稿来源计数且重复加入保持幂等', async () => {
    const { app, database, setTime } = setup();
    insertCard(database, { id: 'source-a-1', rawInput: '同一份初始稿', manualOrder: 10 });
    insertCard(database, { id: 'source-a-2', rawInput: '同一份初始稿', manualOrder: 10 });
    insertCard(database, { id: 'source-b-1', rawInput: '另一份初始稿', manualOrder: 20 });
    const folder = await request(app).post('/api/cards/folders').send({ name: '冲刺' });
    setTime('2026-07-26T09:00:00.000Z');

    const first = await request(app)
      .post(`/api/cards/folders/${folder.body.id}/cards`)
      .send({ cardIds: ['source-a-1', 'source-a-1', 'source-a-2'] });
    const countAfterFirst = database.db
      .prepare('SELECT COUNT(*) AS count FROM card_folder_items')
      .get();
    setTime('2026-07-26T10:00:00.000Z');
    const second = await request(app)
      .post(`/api/cards/folders/${folder.body.id}/cards`)
      .send({ cardIds: ['source-a-1', 'source-a-2'] });

    expect(first.status).toBe(200);
    expect(first.body).toMatchObject({
      originalCount: 1,
      cardIds: ['source-a-1', 'source-a-2'],
      updatedAt: '2026-07-26T09:00:00.000Z',
    });
    expect(second.status).toBe(200);
    expect(second.body).toMatchObject({
      originalCount: 1,
      cardIds: ['source-a-1', 'source-a-2'],
      updatedAt: '2026-07-26T09:00:00.000Z',
    });
    expect(database.db.prepare('SELECT COUNT(*) AS count FROM card_folder_items').get()).toEqual(
      countAfterFirst,
    );
    expect(database.db.prepare('SELECT folder_id, card_id FROM card_folder_items ORDER BY card_id').all()).toEqual([
      { folder_id: folder.body.id, card_id: 'source-a-1' },
      { folder_id: folder.body.id, card_id: 'source-a-2' },
    ]);
  });

  it('文件夹概要只返回直接关联的稳定卡片编号并按加入时间确定性排序', async () => {
    const { app, database, setTime } = setup();
    insertCard(database, { id: 'source-a-1', rawInput: '同一份初始稿' });
    insertCard(database, { id: 'source-a-2', rawInput: '同一份初始稿' });
    insertCard(database, { id: 'source-a-unlinked', rawInput: '同一份初始稿' });
    insertCard(database, { id: 'source-b-1', rawInput: '另一份初始稿' });
    const folder = await request(app).post('/api/cards/folders').send({ name: '编号排序' });

    setTime('2026-07-26T09:00:00.000Z');
    await request(app)
      .post(`/api/cards/folders/${folder.body.id}/cards`)
      .send({ cardIds: ['source-a-2', 'source-a-1'] });
    setTime('2026-07-26T10:00:00.000Z');
    const added = await request(app)
      .post(`/api/cards/folders/${folder.body.id}/cards`)
      .send({ cardIds: ['source-b-1'] });
    const listed = await request(app).get('/api/cards/folders');
    const contents = await request(app).get(`/api/cards/folders/${folder.body.id}/cards`);

    const expectedCardIds = ['source-a-1', 'source-a-2', 'source-b-1'];
    expect(added.body.cardIds).toEqual(expectedCardIds);
    expect(listed.body[0].cardIds).toEqual(expectedCardIds);
    expect(contents.body.folder.cardIds).toEqual(expectedCardIds);

    database.db.prepare("DELETE FROM cards WHERE id = 'source-a-2'").run();
    const listedAfterCardDeletion = await request(app).get('/api/cards/folders');
    expect(listedAfterCardDeletion.body[0].cardIds).toEqual(['source-a-1', 'source-b-1']);
  });

  it('真实重写初始稿后从保留锚点展开最新衍生卡', async () => {
    const aiProvider: AiProvider = {
      async normalize() {
        return {
          normalized_statement: '重写后的初始稿',
          question_type: 'single',
          wrong_point: '',
          analysis: '',
          mnemonic: '',
          extension: '',
          notes: '',
          tags: [],
          quiz_items: [
            { direction: 'single', question: '新问题一？', answer: '新答案一' },
            { direction: 'single', question: '新问题二？', answer: '新答案二' },
          ],
        };
      },
    };
    const { app, database } = setup(aiProvider);
    insertCard(database, { id: 'old-anchor', rawInput: '旧初始稿', manualOrder: 1 });
    insertCard(database, { id: 'old-derived', rawInput: '旧初始稿', manualOrder: 1 });
    const folder = await request(app).post('/api/cards/folders').send({ name: '动态展开' });
    await request(app)
      .post(`/api/cards/folders/${folder.body.id}/cards`)
      .send({ cardIds: ['old-anchor', 'old-derived'] });

    const rewrite = await request(app)
      .put('/api/cards/old-anchor/original')
      .send({
        rawInput: '重写后的初始稿',
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
      });

    const contents = await request(app).get(`/api/cards/folders/${folder.body.id}/cards`);

    expect(rewrite.status).toBe(200);
    expect(rewrite.body.derivedCount).toBe(2);
    expect(contents.status).toBe(200);
    expect(contents.body.folder).toMatchObject({ id: folder.body.id, originalCount: 1 });
    expect(contents.body.cards).toHaveLength(2);
    expect(contents.body.cards.map((card: { id: string }) => card.id)).toContain('old-anchor');
    expect(contents.body.cards.map((card: { id: string }) => card.id)).not.toContain('old-derived');
    expect(contents.body.cards.every((card: { rawInput: string }) => card.rawInput === '重写后的初始稿')).toBe(true);
    expect(contents.body.cards.find((card: { id: string }) => card.id === 'old-anchor').quizItems[0].question).toBe(
      '新问题一？',
    );
    const newDerived = contents.body.cards.find((card: { id: string }) => card.id !== 'old-anchor');
    expect(newDerived).toMatchObject({
      rawInput: '重写后的初始稿',
      quizItems: [{ question: '新问题二？', answer: '新答案二' }],
    });
    expect(database.db.prepare('SELECT card_id FROM card_folder_items').all()).toEqual([
      { card_id: 'old-anchor' },
    ]);
  });

  it('批量读取多卡详情时使用固定数量查询并完整组装关联数据', () => {
    const { database, service } = setup();
    const cardIds = Array.from({ length: 5 }, (_, index) => `batch-detail-${index}`);
    cardIds.forEach((id, index) => {
      insertCard(database, { id, rawInput: `批量来源-${index}`, manualOrder: index });
    });
    database.db
      .prepare('INSERT INTO card_categories (card_id, category_id) VALUES (?, ?)')
      .run('batch-detail-0', '常识判断');
    database.db.prepare('INSERT INTO tags (id, name) VALUES (?, ?)').run('batch-tag', '批量标签');
    database.db
      .prepare("INSERT INTO card_tags (card_id, tag_id, origin) VALUES (?, ?, 'user')")
      .run('batch-detail-0', 'batch-tag');
    database.db
      .prepare(`
        INSERT INTO attachments (
          id, card_id, stored_name, original_name, mime_type, byte_size, sort_order, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, 0, ?)
      `)
      .run(
        'batch-attachment',
        'batch-detail-0',
        'batch-detail.png',
        '批量详情.png',
        'image/png',
        128,
        initialTime.toISOString(),
      );
    database.db
      .prepare(`
        INSERT INTO quiz_items (
          id, card_id, direction, question, answer, due_at, created_at
        ) VALUES (?, ?, 'single', ?, ?, ?, ?)
      `)
      .run(
        'batch-quiz',
        'batch-detail-0',
        '批量问题？',
        '批量答案',
        initialTime.toISOString(),
        initialTime.toISOString(),
      );
    const folder = service.createFolder('批量详情');
    service.addCardsToFolder(folder.id, cardIds);
    const prepareSpy = vi.spyOn(database.db, 'prepare');

    const contents = service.getFolderContents(folder.id);

    expect(prepareSpy).toHaveBeenCalledTimes(7);
    prepareSpy.mockRestore();
    expect(contents.cards.map(({ id }) => id)).toEqual([...cardIds].reverse());
    expect(contents.folder.originalCount).toBe(5);
    expect(contents.cards.find(({ id }) => id === 'batch-detail-0')).toMatchObject({
      categories: [{ id: '常识判断', name: '常识判断', parentId: null }],
      tags: [{ id: 'batch-tag', name: '批量标签', origin: 'user' }],
      attachments: [{
        id: 'batch-attachment',
        url: '/uploads/batch-detail.png',
        originalName: '批量详情.png',
        mimeType: 'image/png',
        byteSize: 128,
      }],
      quizItems: [{
        id: 'batch-quiz',
        direction: 'single',
        question: '批量问题？',
        answer: '批量答案',
        dueAt: initialTime.toISOString(),
      }],
    });
  });

  it('多个来源按各组首卡排序并保持同来源衍生卡连续', async () => {
    const { app, database } = setup();
    insertCard(database, { id: 'group-a-high', rawInput: '来源 A', manualOrder: 10 });
    insertCard(database, { id: 'group-a-low', rawInput: '来源 A', manualOrder: 1 });
    insertCard(database, { id: 'group-b', rawInput: '来源 B', manualOrder: 9 });
    const folder = await request(app).post('/api/cards/folders').send({ name: '分组排序' });
    await request(app)
      .post(`/api/cards/folders/${folder.body.id}/cards`)
      .send({ cardIds: ['group-a-high', 'group-a-low', 'group-b'] });

    const contents = await request(app).get(`/api/cards/folders/${folder.body.id}/cards`);

    expect(contents.status).toBe(200);
    expect(contents.body.cards.map((card: { id: string }) => card.id)).toEqual([
      'group-a-high',
      'group-a-low',
      'group-b',
    ]);
  });

  it('规范化 JSON 相同的衍生卡只计为一份初始稿', async () => {
    const { app, database } = setup();
    insertCard(database, {
      id: 'json-a',
      rawInput: '显示文本一',
      rawContentJson: '{"type":"doc","content":[]}',
    });
    insertCard(database, {
      id: 'json-b',
      rawInput: '显示文本二',
      rawContentJson: '{ "type": "doc", "content": [] }',
    });
    const folder = await request(app).post('/api/cards/folders').send({ name: '富文本' });

    const added = await request(app)
      .post(`/api/cards/folders/${folder.body.id}/cards`)
      .send({ cardIds: ['json-a', 'json-b'] });

    expect(added.status).toBe(200);
    expect(added.body.originalCount).toBe(1);
  });

  it('删除文件夹只级联删除引用而不删除卡片', async () => {
    const { app, database } = setup();
    insertCard(database, { id: 'kept-card', rawInput: '必须保留' });
    const folder = await request(app).post('/api/cards/folders').send({ name: '临时夹' });
    await request(app)
      .post(`/api/cards/folders/${folder.body.id}/cards`)
      .send({ cardIds: ['kept-card'] });

    const deleted = await request(app).delete(`/api/cards/folders/${folder.body.id}`);

    expect(deleted.status).toBe(204);
    expect(database.db.prepare("SELECT raw_input FROM cards WHERE id = 'kept-card'").get()).toEqual({
      raw_input: '必须保留',
    });
    expect(database.db.prepare('SELECT COUNT(*) AS count FROM card_folder_items').get()).toEqual({ count: 0 });
  });

  it('可从文件夹移除单份初始稿且不删除任何卡片', async () => {
    const { app, database } = setup();
    insertCard(database, { id: 'remove-a-1', rawInput: '误加的初始稿' });
    insertCard(database, { id: 'remove-a-2', rawInput: '误加的初始稿' });
    insertCard(database, { id: 'keep-b', rawInput: '保留的初始稿' });
    const folder = await request(app).post('/api/cards/folders').send({ name: '待整理' });
    await request(app)
      .post(`/api/cards/folders/${folder.body.id}/cards`)
      .send({ cardIds: ['remove-a-1', 'remove-a-2', 'keep-b'] });

    const removed = await request(app)
      .delete(`/api/cards/folders/${folder.body.id}/cards`)
      .send({ cardIds: ['remove-a-1', 'remove-a-2'] });
    const contents = await request(app).get(`/api/cards/folders/${folder.body.id}/cards`);

    expect(removed.status).toBe(200);
    expect(removed.body).toMatchObject({ originalCount: 1, cardIds: ['keep-b'] });
    expect(contents.body.cards.map((card: { id: string }) => card.id)).toEqual(['keep-b']);
    expect(database.db.prepare('SELECT id FROM cards ORDER BY id').all()).toEqual([
      { id: 'keep-b' },
      { id: 'remove-a-1' },
      { id: 'remove-a-2' },
    ]);
  });

  it('不存在的文件夹或卡片返回 404 且加入操作不写入部分引用', async () => {
    const { app, database } = setup();
    insertCard(database, { id: 'existing-card', rawInput: '现有卡片' });
    const folder = await request(app).post('/api/cards/folders').send({ name: '原子校验' });

    const missingFolderRead = await request(app).get('/api/cards/folders/missing/cards');
    const missingFolderDelete = await request(app).delete('/api/cards/folders/missing');
    const missingFolderAdd = await request(app)
      .post('/api/cards/folders/missing/cards')
      .send({ cardIds: ['existing-card'] });
    const missingCardAdd = await request(app)
      .post(`/api/cards/folders/${folder.body.id}/cards`)
      .send({ cardIds: ['existing-card', 'missing-card'] });

    for (const response of [missingFolderRead, missingFolderDelete, missingFolderAdd, missingCardAdd]) {
      expect(response.status).toBe(404);
      expect(response.body).toEqual({ code: 'not_found', message: '请求的资源不存在' });
    }
    expect(database.db.prepare('SELECT COUNT(*) AS count FROM card_folder_items').get()).toEqual({ count: 0 });
  });

  it.each([
    ['空数组', { cardIds: [] }],
    ['空编号', { cardIds: ['   '] }],
    ['未知字段', { cardIds: ['card-1'], unexpected: true }],
  ])('拒绝加入卡片请求中的%s', async (_name, body) => {
    const { app } = setup();
    const folder = await request(app).post('/api/cards/folders').send({ name: '参数校验' });

    const response = await request(app)
      .post(`/api/cards/folders/${folder.body.id}/cards`)
      .send(body);

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ code: 'invalid_request', message: '请求参数不合法' });
  });

  it('内部数据库错误不向文件夹接口泄露 SQL 或路径', async () => {
    const { app, database } = setup();
    database.db.exec(`
      CREATE TRIGGER fail_folder_insert BEFORE INSERT ON card_folders
      BEGIN
        SELECT RAISE(ABORT, 'secret SQL C:\\private\\gongkao.db');
      END
    `);

    const response = await request(app).post('/api/cards/folders').send({ name: '触发失败' });

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ code: 'internal_error', message: '请求处理失败' });
    expect(JSON.stringify(response.body)).not.toMatch(/secret|SQL|private|gongkao\.db/i);
  });
});
