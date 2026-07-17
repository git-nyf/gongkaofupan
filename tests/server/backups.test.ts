import {
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
import request, { type Response } from 'supertest';
import unzipper from 'unzipper';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../server/app';
import { createBackupService } from '../../server/backups/service';
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
    ).toEqual([{ version: 1 }, { version: 2 }]);
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
    const applyUploads = vi.fn(async () => {
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
