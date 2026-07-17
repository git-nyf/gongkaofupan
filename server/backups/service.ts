import { randomUUID } from 'node:crypto';
import {
  copyFileSync,
  createReadStream,
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
} from 'node:fs';
import {
  mkdir,
  readdir,
  readFile,
  rename,
  rm,
} from 'node:fs/promises';
import path from 'node:path';
import { Transform } from 'node:stream';
import { finished, pipeline } from 'node:stream/promises';
import archiver from 'archiver';
import Database from 'better-sqlite3';
import unzipper, { type Entry, type File as ZipFile } from 'unzipper';
import { migrate } from '../db/migrations';

const backupFormat = 'gongkao-memory-card-backup';
const backupSchemaVersion = 1;
const maximumEntryCount = 10_000;
const maximumUncompressedBytes = 1024 * 1024 * 1024;
const maximumManifestBytes = 64 * 1024;
const maximumImageBytes = 10 * 1024 * 1024;
const allowedImageExtensions = new Set(['.png', '.jpg', '.jpeg', '.webp']);

interface DatabaseManager {
  get(): Database.Database;
  replaceFrom(filePath: string): void;
}

export interface BackupService {
  createBackup(): Promise<{ filePath: string; fileName: string }>;
  restoreBackup(filePath: string): Promise<{ restored: true }>;
}

export class BackupServiceError extends Error {
  constructor(readonly code: 'invalid_backup' | 'restore_failed') {
    super(code);
  }
}

interface BackupServiceDependencies {
  database: DatabaseManager;
  dataDirectory: string;
  uploadsDirectory: string;
  now?: () => Date;
  applyUploads?: typeof replaceUploads;
  cleanupPaths?: typeof cleanupRestorePaths;
}

interface Manifest {
  format: typeof backupFormat;
  schemaVersion: typeof backupSchemaVersion;
  createdAt: string;
}

interface PreparedRestore {
  databasePath: string;
  uploadsPath: string;
}

interface ExpectedZipEntry {
  type: 'File' | 'Directory';
  uncompressedSize: number;
  flags: number;
  compressionMethod: number;
}

