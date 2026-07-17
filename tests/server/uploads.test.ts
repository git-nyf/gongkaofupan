import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import path from 'node:path';
import request, { type Response } from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../server/app';
import { createCardService, type CardService } from '../../server/cards/service';
import type { CreateCardInput, NormalizedCard } from '../../shared/contracts';
import { createTestDatabase } from '../helpers/testDatabase';

const fixedNow = new Date('2026-07-17T10:00:00.000Z');

const baseInput: CreateCardInput = {
  entryMode: 'knowledge',
  rawInput: '带图片的卡片',
  rawContentJson: null,
  wrongPoint: '',
  analysis: '',
  mnemonic: '',
  extension: '',
  notes: '',
  categoryIds: ['常识判断', '常识判断/文史'],
  userTags: [],
  template: '常识模板',
  sourceType: 'manual',
  sourceDetail: '',
  rating: 3,
  initialMastery: 'unseen',
  attachments: [],
};

const normalized: NormalizedCard = {
  normalized_statement: '规范表述',
  question_type: 'single',
  wrong_point: '',
  analysis: '解析',
  mnemonic: '',
  extension: '',
  notes: '',
  tags: ['AI标签'],
  quiz_items: [{ direction: 'single', question: '问题', answer: '答案' }],
};

type TestDatabase = ReturnType<typeof createTestDatabase>;

function createInput(overrides: Partial<CreateCardInput> = {}): CreateCardInput {
  return {
    ...baseInput,
    categoryIds: [...baseInput.categoryIds],
    userTags: [...baseInput.userTags],
    attachments: [],
    ...overrides,
  };
}

function expectSafeError(response: Response, status: number) {
  expect(response.status).toBe(status);
  expect(response.body).toEqual({ code: expect.any(String), message: expect.any(String) });
  expect(JSON.stringify(response.body)).not.toMatch(/SQL|AAA错题|uploadsDirectory|\\/i);
}

