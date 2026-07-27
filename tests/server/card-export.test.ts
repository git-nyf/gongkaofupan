import { afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import unzipper from 'unzipper';
import { createApp } from '../../server/app';
import { createCardService } from '../../server/cards/service';
import type { NormalizedCard } from '../../shared/contracts';
import { createTestDatabase } from '../helpers/testDatabase';

const now = new Date('2026-07-18T10:00:00.000Z');
const normalized: NormalizedCard = {
  normalized_statement: '规范表述',
  question_type: 'single',
  wrong_point: '',
  analysis: '解析',
  mnemonic: '',
  extension: '',
  notes: '',
  tags: [],
  quiz_items: [{ direction: 'single', question: '问题', answer: '答案' }],
};

type TestDatabase = ReturnType<typeof createTestDatabase>;

describe('卡片库 Excel 导出', () => {
  const resources: TestDatabase[] = [];

  afterEach(() => {
    resources.splice(0).forEach((resource) => resource.dispose());
  });

  function setup() {
    const database = createTestDatabase();
    resources.push(database);
    const service = createCardService({
      database: database.manager,
      aiProvider: { normalize: vi.fn(async () => structuredClone(normalized)) },
      now: () => new Date(now),
    });
    return { app: createApp({ cardService: service }), database };
  }

  it('按一级板块导出原文，并保留归档、去重、跨板块和未分类内容', async () => {
    const { app, database } = setup();
    const insertCard = database.db.prepare(`
      INSERT INTO cards (
        id, entry_mode, raw_input, raw_content_json, normalized_statement, analysis,
        ai_status, ai_error_code, archived, created_at, updated_at
      ) VALUES (?, 'knowledge', ?, ?, ?, ?, 'ready', ?, ?, ?, ?)
    `);
    const assignCategory = database.db.prepare(
      'INSERT INTO card_categories (card_id, category_id) VALUES (?, ?)',
    );

    insertCard.run(
      'archived-language-card',
      '用户原文<含符号>',
      '{"type":"doc","secret":"不应导出的富文本"}',
      '不应导出的 AI 规范内容',
      '不应导出的 AI 解析',
      'invalid_schema',
      1,
      '2026-07-18T10:00:00.000Z',
      now.toISOString(),
    );
    assignCategory.run('archived-language-card', '言语理解');

    insertCard.run(
      'language-duplicate-card',
      '用户原文<含符号>',
      null,
      '同一原稿衍生的问题',
      '衍生解析',
      '',
      0,
      '2026-07-18T10:01:00.000Z',
      now.toISOString(),
    );
    assignCategory.run('language-duplicate-card', '言语理解/逻辑填空');

    insertCard.run(
      'cross-section-card',
      '跨板块原稿',
      null,
      '不应导出的跨板块 AI 内容',
      '不应导出的跨板块 AI 解析',
      '',
      0,
      '2026-07-18T10:02:00.000Z',
      now.toISOString(),
    );
    assignCategory.run('cross-section-card', '言语理解');
    assignCategory.run('cross-section-card', '资料分析/基础公式');

    insertCard.run(
      'data-card',
      '资料分析原稿',
      null,
      '不应导出的资料 AI 内容',
      '不应导出的资料 AI 解析',
      '',
      0,
      '2026-07-18T10:03:00.000Z',
      now.toISOString(),
    );
    assignCategory.run('data-card', '资料分析/基础公式');

    insertCard.run(
      'uncategorized-card',
      '未分类原稿',
      null,
      '不应导出的未分类 AI 内容',
      '不应导出的未分类 AI 解析',
      '',
      0,
      '2026-07-18T10:04:00.000Z',
      now.toISOString(),
    );

    insertCard.run(
      'blank-card',
      '   ',
      null,
      '空原文卡片',
      '空原文解析',
      '',
      0,
      '2026-07-18T10:05:00.000Z',
      now.toISOString(),
    );
    assignCategory.run('blank-card', '言语理解');
    database.db.prepare(`
      INSERT INTO quiz_items (id, card_id, direction, question, answer, due_at, created_at)
      VALUES ('sensitive-answer', 'archived-language-card', 'single', '不应导出的题目', '不应导出的答案', ?, ?)
    `).run(now.toISOString(), now.toISOString());

    const response = await request(app).get('/api/cards/export').buffer(true).parse(binaryParser);

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    expect(response.headers['content-disposition']).toMatch(/gongkao-original-content-\d{8}-\d{6}\.xlsx/);

    const opened = await unzipper.Open.buffer(response.body as Buffer);
    const workbook = await readEntry(opened, 'xl/workbook.xml');
    expect(workbook.match(/<sheet /g)).toHaveLength(3);
    expect(sheetNames(workbook)).toEqual(['言语理解', '资料分析', '未分类']);
    expect(workbook).not.toContain('name="用户原始内容"');

    const sheets = await readSheets(opened);
    expect(Object.keys(sheets)).toEqual(['言语理解', '资料分析', '未分类']);
    expect(sheets['言语理解']).toContain('<t>用户原始内容</t>');
    expect(sheets['言语理解']).toContain('<t>用户原文&lt;含符号&gt;</t>');
    expect(sheets['言语理解']).toContain('<t>跨板块原稿</t>');
    expect(sheets['言语理解'].match(/用户原文&lt;含符号&gt;/g)).toHaveLength(1);
    expect(sheets['言语理解'].match(/<row r=/g)).toHaveLength(3);

    expect(sheets['资料分析']).toContain('<t>用户原始内容</t>');
    expect(sheets['资料分析']).toContain('<t>跨板块原稿</t>');
    expect(sheets['资料分析']).toContain('<t>资料分析原稿</t>');
    expect(sheets['资料分析'].match(/<row r=/g)).toHaveLength(3);

    expect(sheets['未分类']).toContain('<t>用户原始内容</t>');
    expect(sheets['未分类']).toContain('<t>未分类原稿</t>');
    expect(sheets['未分类'].match(/<row r=/g)).toHaveLength(2);

    const allSheets = Object.values(sheets).join('\n');
    expect(allSheets).not.toContain('archived-language-card');
    expect(allSheets).not.toContain('不应导出的 AI 规范内容');
    expect(allSheets).not.toContain('不应导出的 AI 解析');
    expect(allSheets).not.toContain('不应导出的富文本');
    expect(allSheets).not.toContain('不应导出的题目');
    expect(allSheets).not.toContain('不应导出的答案');
    expect(allSheets).not.toContain('空原文卡片');
    expect(allSheets).not.toMatch(/<c r="B\d+"/);
    expect(allSheets).not.toContain('<f>');
  });

  it('完全没有原文时保留仅表头的未分类工作表', async () => {
    const { app } = setup();

    const response = await request(app).get('/api/cards/export').buffer(true).parse(binaryParser);

    expect(response.status).toBe(200);
    const opened = await unzipper.Open.buffer(response.body as Buffer);
    const workbook = await readEntry(opened, 'xl/workbook.xml');
    const sheets = await readSheets(opened);
    expect(sheetNames(workbook)).toEqual(['未分类']);
    expect(Object.keys(sheets)).toEqual(['未分类']);
    expect(sheets['未分类']).toContain('<t>用户原始内容</t>');
    expect(sheets['未分类'].match(/<row r=/g)).toHaveLength(1);
    expect(sheets['未分类']).not.toMatch(/<c r="B\d+"/);
  });
});

async function readSheets(opened: unzipper.CentralDirectory) {
  const workbook = await readEntry(opened, 'xl/workbook.xml');
  const names = sheetNames(workbook);
  return Object.fromEntries(
    await Promise.all(names.map(async (name, index) => [
      name,
      await readEntry(opened, `xl/worksheets/sheet${index + 1}.xml`),
    ])),
  );
}

function sheetNames(workbook: string) {
  return [...workbook.matchAll(/<sheet name="([^"]+)"/g)].map((match) => match[1]);
}

async function readEntry(opened: unzipper.CentralDirectory, entryPath: string) {
  const entry = opened.files.find((file) => file.path === entryPath);
  if (!entry) throw new Error(`缺少 ${entryPath}`);
  return (await entry.buffer()).toString('utf8');
}

function binaryParser(
  response: unknown,
  callback: (error: Error | null, body: Buffer) => void,
) {
  const stream = response as NodeJS.ReadableStream;
  const chunks: Buffer[] = [];
  stream.on('data', (chunk: Buffer) => chunks.push(chunk));
  stream.on('end', () => callback(null, Buffer.concat(chunks)));
  stream.on('error', (error: Error) => callback(error, Buffer.alloc(0)));
}