export function createBackupService({
  database,
  dataDirectory,
  uploadsDirectory,
  now = () => new Date(),
  applyUploads = replaceUploads,
  cleanupPaths = cleanupRestorePaths,
}: BackupServiceDependencies): BackupService {
  const dataRoot = path.resolve(dataDirectory);
  const uploadsRoot = path.resolve(uploadsDirectory);
  const backupsRoot = path.resolve(dataRoot, 'backups');

  return {
    async createBackup() {
      await mkdir(backupsRoot, { recursive: true });
      const createdAt = now();
      const fileName = `公考记忆卡备份-${formatTimestamp(createdAt)}.zip`;
      const workingId = randomUUID();
      const filePath = path.join(
        backupsRoot,
        `backup-${formatTimestamp(createdAt)}-${workingId}.zip`,
      );
      const snapshotPath = path.join(backupsRoot, `snapshot-${workingId}.db`);
      const archivePath = path.join(backupsRoot, `backup-${workingId}.tmp`);

      try {
        await database.get().backup(snapshotPath);
        await writeBackupArchive({
          archivePath,
          snapshotPath,
          uploadsRoot,
          manifest: {
            format: backupFormat,
            schemaVersion: backupSchemaVersion,
            createdAt: createdAt.toISOString(),
          },
        });
        await rename(archivePath, filePath);
        return { filePath, fileName };
      } finally {
        await rm(snapshotPath, { force: true });
        await rm(archivePath, { force: true });
      }
    },

    async restoreBackup(filePath) {
      await mkdir(backupsRoot, { recursive: true });
      const operationId = randomUUID();
      const stagingPath = path.join(backupsRoot, `restore-${operationId}`);
      const rollbackDatabasePath = path.join(backupsRoot, `rollback-${operationId}.db`);
      const rollbackUploadsPath = path.join(backupsRoot, `rollback-${operationId}-uploads`);
      const activeUploadsPath = path.join(backupsRoot, `active-${operationId}-uploads`);
      let rollbackFailed = false;
      try {
        await mkdir(stagingPath, { recursive: false });
        const prepared = await prepareRestore(filePath, stagingPath);

        await database.get().backup(rollbackDatabasePath);
        await copyOrdinaryFiles(uploadsRoot, rollbackUploadsPath);

        // 用户批准：换库、图片替换和失败回滚保持在同一同步临界段，避免写入落到待回滚的新库。
        try {
          database.replaceFrom(prepared.databasePath);
          const result = applyUploads(
            prepared.uploadsPath,
            uploadsRoot,
            backupsRoot,
            operationId,
          ) as unknown;
          if (isPromiseLike(result)) {
            void Promise.resolve(result).catch(() => undefined);
            throw new Error('图片替换操作必须同步完成');
          }
        } catch {
          const rollbackErrors: unknown[] = [];
          try {
            database.replaceFrom(rollbackDatabasePath);
          } catch (rollbackError) {
            rollbackErrors.push(rollbackError);
          }
          try {
            restoreUploads(rollbackUploadsPath, uploadsRoot);
          } catch (rollbackError) {
            rollbackErrors.push(rollbackError);
          }

          if (rollbackErrors.length === 0) {
            await bestEffortCleanup(
              cleanupPaths,
              stagingPath,
              rollbackDatabasePath,
              rollbackUploadsPath,
              activeUploadsPath,
            );
          } else {
            rollbackFailed = true;
          }
          throw new BackupServiceError('restore_failed');
        }

        await bestEffortCleanup(
          cleanupPaths,
          stagingPath,
          rollbackDatabasePath,
          rollbackUploadsPath,
          activeUploadsPath,
        );
        return { restored: true };
      } catch (error) {
        if (!rollbackFailed) {
          await bestEffortCleanup(
            cleanupPaths,
            stagingPath,
            rollbackDatabasePath,
            rollbackUploadsPath,
            activeUploadsPath,
          );
        }
        if (error instanceof BackupServiceError) throw error;
        throw new BackupServiceError('restore_failed');
      }
    },
  };
}

async function writeBackupArchive({
  archivePath,
  snapshotPath,
  uploadsRoot,
  manifest,
}: {
  archivePath: string;
  snapshotPath: string;
  uploadsRoot: string;
  manifest: Manifest;
}) {
  const imageFiles = await listOrdinaryFiles(uploadsRoot, isBackupImageName);
  const output = createWriteStream(archivePath, { flags: 'wx' });
  const archive = archiver('zip', { zlib: { level: 9 } });
  const inputs = [snapshotPath, ...imageFiles.map(({ absolutePath }) => absolutePath)].map(
    (filePath) => createReadStream(filePath),
  );
  const completed = new Promise<void>((resolve, reject) => {
    output.on('close', resolve);
    output.on('error', reject);
    archive.on('error', reject);
    archive.on('warning', reject);
  });

  try {
    archive.pipe(output);
    archive.append(JSON.stringify(manifest), { name: 'manifest.json' });
    archive.append(inputs[0], { name: 'gongkao.db' });
    imageFiles.forEach((file, index) => {
      archive.append(inputs[index + 1], { name: `uploads/${file.relativePath}` });
    });
    await Promise.all([archive.finalize(), completed]);
  } catch (error) {
    archive.abort();
    throw error;
  } finally {
    inputs.forEach((input) => input.destroy());
    output.destroy();
    archive.destroy();
    await Promise.allSettled([
      finished(output),
      finished(archive),
      ...inputs.map((input) => finished(input)),
    ]);
  }
}

async function listOrdinaryFiles(
  directory: string,
  include: (fileName: string) => boolean = () => true,
): Promise<Array<{ absolutePath: string; relativePath: string }>> {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (isMissingPath(error)) return [];
    throw error;
  }

  const files: Array<{ absolutePath: string; relativePath: string }> = [];
  for (const entry of entries) {
    if (entry.isFile() && include(entry.name)) {
      files.push({
        absolutePath: path.join(directory, entry.name),
        relativePath: entry.name,
      });
    }
  }
  return files;
}

