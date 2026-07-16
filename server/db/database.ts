import { randomUUID } from 'node:crypto';
import { mkdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import Database from 'better-sqlite3';
import { migrate } from './migrations';

function openDatabase(filePath: string) {
  const database = new Database(filePath);
  try {
    database.pragma('journal_mode = WAL');
    database.pragma('foreign_keys = ON');
    return database;
  } catch (error) {
    database.close();
    throw error;
  }
}

function closeDatabase(database: Database.Database | undefined) {
  if (database?.open) {
    database.close();
  }
}

function assertIntegrity(database: Database.Database) {
  const result = database.pragma('integrity_check', { simple: true });
  if (result !== 'ok') {
    throw new Error(`数据库完整性检查失败：${String(result)}`);
  }
}

function removeDatabaseFiles(filePath: string) {
  rmSync(`${filePath}-wal`, { force: true });
  rmSync(`${filePath}-shm`, { force: true });
  rmSync(filePath, { force: true });
}

function prepareReplacement(replacementPath: string, temporaryPath: string) {
  let source: Database.Database | undefined;
  let temporary: Database.Database | undefined;

  try {
    source = new Database(replacementPath, { readonly: true, fileMustExist: true });
    assertIntegrity(source);
    const serialized = source.serialize();
    closeDatabase(source);
    source = undefined;

    writeFileSync(temporaryPath, serialized, { flag: 'wx' });
    temporary = openDatabase(temporaryPath);
    migrate(temporary);
    assertIntegrity(temporary);
  } finally {
    closeDatabase(temporary);
    closeDatabase(source);
  }
}

export function createDatabaseManager(filePath: string) {
  mkdirSync(dirname(filePath), { recursive: true });
  let database = openDatabase(filePath);

  return {
    get() {
      return database;
    },
    close() {
      closeDatabase(database);
    },
    replaceFrom(replacementPath: string) {
      const temporaryPath = `${filePath}.restore-${randomUUID()}`;
      const rollbackPath = `${filePath}.rollback-${randomUUID()}`;
      let rollbackExists = false;

      try {
        prepareReplacement(replacementPath, temporaryPath);
        closeDatabase(database);

        try {
          renameSync(filePath, rollbackPath);
          rollbackExists = true;
          renameSync(temporaryPath, filePath);
          database = openDatabase(filePath);
          removeDatabaseFiles(rollbackPath);
          rollbackExists = false;
        } catch (error) {
          closeDatabase(database);

          try {
            if (rollbackExists) {
              removeDatabaseFiles(filePath);
              renameSync(rollbackPath, filePath);
              rollbackExists = false;
            }
            database = openDatabase(filePath);
          } catch (restoreError) {
            throw new AggregateError([error, restoreError], '数据库替换失败，原数据库恢复也失败');
          }

          throw error;
        }
      } finally {
        removeDatabaseFiles(temporaryPath);
        if (!rollbackExists) {
          removeDatabaseFiles(rollbackPath);
        }
      }
    },
  };
}
