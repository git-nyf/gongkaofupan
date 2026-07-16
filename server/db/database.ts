import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import Database from 'better-sqlite3';
import { migrate } from './migrations';

function openDatabase(filePath: string) {
  const database = new Database(filePath);
  database.pragma('journal_mode = WAL');
  database.pragma('foreign_keys = ON');
  return database;
}

export function createDatabaseManager(filePath: string) {
  mkdirSync(dirname(filePath), { recursive: true });
  let database = openDatabase(filePath);

  return {
    get() {
      return database;
    },
    close() {
      database.close();
    },
    replaceFrom(replacementPath: string) {
      database.close();
      copyFileSync(replacementPath, filePath);
      database = openDatabase(filePath);
      migrate(database);
    },
  };
}