function isBackupImageName(fileName: string) {
  return !fileName.startsWith('.') && allowedImageExtensions.has(path.extname(fileName).toLowerCase());
}

async function prepareRestore(filePath: string, stagingPath: string): Promise<PreparedRestore> {
  try {
    const expectedEntries = await inspectCentralDirectory(filePath);
    await extractValidatedEntries(filePath, stagingPath, expectedEntries);
    const manifestPath = path.join(stagingPath, 'manifest.json');
    const databasePath = path.join(stagingPath, 'gongkao.db');
    validateManifest(await readFile(manifestPath, 'utf8'));
    validateApplicationDatabase(databasePath);
    const uploadsPath = path.join(stagingPath, 'uploads');
    await mkdir(uploadsPath, { recursive: true });
    return { databasePath, uploadsPath };
  } catch (error) {
    if (error instanceof BackupServiceError) throw error;
    throw new BackupServiceError('invalid_backup');
  }
}

async function inspectCentralDirectory(filePath: string) {
  const directory = await unzipper.Open.file(filePath);
  if (directory.files.length === 0 || directory.files.length > maximumEntryCount) {
    throw new BackupServiceError('invalid_backup');
  }

  const expected = new Map<string, ExpectedZipEntry>();
  let totalBytes = 0;
  for (const entry of directory.files) {
    const entryPath = validateEntryPath(entry.path, entry.type);
    validateCentralEntryType(entry);
    validateDeclaredSize(entryPath, entry.type, entry.uncompressedSize);
    const key = entryPath.toLowerCase();
    if (expected.has(key)) throw new BackupServiceError('invalid_backup');
    expected.set(key, {
      type: entry.type,
      uncompressedSize: entry.uncompressedSize,
      flags: entry.flags,
      compressionMethod: entry.compressionMethod,
    });
    totalBytes += entry.uncompressedSize;
    if (!Number.isSafeInteger(totalBytes) || totalBytes > maximumUncompressedBytes) {
      throw new BackupServiceError('invalid_backup');
    }
  }

  if (
    expected.get('manifest.json')?.type !== 'File' ||
    expected.get('gongkao.db')?.type !== 'File'
  ) {
    throw new BackupServiceError('invalid_backup');
  }
  return expected;
}

function validateDeclaredSize(entryPath: string, type: string, size: number) {
  if (!Number.isSafeInteger(size) || size < 0) {
    throw new BackupServiceError('invalid_backup');
  }
  if (type === 'Directory' && size !== 0) {
    throw new BackupServiceError('invalid_backup');
  }
  if (entryPath === 'manifest.json' && size > maximumManifestBytes) {
    throw new BackupServiceError('invalid_backup');
  }
  if (entryPath.startsWith('uploads/') && size > maximumImageBytes) {
    throw new BackupServiceError('invalid_backup');
  }
}

function validateCentralEntryType(entry: ZipFile) {
  if (entry.type !== 'File' && entry.type !== 'Directory') {
    throw new BackupServiceError('invalid_backup');
  }
  if ((entry.flags & 1) !== 0) throw new BackupServiceError('invalid_backup');

  const madeByUnix = entry.versionMadeBy >> 8 === 3;
  const unixMode = madeByUnix ? (entry.externalFileAttributes >>> 16) & 0xffff : 0;
  const fileType = unixMode & 0o170000;
  if (
    fileType !== 0 &&
    fileType !== (entry.type === 'Directory' ? 0o040000 : 0o100000)
  ) {
    throw new BackupServiceError('invalid_backup');
  }
}

