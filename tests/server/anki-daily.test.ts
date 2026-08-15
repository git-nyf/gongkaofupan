import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDailyAnkiService } from '../../server/anki/daily';
import { createTestDatabase } from '../helpers/testDatabase';

describe('每日 Anki 任务', () => {
  const resources: Array<ReturnType<typeof createTestDatabase>> = [];

  afterEach(() => {
    resources.splice(0).forEach((resource) => resource.dispose());
  });

  it('随机生成十张未归档用户初始稿，并同时落地 Markdown 与 apkg', async () => {
    const resource = createTestDatabase();
    resources.push(resource);
    const outputDirectory = path.join(resource.directory, 'anki');
    const createdAt = '2026-08-07T08:00:00.000Z';
    const insertCard = resource.db.prepare(`
      INSERT INTO cards (
        id, entry_mode, raw_input, ai_status, archived, created_at, updated_at
      ) VALUES (?, 'knowledge', ?, 'ready', ?, ?, ?)
    `);
    const insertCategory = resource.db.prepare(
      'INSERT INTO card_categories (card_id, category_id) VALUES (?, ?)',
    );
    const insertQuiz = resource.db.prepare(`
      INSERT INTO quiz_items (
        id, card_id, direction, question, answer, mastery, due_at, created_at
      ) VALUES (?, ?, 'single', ?, ?, 'unseen', ?, ?)
    `);
    for (let index = 0; index < 12; index += 1) {
      const id = `card-${index}`;
      insertCard.run(id, `用户初始稿-${index}`, index === 11 ? 1 : 0, createdAt, createdAt);
      insertCategory.run(id, '常识判断');
      insertQuiz.run(`quiz-${index}`, id, `AI 复习题-${index}`, `答案-${index}`, createdAt, createdAt);
    }

    const service = createDailyAnkiService({
      database: resource.manager,
      outputDirectory,
      now: () => new Date('2026-08-07T23:00:00.000Z'),
      random: () => 0,
    });

    const result = await service.generate();

    expect(result.status).toBe('generated');
    expect(result.count).toBe(10);
    expect(result.markdownPath).toMatch(/\.md$/);
    expect(result.apkgPath).toMatch(/\.apkg$/);
    expect(readFileSync(result.markdownPath, 'utf8')).toContain('用户初始稿-');
    expect(readFileSync(result.markdownPath, 'utf8')).toContain('### 复习问题');
    expect(readFileSync(result.apkgPath).subarray(0, 2).toString()).toBe('PK');
  });

  it('按本地日期命名每日卡组，避免凌晨生成到前一天', async () => {
    const resource = createTestDatabase();
    resources.push(resource);
    const createdAt = '2026-08-07T08:00:00.000Z';
    resource.db.prepare(`
      INSERT INTO cards (
        id, entry_mode, raw_input, ai_status, archived, created_at, updated_at
      ) VALUES ('local-date-card', 'knowledge', '本地日期测试', 'ready', 0, ?, ?)
    `).run(createdAt, createdAt);
    resource.db.prepare(`
      INSERT INTO quiz_items (
        id, card_id, direction, question, answer, mastery, due_at, created_at
      ) VALUES ('local-date-quiz', 'local-date-card', 'single', '本地日期题面', '答案', 'unseen', ?, ?)
    `).run(createdAt, createdAt);
    const service = createDailyAnkiService({
      database: resource.manager,
      outputDirectory: path.join(resource.directory, 'anki'),
      now: () => new Date(2026, 7, 8, 0, 30),
    });

    const result = await service.generate();

    expect(path.basename(result.markdownPath)).toBe('daily-review-2026-08-08.md');
    expect(path.basename(result.apkgPath)).toBe('daily-review-2026-08-08.apkg');
  });

  it('清理自定义文件前缀，并让自动文件与每日文件独立落地', async () => {
    const resource = createTestDatabase();
    resources.push(resource);
    const outputDirectory = path.join(resource.directory, 'anki');
    const createdAt = '2026-08-08T01:00:00.000Z';
    resource.db.prepare(`
      INSERT INTO cards (
        id, entry_mode, raw_input, ai_status, archived, created_at, updated_at
      ) VALUES ('prefix-card', 'knowledge', '前缀测试', 'ready', 0, ?, ?)
    `).run(createdAt, createdAt);
    resource.db.prepare(`
      INSERT INTO quiz_items (
        id, card_id, direction, question, answer, mastery, due_at, created_at
      ) VALUES ('prefix-quiz', 'prefix-card', 'single', '前缀题面', '答案', 'unseen', ?, ?)
    `).run(createdAt, createdAt);
    const send = vi.fn().mockResolvedValue({ ok: true });
    const service = createDailyAnkiService({
      database: resource.manager,
      outputDirectory,
      sender: send,
      now: () => new Date(2026, 7, 8, 9, 30, 45),
    });

    const dailyResult = await service.generate(1);
    const automaticResult = await service.generateAndSend(1, {
      filePrefix: '../unsafe/auto review:20260808-093045',
    });

    expect(path.basename(dailyResult.apkgPath)).toBe('daily-review-2026-08-08.apkg');
    expect(path.basename(automaticResult.apkgPath)).toBe('auto-review-20260808-093045.apkg');
    expect(path.basename(automaticResult.markdownPath)).toBe('auto-review-20260808-093045.md');
    expect(path.dirname(automaticResult.apkgPath)).toBe(path.resolve(outputDirectory));
    expect(existsSync(dailyResult.apkgPath)).toBe(true);
    expect(existsSync(automaticResult.apkgPath)).toBe(true);
    expect(send).toHaveBeenCalledWith(expect.objectContaining({
      apkgPath: automaticResult.apkgPath,
      markdownPath: automaticResult.markdownPath,
    }));
  });

  it('按指定用户初始稿编号生成单卡组，不重新随机抽取', async () => {
    const resource = createTestDatabase();
    resources.push(resource);
    const createdAt = '2026-08-08T01:00:00.000Z';
    const insertCard = resource.db.prepare(`
      INSERT INTO cards (
        id, entry_mode, raw_input, ai_status, archived, created_at, updated_at
      ) VALUES (?, 'knowledge', ?, 'ready', 0, ?, ?)
    `);
    const insertQuiz = resource.db.prepare(`
      INSERT INTO quiz_items (
        id, card_id, direction, question, answer, mastery, due_at, created_at
      ) VALUES (?, ?, 'single', ?, ?, 'unseen', ?, ?)
    `);
    insertCard.run('direct-card-a', '直接发送目标', createdAt, createdAt);
    insertCard.run('direct-card-b', '不应被抽取', createdAt, createdAt);
    insertQuiz.run('direct-quiz-a', 'direct-card-a', '目标题面', '目标答案', createdAt, createdAt);
    insertQuiz.run('direct-quiz-b', 'direct-card-b', '其他题面', '其他答案', createdAt, createdAt);

    const service = createDailyAnkiService({
      database: resource.manager,
      outputDirectory: path.join(resource.directory, 'anki'),
      now: () => new Date('2026-08-08T09:30:45.000Z'),
    });
    const result = await service.generate(1, {
      cardIds: ['direct-card-a'],
      filePrefix: 'card-review-direct-card-a-123',
    });

    expect(result.status).toBe('generated');
    expect(result.count).toBe(1);
    expect(result.cardIds).toEqual(['direct-card-a']);
    expect(readFileSync(result.markdownPath, 'utf8')).toContain('直接发送目标');
    expect(readFileSync(result.markdownPath, 'utf8')).not.toContain('不应被抽取');
  });

  it('没有可用初始稿时不生成空卡组，也不调用发送器', async () => {
    const resource = createTestDatabase();
    resources.push(resource);
    const send = vi.fn();
    const service = createDailyAnkiService({
      database: resource.manager,
      outputDirectory: path.join(resource.directory, 'anki'),
      sender: send,
    });

    const result = await service.generateAndSend();

    expect(result.status).toBe('empty');
    expect(result.count).toBe(0);
    expect(send).not.toHaveBeenCalled();
  });
});
