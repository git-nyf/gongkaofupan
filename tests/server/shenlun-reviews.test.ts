import express from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { createShenlunReviewRouter } from '../../server/shenlunReviews/routes';
import { createShenlunReviewService } from '../../server/shenlunReviews/service';
import { createApp } from '../../server/app';
import { createTestDatabase } from '../helpers/testDatabase';

type TestDatabase = ReturnType<typeof createTestDatabase>;

const timestamps = [
  '2026-08-09T01:00:00.000Z',
  '2026-08-09T02:00:00.000Z',
  '2026-08-09T03:00:00.000Z',
];

function setup() {
  const database = createTestDatabase();
  let clockIndex = 0;
  const service = createShenlunReviewService({
    database: database.manager,
    now: () => new Date(timestamps[Math.min(clockIndex++, timestamps.length - 1)]),
  });
  const app = express();
  app.use(express.json());
  app.use('/api/shenlun-reviews', createShenlunReviewRouter(service));
  return { app, database };
}

function validInput(overrides: Record<string, unknown> = {}) {
  return {
    title: '  基层治理答题复盘  ',
    template: 400,
    text: '重点论述基层治理。',
    marks: [
      { id: 'mark-bold', type: 'bold', start: 0, end: 2 },
      { id: 'mark-underline', type: 'underline', start: 2, end: 4 },
    ],
    notes: '注意主体与措施对应。',
    standardAnswer: '坚持党建引领，完善群众参与机制。',
    annotations: [
      {
        id: 'annotation-1',
        start: 0,
        end: 2,
        quote: '重点',
        body: '总括词应当先行。',
        createdAt: '2026-08-09T00:30:00.000Z',
        detached: false,
      },
    ],
    ...overrides,
  };
}