function validateEntryPath(entryPath: string, type: string) {
  if (
    entryPath.length === 0 ||
    entryPath.includes('\0') ||
    entryPath.includes('\\') ||
    entryPath.includes(':') ||
    entryPath.startsWith('/') ||
    entryPath.startsWith('//') ||
    path.posix.isAbsolute(entryPath) ||
    path.win32.isAbsolute(entryPath)
  ) {
    throw new BackupServiceError('invalid_backup');
  }

  const normalized = entryPath.endsWith('/') ? entryPath.slice(0, -1) : entryPath;
  const segments = normalized.split('/');
  if (segments.some((segment) => segment.length === 0 || segment === '.' || segment === '..')) {
    throw new BackupServiceError('invalid_backup');
  }

  const isRootFile = normalized === 'manifest.json' || normalized === 'gongkao.db';
  const isUploadsDirectory = normalized === 'uploads' && type === 'Directory';
  const isUploadFile =
    type === 'File' &&
    segments.length === 2 &&
    segments[0] === 'uploads' &&
    isBackupImageName(segments[1]);
  if (!isRootFile && !isUploadsDirectory && !isUploadFile) {
    throw new BackupServiceError('invalid_backup');
  }
  if (type === 'Directory' && !isUploadsDirectory) {
    throw new BackupServiceError('invalid_backup');
  }
  return normalized;
}

async function extractValidatedEntries(
  filePath: string,
  stagingPath: string,
  expectedEntries: Map<string, ExpectedZipEntry>,
) {
  const parsedEntries = new Set<string>();
  const actualTotal = { bytes: 0 };
  const input = createReadStream(filePath);
  const parser = unzipper.Parse({ forceStream: true });
  input.pipe(parser);

  try {
    for await (const entry of parser as AsyncIterable<Entry>) {
      const entryPath = validateEntryPath(entry.path, entry.type);
      const key = entryPath.toLowerCase();
      const expected = expectedEntries.get(key);
      if (
        !expected ||
        expected.type !== entry.type ||
        expected.flags !== entry.vars.flags ||
        expected.compressionMethod !== entry.vars.compressionMethod ||
        parsedEntries.has(key)
      ) {
        await entry.autodrain().promise();
        throw new BackupServiceError('invalid_backup');
      }
      parsedEntries.add(key);

      const target = path.resolve(stagingPath, entryPath);
      if (!target.startsWith(`${stagingPath}${path.sep}`)) {
        await entry.autodrain().promise();
        throw new BackupServiceError('invalid_backup');
      }
      if (entry.type === 'Directory') {
        await mkdir(target, { recursive: true });
        await entry.autodrain().promise();
      } else {
        await mkdir(path.dirname(target), { recursive: true });
        const counter = createByteCounter(expected.uncompressedSize, actualTotal);
        await pipeline(entry, counter.stream, createWriteStream(target, { flags: 'wx' }));
        if (counter.bytes() !== expected.uncompressedSize) {
          throw new BackupServiceError('invalid_backup');
        }
      }
    }
  } finally {
    input.unpipe(parser);
    input.destroy();
    parser.destroy();
    await Promise.allSettled([finished(input), finished(parser)]);
  }

  if (parsedEntries.size !== expectedEntries.size) {
    throw new BackupServiceError('invalid_backup');
  }
}

function createByteCounter(declaredBytes: number, actualTotal: { bytes: number }) {
  let entryBytes = 0;
  const stream = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      const nextEntryBytes = entryBytes + chunk.length;
      const nextTotalBytes = actualTotal.bytes + chunk.length;
      if (
        nextEntryBytes > declaredBytes ||
        nextTotalBytes > maximumUncompressedBytes
      ) {
        callback(new BackupServiceError('invalid_backup'));
        return;
      }
      entryBytes = nextEntryBytes;
      actualTotal.bytes = nextTotalBytes;
      callback(null, chunk);
    },
  });
  return { stream, bytes: () => entryBytes };
}

