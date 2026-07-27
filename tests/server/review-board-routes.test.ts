import express from 'express';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { createReviewImageRouter } from '../../server/reviewImages/routes';
import { createReviewImageService } from '../../server/reviewImages/service';

const fixedNow = new Date('2026-07-20T12:00:00.000Z');
const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

interface SectionResponse {
  id: string;
  name: string;
  hidden: boolean;
  createdAt: string;
}

interface BoardResponse {
  id: string;
  name: string;
  hidden: boolean;
  createdAt: string;
  sections: SectionResponse[];
}

describe('复盘错题积累多级板块接口', () => {
  const temporaryDirectories: string[] = [];

  afterEach(() => {
    temporaryDirectories.splice(0).forEach((directory) => {
      rmSync(directory, { recursive: true, force: true });
    });
  });

  function setup(directory = createTemporaryDirectory()) {
    const service = createReviewImageService({
      directory,
      now: () => new Date(fixedNow),
    });
    const app = express();
    app.use(express.json());
    app.use(createReviewImageRouter(service));
    return { app, directory, service };
  }

  function createTemporaryDirectory() {
    const directory = mkdtempSync(path.join(os.tmpdir(), 'gongkao-review-boards-'));
    temporaryDirectories.push(directory);
    return directory;
  }

  async function listBoards(app: express.Express) {
    const response = await request(app).get('/api/review-images');
    expect(response.status).toBe(200);
    expect(response.body.items).toEqual(expect.any(Array));
    return response.body.boards as BoardResponse[];
  }

  it('首次读取时建立资料、言语、判断及约定的小板块', async () => {
    const { app } = setup();

    const response = await request(app).get('/api/review-images');

    expect(response.status).toBe(200);
    expect(response.body.items).toEqual([]);
    expect((response.body.boards as BoardResponse[]).map((board) => ({
      name: board.name,
      hidden: board.hidden,
      sections: board.sections.map((section) => ({
        name: section.name,
        hidden: section.hidden,
      })),
    }))).toEqual([
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
    for (const board of response.body.boards as BoardResponse[]) {
      expect(board).toEqual({
        id: expect.any(String),
        name: expect.any(String),
        hidden: expect.any(Boolean),
        createdAt: fixedNow.toISOString(),
        sections: expect.any(Array),
      });
      for (const section of board.sections) {
        expect(section).toEqual({
          id: expect.any(String),
          name: expect.any(String),
          hidden: expect.any(Boolean),
          createdAt: fixedNow.toISOString(),
        });
      }
    }
  });

  it('新增大板块和小板块，并能分别隐藏与恢复', async () => {
    const { app } = setup();
    const createdBoard = await request(app)
      .post('/api/review-boards')
      .send({ name: '数量' });
    expect(createdBoard.status).toBe(201);
    expect(createdBoard.body.board).toMatchObject({ name: '数量', hidden: false, sections: [] });
    const board = createdBoard.body.board as BoardResponse;

    const createdSection = await request(app)
      .post(`/api/review-boards/${board.id}/sections`)
      .send({ name: '数学运算' });
    expect(createdSection.status).toBe(201);
    expect(createdSection.body.section).toMatchObject({ name: '数学运算', hidden: false });
    const section = createdSection.body.section as SectionResponse;

    const hiddenBoard = await request(app)
      .patch(`/api/review-boards/${board.id}`)
      .send({ hidden: true });
    expect(hiddenBoard.status).toBe(200);
    expect(hiddenBoard.body.board).toMatchObject({ id: board.id, hidden: true });
    const restoredBoard = await request(app)
      .patch(`/api/review-boards/${board.id}`)
      .send({ hidden: false });
    expect(restoredBoard.status).toBe(200);
    expect(restoredBoard.body.board).toMatchObject({ id: board.id, hidden: false });

    const hiddenSection = await request(app)
      .patch(`/api/review-sections/${section.id}`)
      .send({ hidden: true });
    expect(hiddenSection.status).toBe(200);
    expect(hiddenSection.body.section).toMatchObject({ id: section.id, hidden: true });
    const restoredSection = await request(app)
      .patch(`/api/review-sections/${section.id}`)
      .send({ hidden: false });
    expect(restoredSection.status).toBe(200);
    expect(restoredSection.body.section).toMatchObject({ id: section.id, hidden: false });

    const storedBoard = (await listBoards(app)).find(({ id }) => id === board.id);
    expect(storedBoard).toMatchObject({ id: board.id, name: '数量', hidden: false });
    expect(storedBoard?.sections).toEqual([
      expect.objectContaining({ id: section.id, name: '数学运算', hidden: false }),
    ]);
  });

  it('拒绝大小板块的空名、超长名和同级重名', async () => {
    const { app } = setup();
    const twentyCharacters = '考'.repeat(20);
    const twentyOneCharacters = '考'.repeat(21);

    const validBoundary = await request(app)
      .post('/api/review-boards')
      .send({ name: twentyCharacters });
    expect(validBoundary.status).toBe(201);
    const board = validBoundary.body.board as BoardResponse;

    const emptyBoard = await request(app).post('/api/review-boards').send({ name: '   ' });
    const longBoard = await request(app)
      .post('/api/review-boards')
      .send({ name: twentyOneCharacters });
    const duplicateBoard = await request(app)
      .post('/api/review-boards')
      .send({ name: ` ${twentyCharacters} ` });
    expect(emptyBoard.status).toBe(400);
    expect(longBoard.status).toBe(400);
    expect(duplicateBoard.status).toBe(409);
    expect(emptyBoard.body).toEqual({ code: 'invalid_request', message: expect.any(String) });
    expect(longBoard.body).toEqual({ code: 'invalid_request', message: expect.any(String) });
    expect(duplicateBoard.body).toEqual({ code: 'conflict', message: expect.any(String) });

    const validSection = await request(app)
      .post(`/api/review-boards/${board.id}/sections`)
      .send({ name: '资料分析' });
    expect(validSection.status).toBe(201);
    const emptySection = await request(app)
      .post(`/api/review-boards/${board.id}/sections`)
      .send({ name: '' });
    const longSection = await request(app)
      .post(`/api/review-boards/${board.id}/sections`)
      .send({ name: twentyOneCharacters });
    const duplicateSection = await request(app)
      .post(`/api/review-boards/${board.id}/sections`)
      .send({ name: ' 资料分析 ' });
    expect(emptySection.status).toBe(400);
    expect(longSection.status).toBe(400);
    expect(duplicateSection.status).toBe(409);
    expect(emptySection.body).toEqual({ code: 'invalid_request', message: expect.any(String) });
    expect(longSection.body).toEqual({ code: 'invalid_request', message: expect.any(String) });
    expect(duplicateSection.body).toEqual({ code: 'conflict', message: expect.any(String) });
  });

  it('上传必须指定可见的小板块，并在图片响应中保留 sectionId', async () => {
    const { app } = setup();
    const boards = await listBoards(app);
    const languageBoard = boards.find(({ name }) => name === '言语')!;
    const section = languageBoard.sections.find(({ name }) => name === '中心理解')!;

    const missingSection = await request(app)
      .post('/api/review-images')
      .attach('image', pngSignature, { filename: 'missing.png', contentType: 'image/png' });
    expect(missingSection.status).toBe(400);
    expect(missingSection.body).toEqual({ code: 'invalid_request', message: expect.any(String) });

    await request(app)
      .patch(`/api/review-sections/${section.id}`)
      .send({ hidden: true })
      .expect(200);
    const hiddenSection = await request(app)
      .post(`/api/review-images?sectionId=${section.id}`)
      .attach('image', pngSignature, { filename: 'hidden-section.png', contentType: 'image/png' });
    expect(hiddenSection.status).toBe(400);
    expect(hiddenSection.body).toEqual({ code: 'invalid_request', message: expect.any(String) });
    await request(app)
      .patch(`/api/review-sections/${section.id}`)
      .send({ hidden: false })
      .expect(200);

    await request(app)
      .patch(`/api/review-boards/${languageBoard.id}`)
      .send({ hidden: true })
      .expect(200);
    const hiddenBoard = await request(app)
      .post(`/api/review-images?sectionId=${section.id}`)
      .attach('image', pngSignature, { filename: 'hidden-board.png', contentType: 'image/png' });
    expect(hiddenBoard.status).toBe(400);
    expect(hiddenBoard.body).toEqual({ code: 'invalid_request', message: expect.any(String) });
    await request(app)
      .patch(`/api/review-boards/${languageBoard.id}`)
      .send({ hidden: false })
      .expect(200);

    const uploaded = await request(app)
      .post(`/api/review-images?sectionId=${section.id}`)
      .attach('image', pngSignature, { filename: '中心理解错题.png', contentType: 'image/png' });
    expect(uploaded.status).toBe(201);
    expect(uploaded.body.items).toEqual([
      expect.objectContaining({
        id: expect.any(String),
        originalName: '中心理解错题.png',
        mimeType: 'image/png',
        sectionId: section.id,
      }),
    ]);
    const listed = await request(app).get('/api/review-images');
    expect(listed.status).toBe(200);
    expect(listed.body.items).toEqual([
      expect.objectContaining({ sectionId: section.id }),
    ]);
  });

  it('迁移旧版清单后把图片归入其他/未分类并保持内容可读', async () => {
    const directory = createTemporaryDirectory();
    const imageId = '11111111-1111-4111-8111-111111111111';
    const storedName = '22222222-2222-4222-8222-222222222222.png';
    writeFileSync(path.join(directory, storedName), pngSignature);
    writeFileSync(
      path.join(directory, 'manifest.json'),
      `${JSON.stringify({
        version: 1,
        items: [
          {
            id: imageId,
            storedName,
            originalName: '旧版错题.png',
            mimeType: 'image/png',
            byteSize: pngSignature.byteLength,
            createdAt: '2026-07-19T08:00:00.000Z',
          },
        ],
      }, null, 2)}\n`,
      'utf8',
    );
    const { app } = setup(directory);

    const response = await request(app).get('/api/review-images');

    expect(response.status).toBe(200);
    const otherBoard = (response.body.boards as BoardResponse[]).find(({ name }) => name === '其他');
    expect(otherBoard).toBeDefined();
    const uncategorized = otherBoard?.sections.find(({ name }) => name === '未分类');
    expect(uncategorized).toBeDefined();
    expect(response.body.items).toEqual([
      expect.objectContaining({
        id: imageId,
        originalName: '旧版错题.png',
        sectionId: uncategorized?.id,
      }),
    ]);

    const content = await request(app).get(`/api/review-images/${imageId}/content`);
    expect(content.status).toBe(200);
    expect(content.headers['content-type']).toContain('image/png');
    expect(content.body).toEqual(pngSignature);
  });

  it('persists the exact board order and returns it after recreating the service', async () => {
    const { app, directory } = setup();
    const initial = await listBoards(app);
    const ids = initial.map(({ id }) => id).reverse();

    const response = await request(app).put('/api/review-boards/order').send({ ids });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ boards: expect.any(Array) });
    expect((response.body.boards as BoardResponse[]).map(({ id }) => id)).toEqual(ids);
    const manifest = JSON.parse(readFileSync(path.join(directory, 'manifest.json'), 'utf8')) as {
      boards: BoardResponse[];
    };
    expect(manifest.boards.map(({ id }) => id)).toEqual(ids);

    const restarted = setup(directory);
    expect((await listBoards(restarted.app)).map(({ id }) => id)).toEqual(ids);
  });

  it('rejects incomplete, duplicate, and unknown board ids without changing data', async () => {
    const { app, directory } = setup();
    const initial = await listBoards(app);
    const ids = initial.map(({ id }) => id);
    const manifestBefore = readFileSync(path.join(directory, 'manifest.json'), 'utf8');
    const invalidOrders = [
      ids.slice(1),
      [ids[0], ids[0], ...ids.slice(2)],
      ['00000000-0000-4000-8000-000000000000', ...ids.slice(1)],
    ];

    for (const invalidIds of invalidOrders) {
      const response = await request(app)
        .put('/api/review-boards/order')
        .send({ ids: invalidIds });
      expect(response.status).toBe(400);
      expect(response.body).toEqual({ code: 'invalid_request', message: expect.any(String) });
      expect((await listBoards(app)).map(({ id }) => id)).toEqual(ids);
    }
    expect(readFileSync(path.join(directory, 'manifest.json'), 'utf8')).toBe(manifestBefore);
  });

  it('persists the exact section order and returns its board after recreating the service', async () => {
    const { app, directory } = setup();
    const initial = await listBoards(app);
    const board = initial.find(({ sections }) => sections.length > 1)!;
    const ids = board.sections.map(({ id }) => id).reverse();

    const response = await request(app)
      .put(`/api/review-boards/${board.id}/sections/order`)
      .send({ ids });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ board: expect.any(Object) });
    expect((response.body.board as BoardResponse).sections.map(({ id }) => id)).toEqual(ids);
    const manifest = JSON.parse(readFileSync(path.join(directory, 'manifest.json'), 'utf8')) as {
      boards: BoardResponse[];
    };
    expect(manifest.boards.find(({ id }) => id === board.id)?.sections.map(({ id }) => id)).toEqual(
      ids,
    );

    const restarted = setup(directory);
    const restartedBoard = (await listBoards(restarted.app)).find(({ id }) => id === board.id);
    expect(restartedBoard?.sections.map(({ id }) => id)).toEqual(ids);
  });

  it('rejects incomplete, duplicate, and unknown section ids without changing data', async () => {
    const { app, directory } = setup();
    const initial = await listBoards(app);
    const board = initial.find(({ sections }) => sections.length > 1)!;
    const ids = board.sections.map(({ id }) => id);
    const manifestBefore = readFileSync(path.join(directory, 'manifest.json'), 'utf8');
    const invalidOrders = [
      ids.slice(1),
      [ids[0], ids[0], ...ids.slice(2)],
      ['00000000-0000-4000-8000-000000000000', ...ids.slice(1)],
    ];

    for (const invalidIds of invalidOrders) {
      const response = await request(app)
        .put(`/api/review-boards/${board.id}/sections/order`)
        .send({ ids: invalidIds });
      expect(response.status).toBe(400);
      expect(response.body).toEqual({ code: 'invalid_request', message: expect.any(String) });
      const storedBoard = (await listBoards(app)).find(({ id }) => id === board.id);
      expect(storedBoard?.sections.map(({ id }) => id)).toEqual(ids);
    }
    expect(readFileSync(path.join(directory, 'manifest.json'), 'utf8')).toBe(manifestBefore);
  });
});