describe('本地图片上传与读取', () => {
  const resources: TestDatabase[] = [];

  afterEach(() => {
    resources.splice(0).forEach((resource) => resource.dispose());
  });

  function setup() {
    const database = createTestDatabase();
    resources.push(database);
    const uploadsDirectory = path.join(database.directory, 'uploads');
    mkdirSync(uploadsDirectory, { recursive: true });
    const normalize = vi.fn(async () => structuredClone(normalized));
    const service = createCardService({
      database: database.manager,
      aiProvider: { normalize },
      now: () => new Date(fixedNow),
      uploadsDirectory,
    });
    const app = createApp({ cardService: service, uploadsDirectory });
    return { app, database, normalize, service, uploadsDirectory };
  }

  async function createJsonCard(app: ReturnType<typeof createApp>, overrides: Partial<CreateCardInput> = {}) {
    const response = await request(app).post('/api/cards').send(createInput(overrides));
    expect(response.status).toBe(201);
    return response.body as { id: string; attachments: unknown[] };
  }

  it('保留 JSON 创建，并在 multipart 创建时先把多张附件纳入事务 A 再调用 AI', async () => {
    const { app, database, normalize, uploadsDirectory } = setup();
    const jsonCard = await createJsonCard(app);
    expect(jsonCard.attachments).toEqual([]);

    normalize.mockImplementationOnce(async () => {
      expect(database.db.prepare('SELECT COUNT(*) AS count FROM attachments').get()).toEqual({ count: 2 });
      expect(database.db.prepare('SELECT COUNT(*) AS count FROM cards').get()).toEqual({ count: 2 });
      return structuredClone(normalized);
    });
    const response = await request(app)
      .post('/api/cards')
      .field('payload', JSON.stringify(createInput({ userTags: ['图片标签'] })))
      .attach('imageA', Buffer.from('png-a'), {
        filename: 'first original.png',
        contentType: 'image/png',
      })
      .attach('imageB', Buffer.from('jpg-b'), {
        filename: 'second original.jpeg',
        contentType: 'image/jpeg',
      });

    expect(response.status).toBe(201);
    expect(response.body.attachments).toHaveLength(2);
    const stored = database.db
      .prepare('SELECT stored_name, original_name, mime_type, byte_size FROM attachments ORDER BY sort_order')
      .all() as Array<{ stored_name: string; original_name: string; mime_type: string; byte_size: number }>;
    expect(stored.map(({ mime_type }) => mime_type)).toEqual(['image/png', 'image/jpeg']);
    expect(stored.map(({ original_name }) => original_name)).toEqual([
      'first original.png',
      'second original.jpeg',
    ]);
    expect(stored.map(({ stored_name }) => stored_name).sort()).toEqual(readdirSync(uploadsDirectory).sort());
    expect(normalize).toHaveBeenCalledTimes(2);
  });

  it('接受 PNG、JPEG、WebP，使用 UUID 固定扩展存储且可通过安全路径读取', async () => {
    const { app, database } = setup();
    const response = await request(app)
      .post('/api/cards')
      .field('payload', JSON.stringify(createInput()))
      .attach('png', Buffer.from('png-content'), {
        filename: 'visible-name.png',
        contentType: 'image/png',
      })
      .attach('jpeg', Buffer.from('jpeg-content'), {
        filename: 'visible-name.jpeg',
        contentType: 'image/jpeg',
      })
      .attach('webp', Buffer.from('webp-content'), {
        filename: 'visible-name.webp',
        contentType: 'image/webp',
      });

    expect(response.status).toBe(201);
    const files = database.db
      .prepare('SELECT stored_name, mime_type FROM attachments ORDER BY sort_order')
      .all() as Array<{ stored_name: string; mime_type: string }>;
    expect(files).toHaveLength(3);
    expect(files[0].stored_name).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.png$/,
    );
    expect(files[1].stored_name).toMatch(/^[0-9a-f-]{36}\.jpg$/);
    expect(files[2].stored_name).toMatch(/^[0-9a-f-]{36}\.webp$/);
    expect(files.every(({ stored_name }) => !stored_name.includes('visible-name'))).toBe(true);

    for (const file of files) {
      const download = await request(app).get(`/uploads/${file.stored_name}`);
      expect(download.status).toBe(200);
      expect(download.headers['content-type']).toContain(file.mime_type);
      expect(Buffer.isBuffer(download.body)).toBe(true);
    }
  });

  it('拒绝非法 MIME 和超过 10MB 的单文件，并返回安全错误体', async () => {
    const { app, uploadsDirectory } = setup();
    const invalidMime = await request(app)
      .post('/api/cards')
      .field('payload', JSON.stringify(createInput()))
      .attach('file', Buffer.from('plain'), { filename: 'plain.txt', contentType: 'text/plain' });
    const prototypeMime = await request(app)
      .post('/api/cards')
      .field('payload', JSON.stringify(createInput()))
      .attach('file', Buffer.from('plain'), { filename: 'plain.bin', contentType: 'constructor' });
    const tooLarge = await request(app)
      .post('/api/cards')
      .field('payload', JSON.stringify(createInput()))
      .attach('file', Buffer.alloc(10 * 1024 * 1024 + 1), {
        filename: 'large.png',
        contentType: 'image/png',
      });

    expectSafeError(invalidMime, 400);
    expectSafeError(prototypeMime, 400);
    expectSafeError(tooLarge, 413);
    expect(readdirSync(uploadsDirectory)).toEqual([]);
  });

  it('严格拒绝缺失、重复、非法 payload、额外文本字段和客户端附件元数据', async () => {
    const { app, uploadsDirectory } = setup();
    const missing = await request(app)
      .post('/api/cards')
      .attach('image', Buffer.from('png'), { filename: 'a.png', contentType: 'image/png' });
    const duplicate = await request(app)
      .post('/api/cards')
      .field('payload', JSON.stringify(createInput()))
      .field('payload', JSON.stringify(createInput()))
      .attach('image', Buffer.from('png'), { filename: 'a.png', contentType: 'image/png' });
    const invalidJson = await request(app)
      .post('/api/cards')
      .field('payload', '{')
      .attach('image', Buffer.from('png'), { filename: 'a.png', contentType: 'image/png' });
    const extraField = await request(app)
      .post('/api/cards')
      .field('payload', JSON.stringify(createInput()))
      .field('note', 'not allowed');
    const suppliedAttachments = await request(app)
      .post('/api/cards')
      .field(
        'payload',
        JSON.stringify(
          createInput({
            attachments: [
              {
                id: 'client-id',
                storedName: 'client.png',
                originalName: 'client.png',
                mimeType: 'image/png',
                byteSize: 1,
              },
            ],
          }),
        ),
      );

    for (const response of [missing, duplicate, invalidJson, extraField, suppliedAttachments]) {
      expectSafeError(response, 400);
    }
    expect(readdirSync(uploadsDirectory)).toEqual([]);
  });

  it('现有卡片至少上传一张图片，并可按卡片归属删除数据库记录和本地文件', async () => {
    const { app, database, uploadsDirectory } = setup();
    const first = await createJsonCard(app);
    const second = await createJsonCard(app, { rawInput: '第二张卡片' });

    const noFile = await request(app).post(`/api/cards/${first.id}/attachments`);
    expectSafeError(noFile, 400);

    const added = await request(app)
      .post(`/api/cards/${first.id}/attachments`)
      .attach('anyFileField', Buffer.from('webp'), {
        filename: 'attachment.webp',
        contentType: 'image/webp',
      });
    expect(added.status).toBe(201);
    expect(added.body.attachments).toHaveLength(1);
    const attachment = database.db
      .prepare('SELECT id, stored_name FROM attachments WHERE card_id = ?')
      .get(first.id) as { id: string; stored_name: string };
    const storedPath = path.join(uploadsDirectory, attachment.stored_name);
    expect(existsSync(storedPath)).toBe(true);

    const mismatch = await request(app).delete(
      `/api/cards/${second.id}/attachments/${attachment.id}`,
    );
    expect(mismatch.status).toBe(404);
    expect(existsSync(storedPath)).toBe(true);

    const deleted = await request(app).delete(
      `/api/cards/${first.id}/attachments/${attachment.id}`,
    );
    expect(deleted.status).toBe(204);
    expect(database.db.prepare('SELECT COUNT(*) AS count FROM attachments').get()).toEqual({ count: 0 });
    expect(existsSync(storedPath)).toBe(false);
  });

  it('附件事务写入失败时回滚卡片和关联记录，并清理本轮全部 UUID 文件', async () => {
    const { app, database, normalize, uploadsDirectory } = setup();
    database.db.exec(`
      CREATE TRIGGER reject_attachment
      BEFORE INSERT ON attachments
      BEGIN
        SELECT RAISE(ABORT, 'private attachment SQL');
      END
    `);

    const response = await request(app)
      .post('/api/cards')
      .field('payload', JSON.stringify(createInput({ userTags: ['事务标签'] })))
      .attach('first', Buffer.from('png'), { filename: 'a.png', contentType: 'image/png' })
      .attach('second', Buffer.from('jpg'), { filename: 'b.jpg', contentType: 'image/jpeg' });

    expectSafeError(response, 500);
    for (const table of ['cards', 'attachments', 'card_categories', 'card_tags']) {
      expect(database.db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get()).toEqual({ count: 0 });
    }
    expect(readdirSync(uploadsDirectory)).toEqual([]);
    expect(normalize).not.toHaveBeenCalled();
  });

  it('多文件全部落盘后服务失败时仍清理本轮文件', async () => {
    const { database, service, uploadsDirectory } = setup();
    const failingService: CardService = {
      ...service,
      async create() {
        throw new Error('private service failure');
      },
    };
    const app = createApp({ cardService: failingService, uploadsDirectory });

    const response = await request(app)
      .post('/api/cards')
      .field('payload', JSON.stringify(createInput()))
      .attach('first', Buffer.from('png'), { filename: 'a.png', contentType: 'image/png' })
      .attach('second', Buffer.from('webp'), { filename: 'b.webp', contentType: 'image/webp' });

    expectSafeError(response, 500);
    expect(readdirSync(uploadsDirectory)).toEqual([]);
    expect(database.db.prepare('SELECT COUNT(*) AS count FROM cards').get()).toEqual({ count: 0 });
  });

  it('非法或不存在的存储名返回 404且不暴露本机路径', async () => {
    const { app } = setup();
    const invalid = await request(app).get('/uploads/not-a-system-name.png');
    const missing = await request(app).get(
      '/uploads/11111111-1111-4111-8111-111111111111.png',
    );

    expectSafeError(invalid, 404);
    expectSafeError(missing, 404);
  });

  it('删除卡片后级联清理附件记录和对应本地图片', async () => {
    const { app, database, uploadsDirectory } = setup();
    const card = await createJsonCard(app);
    const added = await request(app)
      .post(`/api/cards/${card.id}/attachments`)
      .attach('image', Buffer.from('png'), { filename: 'delete.png', contentType: 'image/png' });
    expect(added.status).toBe(201);
    const attachment = database.db
      .prepare('SELECT stored_name FROM attachments WHERE card_id = ?')
      .get(card.id) as { stored_name: string };
    const storedPath = path.join(uploadsDirectory, attachment.stored_name);

    const deleted = await request(app).delete(`/api/cards/${card.id}`);

    expect(deleted.status).toBe(204);
    expect(database.db.prepare('SELECT COUNT(*) AS count FROM attachments').get()).toEqual({ count: 0 });
    expect(existsSync(storedPath)).toBe(false);
  });
});
