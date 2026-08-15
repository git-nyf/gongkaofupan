import {
  existsSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createAnkiLibraryExportService } from '../../server/anki/libraryExports';
import { createTestDatabase } from '../helpers/testDatabase';

describe('卡片库 Anki 导出历史', () => {
  const resources: Array<ReturnType<typeof createTestDatabase>> = [];

  afterEach(() => {
    resources.splice(0).forEach((resource) => resource.dispose());
  });

  function setup() {
    const resource = createTestDatabase();
    resources.push(resource);
    resource.db.exec(`
      INSERT INTO categories (id, parent_id, name, sort_order)
      VALUES
        ('library-section', NULL, '资料分析', 1),
        ('library-topic', 'library-section', '基础公式', 1);
    `);
    return resource;
  }

  function insertCard(
    resource: ReturnType<typeof createTestDatabase>,
    input: {
      id: string;
      rawInput: string;
      rawContentJson?: string | null;
      question?: string | null;
      createdAt?: string;
      categoryIds?: string[];
    },
  ) {
    const createdAt = input.createdAt ?? '2026-08-08T00:00:00.000Z';
    resource.db.prepare(`
      INSERT INTO cards (
        id, entry_mode, raw_input, raw_content_json, ai_status, archived, created_at, updated_at
      ) VALUES (?, 'knowledge', ?, ?, 'ready', 0, ?, ?)
    `).run(input.id, input.rawInput, input.rawContentJson ?? null, createdAt, createdAt);

    if (input.question !== null) {
      resource.db.prepare(`
        INSERT INTO quiz_items (
          id, card_id, direction, question, answer, mastery, due_at, created_at
        ) VALUES (?, ?, 'single', ?, '精简答案', 'unseen', ?, ?)
      `).run(`quiz-${input.id}`, input.id, input.question ?? `题面-${input.id}`, createdAt, createdAt);
    }

    const insertCategory = resource.db.prepare(
      'INSERT INTO card_categories (card_id, category_id) VALUES (?, ?)',
    );
    for (const categoryId of input.categoryIds ?? []) insertCategory.run(input.id, categoryId);
  }

  it('在固定 exports 目录创建全部合格初始稿的独立批次和安全元数据', async () => {
    const resource = setup();
    insertCard(resource, {
      id: 'card-1',
      rawInput: '完整初始稿\n第二行答案',
      question: '完整题面',
      categoryIds: ['library-section', 'library-topic'],
    });
    insertCard(resource, { id: 'without-question', rawInput: '无可靠题面', question: null });
    const outputDirectory = path.join(resource.directory, 'anki');
    const service = createAnkiLibraryExportService({
      database: resource.manager,
      outputDirectory,
      now: () => new Date(2026, 7, 8, 9, 30, 45),
      id: () => 'a1b2c3',
    });

    const created = await service.create();

    expect(created.status).toBe('created');
    if (created.status !== 'created') throw new Error('预期创建导出批次');
    const fileBase = 'card-library-20260808-093045-a1b2c3';
    expect(created.export).toEqual({
      id: 'a1b2c3',
      createdAt: new Date(2026, 7, 8, 9, 30, 45).toISOString(),
      count: 1,
      apkgFileName: `${fileBase}.apkg`,
      markdownFileName: `${fileBase}.md`,
    });

    const exportDirectory = path.join(outputDirectory, 'exports');
    expect(readdirSync(exportDirectory).sort()).toEqual([
      `${fileBase}.apkg`,
      `${fileBase}.json`,
      `${fileBase}.md`,
    ]);
    expect(readFileSync(path.join(exportDirectory, `${fileBase}.apkg`)).subarray(0, 2).toString()).toBe('PK');
    expect(readFileSync(path.join(exportDirectory, `${fileBase}.md`), 'utf8')).toContain('完整初始稿');

    const metadataText = readFileSync(path.join(exportDirectory, `${fileBase}.json`), 'utf8');
    const metadata = JSON.parse(metadataText) as Record<string, unknown>;
    expect(metadata).toMatchObject({ schemaVersion: 1, ...created.export });
    expect(metadataText).not.toContain(outputDirectory);
    expect(metadata).not.toHaveProperty('jsonFile');
  });

  it('指定编号时只导出对应卡片并继续去重，无内容时不创建空文件', async () => {
    const resource = setup();
    const sharedContent = JSON.stringify({ type: 'doc', content: [{ type: 'text', text: '共享初始稿' }] });
    insertCard(resource, {
      id: 'old-card',
      rawInput: '共享初始稿',
      rawContentJson: sharedContent,
      createdAt: '2026-08-08T00:00:00.000Z',
    });
    insertCard(resource, {
      id: 'new-card',
      rawInput: '共享初始稿',
      rawContentJson: sharedContent,
      createdAt: '2026-08-08T00:01:00.000Z',
    });
    insertCard(resource, {
      id: 'not-selected',
      rawInput: '不应导出',
      createdAt: '2026-08-08T00:02:00.000Z',
    });
    const outputDirectory = path.join(resource.directory, 'selected-anki');
    const service = createAnkiLibraryExportService({
      database: resource.manager,
      outputDirectory,
      now: () => new Date(2026, 7, 8, 10, 0, 0),
      id: () => 'selected1',
    });

    const created = await service.create(['old-card', 'new-card', 'new-card']);

    expect(created.status).toBe('created');
    if (created.status !== 'created') throw new Error('预期创建指定卡片导出批次');
    expect(created.export.count).toBe(1);
    expect(service.get(created.export.id)?.cards.map(({ id }) => id)).toEqual(['new-card']);

    const emptyOutputDirectory = path.join(resource.directory, 'empty-anki');
    const emptyService = createAnkiLibraryExportService({
      database: resource.manager,
      outputDirectory: emptyOutputDirectory,
      id: () => 'empty001',
    });
    await expect(emptyService.create(['missing-card'])).resolves.toEqual({ status: 'empty' });
    expect(existsSync(path.join(emptyOutputDirectory, 'exports'))).toBe(false);
  });

  it('列表按创建时间倒序，详情含完整答案，并安全读取仍存在的 apkg', async () => {
    const resource = setup();
    insertCard(resource, {
      id: 'card-1',
      rawInput: '完整初始稿',
      question: '导出题面',
      categoryIds: ['library-section', 'library-topic'],
    });
    const outputDirectory = path.join(resource.directory, 'history-anki');
    let generatedAt = new Date(2026, 7, 8, 9, 0, 0);
    let shortId = 'first001';
    const service = createAnkiLibraryExportService({
      database: resource.manager,
      outputDirectory,
      now: () => generatedAt,
      id: () => shortId,
    });
    const first = await service.create();
    generatedAt = new Date(2026, 7, 8, 10, 0, 0);
    shortId = 'second01';
    const second = await service.create();
    if (first.status !== 'created' || second.status !== 'created') {
      throw new Error('预期创建两个导出批次');
    }

    expect(service.list().map(({ id }) => id)).toEqual(['second01', 'first001']);
    expect(service.get('second01')?.cards).toEqual([{
      id: 'card-1',
      category: '资料分析 / 基础公式',
      question: '导出题面',
      answer: '完整初始稿',
    }]);

    const apkgPath = service.getApkgPath('second01');
    expect(apkgPath).toBe(path.join(outputDirectory, 'exports', second.export.apkgFileName));
    expect(service.getApkgPath('../second01')).toBeUndefined();
    expect(service.get('../second01')).toBeUndefined();

    const exportDirectory = path.join(outputDirectory, 'exports');
    writeFileSync(path.join(exportDirectory, 'broken.json'), '{broken', 'utf8');
    expect(service.list().map(({ id }) => id)).toEqual(['second01', 'first001']);
    expect(service.get('broken')).toBeUndefined();

    if (!apkgPath) throw new Error('预期存在 apkg 路径');
    rmSync(apkgPath);
    expect(service.getApkgPath('second01')).toBeUndefined();
  });
});