describe('申论复盘数据库与接口', () => {
  const opened: TestDatabase[] = [];

  afterEach(() => {
    opened.splice(0).forEach((database) => database.dispose());
  });

  it('迁移会创建独立申论复盘表', () => {
    const database = createTestDatabase();
    opened.push(database);

    const columns = database.db
      .prepare('PRAGMA table_info(shenlun_reviews)')
      .all() as Array<{ name: string }>;

    expect(columns.map(({ name }) => name)).toEqual([
      'id',
      'title',
      'template',
      'text',
      'marks_json',
      'notes',
      'standard_answer',
      'annotations_json',
      'created_at',
      'updated_at',
      'pinned',
      'archived',
    ]);
  });

  it('应用入口挂载申论复盘接口', async () => {
    const database = createTestDatabase();
    opened.push(database);
    const service = createShenlunReviewService({ database: database.manager });

    const response = await request(createApp({ shenlunReviewService: service }))
      .get('/api/shenlun-reviews');

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });

  it('创建后可读取详情，并由服务端生成编号和时间', async () => {
    const { app, database } = setup();
    opened.push(database);

    const created = await request(app).post('/api/shenlun-reviews').send(validInput());

    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({
      id: expect.stringMatching(/^[0-9a-f-]{36}$/),
      title: '基层治理答题复盘',
      template: 400,
      text: '重点论述基层治理。',
      marks: [
        { id: 'mark-bold', type: 'bold', start: 0, end: 2 },
        { id: 'mark-underline', type: 'underline', start: 2, end: 4 },
      ],
      notes: '注意主体与措施对应。',
      standardAnswer: '坚持党建引领，完善群众参与机制。',
      annotations: [expect.objectContaining({ id: 'annotation-1', detached: false })],
      pinned: false,
      archived: false,
      createdAt: timestamps[0],
      updatedAt: timestamps[0],
    });

    const detail = await request(app).get(`/api/shenlun-reviews/${created.body.id}`);
    expect(detail.status).toBe(200);
    expect(detail.body).toEqual(created.body);
  });

  it('保存文字颜色格式并沿用现有格式 JSON 字段', async () => {
    const { app, database } = setup();
    opened.push(database);

    const created = await request(app).post('/api/shenlun-reviews').send(validInput({
      marks: [{ id: 'mark-color', type: 'color', color: 'red', start: 0, end: 2 }],
    }));

    expect(created.status).toBe(201);
    expect(created.body.marks).toEqual([
      { id: 'mark-color', type: 'color', color: 'red', start: 0, end: 2 },
    ]);
    expect(database.db.prepare('SELECT marks_json FROM shenlun_reviews WHERE id = ?').get(created.body.id))
      .toEqual({ marks_json: '[{"id":"mark-color","type":"color","color":"red","start":0,"end":2}]' });
  });

  it('保存失联批注时允许保留超出当前正文的历史区间', async () => {
    const { app, database } = setup();
    opened.push(database);
    const annotation = {
      id: 'annotation-detached',
      start: 0,
      end: 4,
      quote: '旧稿原文',
      body: '原批注意见',
      createdAt: '2026-08-09T00:30:00.000Z',
      detached: true,
    };

    const created = await request(app).post('/api/shenlun-reviews').send(validInput({
      text: '',
      marks: [],
      annotations: [annotation],
    }));

    expect(created.status).toBe(201);
    expect(created.body.annotations).toEqual([annotation]);
  });

  it('更新覆盖原记录，列表按更新时间倒序返回摘要', async () => {
    const { app, database } = setup();
    opened.push(database);

    const first = await request(app).post('/api/shenlun-reviews').send(validInput());
    const second = await request(app).post('/api/shenlun-reviews').send(validInput({
      title: '综合分析复盘',
      template: 800,
      text: '第二篇正文',
      marks: [],
      annotations: [],
    }));
    const updated = await request(app)
      .put(`/api/shenlun-reviews/${first.body.id}`)
      .send(validInput({
        title: '更新后的复盘',
        text: '更新正文',
        marks: [{ id: 'mark-strike', type: 'strike', start: 0, end: 2 }],
        annotations: [],
      }));

    expect(updated.status).toBe(200);
    expect(updated.body).toMatchObject({
      id: first.body.id,
      title: '更新后的复盘',
      text: '更新正文',
      createdAt: timestamps[0],
      updatedAt: timestamps[2],
    });
    expect(database.db.prepare('SELECT COUNT(*) AS count FROM shenlun_reviews').get()).toEqual({
      count: 2,
    });

    const listed = await request(app).get('/api/shenlun-reviews');
    expect(listed.status).toBe(200);
    expect(listed.body.map(({ id }: { id: string }) => id)).toEqual([
      first.body.id,
      second.body.id,
    ]);
    expect(listed.body[0]).toEqual({
      id: first.body.id,
      title: '更新后的复盘',
      template: 400,
      excerpt: '更新正文',
      characterCount: 4,
      pinned: false,
      archived: false,
      createdAt: timestamps[0],
      updatedAt: timestamps[2],
    });
    expect(listed.body[0]).not.toHaveProperty('marks');
  });

  it('支持置顶、归档筛选和恢复申论复盘', async () => {
    const { app, database } = setup();
    opened.push(database);

    const older = await request(app).post('/api/shenlun-reviews').send(validInput({
      title: '较早申论',
      text: '较早正文',
      marks: [],
      annotations: [],
    }));
    const newer = await request(app).post('/api/shenlun-reviews').send(validInput({
      title: '较新申论',
      text: '较新正文',
      marks: [],
      annotations: [],
    }));

    const pinned = await request(app)
      .patch(`/api/shenlun-reviews/${older.body.id}`)
      .send({ pinned: true });
    expect(pinned.status).toBe(200);
    expect(pinned.body).toMatchObject({ id: older.body.id, pinned: true, archived: false });

    const current = await request(app).get('/api/shenlun-reviews');
    expect(current.body.map(({ id }: { id: string }) => id)).toEqual([
      older.body.id,
      newer.body.id,
    ]);

    const archived = await request(app)
      .patch(`/api/shenlun-reviews/${older.body.id}`)
      .send({ archived: true });
    expect(archived.status).toBe(200);
    expect(archived.body).toMatchObject({ pinned: true, archived: true });
    expect((await request(app).get('/api/shenlun-reviews')).body.map(({ id }: { id: string }) => id))
      .toEqual([newer.body.id]);
    expect((await request(app).get('/api/shenlun-reviews?archived=true')).body)
      .toEqual([expect.objectContaining({ id: older.body.id, archived: true })]);

    const restored = await request(app)
      .patch(`/api/shenlun-reviews/${older.body.id}`)
      .send({ archived: false, pinned: false });
    expect(restored.status).toBe(200);
    expect(restored.body).toMatchObject({ pinned: false, archived: false });
  });

  it('拒绝非法申论状态更新并为不存在记录返回 404', async () => {
    const { app, database } = setup();
    opened.push(database);

    expect((await request(app).patch('/api/shenlun-reviews/missing').send({ pinned: true })).status)
      .toBe(404);
    expect((await request(app).patch('/api/shenlun-reviews/missing').send({})).status)
      .toBe(400);
    expect((await request(app).patch('/api/shenlun-reviews/missing').send({ archived: 'yes' })).status)
      .toBe(400);
    expect((await request(app).get('/api/shenlun-reviews?archived=yes')).status)
      .toBe(400);
  });

  it.each([
    ['不支持的模板', { template: 300 }],
    ['空标题', { title: '   ' }],
    ['超过 80 字的标题', { title: '题'.repeat(81) }],
    ['未知格式类型', { marks: [{ id: 'mark-1', type: 'italic', start: 0, end: 1 }] }],
    ['格式起点为负数', { marks: [{ id: 'mark-1', type: 'bold', start: -1, end: 1 }] }],
    ['格式区间为空', { marks: [{ id: 'mark-1', type: 'bold', start: 1, end: 1 }] }],
    ['格式区间超出正文', { text: '正文', marks: [{ id: 'mark-1', type: 'bold', start: 0, end: 3 }] }],
    ['批注结构缺少字段', { annotations: [{ id: 'annotation-1', start: 0, end: 1 }] }],
    ['批注区间超出正文', {
      text: '正文',
      marks: [],
      annotations: [{
        id: 'annotation-1',
        start: 0,
        end: 3,
        quote: '正文外',
        body: '批注',
        createdAt: '2026-08-09T00:30:00.000Z',
        detached: false,
      }],
    }],
    ['有效批注原文与正文区间不一致', {
      text: '正文',
      marks: [],
      annotations: [{
        id: 'annotation-1',
        start: 0,
        end: 1,
        quote: '错',
        body: '批注',
        createdAt: '2026-08-09T00:30:00.000Z',
        detached: false,
      }],
    }],
    ['批注时间格式非法', {
      annotations: [{
        id: 'annotation-1',
        start: 0,
        end: 1,
        quote: '重',
        body: '批注',
        createdAt: '昨天',
        detached: false,
      }],
    }],
    ['客户端指定记录编号', { id: 'client-id' }],
    ['客户端指定创建时间', { createdAt: timestamps[0] }],
  ])('拒绝%s', async (_name, override) => {
    const { app, database } = setup();
    opened.push(database);

    const response = await request(app).post('/api/shenlun-reviews').send(validInput(override));

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ code: 'invalid_request', message: '请求参数不合法' });
  });

  it('拒绝非法更新并为不存在的记录返回 404', async () => {
    const { app, database } = setup();
    opened.push(database);

    const invalid = await request(app)
      .put('/api/shenlun-reviews/missing')
      .send(validInput({ template: 100 }));
    expect(invalid.status).toBe(400);

    const missingGet = await request(app).get('/api/shenlun-reviews/missing');
    expect(missingGet.status).toBe(404);
    expect(missingGet.body).toEqual({ code: 'not_found', message: '申论复盘不存在' });

    const missingUpdate = await request(app)
      .put('/api/shenlun-reviews/missing')
      .send(validInput());
    expect(missingUpdate.status).toBe(404);
    expect(missingUpdate.body).toEqual({ code: 'not_found', message: '申论复盘不存在' });
  });
});
