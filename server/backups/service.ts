import { randomUUID } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import {
  access,
  mkdir,
  readdir,
  readFile,
  rename,
  rm,
} from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import archiver from 'archiver';
import Database from 'better-sqlite3';
import unzipper, { type Entry, type File as ZipFile } from 'unzipper';

const backupFormat = 'gongkao-memory-card-backup';
const backupSchemaVersion = 1;
const currentDatabaseVersion = 2;
const maximumEntryCount = 10_000;
const maximumUncompressedBytes = 1024 * 1024 * 1024;

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

export function createBackupService({
  database,
  dataDirectory,
  uploadsDirectory,
  now = () => new Date(),
  applyUploads = replaceUploads,
}: BackupServiceDependencies): BackupService {
  const dataRoot = path.resolve(dataDirectory);
  const uploadsRoot = path.resolve(uploadsDirectory);
  const backupsRoot = path.resolve(dataRoot, 'backups');

  return {
    async createBackup() {
      await mkdir(backupsRoot, { recursive: true });
      const createdAt = now();
      const fileName = `公考记忆卡备份-${formatTimestamp(createdAt)}.zip`;
      const filePath = path.join(backupsRoot, fileName);
      const workingId = randomUUID();
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
        await rm(filePath, { force: true });
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
      let rollbackPrepared = false;
      let replacementStarted = false;

      try {
        await mkdir(stagingPath, { recursive: false });
        const prepared = await prepareRestore(filePath, stagingPath);

        await database.get().backup(rollbackDatabasePath);
        await copyOrdinaryFiles(uploadsRoot, rollbackUploadsPath);
        rollbackPrepared = true;

        replacementStarted = true;
        database.replaceFrom(prepared.databasePath);
        await applyUploads(prepared.uploadsPath, uploadsRoot, backupsRoot, operationId);

        await cleanupRestorePaths(
          stagingPath,
          rollbackDatabasePath,
          rollbackUploadsPath,
          activeUploadsPath,
        );
        return { restored: true };
      } catch (error) {
        if (!rollbackPrepared) {
          await cleanupRestorePaths(
            stagingPath,
            rollbackDatabasePath,
            rollbackUploadsPath,
            activeUploadsPath,
          );
          if (error instanceof BackupServiceError) throw error;
          throw new BackupServiceError('restore_failed');
        }

        const rollbackErrors: unknown[] = [];
        if (replacementStarted) {
          try {
            database.replaceFrom(rollbackDatabasePath);
          } catch (rollbackError) {
            rollbackErrors.push(rollbackError);
          }
        }
        try {
          await restoreUploads(rollbackUploadsPath, uploadsRoot);
        } catch (rollbackError) {
          rollbackErrors.push(rollbackError);
        }

        if (rollbackErrors.length === 0) {
          await cleanupRestorePaths(
            stagingPath,
            rollbackDatabasePath,
            rollbackUploadsPath,
            activeUploadsPath,
          );
        }
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
  const output = createWriteStream(archivePath, { flags: 'wx' });
  const archive = archiver('zip', { zlib: { level: 9 } });
  const completed = new Promise<void>((resolve, reject) => {
    output.on('close', resolve);
    output.on('error', reject);
    archive.on('error', reject);
  });
  archive.pipe(output);
  archive.append(JSON.stringify(manifest), { name: 'manifest.json' });
  archive.file(snapshotPath, { name: 'gongkao.db' });
  for (const file of await listOrdinaryFiles(uploadsRoot)) {
    archive.file(file.absolutePath, { name: `uploads/${file.relativePath}` });
  }
  await archive.finalize();
  await completed;
}

async function listOrdinaryFiles(
  directory: string,
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
    if (entry.isFile()) {
      files.push({
        absolutePath: path.join(directory, entry.name),
        relativePath: entry.name,
      });
    }
  }
  return files;
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

  const expected = new Map<string, 'File' | 'Directory'>();
  let totalBytes = 0;
  for (const entry of directory.files) {
    const entryPath = validateEntryPath(entry.path, entry.type);
    validateCentralEntryType(entry);
    const key = entryPath.toLowerCase();
    if (expected.has(key)) throw new BackupServiceError('invalid_backup');
    expected.set(key, entry.type);
    totalBytes += entry.uncompressedSize;
    if (!Number.isSafeInteger(totalBytes) || totalBytes > maximumUncompressedBytes) {
      throw new BackupServiceError('invalid_backup');
    }
  }

  if (expected.get('manifest.json') !== 'File' || expected.get('gongkao.db') !== 'File') {
    throw new BackupServiceError('invalid_backup');
  }
  return expected;
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
    type === 'File' && segments.length === 2 && segments[0] === 'uploads' && segments[1].length > 0;
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
  expectedEntries: Map<string, 'File' | 'Directory'>,
) {
  const parsedEntries = new Set<string>();
  const parser = createReadStream(filePath).pipe(unzipper.Parse({ forceStream: true }));

  try {
    for await (const entry of parser as AsyncIterable<Entry>) {
      const entryPath = validateEntryPath(entry.path, entry.type);
      const key = entryPath.toLowerCase();
      const expectedType = expectedEntries.get(key);
      if (!expectedType || expectedType !== entry.type || parsedEntries.has(key)) {
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
        await pipeline(entry, createWriteStream(target, { flags: 'wx' }));
      }
    }
  } catch (error) {
    parser.destroy();
    throw error;
  }

  if (parsedEntries.size !== expectedEntries.size) {
    throw new BackupServiceError('invalid_backup');
  }
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
  try {
    database = new Database(filePath, { readonly: true, fileMustExist: true });
    if (database.pragma('integrity_check', { simple: true }) !== 'ok') {
      throw new BackupServiceError('invalid_backup');
    }
    if ((database.pragma('foreign_key_check') as unknown[]).length !== 0) {
      throw new BackupServiceError('invalid_backup');
    }
    validateMigrations(database);
    validateRequiredSchema(database);
  } catch (error) {
    if (error instanceof BackupServiceError) throw error;
    throw new BackupServiceError('invalid_backup');
  } finally {
    database?.close();
  }
}

function validateMigrations(database: Database.Database) {
  const migrations = database
    .prepare('SELECT version FROM schema_migrations ORDER BY version')
    .all() as Array<{ version: number }>;
  if (migrations.length === 0 || migrations.length > currentDatabaseVersion) {
    throw new BackupServiceError('invalid_backup');
  }
  migrations.forEach(({ version }, index) => {
    if (version !== index + 1 || version > currentDatabaseVersion) {
      throw new BackupServiceError('invalid_backup');
    }
  });
}

function validateRequiredSchema(database: Database.Database) {
  const requiredColumns: Record<string, string[]> = {
    schema_migrations: ['version', 'applied_at'],
    categories: ['id', 'parent_id', 'name', 'sort_order'],
    cards: [
      'id',
      'entry_mode',
      'raw_input',
      'raw_content_json',
      'normalized_statement',
      'wrong_point',
      'analysis',
      'mnemonic',
      'extension',
      'notes',
      'source_type',
      'source_detail',
      'rating',
      'mastery',
      'wrong_count',
      'ai_status',
      'ai_attempt_count',
      'ai_error_code',
      'archived',
      'created_at',
      'updated_at',
    ],
    card_categories: ['card_id', 'category_id'],
    tags: ['id', 'name'],
    card_tags: ['card_id', 'tag_id', 'origin'],
    attachments: [
      'id',
      'card_id',
      'stored_name',
      'original_name',
      'mime_type',
      'byte_size',
      'sort_order',
      'created_at',
    ],
    quiz_items: [
      'id',
      'card_id',
      'direction',
      'question',
      'answer',
      'mastery',
      'due_at',
      'stability',
      'difficulty',
      'elapsed_days',
      'scheduled_days',
      'learning_steps',
      'reps',
      'lapses',
      'state',
      'last_review_at',
      'created_at',
    ],
    review_logs: [
      'id',
      'quiz_item_id',
      'card_id',
      'rating',
      'previous_due_at',
      'next_due_at',
      'reviewed_at',
    ],
    app_settings: ['key', 'value_json'],
  };
  for (const [table, columns] of Object.entries(requiredColumns)) {
    const existing = new Set(
      (database.pragma(`table_info(${table})`) as Array<{ name: string }>).map(({ name }) => name),
    );
    if (columns.some((column) => !existing.has(column))) {
      throw new BackupServiceError('invalid_backup');
    }
  }

  const latestMigration = database
    .prepare('SELECT MAX(version) AS version FROM schema_migrations')
    .get() as { version: number };
  if (latestMigration.version >= 2) {
    const cardColumns = database.pragma('table_info(cards)') as Array<{ name: string }>;
    if (!cardColumns.some(({ name }) => name === 'template')) {
      throw new BackupServiceError('invalid_backup');
    }
  }
}

async function copyOrdinaryFiles(source: string, destination: string) {
  await mkdir(destination, { recursive: true });
  for (const file of await listOrdinaryFiles(source)) {
    const target = path.join(destination, ...file.relativePath.split('/'));
    await mkdir(path.dirname(target), { recursive: true });
    await pipeline(createReadStream(file.absolutePath), createWriteStream(target, { flags: 'wx' }));
  }
}

async function replaceUploads(
  incomingUploads: string,
  uploadsRoot: string,
  backupsRoot: string,
  operationId: string,
) {
  const heldUploads = path.join(backupsRoot, `active-${operationId}-uploads`);
  let held = false;
  try {
    if (await pathExists(uploadsRoot)) {
      await rename(uploadsRoot, heldUploads);
      held = true;
    }
    await mkdir(path.dirname(uploadsRoot), { recursive: true });
    await rename(incomingUploads, uploadsRoot);
    await rm(heldUploads, { recursive: true, force: true });
  } catch (error) {
    if (held && !(await pathExists(uploadsRoot))) {
      try {
        await rename(heldUploads, uploadsRoot);
      } catch {
        // 外层会使用独立图片回滚点再次恢复。
      }
    }
    throw error;
  }
}

async function restoreUploads(rollbackUploads: string, uploadsRoot: string) {
  await rm(uploadsRoot, { recursive: true, force: true });
  await copyOrdinaryFiles(rollbackUploads, uploadsRoot);
}

async function cleanupRestorePaths(...paths: string[]) {
  await Promise.all(paths.map((item) => rm(item, { recursive: true, force: true })));
}

async function pathExists(filePath: string) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function formatTimestamp(value: Date) {
  const iso = value.toISOString();
  return `${iso.slice(0, 10).replaceAll('-', '')}-${iso.slice(11, 19).replaceAll(':', '')}`;
}

function isMissingPath(error: unknown) {
  return typeof error === 'object' && error !== null && Reflect.get(error, 'code') === 'ENOENT';
}
