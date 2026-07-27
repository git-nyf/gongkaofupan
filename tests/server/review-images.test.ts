import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createReviewImageRouter } from '../../server/reviewImages/routes';
import { createReviewImageService } from '../../server/reviewImages/service';

const png = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
]);
const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
const webp = Buffer.from([
  0x52, 0x49, 0x46, 0x46, 0x04, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
]);
const fixedNow = new Date('2026-07-20T08:30:00.000Z');

interface TestSection {
  id: string;
  name: string;
  hidden: boolean;
  createdAt: string;
}

interface TestBoard {
  id: string;
  name: string;
  hidden: boolean;
  createdAt: string;
  sections: TestSection[];
}

describe('复盘错题图片', () => {
  let directory: string;

  beforeEach(async () => {
    directory = await mkdtemp(path.join(tmpdir(), 'gongkao-review-images-'));
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  function setup() {
    const service = createReviewImageService({ directory, now: () => fixedNow });
    const app = express();
    app.use(express.json());
    app.use(createReviewImageRouter(service));
    return { app, service };
  }

  async function readCatalog(app: express.Express) {
    const response = await request(app).get('/api/review-images');
    expect(response.status).toBe(200);
    return response.body as { items: Array<Record<string, unknown>>; boards: TestBoard[] };
  }

  async function defaultSectionId(app: express.Express) {
    const catalog = await readCatalog(app);
    return catalog.boards.find((board) => board.name === '资料')!.sections[0].id;
  }

  it('生成固定默认分类并将多张图片绑定到指定小板块', async () => {
    const { app } = setup();
    const initial = await readCatalog(app);
    expect(initial.items).toEqual([]);
    expect(initial.boards.map((board) => board.name)).toEqual(['资料', '言语', '判断']);
    expect(
      initial.boards.map((board) => ({
        name: board.name,
        hidden: board.hidden,
        sections: board.sections.map((section) => ({ name: section.name, hidden: section.hidden })),
      })),
    ).toEqual([
      { name: '资料', hidden: false, sections: [{ name: '综合', hidden: false }] },
      {
        name: '言语',
        hidden: false,
        sections: [
          { name: '中心理解', hidden: false },
          { name: '后文推断', hidden: false },
          { name: '逻辑填空', hidden: false },
        ],
      },
      { name: '判断', hidden: false, sections: [{ name: '综合', hidden: false }] },
    ]);
    const sectionId = initial.boards[0].sections[0].id;

    const uploaded = await request(app)
      .post('/api/review-images')
      .query({ sectionId })
      .attach('image', png, { filename: '微信截图.png', contentType: 'image/png' })
      .attach('image', jpeg, { filename: 'QQ截图.jpg', contentType: 'image/jpeg' })
      .attach('image', webp, { filename: '粘贴图片.webp', contentType: 'image/webp' });

    expect(uploaded.status).toBe(201);
    expect(uploaded.body.items).toHaveLength(3);
    expect(uploaded.body.items[0]).toEqual({
      id: expect.stringMatching(/^[0-9a-f-]{36}$/),
      url: expect.stringMatching(/^\/api\/review-images\/[0-9a-f-]+\/content$/),
      originalName: '微信截图.png',
      mimeType: 'image/png',
      byteSize: png.length,
      createdAt: fixedNow.toISOString(),
      sectionId,
    });

    const listed = await readCatalog(app);
    expect(listed).toEqual({ items: uploaded.body.items, boards: initial.boards });
    const image = await request(app).get(uploaded.body.items[0].url);
    expect(image.status).toBe(200);
    expect(image.headers['content-type']).toMatch(/^image\/png/);
    expect(image.body).toEqual(png);
    const manifest = JSON.parse(await readFile(path.join(directory, 'manifest.json'), 'utf8'));
    const storedItem = manifest.items.find(
      (item: { id: string }) => item.id === uploaded.body.items[0].id,
    );
    expect(storedItem).toBeDefined();
    expect(await readFile(resolveStoredPath(directory, storedItem.storedName))).toEqual(png);
    const storedFiles = await readdir(directory);
    expect(storedFiles).toContain('manifest.json');
    expect(storedFiles.some((name) => name.startsWith('.manifest-'))).toBe(false);
  });

  it('新增分类会规范名称、阻止同级重名并支持隐藏与恢复', async () => {
    const { app } = setup();
    const createdBoard = await request(app)
      .post('/api/review-boards')
      .send({ name: '  数量关系  ' });
    expect(createdBoard.status).toBe(201);
    expect(createdBoard.body.board).toMatchObject({
      name: '数量关系',
      hidden: false,
      sections: [],
    });
    const boardId = createdBoard.body.board.id as string;

    const createdSection = await request(app)
      .post(`/api/review-boards/${boardId}/sections`)
      .send({ name: '  工程问题  ' });
    expect(createdSection.status).toBe(201);
    expect(createdSection.body.section).toMatchObject({ name: '工程问题', hidden: false });
    const sectionId = createdSection.body.section.id as string;

    const duplicateBoard = await request(app).post('/api/review-boards').send({ name: '资料' });
    const duplicateSection = await request(app)
      .post(`/api/review-boards/${boardId}/sections`)
      .send({ name: '工程问题' });
    const emptyName = await request(app).post('/api/review-boards').send({ name: '   ' });
    const longName = await request(app)
      .post('/api/review-boards')
      .send({ name: '一'.repeat(21) });
    expect(duplicateBoard.status).toBe(409);
    expect(duplicateSection.status).toBe(409);
    expect(emptyName.status).toBe(400);
    expect(longName.status).toBe(400);

    const hiddenSection = await request(app)
      .patch(`/api/review-sections/${sectionId}`)
      .send({ hidden: true });
    expect(hiddenSection.status).toBe(200);
    expect(hiddenSection.body.section.hidden).toBe(true);
    expect(
      (
        await request(app)
          .post('/api/review-images')
          .query({ sectionId })
          .attach('image', png, { filename: 'hidden.png', contentType: 'image/png' })
      ).status,
    ).toBe(400);

    await request(app).patch(`/api/review-sections/${sectionId}`).send({ hidden: false });
    expect(
      (
        await request(app)
          .post('/api/review-images')
          .query({ sectionId })
          .attach('image', png, { filename: 'restored.png', contentType: 'image/png' })
      ).status,
    ).toBe(201);

    const hiddenBoard = await request(app)
      .patch(`/api/review-boards/${boardId}`)
      .send({ hidden: true });
    expect(hiddenBoard.status).toBe(200);
    expect(hiddenBoard.body.board.hidden).toBe(true);
    expect(
      (
        await request(app)
          .post('/api/review-images')
          .query({ sectionId })
          .attach('image', png, { filename: 'board-hidden.png', contentType: 'image/png' })
      ).status,
    ).toBe(400);
    await request(app).patch(`/api/review-boards/${boardId}`).send({ hidden: false });

    const catalog = await readCatalog(app);
    expect(catalog.boards.find((board) => board.id === boardId)).toMatchObject({
      hidden: false,
      sections: [expect.objectContaining({ id: sectionId, hidden: false })],
    });
  });

  it('拒绝非法分类参数和不存在的分类', async () => {
    const { app } = setup();
    const unknownId = '00000000-0000-4000-8000-000000000000';
    const sectionId = await defaultSectionId(app);
    const responses = await Promise.all([
      request(app).post('/api/review-boards').send({ name: 1 }),
      request(app).patch(`/api/review-boards/${sectionId}`).send({ hidden: 'yes' }),
      request(app).post(`/api/review-boards/${unknownId}/sections`).send({ name: '综合' }),
      request(app).patch(`/api/review-sections/${unknownId}`).send({ hidden: false }),
      request(app)
        .post('/api/review-images')
        .attach('image', png, { filename: 'missing-section.png', contentType: 'image/png' }),
      request(app)
        .post('/api/review-images')
        .query({ sectionId: unknownId })
        .attach('image', png, { filename: 'unknown-section.png', contentType: 'image/png' }),
    ]);

    for (const response of responses) {
      expect([400, 404]).toContain(response.status);
      expect(JSON.stringify(response.body)).not.toContain(directory);
    }
  });

  it('将 v1 图片无损迁入额外的其他/未分类并持久化为 v3', async () => {
    const id = '11111111-1111-4111-8111-111111111111';
    const storedName = '22222222-2222-4222-8222-222222222222.png';
    await writeFile(path.join(directory, storedName), png);
    await writeFile(
      path.join(directory, 'manifest.json'),
      JSON.stringify({
        version: 1,
        items: [
          {
            id,
            storedName,
            originalName: '旧错题.png',
            mimeType: 'image/png',
            byteSize: png.length,
            createdAt: '2026-07-01T00:00:00.000Z',
          },
        ],
      }),
    );

    const first = setup();
    const migrated = await readCatalog(first.app);
    expect(migrated.boards.map((board) => board.name)).toEqual(['资料', '言语', '判断', '其他']);
    const uncategorized = migrated.boards.find((board) => board.name === '其他')!.sections[0];
    expect(uncategorized.name).toBe('未分类');
    expect(migrated.items).toEqual([
      expect.objectContaining({ id, originalName: '旧错题.png', sectionId: uncategorized.id }),
    ]);
    const image = await request(first.app).get(migrated.items[0].url as string);
    expect(image.status).toBe(200);
    expect(image.body).toEqual(png);

    const manifest = JSON.parse(await readFile(path.join(directory, 'manifest.json'), 'utf8'));
    expect(manifest).toMatchObject({ version: 3, boards: expect.any(Array) });
    expect(manifest.items[0]).toMatchObject({ id, sectionId: uncategorized.id });
    expect(await readFile(resolveStoredPath(directory, manifest.items[0].storedName))).toEqual(png);
    const restarted = setup();
    expect(await readCatalog(restarted.app)).toEqual(migrated);
  });

  it('重新创建 service 后恢复分类与图片', async () => {
    const first = setup();
    const sectionId = await defaultSectionId(first.app);
    const uploaded = await request(first.app)
      .post('/api/review-images')
      .query({ sectionId })
      .attach('image', png, { filename: '错题.png', contentType: 'image/png' });
    const createdBoard = await request(first.app).post('/api/review-boards').send({ name: '常识' });

    const restarted = setup();
    const listed = await readCatalog(restarted.app);
    const image = await request(restarted.app).get(uploaded.body.items[0].url);
    expect(listed.items).toEqual(uploaded.body.items);
    expect(listed.boards).toContainEqual(createdBoard.body.board);
    expect(image.status).toBe(200);
    expect(image.body).toEqual(png);
  });

  it('删除图片时同步删除记录和文件', async () => {
    const { app } = setup();
    const sectionId = await defaultSectionId(app);
    const uploaded = await request(app)
      .post('/api/review-images')
      .query({ sectionId })
      .attach('image', png, { filename: '待删除.png', contentType: 'image/png' });
    const [item] = uploaded.body.items;

    const deleted = await request(app).delete(`/api/review-images/${item.id}`);
    expect(deleted.status).toBe(204);
    expect((await readCatalog(app)).items).toEqual([]);
    expect((await request(app).get(item.url)).status).toBe(404);
    expect(JSON.parse(await readFile(path.join(directory, 'manifest.json'), 'utf8'))).toMatchObject({
      version: 3,
      items: [],
      boards: expect.any(Array),
    });
  });

  it('拒绝非图片、伪造内容、错误字段及不支持的上传参数', async () => {
    const { app } = setup();
    const sectionId = await defaultSectionId(app);
    const responses = await Promise.all([
      request(app)
        .post('/api/review-images')
        .query({ sectionId })
        .attach('image', Buffer.from('text'), { filename: 'notes.txt', contentType: 'text/plain' }),
      request(app)
        .post('/api/review-images')
        .query({ sectionId })
        .attach('image', Buffer.from('not png'), { filename: 'fake.png', contentType: 'image/png' }),
      request(app)
        .post('/api/review-images')
        .query({ sectionId })
        .attach('file', png, { filename: 'wrong.png', contentType: 'image/png' }),
      request(app).post('/api/review-images').query({ sectionId }),
    ]);

    for (const response of responses) {
      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({ code: 'invalid_request' });
      expect(JSON.stringify(response.body)).not.toContain(directory);
    }
  });

  it('限制单张图片为 10MB 且每次最多 12 张', async () => {
    const { app } = setup();
    const sectionId = await defaultSectionId(app);
    const tooLarge = Buffer.alloc(10 * 1024 * 1024 + 1);
    png.copy(tooLarge);

    const oversized = await request(app)
      .post('/api/review-images')
      .query({ sectionId })
      .attach('image', tooLarge, { filename: 'large.png', contentType: 'image/png' });
    let excessive = request(app).post('/api/review-images').query({ sectionId });
    for (let index = 0; index < 13; index += 1) {
      excessive = excessive.attach('image', png, {
        filename: `${index}.png`,
        contentType: 'image/png',
      });
    }
    const tooMany = await excessive;
    let maximum = request(app).post('/api/review-images').query({ sectionId });
    for (let index = 0; index < 12; index += 1) {
      maximum = maximum.attach('image', png, {
        filename: `allowed-${index}.png`,
        contentType: 'image/png',
      });
    }
    const maximumAllowed = await maximum;

    expect(oversized.status).toBe(413);
    expect(oversized.body).toMatchObject({ code: 'file_too_large' });
    expect(tooMany.status).toBe(400);
    expect(tooMany.body).toMatchObject({ code: 'invalid_request' });
    expect(maximumAllowed.status).toBe(201);
    expect(maximumAllowed.body.items).toHaveLength(12);
  });

  it('拒绝非法 ID、路径穿越和不存在的资源且不泄露内部错误', async () => {
    const { app } = setup();
    const invalidId = await request(app).delete('/api/review-images/not-an-id');
    const missingId = await request(app).delete(
      '/api/review-images/00000000-0000-4000-8000-000000000000',
    );
    const traversal = await request(app).get(
      '/api/review-images/%2e%2e%2fmanifest.json/content',
    );
    const invalidContentId = await request(app).get('/api/review-images/not-an-id/content');

    expect(invalidId.status).toBe(400);
    expect(missingId.status).toBe(404);
    expect(traversal.status).toBe(400);
    expect(invalidContentId.status).toBe(400);
    for (const response of [invalidId, missingId, traversal, invalidContentId]) {
      expect(JSON.stringify(response.body)).not.toContain(directory);
    }
  });
});

function resolveStoredPath(directory: string, storedName: string) {
  const root = path.resolve(directory);
  const resolved = path.resolve(root, ...storedName.split(/[\\/]/));
  const relative = path.relative(root, resolved);
  expect(relative.startsWith('..') || path.isAbsolute(relative)).toBe(false);
  expect(path.dirname(resolved)).not.toBe(root);
  return resolved;
}
