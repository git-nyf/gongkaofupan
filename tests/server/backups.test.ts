import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { PassThrough } from 'node:stream';
import archiver from 'archiver';
import Database from 'better-sqlite3';
import multer from 'multer';
import request, { type Response } from 'supertest';
import unzipper from 'unzipper';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../server/app';
import { createBackupService } from '../../server/backups/service';
import * as backupRoutes from '../../server/backups/routes';
import { createTestDatabase } from '../helpers/testDatabase';

const fixedNow = new Date('2026-07-17T10:20:30.000Z');
const manifest = {
  format: 'gongkao-memory-card-backup',
  schemaVersion: 1,
  createdAt: fixedNow.toISOString(),
};

type TestDatabase = ReturnType<typeof createTestDatabase>;

interface ZipEntry {
  name: string;
  content: Buffer | string;
}

function zip(entries: ZipEntry[]) {
  const output = new PassThrough();
  const chunks: Buffer[] = [];
  output.on('data', (chunk: Buffer) => chunks.push(chunk));
  const completed = new Promise<Buffer>((resolve, reject) => {
    output.on('end', () => resolve(Buffer.concat(chunks)));
    output.on('error', reject);
  });
  const archive = archiver('zip', { zlib: { level: 9 } });
  archive.on('error', (error) => output.destroy(error));
  archive.pipe(output);
  for (const entry of entries) archive.append(entry.content, { name: entry.name });
  void archive.finalize();
  return completed;
}

function replaceEntryName(buffer: Buffer, safeName: string, unsafeName: string) {
  expect(Buffer.byteLength(unsafeName)).toBe(Buffer.byteLength(safeName));
  const result = Buffer.from(buffer);
  const safe = Buffer.from(safeName);
  const unsafe = Buffer.from(unsafeName);
  let offset = 0;
  let replacements = 0;
  while ((offset = result.indexOf(safe, offset)) !== -1) {
    unsafe.copy(result, offset);
    offset += safe.length;
    replacements += 1;
  }
  expect(replacements).toBeGreaterThanOrEqual(2);
  return result;
}

function centralEntryOffset(buffer: Buffer, entryName: string) {
  const signature = Buffer.from([0x50, 0x4b, 0x01, 0x02]);
  let offset = 0;
  while ((offset = buffer.indexOf(signature, offset)) !== -1) {
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const name = buffer.subarray(offset + 46, offset + 46 + nameLength).toString('utf8');
    if (name === entryName) return offset;
    offset += 46 + nameLength + extraLength + commentLength;
  }
  throw new Error(`找不到 ZIP 中央目录条目：${entryName}`);
}

function patchCentralUncompressedSize(buffer: Buffer, entryName: string, size: number) {
  const result = Buffer.from(buffer);
  result.writeUInt32LE(size, centralEntryOffset(result, entryName) + 24);
  return result;
}

function patchCentralCompressionMethod(buffer: Buffer, entryName: string, method: number) {
  const result = Buffer.from(buffer);
  result.writeUInt16LE(method, centralEntryOffset(result, entryName) + 10);
  return result;
}