function validateManifest(content: string) {
  let value: unknown;
  try {
    value = JSON.parse(content);
  } catch {
    throw new BackupServiceError('invalid_backup');
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new BackupServiceError('invalid_backup');
  }
  const keys = Object.keys(value).sort();
  if (keys.join(',') !== 'createdAt,format,schemaVersion') {
    throw new BackupServiceError('invalid_backup');
  }
  const record = value as Record<string, unknown>;
  const createdAt = typeof record.createdAt === 'string' ? new Date(record.createdAt) : undefined;
  if (
    record.format !== backupFormat ||
    record.schemaVersion !== backupSchemaVersion ||
    !createdAt ||
    Number.isNaN(createdAt.getTime()) ||
    createdAt.toISOString() !== record.createdAt
  ) {
    throw new BackupServiceError('invalid_backup');
  }
}

function validateApplicationDatabase(filePath: string) {
  let database: Database.Database | undefined;
  let currentCanonical: Database.Database | undefined;
  let targetCanonical: Database.Database | undefined;
  try {
    database = new Database(filePath, { readonly: true, fileMustExist: true });
    if (database.pragma('integrity_check', { simple: true }) !== 'ok') {
      throw new BackupServiceError('invalid_backup');
    }
    if ((database.pragma('foreign_key_check') as unknown[]).length !== 0) {
      throw new BackupServiceError('invalid_backup');
    }
    currentCanonical = new Database(':memory:');
    migrate(currentCanonical);
    const currentVersions = readMigrationVersions(currentCanonical);
    const candidateVersions = readMigrationVersions(database);
    validateMigrationSequence(candidateVersions, currentVersions.at(-1));

    const targetVersion = candidateVersions.at(-1)!;
    if (targetVersion === currentVersions.at(-1)) {
      targetCanonical = currentCanonical;
    } else if (targetVersion === 1) {
      targetCanonical = new Database(':memory:');
      targetCanonical.exec(
        readFileSync(
          path.resolve(process.cwd(), 'server', 'db', 'migrations', '001_initial.sql'),
          'utf8',
        ),
      );
    } else {
      throw new BackupServiceError('invalid_backup');
    }
    validateSchemaAgainstCanonical(database, targetCanonical);
  } catch (error) {
    if (error instanceof BackupServiceError) throw error;
    throw new BackupServiceError('invalid_backup');
  } finally {
    database?.close();
    if (targetCanonical !== currentCanonical) targetCanonical?.close();
    currentCanonical?.close();
  }
}

function readMigrationVersions(database: Database.Database) {
  const rows = database
    .prepare('SELECT version FROM schema_migrations ORDER BY version')
    .all() as Array<{ version: number }>;
  return rows.map(({ version }) => version);
}

function validateMigrationSequence(versions: number[], currentVersion: number | undefined) {
  if (!currentVersion || versions.length === 0 || versions.at(-1)! > currentVersion) {
    throw new BackupServiceError('invalid_backup');
  }
  versions.forEach((version, index) => {
    if (version !== index + 1) {
      throw new BackupServiceError('invalid_backup');
    }
  });
}

function validateSchemaAgainstCanonical(
  database: Database.Database,
  canonical: Database.Database,
) {
  const specialObjects = (item: Database.Database) =>
    item
      .prepare(
        "SELECT type, name FROM sqlite_master WHERE type IN ('view', 'trigger') ORDER BY type, name",
      )
      .all();
  if (JSON.stringify(specialObjects(database)) !== JSON.stringify(specialObjects(canonical))) {
    throw new BackupServiceError('invalid_backup');
  }

  const tables = canonical
    .prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
    )
    .all() as Array<{ name: string }>;
  for (const { name } of tables) {
    const object = database
      .prepare('SELECT type FROM sqlite_master WHERE name = ?')
      .get(name) as { type: string } | undefined;
    if (object?.type !== 'table') {
      throw new BackupServiceError('invalid_backup');
    }
    if (
      JSON.stringify(readTableInfo(database, name)) !==
        JSON.stringify(readTableInfo(canonical, name)) ||
      JSON.stringify(readForeignKeys(database, name)) !==
        JSON.stringify(readForeignKeys(canonical, name)) ||
      JSON.stringify(readUniqueIndexes(database, name)) !==
        JSON.stringify(readUniqueIndexes(canonical, name))
    ) {
      throw new BackupServiceError('invalid_backup');
    }
  }
}

