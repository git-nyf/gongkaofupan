import { createHash } from 'node:crypto';
import { access, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createReviewImageService } from '../../server/reviewImages/service';

const png = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
]);
const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
const fixedNow = new Date('2026-07-20T08:30:00.123Z');
const boardId = '11111111-1111-4111-8111-111111111111';
const sectionId = '22222222-2222-4222-8222-222222222222';
const imageId = '33333333-3333-4333-8333-333333333333';
const legacyStoredName = '44444444-4444-4444-8444-444444444444.png';
const secondImageId = '55555555-5555-4555-8555-555555555555';
const secondLegacyStoredName = '66666666-6666-4666-8666-666666666666.png';

interface StoredManifest {
  version: number;
  boards: Array<{
    id: string;
    name: string;
    sections: Array<{ id: string; name: string }>;
  }>;
  items: Array<{
    id: string;
    storedName: string;
    sectionId: string;
  }>;
}

describe('复盘图片 v3 分类目录存储', () => {
  let directory: string;

  beforeEach(async () => {
    directory = await mkdtemp(path.join(tmpdir(), 'gongkao-review-layout-'));
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  it('首次读取 v2 清单时迁移图片到可读的板块目录并保留稳定 ID', async () => {
    await seedV2Store(directory);
    const service = createReviewImageService({ directory });

    const catalog = await service.list();
    const manifest = await readManifest(directory);
    const storedName = manifest.items[0].storedName;

    expect(manifest.version).toBe(3);
    const [boardDirectory, sectionDirectory, fileName] = splitStoredName(storedName);
    expect(manifest.items[0]).toMatchObject({ id: imageId, sectionId });
    expect(catalog.items).toEqual([
      expect.objectContaining({ id: imageId, sectionId, createdAt: fixedNow.toISOString() }),
    ]);
    expect(boardDirectory).toContain('言语');
    expect(boardDirectory).toContain(boardId.slice(0, 8));
    expect(sectionDirectory).toContain('中心理解');
    expect(sectionDirectory).toContain(sectionId.slice(0, 8));
    expect(fileName).toContain('言语');
    expect(fileName).toContain('中心理解');
    expect(fileName).toMatch(/2026\D?07\D?20\D+16\D?30\D?00\D+123/);
    expect(fileName).toContain(imageId);
    expect(fileName).toMatch(/\.png$/);
    expect(await fileExists(path.join(directory, legacyStoredName))).toBe(false);
    expect(await readFile(resolveStoredPath(directory, storedName))).toEqual(png);
    expect(await service.read(imageId)).toEqual({ content: png, mimeType: 'image/png' });

    await service.delete(imageId);

    expect(await service.read(imageId)).toBeUndefined();
    expect(await fileExists(resolveStoredPath(directory, storedName))).toBe(false);
    expect((await readManifest(directory)).items).toEqual([]);
  });

  it('把 v1 图片直接迁入其他和未分类的 v3 目录', async () => {
    await writeFile(path.join(directory, legacyStoredName), png);
    await writeFile(
      path.join(directory, 'manifest.json'),
      `${JSON.stringify({
        version: 1,
        items: [legacyItem()],
      })}\n`,
    );
    const service = createReviewImageService({
      directory,
      now: () => fixedNow,
      createId: sequentialId(),
    });

    const catalog = await service.list();
    const manifest = await readManifest(directory);
    const uncategorizedBoard = catalog.boards.find((board) => board.name === '其他');
    const uncategorizedSection = uncategorizedBoard?.sections.find(
      (section) => section.name === '未分类',
    );
    const migrated = manifest.items.find((item) => item.id === imageId);

    expect(manifest.version).toBe(3);
    const [boardDirectory, sectionDirectory] = splitStoredName(migrated!.storedName);
    expect(uncategorizedBoard).toBeDefined();
    expect(uncategorizedSection).toBeDefined();
    expect(migrated).toMatchObject({ id: imageId, sectionId: uncategorizedSection!.id });
    expect(boardDirectory).toContain('其他');
    expect(boardDirectory).toContain(uncategorizedBoard!.id.slice(0, 8));
    expect(sectionDirectory).toContain('未分类');
    expect(sectionDirectory).toContain(uncategorizedSection!.id.slice(0, 8));
    expect(await fileExists(path.join(directory, legacyStoredName))).toBe(false);
    expect(await service.read(imageId)).toEqual({ content: png, mimeType: 'image/png' });
  });

  it('续跑已移动一张图片的 v2 迁移并保持两张图片的公开身份与内容', async () => {
    const firstContent = Buffer.concat([png, Buffer.from([0x01])]);
    const secondContent = Buffer.concat([png, Buffer.from([0x02])]);
    const firstItem = legacyItem({ byteSize: firstContent.length });
    const secondItem = legacyItem({
      id: secondImageId,
      storedName: secondLegacyStoredName,
      originalName: '待续迁错题.png',
      byteSize: secondContent.length,
    });
    const firstTargetName = expectedStoredName(imageId, '.png');
    const secondTargetName = expectedStoredName(secondImageId, '.png');
    await writeV2Manifest(directory, [firstItem, secondItem]);
    await writeMigrationJournal(directory, [
      migrationCredential(firstItem, firstTargetName, firstContent),
      migrationCredential(secondItem, secondTargetName, secondContent),
    ]);
    await writeStoredFile(directory, firstTargetName, firstContent);
    await writeFile(path.join(directory, secondLegacyStoredName), secondContent);
    const service = createReviewImageService({ directory });

    const catalog = await service.list();
    const manifest = await readManifest(directory);

    expect(manifest.version).toBe(3);
    expect(manifest.items).toEqual([
      expect.objectContaining({ id: imageId, sectionId, storedName: firstTargetName }),
      expect.objectContaining({ id: secondImageId, sectionId, storedName: secondTargetName }),
    ]);
    expect(catalog.items).toEqual([
      expect.objectContaining({
        id: imageId,
        sectionId,
        url: `/api/review-images/${imageId}/content`,
      }),
      expect.objectContaining({
        id: secondImageId,
        sectionId,
        url: `/api/review-images/${secondImageId}/content`,
      }),
    ]);
    expect(await service.read(imageId)).toEqual({ content: firstContent, mimeType: 'image/png' });
    expect(await service.read(secondImageId)).toEqual({
      content: secondContent,
      mimeType: 'image/png',
    });
    expect(await fileExists(path.join(directory, legacyStoredName))).toBe(false);
    expect(await fileExists(path.join(directory, secondLegacyStoredName))).toBe(false);
    expect(await fileExists(path.join(directory, '.migration-v3.json'))).toBe(false);
  });

  it('源文件缺失但目标内容无法证明时拒绝升级清单', async () => {
    const expectedContent = Buffer.concat([png, Buffer.from([0x31])]);
    const wrongTargetContent = Buffer.concat([png, Buffer.from([0x32])]);
    const targetName = expectedStoredName(imageId, '.png');
    await writeV2Manifest(directory, [legacyItem({ byteSize: expectedContent.length })]);
    await writeStoredFile(directory, targetName, wrongTargetContent);
    const service = createReviewImageService({ directory });

    await expect(service.list()).rejects.toThrow(/migration|credential|hash/i);

    expect(await readFile(resolveStoredPath(directory, targetName))).toEqual(wrongTargetContent);
    expect(await readManifest(directory)).toMatchObject({
      version: 2,
      items: [{ id: imageId, sectionId, storedName: legacyStoredName }],
    });
  });

  it('拒绝覆盖与 v2 平铺源内容不同的既有 v3 目标文件', async () => {
    const sourceContent = Buffer.concat([png, Buffer.from([0x11])]);
    const targetContent = Buffer.concat([png, Buffer.from([0x22])]);
    const targetName = expectedStoredName(imageId, '.png');
    await writeV2Manifest(directory, [legacyItem({ byteSize: sourceContent.length })]);
    await writeFile(path.join(directory, legacyStoredName), sourceContent);
    await writeStoredFile(directory, targetName, targetContent);
    const service = createReviewImageService({ directory });

    await expect(service.list()).rejects.toThrow('review image migration target already exists');

    expect(await readFile(path.join(directory, legacyStoredName))).toEqual(sourceContent);
    expect(await readFile(resolveStoredPath(directory, targetName))).toEqual(targetContent);
    expect(await readManifest(directory)).toMatchObject({
      version: 2,
      items: [{ id: imageId, sectionId, storedName: legacyStoredName }],
    });
  });

  it('新增大板块和小板块时立即建立对应目录', async () => {
    const service = createReviewImageService({ directory, now: () => fixedNow });

    const board = await service.createBoard('数量关系');
    const boardDirectory = await findDirectoryContaining(directory, '数量关系', board.id.slice(0, 8));
    expect(boardDirectory).toBeDefined();

    const section = await service.createSection(board.id, '工程问题');
    const sectionDirectory = await findDirectoryContaining(
      path.join(directory, boardDirectory!),
      '工程问题',
      section.id.slice(0, 8),
    );
    expect(sectionDirectory).toBeDefined();
  });

  it('同批同时间上传的图片使用不同文件名并直接进入所属小板块', async () => {
    const service = createReviewImageService({ directory, now: () => fixedNow });
    const board = await service.createBoard('资料分析');
    const section = await service.createSection(board.id, '增长率');

    const added = await service.add(
      [
        { originalName: '微信截图.png', mimeType: 'image/png', buffer: png },
        { originalName: 'QQ截图.png', mimeType: 'image/png', buffer: png },
      ],
      section.id,
    );
    const manifest = await readManifest(directory);
    const storedNames = added.map(
      (item) => manifest.items.find((stored) => stored.id === item.id)!.storedName,
    );

    expect(new Set(storedNames).size).toBe(2);
    for (const [index, storedName] of storedNames.entries()) {
      const [boardDirectory, sectionDirectory, fileName] = splitStoredName(storedName);
      expect(boardDirectory).toContain('资料分析');
      expect(boardDirectory).toContain(board.id.slice(0, 8));
      expect(sectionDirectory).toContain('增长率');
      expect(sectionDirectory).toContain(section.id.slice(0, 8));
      expect(fileName).toContain('资料分析');
      expect(fileName).toContain('增长率');
      expect(fileName).toMatch(/2026\D?07\D?20\D+16\D?30\D?00\D+123/);
      expect(fileName).toContain(added[index].id);
      expect(fileName).toMatch(/\.png$/);
      expect(await readFile(resolveStoredPath(directory, storedName))).toEqual(png);
      expect(await service.read(added[index].id)).toEqual({ content: png, mimeType: 'image/png' });
    }

    await service.delete(added[0].id);
    expect(await fileExists(resolveStoredPath(directory, storedNames[0]))).toBe(false);
    expect(await service.read(added[1].id)).toEqual({ content: png, mimeType: 'image/png' });
  });

  it('同一存储根的多个服务实例不会互相覆盖清单', async () => {
    const serviceA = createReviewImageService({ directory, now: () => fixedNow });
    const serviceB = createReviewImageService({ directory, now: () => fixedNow });
    const board = await serviceA.createBoard('并发板块');
    const section = await serviceA.createSection(board.id, '并发小节');
    await serviceB.list();

    const [first, second] = await Promise.all([
      serviceA.add([{ originalName: 'A.png', mimeType: 'image/png', buffer: png }], section.id),
      serviceB.add([{ originalName: 'B.png', mimeType: 'image/png', buffer: png }], section.id),
    ]);
    const catalog = await serviceA.list();

    expect(catalog.items.map(({ id }) => id)).toEqual(
      expect.arrayContaining([first[0].id, second[0].id]),
    );
    expect((await readManifest(directory)).items).toHaveLength(2);
  });

  it('安全替换板块名中的 Windows 非法字符且目录不会越出存储根目录', async () => {
    const service = createReviewImageService({ directory, now: () => fixedNow });
    const board = await service.createBoard('资料:../\\?|*');
    const section = await service.createSection(board.id, '中心\\理解:<">?');

    const boardDirectory = await findDirectoryById(directory, board.id.slice(0, 8));
    expect(boardDirectory).toBeDefined();
    const sectionDirectory = await findDirectoryById(
      path.join(directory, boardDirectory!),
      section.id.slice(0, 8),
    );
    expect(sectionDirectory).toBeDefined();
    const resolvedBoardPath = path.resolve(directory, boardDirectory!);
    const resolvedSectionPath = path.resolve(resolvedBoardPath, sectionDirectory!);

    expect(boardDirectory).toContain('资料');
    expect(sectionDirectory).toContain('中心');
    expect(sectionDirectory).toContain('理解');
    expect(boardDirectory).not.toMatch(/[<>:"/\\|?*]/);
    expect(sectionDirectory).not.toMatch(/[<>:"/\\|?*]/);
    expect(resolvedBoardPath.startsWith(`${path.resolve(directory)}${path.sep}`)).toBe(true);
    expect(resolvedSectionPath.startsWith(`${resolvedBoardPath}${path.sep}`)).toBe(true);
    await expect(access(resolvedSectionPath)).resolves.toBeUndefined();
  });

  it('使用 Windows 保留名、非法字符和尾点尾空格的分类仍能安全上传与读删', async () => {
    const service = createReviewImageService({ directory, now: () => fixedNow });
    const reservedBoard = await service.createBoard('CON');
    const reservedSection = await service.createSection(reservedBoard.id, 'PRN ');
    const unsafeBoard = await service.createBoard('错题<>:"/\\|?*.');
    const unsafeSection = await service.createSection(unsafeBoard.id, '小节<>:"/\\|?*. ');
    const [reservedImage] = await service.add(
      [{ originalName: '保留名.jpg', mimeType: 'image/jpeg', buffer: jpeg }],
      reservedSection.id,
    );
    const [unsafeImage] = await service.add(
      [{ originalName: '非法字符.png', mimeType: 'image/png', buffer: png }],
      unsafeSection.id,
    );
    const manifest = await readManifest(directory);
    const storedById = new Map(manifest.items.map((item) => [item.id, item.storedName]));
    const reservedStoredName = storedById.get(reservedImage.id)!;
    const unsafeStoredName = storedById.get(unsafeImage.id)!;

    assertSafeStoredName(directory, reservedStoredName, '.jpg');
    assertSafeStoredName(directory, unsafeStoredName, '.png');
    const [reservedBoardDirectory, reservedSectionDirectory] = splitStoredName(reservedStoredName);
    const [unsafeBoardDirectory, unsafeSectionDirectory] = splitStoredName(unsafeStoredName);
    expect(reservedBoardDirectory).not.toMatch(/^CON--/i);
    expect(reservedSectionDirectory).not.toMatch(/^PRN--/i);
    expect(unsafeBoardDirectory).toContain('错题');
    expect(unsafeSectionDirectory).toContain('小节');
    expect(await service.read(reservedImage.id)).toEqual({
      content: jpeg,
      mimeType: 'image/jpeg',
    });
    expect(await service.read(unsafeImage.id)).toEqual({ content: png, mimeType: 'image/png' });

    await service.delete(reservedImage.id);
    await service.delete(unsafeImage.id);

    expect(await service.read(reservedImage.id)).toBeUndefined();
    expect(await service.read(unsafeImage.id)).toBeUndefined();
    expect(await fileExists(resolveStoredPath(directory, reservedStoredName))).toBe(false);
    expect(await fileExists(resolveStoredPath(directory, unsafeStoredName))).toBe(false);
  });
});

async function seedV2Store(directory: string) {
  await writeFile(path.join(directory, legacyStoredName), png);
  await writeV2Manifest(directory, [legacyItem()]);
}

async function writeV2Manifest(
  directory: string,
  items: Array<ReturnType<typeof legacyItem>>,
) {
  await writeFile(
    path.join(directory, 'manifest.json'),
    `${JSON.stringify({
      version: 2,
      boards: [reviewBoard()],
      items,
    })}\n`,
  );
}

async function writeMigrationJournal(
  directory: string,
  items: ReturnType<typeof migrationCredential>[],
) {
  await writeFile(
    path.join(directory, '.migration-v3.json'),
    `${JSON.stringify({ version: 1, items })}\n`,
  );
}

function migrationCredential(
  item: ReturnType<typeof legacyItem>,
  targetStoredName: string,
  content: Buffer,
) {
  return {
    id: item.id,
    sourceStoredName: item.storedName,
    targetStoredName,
    byteSize: item.byteSize,
    mimeType: item.mimeType,
    sha256: createHash('sha256').update(content).digest('hex'),
  };
}

function reviewBoard() {
  return {
    id: boardId,
    name: '言语',
    hidden: false,
    createdAt: '2026-07-01T00:00:00.000Z',
    sections: [
      {
        id: sectionId,
        name: '中心理解',
        hidden: false,
        createdAt: '2026-07-01T00:00:00.000Z',
      },
    ],
  };
}

function legacyItem(
  overrides: Partial<{
    id: string;
    storedName: string;
    originalName: string;
    byteSize: number;
  }> = {},
) {
  return {
    id: imageId,
    storedName: legacyStoredName,
    originalName: '旧错题.png',
    mimeType: 'image/png',
    byteSize: png.length,
    createdAt: fixedNow.toISOString(),
    sectionId,
    ...overrides,
  };
}

function expectedStoredName(id: string, extension: '.png' | '.jpg') {
  return `言语--${boardId.slice(0, 8)}/中心理解--${sectionId.slice(0, 8)}/言语_中心理解_20260720-163000-123_${id}${extension}`;
}

async function writeStoredFile(directory: string, storedName: string, content: Buffer) {
  const filePath = resolveStoredPath(directory, storedName);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, content);
}

async function readManifest(directory: string) {
  return JSON.parse(
    await readFile(path.join(directory, 'manifest.json'), 'utf8'),
  ) as StoredManifest;
}

function splitStoredName(storedName: string) {
  const segments = storedName.split(/[\\/]/);
  expect(segments).toHaveLength(3);
  return segments;
}

function resolveStoredPath(directory: string, storedName: string) {
  const resolved = path.resolve(directory, ...storedName.split(/[\\/]/));
  expect(resolved.startsWith(`${path.resolve(directory)}${path.sep}`)).toBe(true);
  return resolved;
}

function assertSafeStoredName(directory: string, storedName: string, extension: '.png' | '.jpg') {
  const [boardDirectory, sectionDirectory, fileName] = splitStoredName(storedName);
  for (const segment of [boardDirectory, sectionDirectory]) {
    expect(segment).not.toMatch(/[<>:"/\\|?*\u0000-\u001f]/);
    expect(segment).not.toMatch(/[. ]$/);
  }
  expect(fileName).not.toMatch(/[<>:"/\\|?*\u0000-\u001f]/);
  expect(fileName.endsWith(extension)).toBe(true);
  const resolved = resolveStoredPath(directory, storedName);
  expect(resolved.startsWith(`${path.resolve(directory)}${path.sep}`)).toBe(true);
}

async function findDirectoryContaining(directory: string, name: string, idPrefix: string) {
  const entries = await readdir(directory, { withFileTypes: true });
  return entries.find(
    (entry) => entry.isDirectory() && entry.name.includes(name) && entry.name.includes(idPrefix),
  )?.name;
}

async function findDirectoryById(directory: string, idPrefix: string) {
  const entries = await readdir(directory, { withFileTypes: true });
  return entries.find((entry) => entry.isDirectory() && entry.name.includes(idPrefix))?.name;
}

async function fileExists(filePath: string) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function sequentialId() {
  let value = 0;
  return () => {
    value += 1;
    return `${value.toString(16).padStart(8, '0')}-0000-4000-8000-000000000000`;
  };
}
