import { afterEach, describe, expect, it } from 'vitest';
import { readdirSync, statSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createTestDatabase } from '../helpers/testDatabase';
import * as databaseModule from '../../server/db/database';
import { createDatabaseManager } from '../../server/db/database';
import { migrate } from '../../server/db/migrations';

const expectedTables = [
  'app_settings',
  'attachments',
  'card_categories',
  'card_tags',
  'cards',
  'categories',
  'quiz_items',
  'review_logs',
  'schema_migrations',
  'tags',
];

describe('数据库初始化', () => {
  const opened: Array<ReturnType<typeof createTestDatabase>> = [];

  afterEach(() => {
    opened.splice(0).forEach((item) => item.dispose());
  });

  it('创建全部首版表和索引', () => {
    const testDatabase = createTestDatabase();
    opened.push(testDatabase);

    const tables = testDatabase.db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
      .all() as Array<{ name: string }>;
    const indexes = testDatabase.db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND name LIKE 'idx_%' ORDER BY name")
      .all() as Array<{ name: string }>;

    expect(tables.map(({ name }) => name)).toEqual(expectedTables);
    expect(indexes.map(({ name }) => name)).toEqual([
      'idx_cards_ai_status',
      'idx_cards_archived',
      'idx_quiz_items_created_at',
      'idx_quiz_items_due_at',
      'idx_review_logs_card_id',
    ]);
  });

  it('写入完整且编号确定的公考分类目录', () => {
    const testDatabase = createTestDatabase();
    opened.push(testDatabase);

    const counts = testDatabase.db
      .prepare(`
        SELECT
          SUM(CASE WHEN parent_id IS NULL THEN 1 ELSE 0 END) AS top_level,
          SUM(CASE WHEN parent_id IS NOT NULL THEN 1 ELSE 0 END) AS second_level,
          COUNT(*) AS total
        FROM categories
      `)
      .get() as { top_level: number; second_level: number; total: number };
    const keyIds = testDatabase.db
      .prepare("SELECT id FROM categories WHERE id IN (?, ?, ?) ORDER BY id")
      .all('申论素材', '常识判断/法律', '资料分析/计算易错点') as Array<{ id: string }>;

    expect(counts).toEqual({ top_level: 10, second_level: 59, total: 69 });
    expect(keyIds.map(({ id }) => id)).toEqual([
      '常识判断/法律',
      '申论素材',
      '资料分析/计算易错点',
    ]);
  });

  it('重复迁移不重复写入版本和分类', () => {
    const testDatabase = createTestDatabase();
    opened.push(testDatabase);

    migrate(testDatabase.db);
    migrate(testDatabase.db);

    const categoryCount = testDatabase.db.prepare('SELECT COUNT(*) AS count FROM categories').get() as {
      count: number;
    };
    const versions = testDatabase.db
      .prepare('SELECT version FROM schema_migrations ORDER BY version')
      .all() as Array<{ version: number }>;

    expect(categoryCount.count).toBe(69);
    expect(versions).toEqual([{ version: 1 }]);
  });

  it('每次连接启用 WAL 和外键约束', () => {
    const testDatabase = createTestDatabase();
    opened.push(testDatabase);

    const journalMode = testDatabase.db.pragma('journal_mode', { simple: true });
    const foreignKeys = testDatabase.db.pragma('foreign_keys', { simple: true });

    expect(journalMode).toBe('wal');
    expect(foreignKeys).toBe(1);
  });

  it('执行关键 CHECK 约束和卡片关联级联删除', () => {
    const testDatabase = createTestDatabase();
    opened.push(testDatabase);

    expect(() => {
      testDatabase.db
        .prepare(`
          INSERT INTO cards (id, entry_mode, raw_input, ai_status, created_at, updated_at)
          VALUES ('invalid', 'other', '无效模式', 'ready', '2026-07-16T00:00:00.000Z', '2026-07-16T00:00:00.000Z')
        `)
        .run();
    }).toThrow();

    testDatabase.db
      .prepare(`
        INSERT INTO cards (id, entry_mode, raw_input, ai_status, created_at, updated_at)
        VALUES ('card-1', 'mistake', '原始错题', 'ready', '2026-07-16T00:00:00.000Z', '2026-07-16T00:00:00.000Z')
      `)
      .run();
    testDatabase.db
      .prepare("INSERT INTO card_categories (card_id, category_id) VALUES ('card-1', '常识判断/法律')")
      .run();
    testDatabase.db
      .prepare(`
        INSERT INTO quiz_items (id, card_id, direction, question, answer, due_at, created_at)
        VALUES ('quiz-1', 'card-1', 'single', '问题', '答案', '2026-07-16T00:00:00.000Z', '2026-07-16T00:00:00.000Z')
      `)
      .run();
    testDatabase.db
      .prepare(`
        INSERT INTO review_logs (id, quiz_item_id, card_id, rating, previous_due_at, next_due_at, reviewed_at)
        VALUES ('review-1', 'quiz-1', 'card-1', 'again', '2026-07-16T00:00:00.000Z', '2026-07-17T00:00:00.000Z', '2026-07-16T00:00:00.000Z')
      `)
      .run();

    testDatabase.db.prepare("DELETE FROM cards WHERE id = 'card-1'").run();

    expect(
      testDatabase.db.prepare("SELECT COUNT(*) AS count FROM card_categories WHERE card_id = 'card-1'").get(),
    ).toEqual({ count: 0 });
    expect(testDatabase.db.prepare("SELECT COUNT(*) AS count FROM quiz_items WHERE card_id = 'card-1'").get()).toEqual({
      count: 0,
    });
    expect(testDatabase.db.prepare("SELECT COUNT(*) AS count FROM review_logs WHERE card_id = 'card-1'").get()).toEqual({
      count: 0,
    });
  });

  it('数据库管理器不暴露全局连接并可替换数据库后继续访问', () => {
    const testDatabase = createTestDatabase();
    opened.push(testDatabase);
    const replacementPath = resolve(testDatabase.directory, 'replacement.db');
    const replacement = createDatabaseManager(replacementPath);
    replacement.close();

    expect(Object.keys(databaseModule)).toEqual(['createDatabaseManager']);
    expect(Object.keys(testDatabase.manager).sort()).toEqual(['close', 'get', 'replaceFrom']);

    testDatabase.manager.replaceFrom(replacementPath);

    const categoryCount = testDatabase.manager.get().prepare('SELECT COUNT(*) AS count FROM categories').get() as {
      count: number;
    };
    const migrationCount = testDatabase.manager
      .get()
      .prepare('SELECT COUNT(*) AS count FROM schema_migrations WHERE version = 1')
      .get() as { count: number };

    expect(categoryCount.count).toBe(69);
    expect(migrationCount.count).toBe(1);
  });

  it('拒绝损坏替换源并保持原数据库可用且能够再次替换', () => {
    const testDatabase = createTestDatabase();
    opened.push(testDatabase);
    testDatabase.db
      .prepare("INSERT INTO app_settings (key, value_json) VALUES ('target-marker', '\"original\"')")
      .run();
    const corruptPath = resolve(testDatabase.directory, 'corrupt.db');
    writeFileSync(corruptPath, Buffer.from('not-sqlite'));

    expect(() => testDatabase.manager.replaceFrom(corruptPath)).toThrow();
    expect(testDatabase.db.prepare("SELECT value_json FROM app_settings WHERE key = 'target-marker'").get()).toEqual({
      value_json: '"original"',
    });

    const validPath = resolve(testDatabase.directory, 'valid.db');
    const validManager = createDatabaseManager(validPath);
    migrate(validManager.get());
    validManager
      .get()
      .prepare("INSERT INTO app_settings (key, value_json) VALUES ('replacement-marker', '\"valid\"')")
      .run();
    validManager.close();

    testDatabase.manager.replaceFrom(validPath);

    expect(testDatabase.db.prepare("SELECT value_json FROM app_settings WHERE key = 'replacement-marker'").get()).toEqual({
      value_json: '"valid"',
    });
    expect(
      readdirSync(testDatabase.directory).filter(
        (name) => name.includes('.restore-') || name.includes('.rollback-'),
      ),
    ).toEqual([]);
    expect(() => testDatabase.manager.close()).not.toThrow();
    expect(() => testDatabase.manager.close()).not.toThrow();
  });

  it('替换打开中的 WAL 数据库时保留尚未检查点的全部数据', () => {
    const target = createTestDatabase();
    const source = createTestDatabase();
    opened.push(target, source);
    source.db.pragma('wal_checkpoint(TRUNCATE)');
    source.db.pragma('wal_autocheckpoint = 0');
    const insertSetting = source.db.prepare('INSERT INTO app_settings (key, value_json) VALUES (?, ?)');
    insertSetting.run('wal-marker-1', '"first"');
    insertSetting.run('wal-marker-2', '"second"');
    const sourcePath = resolve(source.directory, 'gongkao.db');

    expect(statSync(`${sourcePath}-wal`).size).toBeGreaterThan(0);

    target.manager.replaceFrom(sourcePath);

    expect(
      target.db
        .prepare("SELECT key, value_json FROM app_settings WHERE key LIKE 'wal-marker-%' ORDER BY key")
        .all(),
    ).toEqual([
      { key: 'wal-marker-1', value_json: '"first"' },
      { key: 'wal-marker-2', value_json: '"second"' },
    ]);
  });

  it('测试资源动态获取替换后的连接而不缓存裸连接', () => {
    const testDatabase = createTestDatabase();
    opened.push(testDatabase);
    const cachedConnection = testDatabase.db;
    const replacementPath = resolve(testDatabase.directory, 'replacement-with-data.db');
    const replacementManager = createDatabaseManager(replacementPath);
    migrate(replacementManager.get());
    replacementManager
      .get()
      .prepare("INSERT INTO app_settings (key, value_json) VALUES ('dynamic-marker', '\"current\"')")
      .run();
    replacementManager.close();

    testDatabase.manager.replaceFrom(replacementPath);

    expect(testDatabase.db).not.toBe(cachedConnection);
    expect(testDatabase.db).toBe(testDatabase.manager.get());
    expect(testDatabase.db.prepare("SELECT value_json FROM app_settings WHERE key = 'dynamic-marker'").get()).toEqual({
      value_json: '"current"',
    });
  });
});