async function databaseBytes(database: TestDatabase) {
  const directory = await mkdtemp(path.join(tmpdir(), 'gongkao-backup-db-'));
  const filePath = path.join(directory, 'gongkao.db');
  try {
    await database.manager.get().backup(filePath);
    return await readFile(filePath);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

async function backupBuffer(
  database: TestDatabase,
  overrides: Partial<typeof manifest> = {},
  extraEntries: ZipEntry[] = [],
) {
  return zip([
    { name: 'manifest.json', content: JSON.stringify({ ...manifest, ...overrides }) },
    { name: 'gongkao.db', content: await databaseBytes(database) },
    ...extraEntries,
  ]);
}

async function backupBufferWithDatabase(database: Buffer, extraEntries: ZipEntry[] = []) {
  return zip([
    { name: 'manifest.json', content: JSON.stringify(manifest) },
    { name: 'gongkao.db', content: database },
    ...extraEntries,
  ]);
}

async function backupWithSymlink(database: TestDatabase) {
  const output = new PassThrough();
  const chunks: Buffer[] = [];
  output.on('data', (chunk: Buffer) => chunks.push(chunk));
  const completed = new Promise<Buffer>((resolve, reject) => {
    output.on('end', () => resolve(Buffer.concat(chunks)));
    output.on('error', reject);
  });
  const archive = archiver('zip', { zlib: { level: 9 } });
  archive.on('error', (error) => output.destroy(error));
  archive.pipe(output);
  archive.append(JSON.stringify(manifest), { name: 'manifest.json' });
  archive.append(await databaseBytes(database), { name: 'gongkao.db' });
  archive.symlink('uploads/link.png', 'outside.png');
  void archive.finalize();
  return completed;
}

function setMarker(database: TestDatabase, value: string) {
  database.db
    .prepare('INSERT OR REPLACE INTO app_settings (key, value_json) VALUES (?, ?)')
    .run('backup-test-marker', JSON.stringify(value));
}

function marker(database: TestDatabase) {
  const row = database.db
    .prepare('SELECT value_json FROM app_settings WHERE key = ?')
    .get('backup-test-marker') as { value_json: string } | undefined;
  return row ? (JSON.parse(row.value_json) as string) : undefined;
}

function addAttachmentReference(database: TestDatabase, storedName: string) {
  const cardId = `card-${storedName}`;
  database.db
    .prepare(
      `INSERT INTO cards (id, entry_mode, raw_input, ai_status, created_at, updated_at)
       VALUES (?, 'knowledge', ?, 'ready', ?, ?)`,
    )
    .run(cardId, storedName, fixedNow.toISOString(), fixedNow.toISOString());
  database.db
    .prepare(
      `INSERT INTO attachments
        (id, card_id, stored_name, original_name, mime_type, byte_size, sort_order, created_at)
       VALUES (?, ?, ?, ?, 'image/png', 1, 0, ?)`,
    )
    .run(`attachment-${storedName}`, cardId, storedName, storedName, fixedNow.toISOString());
}

function expectSafeError(response: Response, status: number) {
  expect(response.status).toBe(status);
  expect(response.body).toEqual({ code: expect.any(String), message: expect.any(String) });
  expect(JSON.stringify(response.body)).not.toMatch(/gongkao\.db|AAA错题|restore-|rollback-|\.env|sk-/i);
}

describe('SQLite 与图片备份恢复', () => {
  const resources: TestDatabase[] = [];

  afterEach(() => {
    vi.restoreAllMocks();
    resources.splice(0).forEach((resource) => resource.dispose());
  });

  function setup() {
    const database = createTestDatabase();
    resources.push(database);
    const dataDirectory = database.directory;
    const uploadsDirectory = path.join(dataDirectory, 'uploads');
    mkdirSync(uploadsDirectory, { recursive: true });
    const service = createBackupService({
      database: database.manager,
      dataDirectory,
      uploadsDirectory,
      now: () => new Date(fixedNow),
    });
    const app = createApp({ backupService: service });
    return { app, database, dataDirectory, service, uploadsDirectory };
  }

  it('生成可下载的一致性 ZIP，只包含清单、SQLite 副本和普通图片文件', async () => {
    const { app, database, dataDirectory, uploadsDirectory } = setup();
    setMarker(database, '备份中的值');
    writeFileSync(path.join(uploadsDirectory, 'example.png'), 'image-content');
    addAttachmentReference(database, 'example.png');
    writeFileSync(path.join(dataDirectory, '.env'), 'DEEPSEEK_API_KEY=private-value');
    mkdirSync(path.join(dataDirectory, 'backups'), { recursive: true });
    writeFileSync(path.join(dataDirectory, 'backups', 'old.zip'), 'old-backup');
    const outsidePath = `${dataDirectory}-outside.txt`;
    writeFileSync(outsidePath, 'outside');

    const response = await request(app).post('/api/backups').buffer(true).parse((response, callback) => {
      const chunks: Buffer[] = [];
      response.on('data', (chunk: Buffer) => chunks.push(chunk));
      response.on('end', () => callback(null, Buffer.concat(chunks)));
    });

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('application/zip');
    expect(decodeURIComponent(response.headers['content-disposition'])).toContain(
      '公考记忆卡备份-20260717-102030.zip',
    );
    const opened = await unzipper.Open.buffer(response.body as Buffer);
    const entries = opened.files.map(({ path: entryPath }) => entryPath);
    expect(entries).toEqual(
      expect.arrayContaining(['manifest.json', 'gongkao.db', 'uploads/example.png']),
    );
    expect(entries.join('\n')).not.toMatch(/\.env|old\.zip|outside\.txt|backups\//);
    expect((response.body as Buffer).includes(Buffer.from('private-value'))).toBe(false);

    const manifestEntry = opened.files.find(({ path: entryPath }) => entryPath === 'manifest.json');
    expect(JSON.parse((await manifestEntry!.buffer()).toString('utf8'))).toEqual(manifest);
    const databaseEntry = opened.files.find(({ path: entryPath }) => entryPath === 'gongkao.db');
    const copiedDatabasePath = path.join(dataDirectory, 'copied-backup.db');
    await writeFile(copiedDatabasePath, await databaseEntry!.buffer());
    const copiedDatabase = new Database(copiedDatabasePath, { readonly: true });
    expect(copiedDatabase.pragma('integrity_check', { simple: true })).toBe('ok');
    expect(
      JSON.parse(
        (
          copiedDatabase
            .prepare('SELECT value_json FROM app_settings WHERE key = ?')
            .get('backup-test-marker') as { value_json: string }
        ).value_json,
      ),
    ).toBe('备份中的值');
    copiedDatabase.close();
    rmSync(outsidePath, { force: true });
  });

  it('生成备份时不跟随 uploads 中指向目录外的符号链接', async () => {
    const { app, dataDirectory, uploadsDirectory } = setup();
    const outsideDirectory = `${dataDirectory}-linked`;
    mkdirSync(outsideDirectory, { recursive: true });
    writeFileSync(path.join(outsideDirectory, 'secret.png'), 'linked-secret');
    try {
      symlinkSync(outsideDirectory, path.join(uploadsDirectory, 'linked'), 'junction');
    } catch (error) {
      rmSync(outsideDirectory, { recursive: true, force: true });
      if (typeof error === 'object' && error !== null && Reflect.get(error, 'code') === 'EPERM') return;
      throw error;
    }

    const response = await request(app).post('/api/backups').buffer(true).parse((response, callback) => {
      const chunks: Buffer[] = [];
      response.on('data', (chunk: Buffer) => chunks.push(chunk));
      response.on('end', () => callback(null, Buffer.concat(chunks)));
    });

    expect(response.status).toBe(200);
    const opened = await unzipper.Open.buffer(response.body as Buffer);
    expect(opened.files.map(({ path: entryPath }) => entryPath)).not.toContain(
      'uploads/linked/secret.png',
    );
    expect((response.body as Buffer).includes(Buffer.from('linked-secret'))).toBe(false);
    rmSync(outsideDirectory, { recursive: true, force: true });
  });

  it('生成备份只收录公开名称的常用图片扩展名', async () => {
    const { app, database, uploadsDirectory } = setup();
    for (const fileName of ['visible.png', 'visible.jpg', 'visible.jpeg', 'visible.webp']) {
      writeFileSync(path.join(uploadsDirectory, fileName), fileName);
      addAttachmentReference(database, fileName);
    }
    writeFileSync(path.join(uploadsDirectory, '.env'), 'hidden-secret');
    writeFileSync(path.join(uploadsDirectory, '.hidden.png'), 'hidden-image');
    writeFileSync(path.join(uploadsDirectory, 'notes.txt'), 'plain-text');
    writeFileSync(path.join(uploadsDirectory, 'legacy.gif'), 'gif-image');

    const response = await request(app).post('/api/backups').buffer(true).parse((response, callback) => {
      const chunks: Buffer[] = [];
      response.on('data', (chunk: Buffer) => chunks.push(chunk));
      response.on('end', () => callback(null, Buffer.concat(chunks)));
    });

    expect(response.status).toBe(200);
    const opened = await unzipper.Open.buffer(response.body as Buffer);
    const names = opened.files.map(({ path: entryPath }) => entryPath);
    expect(names).toEqual(
      expect.arrayContaining([
        'uploads/visible.png',
        'uploads/visible.jpg',
        'uploads/visible.jpeg',
        'uploads/visible.webp',
      ]),
    );
    expect(names.join('\n')).not.toMatch(/\.env|\.hidden|notes\.txt|legacy\.gif/);
    expect((response.body as Buffer).includes(Buffer.from('hidden-secret'))).toBe(false);
  });

  it('SQLite 快照没有引用的孤儿图片不进入备份', async () => {
    const { app, uploadsDirectory } = setup();
    writeFileSync(path.join(uploadsDirectory, 'orphan.png'), 'orphan-image');

    const response = await request(app).post('/api/backups').buffer(true).parse((response, callback) => {
      const chunks: Buffer[] = [];
      response.on('data', (chunk: Buffer) => chunks.push(chunk));
      response.on('end', () => callback(null, Buffer.concat(chunks)));
    });

    expect(response.status).toBe(200);
    const opened = await unzipper.Open.buffer(response.body as Buffer);
    expect(opened.files.map(({ path: entryPath }) => entryPath)).not.toContain('uploads/orphan.png');
    expect((response.body as Buffer).includes(Buffer.from('orphan-image'))).toBe(false);
  });

  it('SQLite 快照完成后新增的图片不进入本轮备份', async () => {
    const { app, database, uploadsDirectory } = setup();
    writeFileSync(path.join(uploadsDirectory, 'referenced.png'), 'referenced');
    addAttachmentReference(database, 'referenced.png');
    const realBackup = database.db.backup.bind(database.db);
    vi.spyOn(database.db, 'backup').mockImplementation(async (destination, options) => {
      const result = await realBackup(destination, options);
      writeFileSync(path.join(uploadsDirectory, 'late.png'), 'late-orphan');
      return result;
    });

    const response = await request(app).post('/api/backups').buffer(true).parse((response, callback) => {
      const chunks: Buffer[] = [];
      response.on('data', (chunk: Buffer) => chunks.push(chunk));
      response.on('end', () => callback(null, Buffer.concat(chunks)));
    });

    expect(response.status).toBe(200);
    const opened = await unzipper.Open.buffer(response.body as Buffer);
    const names = opened.files.map(({ path: entryPath }) => entryPath);
    expect(names).toContain('uploads/referenced.png');
    expect(names).not.toContain('uploads/late.png');
  });

  it('SQLite 快照引用的图片在快照后缺失时整包失败且不发布 ZIP', async () => {
    const { app, database, dataDirectory, uploadsDirectory } = setup();
    const storedName = 'missing-after-snapshot.png';
    const storedPath = path.join(uploadsDirectory, storedName);
    writeFileSync(storedPath, 'referenced');
    addAttachmentReference(database, storedName);
    const realBackup = database.db.backup.bind(database.db);
    vi.spyOn(database.db, 'backup').mockImplementation(async (destination, options) => {
      const result = await realBackup(destination, options);
      rmSync(storedPath, { force: true });
      return result;
    });

    const response = await request(app).post('/api/backups');

    expectSafeError(response, 500);
    const names = readFileNames(path.join(dataDirectory, 'backups'));
    expect(names.some((name) => name.endsWith('.zip'))).toBe(false);
    expect(names.some((name) => /^(?:snapshot-|backup-.*\.tmp$)/.test(name))).toBe(false);
  });

  it('同一秒生成多个备份时内部文件路径唯一但下载名保持固定格式', async () => {
    const { service } = setup();

    const backups = await Promise.all([
      service.createBackup(),
      service.createBackup(),
      service.createBackup(),
    ]);

    expect(new Set(backups.map(({ filePath }) => filePath)).size).toBe(3);
    expect(new Set(backups.map(({ fileName }) => fileName))).toEqual(
      new Set(['公考记忆卡备份-20260717-102030.zip']),
    );
    for (const backup of backups) {
      expect(existsSync(backup.filePath)).toBe(true);
      await expect(unzipper.Open.file(backup.filePath)).resolves.toBeDefined();
    }
  });

  it('恢复合法备份后同时替换数据库与图片，并返回稳定 JSON', async () => {
    const source = createTestDatabase();
    resources.push(source);
    setMarker(source, '备份值');
    const archive = await backupBuffer(source, {}, [
      { name: 'uploads/restored.png', content: 'restored-image' },
    ]);
    const { app, database, uploadsDirectory } = setup();
    setMarker(database, '当前值');
    writeFileSync(path.join(uploadsDirectory, 'current.png'), 'current-image');

    const response = await request(app)
      .post('/api/restores')
      .attach('backup', archive, { filename: 'backup.zip', contentType: 'application/zip' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ restored: true });
    expect(marker(database)).toBe('备份值');
    expect(readFileSync(path.join(uploadsDirectory, 'restored.png'), 'utf8')).toBe('restored-image');
    expect(existsSync(path.join(uploadsDirectory, 'current.png'))).toBe(false);
  });

  it('调用数据库替换前已经生成当前数据库和图片回滚点', async () => {
    const source = createTestDatabase();
    resources.push(source);
    setMarker(source, '备份值');
    const archivePath = path.join(source.directory, 'restore.zip');
    await writeFile(archivePath, await backupBuffer(source, {}, [{ name: 'uploads/new.png', content: 'new' }]));
    const { database, dataDirectory, uploadsDirectory } = setup();
    setMarker(database, '当前值');
    writeFileSync(path.join(uploadsDirectory, 'current.png'), 'current');
    const realReplace = database.manager.replaceFrom.bind(database.manager);
    const replaceFrom = vi.fn((replacementPath: string) => {
      const backupFiles = path.join(dataDirectory, 'backups');
      const names = existsSync(backupFiles) ? readFileNames(backupFiles) : [];
      expect(names.some((name) => name.endsWith('.db'))).toBe(true);
      expect(names.some((name) => name.endsWith('uploads/current.png'))).toBe(true);
      realReplace(replacementPath);
    });
    const service = createBackupService({
      database: { get: () => database.manager.get(), replaceFrom },
      dataDirectory,
      uploadsDirectory,
      now: () => new Date(fixedNow),
    });

    await expect(service.restoreBackup(archivePath)).resolves.toEqual({ restored: true });
    expect(replaceFrom).toHaveBeenCalled();
  });

  it('回滚图片复制中途失败时不替换当前数据库和图片', async () => {
    const source = createTestDatabase();
    resources.push(source);
    setMarker(source, '备份值');
    const archivePath = path.join(source.directory, 'restore.zip');
    await writeFile(archivePath, await backupBuffer(source));
    const { database, dataDirectory, uploadsDirectory } = setup();
    setMarker(database, '当前值');
    writeFileSync(path.join(uploadsDirectory, 'first.png'), 'first-current-image');
    writeFileSync(path.join(uploadsDirectory, 'second.jpg'), 'second-current-image');
    const realReplace = database.manager.replaceFrom.bind(database.manager);
    const replaceFrom = vi.fn((replacementPath: string) => realReplace(replacementPath));
    let copiedFiles = 0;
    const copyRollbackFile = vi.fn((sourcePath: string, destinationPath: string) => {
      copiedFiles += 1;
      if (copiedFiles === 2) throw new Error('private second rollback image copy failure');
      copyFileSync(sourcePath, destinationPath);
    });
    const service = createBackupService({
      database: { get: () => database.manager.get(), replaceFrom },
      dataDirectory,
      uploadsDirectory,
      copyRollbackFile,
    });

    await expect(service.restoreBackup(archivePath)).rejects.toMatchObject({
      code: 'restore_failed',
    });
    expect(copyRollbackFile).toHaveBeenCalledTimes(2);
    expect(replaceFrom).not.toHaveBeenCalled();
    expect(marker(database)).toBe('当前值');
    expect(readFileSync(path.join(uploadsDirectory, 'first.png'), 'utf8')).toBe(
      'first-current-image',
    );
    expect(readFileSync(path.join(uploadsDirectory, 'second.jpg'), 'utf8')).toBe(
      'second-current-image',
    );
  });

  it('同步回滚快照完成后排队的写入只在失败回滚后执行并保留', async () => {
    const source = createTestDatabase();
    resources.push(source);
    setMarker(source, '备份值');
    const archivePath = path.join(source.directory, 'restore.zip');
    await writeFile(archivePath, await backupBuffer(source));
    const { database, dataDirectory, uploadsDirectory } = setup();
    setMarker(database, '当前值');
    writeFileSync(path.join(uploadsDirectory, 'current.png'), 'current');
    const realSerialize = database.db.serialize.bind(database.db);
    const serialize = vi.spyOn(database.db, 'serialize').mockImplementation(() => {
      const bytes = realSerialize();
      queueMicrotask(() => {
        database.db
          .prepare('INSERT OR REPLACE INTO app_settings (key, value_json) VALUES (?, ?)')
          .run('snapshot-window-write', JSON.stringify('快照后写入'));
      });
      return bytes;
    });
    const applyUploads = vi.fn(() => {
      throw new Error('private image replacement failure');
    });
    const service = createBackupService({
      database: database.manager,
      dataDirectory,
      uploadsDirectory,
      applyUploads,
    });

    await expect(service.restoreBackup(archivePath)).rejects.toMatchObject({
      code: 'restore_failed',
    });
    await Promise.resolve();
    expect(serialize).toHaveBeenCalledOnce();
    expect(marker(database)).toBe('当前值');
    expect(
      JSON.parse(
        (
          database.db
            .prepare('SELECT value_json FROM app_settings WHERE key = ?')
            .get('snapshot-window-write') as { value_json: string }
        ).value_json,
      ),
    ).toBe('快照后写入');
    expect(readFileSync(path.join(uploadsDirectory, 'current.png'), 'utf8')).toBe('current');
  });

  it('接受真实 v1 应用数据库并在换入时迁移到当前结构', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'gongkao-v1-db-'));
    const databasePath = path.join(directory, 'v1.db');
    const v1 = new Database(databasePath);
    v1.exec(readFileSync(path.resolve('server/db/migrations/001_initial.sql'), 'utf8'));
    v1.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(
      1,
      fixedNow.toISOString(),
    );
    v1.close();
    const archive = await backupBufferWithDatabase(await readFile(databasePath));
    rmSync(directory, { recursive: true, force: true });
    const { app, database } = setup();

    const response = await request(app)
      .post('/api/restores')
      .attach('backup', archive, { filename: 'backup.zip', contentType: 'application/zip' });

    expect(response.status).toBe(200);
    expect(
      (database.db.pragma('table_info(cards)') as Array<{ name: string }>).map(({ name }) => name),
    ).toContain('template');
    expect(
      database.db.prepare('SELECT version FROM schema_migrations ORDER BY version').all(),
    ).toEqual([
      { version: 1 },
      { version: 2 },
      { version: 3 },
      { version: 4 },
      { version: 5 },
    ]);
  });

  it('备份不含 uploads 条目时恢复为空图片集', async () => {
    const source = createTestDatabase();
    resources.push(source);
    setMarker(source, '无图片备份');
    const archive = await backupBuffer(source);
    const { app, database, uploadsDirectory } = setup();
    writeFileSync(path.join(uploadsDirectory, 'current.png'), 'current');

    const response = await request(app)
      .post('/api/restores')
      .attach('backup', archive, { filename: 'backup.zip', contentType: 'application/zip' });

    expect(response.status).toBe(200);
    expect(marker(database)).toBe('无图片备份');
    expect(readdirSync(uploadsDirectory)).toEqual([]);
  });

  it('中央目录声明尺寸小于实际内容时在超限字节写出前拒绝并释放源文件', async () => {
    const source = createTestDatabase();
    resources.push(source);
    const entryName = 'uploads/forged.png';
    const normalArchive = await backupBuffer(source, {}, [
      { name: entryName, content: Buffer.alloc(3 * 1024 * 1024, 0x61) },
    ]);
    const forgedArchive = patchCentralUncompressedSize(normalArchive, entryName, 1);
    const { dataDirectory, service } = setup();
    const archivePath = path.join(source.directory, 'forged.zip');
    await writeFile(archivePath, forgedArchive);

    await expect(service.restoreBackup(archivePath)).rejects.toMatchObject({
      code: 'invalid_backup',
    });
    expect(() => rmSync(archivePath)).not.toThrow();
    const workingNames = readFileNames(path.join(dataDirectory, 'backups'));
    expect(workingNames.some((name) => /^(?:restore|rollback|active)-/.test(name))).toBe(false);
  });

  it('单张恢复图片超过 10MiB 时在覆盖当前数据前拒绝', async () => {
    const source = createTestDatabase();
    resources.push(source);
    const archive = await backupBuffer(source, {}, [
      { name: 'uploads/large.png', content: Buffer.alloc(10 * 1024 * 1024 + 1, 0x62) },
    ]);
    const { app, database } = setup();
    setMarker(database, '当前值');

    const response = await request(app)
      .post('/api/restores')
      .attach('backup', archive, { filename: 'backup.zip', contentType: 'application/zip' });

    expectSafeError(response, 400);
    expect(marker(database)).toBe('当前值');
  });

  it('中央目录与本地条目的压缩方法不一致时拒绝恢复', async () => {
    const source = createTestDatabase();
    resources.push(source);
    const entryName = 'uploads/method.png';
    const normalArchive = await backupBuffer(source, {}, [
      { name: entryName, content: Buffer.alloc(1024, 0x63) },
    ]);
    const offset = centralEntryOffset(normalArchive, entryName);
    expect(normalArchive.readUInt16LE(offset + 10)).not.toBe(0);
    const forgedArchive = patchCentralCompressionMethod(normalArchive, entryName, 0);
    const { app, database } = setup();
    setMarker(database, '当前值');

    const response = await request(app)
      .post('/api/restores')
      .attach('backup', forgedArchive, { filename: 'backup.zip', contentType: 'application/zip' });

    expectSafeError(response, 400);
    expect(marker(database)).toBe('当前值');
  });

  it.each([
    ['未来备份格式', { schemaVersion: 2 }, undefined],
    ['损坏数据库', {}, Buffer.from('not-a-sqlite-database')],
  ])('%s 不会覆盖当前数据库或图片', async (_name, manifestOverrides, databaseOverride) => {
    const source = createTestDatabase();
    resources.push(source);
    setMarker(source, '备份值');
    const sourceBytes = databaseOverride ?? (await databaseBytes(source));
    const archive = await zip([
      { name: 'manifest.json', content: JSON.stringify({ ...manifest, ...manifestOverrides }) },
      { name: 'gongkao.db', content: sourceBytes },
      { name: 'uploads/restored.png', content: 'restored' },
    ]);
    const { app, database, uploadsDirectory } = setup();
    setMarker(database, '当前值');
    writeFileSync(path.join(uploadsDirectory, 'current.png'), 'current');

    const response = await request(app)
      .post('/api/restores')
      .attach('backup', archive, { filename: 'backup.zip', contentType: 'application/zip' });

    expectSafeError(response, 400);
    expect(marker(database)).toBe('当前值');
    expect(readFileSync(path.join(uploadsDirectory, 'current.png'), 'utf8')).toBe('current');
    expect(existsSync(path.join(uploadsDirectory, 'restored.png'))).toBe(false);
  });

  it('完整但不是本应用的 SQLite 伪库不会覆盖当前数据', async () => {
    const fakeDirectory = await mkdtemp(path.join(tmpdir(), 'gongkao-fake-db-'));
    const fakePath = path.join(fakeDirectory, 'fake.db');
    const fake = new Database(fakePath);
    fake.exec('CREATE TABLE unrelated (id INTEGER PRIMARY KEY)');
    fake.close();
    const archive = await zip([
      { name: 'manifest.json', content: JSON.stringify(manifest) },
      { name: 'gongkao.db', content: await readFile(fakePath) },
    ]);
    rmSync(fakeDirectory, { recursive: true, force: true });
    const { app, database } = setup();
    setMarker(database, '当前值');

    const response = await request(app)
      .post('/api/restores')
      .attach('backup', archive, { filename: 'backup.zip', contentType: 'application/zip' });

    expectSafeError(response, 400);
    expect(marker(database)).toBe('当前值');
  });

  it('只有表名和少数字段相似的伪应用库不会通过可迁移性校验', async () => {
    const fakeDirectory = await mkdtemp(path.join(tmpdir(), 'gongkao-lookalike-db-'));
    const fakePath = path.join(fakeDirectory, 'fake.db');
    const fake = new Database(fakePath);
    fake.exec(`
      CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);
      INSERT INTO schema_migrations VALUES (1, '2026-07-17T10:20:30.000Z');
      CREATE TABLE categories (id TEXT, parent_id TEXT, name TEXT);
      CREATE TABLE cards (id TEXT, raw_input TEXT, ai_status TEXT);
      CREATE TABLE card_categories (card_id TEXT, category_id TEXT);
      CREATE TABLE tags (id TEXT, name TEXT);
      CREATE TABLE card_tags (card_id TEXT, tag_id TEXT, origin TEXT);
      CREATE TABLE attachments (id TEXT, card_id TEXT, stored_name TEXT);
      CREATE TABLE quiz_items (id TEXT, card_id TEXT, question TEXT, answer TEXT);
      CREATE TABLE review_logs (id TEXT, quiz_item_id TEXT, card_id TEXT);
      CREATE TABLE app_settings (key TEXT, value_json TEXT);
    `);
    fake.close();
    const archive = await backupBufferWithDatabase(await readFile(fakePath));
    rmSync(fakeDirectory, { recursive: true, force: true });
    const { app, database } = setup();
    setMarker(database, '当前值');

    const response = await request(app)
      .post('/api/restores')
      .attach('backup', archive, { filename: 'backup.zip', contentType: 'application/zip' });

    expectSafeError(response, 400);
    expect(marker(database)).toBe('当前值');
  });

  it('同名 VIEW 不能伪装成应用数据表', async () => {
    const source = createTestDatabase();
    resources.push(source);
    source.db.pragma('foreign_keys = OFF');
    source.db.exec(`
      DROP TABLE cards;
      CREATE VIEW cards AS SELECT
        '' AS id, '' AS entry_mode, '' AS raw_input, NULL AS raw_content_json,
        '' AS normalized_statement, '' AS wrong_point, '' AS analysis, '' AS mnemonic,
        '' AS extension, '' AS notes, '' AS source_type, '' AS source_detail,
        1 AS rating, '' AS mastery, 0 AS wrong_count, '' AS ai_status,
        0 AS ai_attempt_count, '' AS ai_error_code, 0 AS archived,
        '' AS created_at, '' AS updated_at, '' AS template;
    `);
    const archive = await backupBuffer(source);
    const { app, database } = setup();
    setMarker(database, '当前值');

    const response = await request(app)
      .post('/api/restores')
      .attach('backup', archive, { filename: 'backup.zip', contentType: 'application/zip' });

    expectSafeError(response, 400);
    expect(marker(database)).toBe('当前值');
  });

  it('列名相同但缺少类型、非空和主键约束的宽松表不能恢复', async () => {
    const source = createTestDatabase();
    resources.push(source);
    source.db.exec(`
      CREATE TABLE loose_settings AS SELECT * FROM app_settings;
      DROP TABLE app_settings;
      ALTER TABLE loose_settings RENAME TO app_settings;
    `);
    const archive = await backupBuffer(source);
    const { app, database } = setup();
    setMarker(database, '当前值');

    const response = await request(app)
      .post('/api/restores')
      .attach('backup', archive, { filename: 'backup.zip', contentType: 'application/zip' });

    expectSafeError(response, 400);
    expect(marker(database)).toBe('当前值');
  });

  it('仅删除 cards.entry_mode CHECK 且含非法行的数据库不能恢复', async () => {
    const source = createTestDatabase();
    resources.push(source);
    const directory = await mkdtemp(path.join(tmpdir(), 'gongkao-no-check-db-'));
    const databasePath = path.join(directory, 'no-check.db');
    await writeFile(databasePath, await databaseBytes(source));
    let modified = new Database(databasePath);
    const schema = modified
      .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'cards'")
      .get() as { sql: string };
    const withoutCheck = schema.sql.replace(
      " CHECK(entry_mode IN ('mistake', 'knowledge'))",
      '',
    );
    expect(withoutCheck).not.toBe(schema.sql);
    modified.pragma('foreign_keys = OFF');
    modified.pragma('legacy_alter_table = ON');
    modified.exec('ALTER TABLE cards RENAME TO cards_checked');
    modified.exec(withoutCheck);
    modified.exec(`
      INSERT INTO cards SELECT * FROM cards_checked;
      DROP TABLE cards_checked;
      CREATE INDEX idx_cards_ai_status ON cards(ai_status);
      CREATE INDEX idx_cards_archived ON cards(archived);
    `);
    modified
      .prepare(
        `INSERT INTO cards (id, entry_mode, raw_input, ai_status, created_at, updated_at)
         VALUES ('invalid-entry-mode', 'invalid', 'invalid', 'ready', ?, ?)`,
      )
      .run(fixedNow.toISOString(), fixedNow.toISOString());
    modified.close();
    const archive = await backupBufferWithDatabase(await readFile(databasePath));
    rmSync(directory, { recursive: true, force: true });
    const { app, database } = setup();
    setMarker(database, '当前值');

    const response = await request(app)
      .post('/api/restores')
      .attach('backup', archive, { filename: 'backup.zip', contentType: 'application/zip' });

    expectSafeError(response, 400);
    expect(marker(database)).toBe('当前值');
  });

  it('备份数据库包含未知 VIEW 或 TRIGGER 时拒绝恢复', async () => {
    const source = createTestDatabase();
    resources.push(source);
    source.db.exec(`
      CREATE VIEW unexpected_view AS SELECT 1 AS value;
      CREATE TRIGGER unexpected_trigger AFTER INSERT ON app_settings BEGIN SELECT 1; END;
    `);
    const archive = await backupBuffer(source);
    const { app, database } = setup();
    setMarker(database, '当前值');

    const response = await request(app)
      .post('/api/restores')
      .attach('backup', archive, { filename: 'backup.zip', contentType: 'application/zip' });

    expectSafeError(response, 400);
    expect(marker(database)).toBe('当前值');
  });

  it('数据库迁移版本高于当前应用时拒绝恢复', async () => {
    const source = createTestDatabase();
    resources.push(source);
    source.db
      .prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)')
      .run(999, fixedNow.toISOString());
    const archive = await backupBuffer(source);
    const { app, database } = setup();
    setMarker(database, '当前值');

    const response = await request(app)
      .post('/api/restores')
      .attach('backup', archive, { filename: 'backup.zip', contentType: 'application/zip' });

    expectSafeError(response, 400);
    expect(marker(database)).toBe('当前值');
  });

  it('外键检查失败的应用数据库不会覆盖当前数据', async () => {
    const source = createTestDatabase();
    resources.push(source);
    source.db.pragma('foreign_keys = OFF');
    source.db
      .prepare(
        `INSERT INTO attachments
          (id, card_id, stored_name, original_name, mime_type, byte_size, sort_order, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run('broken', 'missing-card', 'broken.png', 'broken.png', 'image/png', 1, 0, fixedNow.toISOString());
    const archive = await backupBuffer(source);
    const { app, database } = setup();
    setMarker(database, '当前值');

    const response = await request(app)
      .post('/api/restores')
      .attach('backup', archive, { filename: 'backup.zip', contentType: 'application/zip' });

    expectSafeError(response, 400);
    expect(marker(database)).toBe('当前值');
  });

  it.each([
    ['未知根条目', [{ name: 'other.txt', content: 'unknown' }]],
    ['嵌套 uploads 条目', [{ name: 'uploads/nested/file.png', content: 'nested' }]],
    ['隐藏 uploads 条目', [{ name: 'uploads/.env', content: 'hidden' }]],
    ['非图片 uploads 条目', [{ name: 'uploads/notes.txt', content: 'text' }]],
    [
      '重复条目',
      [
        { name: 'uploads/same.png', content: 'first' },
        { name: 'uploads/same.png', content: 'second' },
      ],
    ],
  ])('%s 在落盘前被拒绝', async (_name, entries) => {
    const source = createTestDatabase();
    resources.push(source);
    const archive = await backupBuffer(source, {}, entries);
    const { app, database, dataDirectory } = setup();
    setMarker(database, '当前值');

    const response = await request(app)
      .post('/api/restores')
      .attach('backup', archive, { filename: 'backup.zip', contentType: 'application/zip' });

    expectSafeError(response, 400);
    expect(marker(database)).toBe('当前值');
    expect(readFileNames(path.join(dataDirectory, 'backups')).some((name) => name.startsWith('restore-'))).toBe(
      false,
    );
  });

  it('中央目录标记为符号链接的条目在 Parse 写入前被拒绝', async () => {
    const source = createTestDatabase();
    resources.push(source);
    const archive = await backupWithSymlink(source);
    const { app, database } = setup();
    setMarker(database, '当前值');

    const response = await request(app)
      .post('/api/restores')
      .attach('backup', archive, { filename: 'backup.zip', contentType: 'application/zip' });

    expectSafeError(response, 400);
    expect(marker(database)).toBe('当前值');
  });

  it.each([
    ['父目录穿越', 'aa/outside.txt', '../outside.txt'],
    ['反斜杠穿越', 'aa/outside.txt', '..\\outside.txt'],
    ['POSIX 绝对路径', 'aa/outside.txt', '/a/outside.txt'],
    ['Windows 绝对路径', 'aa/outside.txt', 'C:\\outside.txt'],
  ])('%s ZIP 条目在写入前被拒绝', async (_name, safeName, unsafeName) => {
    const source = createTestDatabase();
    resources.push(source);
    const safeArchive = await backupBuffer(source, {}, [{ name: safeName, content: 'outside' }]);
    const archive = replaceEntryName(safeArchive, safeName, unsafeName);
    const { app, database, dataDirectory } = setup();
    setMarker(database, '当前值');
    const outsidePath = path.join(dataDirectory, 'backups', 'outside.txt');
    rmSync(outsidePath, { force: true });

    const response = await request(app)
      .post('/api/restores')
      .attach('backup', archive, { filename: 'backup.zip', contentType: 'application/zip' });

    expectSafeError(response, 400);
    expect(marker(database)).toBe('当前值');
    expect(existsSync(outsidePath)).toBe(false);
  });

  it.each([
    ['NUL 字节', 'aa/outside.txt', `a\0/outside.txt`],
    ['盘符冒号', 'aa/outside.txt', 'a:/outside.txt'],
    ['UNC 路径', 'a/outside.txt', '//outside.txt'],
  ])('%s 路径在写入前被拒绝', async (_name, safeName, unsafeName) => {
    const source = createTestDatabase();
    resources.push(source);
    const safeArchive = await backupBuffer(source, {}, [{ name: safeName, content: 'outside' }]);
    const archive = replaceEntryName(safeArchive, safeName, unsafeName);
    const { app, database } = setup();
    setMarker(database, '当前值');

    const response = await request(app)
      .post('/api/restores')
      .attach('backup', archive, { filename: 'backup.zip', contentType: 'application/zip' });

    expectSafeError(response, 400);
    expect(marker(database)).toBe('当前值');
  });

  it('图片替换失败后恢复旧数据库和旧图片', async () => {
    const source = createTestDatabase();
    resources.push(source);
    setMarker(source, '备份值');
    const archive = await backupBuffer(source, {}, [{ name: 'uploads/new.png', content: 'new' }]);
    const { database, dataDirectory, uploadsDirectory } = setup();
    setMarker(database, '当前值');
    writeFileSync(path.join(uploadsDirectory, 'current.png'), 'current');
    const applyUploads = vi.fn(() => {
      rmSync(uploadsDirectory, { recursive: true, force: true });
      throw new Error('private image replacement failure');
    });
    const service = createBackupService({
      database: database.manager,
      dataDirectory,
      uploadsDirectory,
      now: () => new Date(fixedNow),
      applyUploads,
    });
    const app = createApp({ backupService: service });

    const response = await request(app)
      .post('/api/restores')
      .attach('backup', archive, { filename: 'backup.zip', contentType: 'application/zip' });

    expectSafeError(response, 500);
    expect(applyUploads).toHaveBeenCalledOnce();
    expect(marker(database)).toBe('当前值');
    expect(readFileSync(path.join(uploadsDirectory, 'current.png'), 'utf8')).toBe('current');
    expect(existsSync(path.join(uploadsDirectory, 'new.png'))).toBe(false);
  });

  it('业务替换成功后的清理失败不回滚已经恢复的数据', async () => {
    const source = createTestDatabase();
    resources.push(source);
    setMarker(source, '备份值');
    const archive = await backupBuffer(source, {}, [{ name: 'uploads/new.png', content: 'new' }]);
    const { database, dataDirectory, uploadsDirectory } = setup();
    setMarker(database, '当前值');
    writeFileSync(path.join(uploadsDirectory, 'current.png'), 'current');
    const cleanupPaths = vi.fn(async () => {
      throw new Error('private cleanup failure');
    });
    const service = createBackupService({
      database: database.manager,
      dataDirectory,
      uploadsDirectory,
      now: () => new Date(fixedNow),
      cleanupPaths,
    });
    const app = createApp({ backupService: service });

    const response = await request(app)
      .post('/api/restores')
      .attach('backup', archive, { filename: 'backup.zip', contentType: 'application/zip' });

    expect(response.status).toBe(200);
    expect(cleanupPaths).toHaveBeenCalled();
    expect(marker(database)).toBe('备份值');
    expect(readFileSync(path.join(uploadsDirectory, 'new.png'), 'utf8')).toBe('new');
    expect(existsSync(path.join(uploadsDirectory, 'current.png'))).toBe(false);
  });

  it('图片回滚源缺失时不先删除仍然可用的当前图片', async () => {
    const source = createTestDatabase();
    resources.push(source);
    setMarker(source, '备份值');
    const archive = await backupBuffer(source, {}, [{ name: 'uploads/new.png', content: 'new' }]);
    const { database, dataDirectory, uploadsDirectory } = setup();
    setMarker(database, '当前值');
    writeFileSync(path.join(uploadsDirectory, 'current.png'), 'current');
    const applyUploads = vi.fn(
      async (_incoming: string, _active: string, backupsRoot: string, operationId: string) => {
        rmSync(path.join(backupsRoot, `rollback-${operationId}-uploads`), {
          recursive: true,
          force: true,
        });
        throw new Error('private image replacement failure');
      },
    );
    const service = createBackupService({
      database: database.manager,
      dataDirectory,
      uploadsDirectory,
      now: () => new Date(fixedNow),
      applyUploads,
    });
    const app = createApp({ backupService: service });

    const response = await request(app)
      .post('/api/restores')
      .attach('backup', archive, { filename: 'backup.zip', contentType: 'application/zip' });

    expectSafeError(response, 500);
    expect(marker(database)).toBe('当前值');
    expect(readFileSync(path.join(uploadsDirectory, 'current.png'), 'utf8')).toBe('current');
  });

  it('生产默认图片替换在数据库换入后不让出事件循环', async () => {
    const source = createTestDatabase();
    resources.push(source);
    setMarker(source, '备份值');
    const archivePath = path.join(source.directory, 'restore.zip');
    await writeFile(
      archivePath,
      await backupBuffer(source, {}, [{ name: 'uploads/new.png', content: 'new' }]),
    );
    const { database, dataDirectory, uploadsDirectory } = setup();
    setMarker(database, '当前值');
    writeFileSync(path.join(uploadsDirectory, 'current.png'), 'current');
    const realReplace = database.manager.replaceFrom.bind(database.manager);
    let imagesReplacedBeforeYield = false;
    const replaceFrom = vi.fn((replacementPath: string) => {
      realReplace(replacementPath);
      queueMicrotask(() => {
        imagesReplacedBeforeYield =
          existsSync(path.join(uploadsDirectory, 'new.png')) &&
          !existsSync(path.join(uploadsDirectory, 'current.png'));
      });
    });
    const service = createBackupService({
      database: { get: () => database.manager.get(), replaceFrom },
      dataDirectory,
      uploadsDirectory,
    });

    await expect(service.restoreBackup(archivePath)).resolves.toEqual({ restored: true });
    await Promise.resolve();
    expect(imagesReplacedBeforeYield).toBe(true);
  });

  it('异步图片故障不得在数据库换入与回滚之间形成写入丢失窗口', async () => {
    const source = createTestDatabase();
    resources.push(source);
    setMarker(source, '备份值');
    const archivePath = path.join(source.directory, 'restore.zip');
    await writeFile(archivePath, await backupBuffer(source));
    const { database, dataDirectory, uploadsDirectory } = setup();
    setMarker(database, '当前值');
    const asynchronousApply = vi.fn(async () => {
      await Promise.resolve();
      database.db
        .prepare('INSERT OR REPLACE INTO app_settings (key, value_json) VALUES (?, ?)')
        .run('window-write', JSON.stringify('窗口写入'));
      throw new Error('private async image failure');
    });
    const service = createBackupService({
      database: database.manager,
      dataDirectory,
      uploadsDirectory,
      applyUploads: asynchronousApply as unknown as () => void,
    });

    await expect(service.restoreBackup(archivePath)).rejects.toMatchObject({
      code: 'restore_failed',
    });
    await Promise.resolve();
    expect(marker(database)).toBe('当前值');
    expect(
      JSON.parse(
        (
          database.db
            .prepare('SELECT value_json FROM app_settings WHERE key = ?')
            .get('window-write') as { value_json: string }
        ).value_json,
      ),
    ).toBe('窗口写入');
  });

  it('非法 ZIP 的原错误不被清理失败掩盖', async () => {
    const { app, database, dataDirectory, uploadsDirectory } = setup();
    setMarker(database, '当前值');
    const cleanupPaths = vi.fn(async () => {
      throw new Error('private cleanup failure');
    });
    const service = createBackupService({
      database: database.manager,
      dataDirectory,
      uploadsDirectory,
      cleanupPaths,
    });
    const cleanupApp = createApp({ backupService: service });

    const response = await request(cleanupApp)
      .post('/api/restores')
      .attach('backup', Buffer.from('not-a-zip'), {
        filename: 'backup.zip',
        contentType: 'application/zip',
      });

    expectSafeError(response, 400);
    expect(cleanupPaths).toHaveBeenCalled();
    expect(marker(database)).toBe('当前值');
    expect(app).toBeDefined();
  });

  it('非法 ZIP 失败后释放源文件句柄并清理工作目录', async () => {
    const { dataDirectory, service } = setup();
    const archivePath = path.join(dataDirectory, 'invalid.zip');
    writeFileSync(archivePath, 'not-a-zip');

    await expect(service.restoreBackup(archivePath)).rejects.toMatchObject({
      code: 'invalid_backup',
    });
    expect(() => rmSync(archivePath)).not.toThrow();
    expect(
      readFileNames(path.join(dataDirectory, 'backups')).some((name) =>
        /^(?:restore|rollback|active)-/.test(name),
      ),
    ).toBe(false);
  });

  it('数据库替换失败时恢复当前数据库和图片并返回脱敏内部错误', async () => {
    const source = createTestDatabase();
    resources.push(source);
    setMarker(source, '备份值');
    const archive = await backupBuffer(source, {}, [{ name: 'uploads/new.png', content: 'new' }]);
    const { database, dataDirectory, uploadsDirectory } = setup();
    setMarker(database, '当前值');
    writeFileSync(path.join(uploadsDirectory, 'current.png'), 'current');
    const service = createBackupService({
      database: {
        get: () => database.manager.get(),
        replaceFrom() {
          throw new Error('private replacement path and SQL');
        },
      },
      dataDirectory,
      uploadsDirectory,
      now: () => new Date(fixedNow),
    });
    const app = createApp({ backupService: service });

    const response = await request(app)
      .post('/api/restores')
      .attach('backup', archive, { filename: 'backup.zip', contentType: 'application/zip' });

    expectSafeError(response, 500);
    expect(marker(database)).toBe('当前值');
    expect(readFileSync(path.join(uploadsDirectory, 'current.png'), 'utf8')).toBe('current');
    expect(existsSync(path.join(uploadsDirectory, 'new.png'))).toBe(false);
  });

  it('严格限制恢复上传字段、文件数量、类型和大小', async () => {
    const { app } = setup();
    const noFile = await request(app).post('/api/restores');
    const wrongField = await request(app)
      .post('/api/restores')
      .attach('archive', Buffer.from('zip'), { filename: 'backup.zip', contentType: 'application/zip' });
    const wrongType = await request(app)
      .post('/api/restores')
      .attach('backup', Buffer.from('text'), { filename: 'backup.txt', contentType: 'text/plain' });
    const multiple = await request(app)
      .post('/api/restores')
      .attach('backup', Buffer.from('first'), { filename: 'first.zip', contentType: 'application/zip' })
      .attach('backup', Buffer.from('second'), { filename: 'second.zip', contentType: 'application/zip' });
    const extraField = await request(app)
      .post('/api/restores')
      .field('note', 'not allowed')
      .attach('backup', Buffer.from('zip'), { filename: 'backup.zip', contentType: 'application/zip' });

    for (const response of [noFile, wrongField, wrongType, multiple, extraField]) {
      expectSafeError(response, 400);
    }
  });

  it('上传参数错误映射为 400/413，未知磁盘错误映射为脱敏 500', () => {
    const mapper = Reflect.get(backupRoutes, 'mapBackupUploadError') as
      | ((error: unknown) => { status: number; body: { code: string; message: string } })
      | undefined;
    expect(typeof mapper).toBe('function');
    if (!mapper) return;

    for (const code of [
      'LIMIT_UNEXPECTED_FILE',
      'LIMIT_FIELD_NESTING',
      'MISSING_FIELD_NAME',
    ] as const) {
      expect(mapper(new multer.MulterError(code as never, 'backup')).status).toBe(400);
    }
    expect(mapper(new multer.MulterError('LIMIT_FILE_SIZE', 'backup')).status).toBe(413);
    for (const code of ['ENOSPC', 'EACCES', 'EMFILE']) {
      const mapped = mapper(Object.assign(new Error('private disk path'), { code }));
      expect(mapped).toEqual({
        status: 500,
        body: { code: 'internal_error', message: expect.any(String) },
      });
      expect(JSON.stringify(mapped)).not.toContain('private disk path');
    }
  });
});

function readFileNames(directory: string, prefix = ''): string[] {
  return requireDirectoryEntries(directory).flatMap((entry) => {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    return entry.isDirectory()
      ? [relative, ...readFileNames(path.join(directory, entry.name), relative)]
      : [relative];
  });
}

function requireDirectoryEntries(directory: string) {
  return [...new Set(readDirectory(directory))];
}

function readDirectory(directory: string) {
  return readdirSync(directory, { withFileTypes: true });
}
