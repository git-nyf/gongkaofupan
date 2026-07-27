import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type Database from 'better-sqlite3';
import { categoryCatalog } from '../catalog/categories';

export function migrate(database: Database.Database) {
  const applyMigrations = database.transaction(() => {
    database.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL
      )
    `);

    const appliedVersions = new Set(
      (
        database.prepare('SELECT version FROM schema_migrations').all() as Array<{
          version: number;
        }>
      ).map(({ version }) => version),
    );
    const recordMigration = database.prepare(
      'INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)',
    );

    if (!appliedVersions.has(1)) {
      const initialPath = resolve(process.cwd(), 'server', 'db', 'migrations', '001_initial.sql');
      database.exec(readFileSync(initialPath, 'utf8'));

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

      recordMigration.run(1, new Date().toISOString());
    }

    if (!appliedVersions.has(2)) {
      const cardTemplatePath = resolve(
        process.cwd(),
        'server',
        'db',
        'migrations',
        '002_card_template.sql',
      );
      database.exec(readFileSync(cardTemplatePath, 'utf8'));
      recordMigration.run(2, new Date().toISOString());
    }

    if (!appliedVersions.has(3)) {
      const splitCardTitlesPath = resolve(
        process.cwd(),
        'server',
        'db',
        'migrations',
        '003_distinct_split_card_titles.sql',
      );
      database.exec(readFileSync(splitCardTitlesPath, 'utf8'));
      recordMigration.run(3, new Date().toISOString());
    }

    if (!appliedVersions.has(4)) {
      const manualOrderPath = resolve(
        process.cwd(),
        'server',
        'db',
        'migrations',
        '004_card_manual_order.sql',
      );
      database.exec(readFileSync(manualOrderPath, 'utf8'));
      recordMigration.run(4, new Date().toISOString());
    }

    if (!appliedVersions.has(5)) {
      const cardFoldersPath = resolve(
        process.cwd(),
        'server',
        'db',
        'migrations',
        '005_card_folders.sql',
      );
      database.exec(readFileSync(cardFoldersPath, 'utf8'));
      recordMigration.run(5, new Date().toISOString());
    }
  });

  applyMigrations();
}
