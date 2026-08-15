import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import Database from 'better-sqlite3';
import unzipper from 'unzipper';
import { describe, expect, it } from 'vitest';
import {
  createMarkdownReviewDocument,
  type AnkiSourceCard,
} from '../../server/anki/markdown';
import { createAnkiPackage } from '../../server/anki/apkg';

const sourceCards: AnkiSourceCard[] = Array.from({ length: 10 }, (_, index) => ({
  id: `original-${index + 1}`,
  category: index % 2 === 0 ? '资料分析' : '言语理解',
  rawContent: `用户初始稿 ${index + 1}\n第二行内容`,
  question: `复习问题 ${index + 1}`,
  reviewHint: `提示 ${index + 1}`,
  answer: `答案 ${index + 1}`,
}));

describe('Anki 导出', () => {
  it('将用户初始稿渲染为包含稳定编号和复习字段的中文 Markdown', () => {
    const document = createMarkdownReviewDocument(sourceCards);

    expect(document.markdown).toContain('# 公考记忆卡复习卡');
    expect(document.markdown).toContain('稳定编号：`original-1`');
    expect(document.markdown).toContain('分类：资料分析');
    expect(document.markdown).toContain('用户初始稿 1');
    expect(document.markdown).toContain('### 复习问题\n复习问题 1');
    expect(document.markdown).toContain('复习提示：\n提示 1');
    expect(document.markdown).toContain('答案：\n答案 1');
    expect(document.markdown.match(/稳定编号：`original-/g)).toHaveLength(10);
    expect(document.cards).toHaveLength(10);
  });

  it('生成包含 collection.anki2、media 和十张卡片的可打开 apkg', async () => {
    const result = await createAnkiPackage(sourceCards);
    const opened = await unzipper.Open.buffer(result.buffer);
    const files = opened.files.map((file) => file.path);

    expect(files).toContain('collection.anki2');
    expect(files).toContain('media');

    const collection = await opened.files.find((file) => file.path === 'collection.anki2')?.buffer();
    expect(collection).toBeInstanceOf(Buffer);
    if (!collection) throw new Error('压缩包缺少 collection.anki2');
    const directory = mkdtempSync(path.join(tmpdir(), 'gongkao-anki-test-'));
    const collectionPath = path.join(directory, 'collection.anki2');
    writeFileSync(collectionPath, collection);
    const database = new Database(collectionPath, { readonly: true });
    try {
      expect(database.prepare('SELECT COUNT(*) AS count FROM notes').get()).toEqual({ count: 10 });
      expect(database.prepare('SELECT COUNT(*) AS count FROM cards').get()).toEqual({ count: 10 });
      expect(database.prepare('SELECT COUNT(*) AS count FROM col').get()).toEqual({ count: 1 });
      expect(database.prepare('SELECT COUNT(*) AS count FROM revlog').get()).toEqual({ count: 0 });
      const collectionRow = database.prepare('SELECT decks, dconf FROM col').get() as {
        decks: string;
        dconf: string;
      };
      const deck = Object.values(JSON.parse(collectionRow.decks) as Record<string, Record<string, unknown>>)[0];
      const deckConfig = Object.values(JSON.parse(collectionRow.dconf) as Record<string, Record<string, unknown>>)[0];
      expect(deck).toMatchObject({
        dyn: 0,
        lrnToday: [0, 0],
        revToday: [0, 0],
        newToday: [0, 0],
        timeToday: [0, 0],
      });
      expect(deckConfig).toMatchObject({
        dyn: false,
        new: expect.objectContaining({ delays: [1, 10], perDay: 20 }),
        rev: expect.objectContaining({ perDay: 200 }),
        lapse: expect.objectContaining({ delays: [10] }),
      });
      const note = database.prepare('SELECT flds FROM notes ORDER BY id LIMIT 1').get() as { flds: string };
      expect(note.flds.split('\x1f')[0]).toContain('复习问题');
      expect(note.flds.split('\x1f')[0]).not.toContain('用户初始稿');
    } finally {
      database.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('可按指定路径写入 apkg 文件', async () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'gongkao-anki-path-'));
    const outputPath = path.join(directory, 'daily.apkg');
    try {
      const result = await createAnkiPackage(sourceCards, { outputPath });
      expect(result.outputPath).toBe(outputPath);
      expect(existsSync(outputPath)).toBe(true);
      expect(readFileSync(outputPath).subarray(0, 2).toString()).toBe('PK');
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
