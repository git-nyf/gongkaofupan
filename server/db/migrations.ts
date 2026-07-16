import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type Database from 'better-sqlite3';
import { categoryCatalog } from '../catalog/categories';

const initialMigrationVersion = 1;

export function migrate(database: Database.Database) {
  const applyMigrations = database.transaction(() => {
    database.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL
      )
    `);

    const applied = database
      .prepare('SELECT version FROM schema_migrations WHERE version = ?')
      .get(initialMigrationVersion);

    if (applied) {
      return;
    }

    const migrationPath = resolve(process.cwd(), 'server', 'db', 'migrations', '001_initial.sql');
    database.exec(readFileSync(migrationPath, 'utf8'));

    const insertCategory = database.prepare(`
      INSERT OR IGNORE INTO categories (id, parent_id, name, sort_order)
      VALUES (?, ?, ?, ?)
    `);

    Object.entries(categoryCatalog).forEach(([parentName, children], parentIndex) => {
      insertCategory.run(parentName, null, parentName, parentIndex);
      children.forEach((childName, childIndex) => {
        insertCategory.run(`${parentName}/${childName}`, parentName, childName, childIndex);
      });
    });

    database
      .prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)')
      .run(initialMigrationVersion, new Date().toISOString());
  });

  applyMigrations();
}
