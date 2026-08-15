import request from 'supertest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../server/app';
import { createAnkiRouter } from '../../server/anki/routes';

describe('Anki 路由', () => {
  const temporaryDirectories: string[] = [];

  afterEach(() => {
    temporaryDirectories.splice(0).forEach((directory) => {
      rmSync(directory, { recursive: true, force: true });
    });
  });

  it('默认生成十张卡片，并允许显式请求发送', async () => {
    const generate = vi.fn().mockResolvedValue({ status: 'generated', count: 10, sent: false });
    const generateAndSend = vi.fn().mockResolvedValue({ status: 'generated', count: 10, sent: true });
    const app = createApp({
      ankiRouter: createAnkiRouter({ generate, generateAndSend }),
    });

    const generated = await request(app).post('/api/anki/daily').send({});
    const sent = await request(app).post('/api/anki/daily').send({ send: true });

    expect(generated.status).toBe(200);
    expect(generate).toHaveBeenCalledWith(10);
    expect(sent.status).toBe(200);
    expect(generateAndSend).toHaveBeenCalledWith(10);
    expect(sent.body.sent).toBe(true);
  });

  it('按用户初始稿编号生成一张 Anki 卡并直接发送到手机', async () => {
    const cardId = 'e9890bf8-9e5e-4c06-ad22-e87f1fdbc55b';
    const generateAndSend = vi.fn().mockResolvedValue({
      status: 'generated',
      count: 1,
      cardIds: [cardId],
      sent: true,
    });
    const app = createApp({
      ankiRouter: createAnkiRouter({ generate: vi.fn(), generateAndSend }),
    });

    const response = await request(app).post(`/api/anki/cards/${cardId}/send`).send({});

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'sent', count: 1, cardId });
    expect(generateAndSend).toHaveBeenCalledWith(1, {
      cardIds: [cardId],
      filePrefix: expect.stringMatching(/^card-review-e9890bf8-[0-9]+$/),
    });
  });

  it('微信会话令牌过期时返回可执行的恢复提示', async () => {
    const cardId = 'e9890bf8-9e5e-4c06-ad22-e87f1fdbc55b';
    const generateAndSend = vi.fn().mockResolvedValue({
      status: 'generated',
      count: 1,
      cardIds: [cardId],
      sent: false,
      sendResult: {
        ok: false,
        code: 'COMMAND_FAILED',
        error: 'cc-connect 退出状态 1',
        stderr: 'weixin: sendMessage ret=-2 (expired context_token); user must send a new message',
      },
    });
    const app = createApp({
      ankiRouter: createAnkiRouter({ generate: vi.fn(), generateAndSend }),
    });

    const response = await request(app).post(`/api/anki/cards/${cardId}/send`).send({});

    expect(response.status).toBe(502);
    expect(response.body).toEqual({
      code: 'send_failed',
      message: '微信会话已过期，请先给 cc-connect 机器人发送一条消息后重试',
    });
  });

  it('拒绝非法编号并报告不可用的用户初始稿', async () => {
    const generateAndSend = vi.fn().mockResolvedValue({ status: 'empty', count: 0, sent: false });
    const app = createApp({
      ankiRouter: createAnkiRouter({ generate: vi.fn(), generateAndSend }),
    });

    const invalid = await request(app).post('/api/anki/cards/not-a-uuid/send').send({});
    const missing = await request(app)
      .post('/api/anki/cards/e9890bf8-9e5e-4c06-ad22-e87f1fdbc55b/send')
      .send({});

    expect(invalid.status).toBe(400);
    expect(missing.status).toBe(404);
    expect(generateAndSend).toHaveBeenCalledTimes(1);
  });

  it('拒绝超过十张的请求', async () => {
    const app = createApp({
      ankiRouter: createAnkiRouter({ generate: vi.fn(), generateAndSend: vi.fn() }),
    });

    const response = await request(app).post('/api/anki/daily').send({ count: 11 });

    expect(response.status).toBe(400);
  });

  it('创建卡片库导出批次并支持空结果', async () => {
    const create = vi
      .fn()
      .mockResolvedValueOnce({
        status: 'created',
        export: {
          id: 'batch-a1b2c3',
          createdAt: '2026-08-08T01:30:00.000Z',
          count: 1,
          apkgFileName: 'batch-a1b2c3.apkg',
          markdownFileName: 'batch-a1b2c3.md',
        },
      })
      .mockResolvedValueOnce({ status: 'empty' });
    const app = createApp({
      ankiRouter: createRouterWithExports({
        create,
        list: vi.fn(),
        get: vi.fn(),
        getApkgPath: vi.fn(),
      }),
    });

    const created = await request(app)
      .post('/api/anki/exports')
      .send({ cardIds: ['e9890bf8-9e5e-4c06-ad22-e87f1fdbc55b'] });
    const empty = await request(app).post('/api/anki/exports').send({});

    expect(created.status).toBe(201);
    expect(created.body.export.count).toBe(1);
    expect(create).toHaveBeenNthCalledWith(1, ['e9890bf8-9e5e-4c06-ad22-e87f1fdbc55b']);
    expect(empty.status).toBe(200);
    expect(empty.body).toEqual({ status: 'empty' });
    expect(create).toHaveBeenNthCalledWith(2, undefined);
  });

  it('返回历史摘要和包含完整答案的批次详情', async () => {
    const summary = {
      id: 'batch-a1b2c3',
      createdAt: '2026-08-08T01:30:00.000Z',
      count: 1,
      apkgFileName: 'batch-a1b2c3.apkg',
      markdownFileName: 'batch-a1b2c3.md',
    };
    const detail = {
      ...summary,
      cards: [{ id: 'card-1', category: '资料分析', question: '增长率是多少？', answer: '完整初始稿' }],
    };
    const app = createApp({
      ankiRouter: createRouterWithExports({
        create: vi.fn(),
        list: vi.fn().mockReturnValue([summary]),
        get: vi.fn().mockReturnValue(detail),
        getApkgPath: vi.fn(),
      }),
    });

    const history = await request(app).get('/api/anki/exports');
    const response = await request(app).get('/api/anki/exports/batch-a1b2c3');

    expect(history.status).toBe(200);
    expect(history.body).toEqual([summary]);
    expect(response.status).toBe(200);
    expect(response.body.cards[0].answer).toBe('完整初始稿');
  });

  it('重新下载历史 apkg，并拒绝非法或不存在的批次', async () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'anki-route-download-'));
    temporaryDirectories.push(directory);
    const apkgPath = path.join(directory, 'batch-a1b2c3.apkg');
    writeFileSync(apkgPath, Buffer.from('PK-test'));
    const getApkgPath = vi.fn((id: string) => id === 'batch-a1b2c3' ? apkgPath : undefined);
    const app = createApp({
      ankiRouter: createRouterWithExports({
        create: vi.fn(),
        list: vi.fn(),
        get: vi.fn(),
        getApkgPath,
      }),
    });

    const downloaded = await request(app).get('/api/anki/exports/batch-a1b2c3/apkg');
    const missing = await request(app).get('/api/anki/exports/not-found/apkg');
    const invalid = await request(app).get('/api/anki/exports/..%2Fsecret/apkg');

    expect(downloaded.status).toBe(200);
    expect(downloaded.headers['content-disposition']).toContain('attachment');
    expect(missing.status).toBe(404);
    expect(invalid.status).toBe(404);
  });

  it('拒绝非法卡片编号和超过上限的导出请求', async () => {
    const create = vi.fn();
    const app = createApp({
      ankiRouter: createRouterWithExports({
        create,
        list: vi.fn(),
        get: vi.fn(),
        getApkgPath: vi.fn(),
      }),
    });

    const invalidId = await request(app).post('/api/anki/exports').send({ cardIds: ['not-a-uuid'] });
    const tooMany = await request(app).post('/api/anki/exports').send({
      cardIds: Array.from({ length: 501 }, () => 'e9890bf8-9e5e-4c06-ad22-e87f1fdbc55b'),
    });

    expect(invalidId.status).toBe(400);
    expect(tooMany.status).toBe(400);
    expect(create).not.toHaveBeenCalled();
  });
});

interface ExportServiceDouble {
  create: ReturnType<typeof vi.fn>;
  list: ReturnType<typeof vi.fn>;
  get: ReturnType<typeof vi.fn>;
  getApkgPath: ReturnType<typeof vi.fn>;
}

function createRouterWithExports(exportService: ExportServiceDouble) {
  return createAnkiRouter(
    { generate: vi.fn(), generateAndSend: vi.fn() },
    exportService,
  );
}