function readTableInfo(database: Database.Database, table: string) {
  return (
    database.pragma(`table_info(${quoteIdentifier(table)})`) as Array<{
      name: string;
      type: string;
      notnull: number;
      dflt_value: string | null;
      pk: number;
    }>
  ).map(({ name, type, notnull, dflt_value, pk }) => ({
    name,
    type,
    notnull,
    dflt_value,
    pk,
  }));
}

function readForeignKeys(database: Database.Database, table: string) {
  return database.pragma(`foreign_key_list(${quoteIdentifier(table)})`);
}

function readUniqueIndexes(database: Database.Database, table: string) {
  const indexes = database.pragma(`index_list(${quoteIdentifier(table)})`) as Array<{
    name: string;
    unique: number;
    origin: string;
    partial: number;
  }>;
  return indexes
    .filter(({ unique }) => unique === 1)
    .map(({ name, origin, partial }) => ({
      origin,
      partial,
      columns: (
        database.pragma(`index_info(${quoteIdentifier(name)})`) as Array<{
          seqno: number;
          name: string;
        }>
      )
        .sort((left, right) => left.seqno - right.seqno)
        .map(({ name: column }) => column),
    }))
    .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
}

function quoteIdentifier(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

async function copyOrdinaryFiles(source: string, destination: string) {
  await mkdir(destination, { recursive: true });
  for (const file of await listOrdinaryFiles(source)) {
    const target = path.join(destination, ...file.relativePath.split('/'));
    await mkdir(path.dirname(target), { recursive: true });
    await pipeline(createReadStream(file.absolutePath), createWriteStream(target, { flags: 'wx' }));
  }
}

function replaceUploads(
  incomingUploads: string,
  uploadsRoot: string,
  backupsRoot: string,
  operationId: string,
) {
  const heldUploads = path.join(backupsRoot, `active-${operationId}-uploads`);
  let held = false;
  try {
    if (existsSync(uploadsRoot)) {
      renameSync(uploadsRoot, heldUploads);
      held = true;
    }
    mkdirSync(path.dirname(uploadsRoot), { recursive: true });
    renameSync(incomingUploads, uploadsRoot);
    rmSync(heldUploads, { recursive: true, force: true });
  } catch (error) {
    if (held && !existsSync(uploadsRoot)) {
      try {
        renameSync(heldUploads, uploadsRoot);
      } catch {
        // 外层会使用独立图片回滚点再次恢复。
      }
    }
    throw error;
  }
}

function restoreUploads(rollbackUploads: string, uploadsRoot: string) {
  const rollbackStat = statSync(rollbackUploads);
  if (!rollbackStat.isDirectory()) throw new Error('图片回滚点无效');
  const rollbackFiles = readdirSync(rollbackUploads, { withFileTypes: true }).filter((entry) =>
    entry.isFile(),
  );

  rmSync(uploadsRoot, { recursive: true, force: true });
  mkdirSync(uploadsRoot, { recursive: true });
  for (const entry of rollbackFiles) {
    copyFileSync(path.join(rollbackUploads, entry.name), path.join(uploadsRoot, entry.name));
  }
}

async function cleanupRestorePaths(...paths: string[]) {
  await Promise.all(paths.map((item) => rm(item, { recursive: true, force: true })));
}

async function bestEffortCleanup(
  cleanup: (...paths: string[]) => Promise<void>,
  ...paths: string[]
) {
  try {
    await cleanup(...paths);
  } catch {
    // 清理失败不改变已经确定的恢复业务结果。
  }
}

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof Reflect.get(value, 'then') === 'function'
  );
}

function formatTimestamp(value: Date) {
  const iso = value.toISOString();
  return `${iso.slice(0, 10).replaceAll('-', '')}-${iso.slice(11, 19).replaceAll(':', '')}`;
}

function isMissingPath(error: unknown) {
  return typeof error === 'object' && error !== null && Reflect.get(error, 'code') === 'ENOENT';
}
