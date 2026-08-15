import { afterEach, describe, expect, it } from 'vitest';
import { createTestDatabase } from '../helpers/testDatabase';
import { selectOriginalCards, selectRandomOriginalCards } from '../../server/anki/source';

describe('Anki 用户初始稿数据源', () => {
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
        ('section', NULL, '资料分析', 1),
        ('topic', 'section', '基础公式', 1),
        ('other', NULL, '言语理解', 2);
    `);
    return resource;
  }

  function insertCard(
    resource: ReturnType<typeof createTestDatabase>,
    input: {
      id: string;
      rawInput?: string;
      rawContentJson?: string | null;
      normalizedStatement?: string;
      quizQuestion?: string | null;
      archived?: number;
      createdAt?: string;
      categoryIds?: string[];
    },
  ) {
    const createdAt = input.createdAt ?? '2026-08-07T08:00:00.000Z';
    resource.db
      .prepare(`
        INSERT INTO cards (
          id, entry_mode, raw_input, raw_content_json, normalized_statement, ai_status,
          archived, created_at, updated_at
        ) VALUES (?, 'knowledge', ?, ?, ?, 'ready', ?, ?, ?)
      `)
      .run(
        input.id,
        input.rawInput ?? '',
        input.rawContentJson ?? null,
        input.normalizedStatement ?? '',
        input.archived ?? 0,
        createdAt,
        createdAt,
      );
    if (input.quizQuestion !== null) {
      resource.db.prepare(`
        INSERT INTO quiz_items (
          id, card_id, direction, question, answer, mastery, due_at, created_at
        ) VALUES (?, ?, 'single', ?, ?, 'unseen', ?, ?)
      `).run(
        `quiz-${input.id}`,
        input.id,
        input.quizQuestion ?? `AI 题面-${input.id}`,
        input.rawInput ?? '',
        createdAt,
        createdAt,
      );
    }
    const insertCategory = resource.db.prepare(
      'INSERT INTO card_categories (card_id, category_id) VALUES (?, ?)',
    );
    for (const categoryId of input.categoryIds ?? []) insertCategory.run(input.id, categoryId);
  }

  it('默认随机选取最多十张未归档且有原始输入的初始稿，并返回分类', () => {
    const resource = setup();
    for (let index = 0; index < 12; index += 1) {
      insertCard(resource, {
        id: `card-${index}`,
        rawInput: `原始稿 ${index}`,
        categoryIds: index % 2 === 0 ? ['section', 'topic'] : ['other'],
        createdAt: `2026-08-07T08:${String(index).padStart(2, '0')}:00.000Z`,
        normalizedStatement: `规范表述-${index}`,
      });
    }
    insertCard(resource, { id: 'archived', rawInput: '已归档', archived: 1 });
    insertCard(resource, { id: 'empty', rawInput: '   ' });

    const cards = selectRandomOriginalCards(resource.db, {
      random: () => 0,
      now: () => new Date('2026-08-07T23:00:00.000Z'),
    });

    expect(cards).toHaveLength(10);
    expect(cards.every((card) => card.rawInput.trim() !== '')).toBe(true);
    expect(cards.some((card) => card.id === 'archived')).toBe(false);
    expect(cards.every((card) => /^2026-08-07T08:\d{2}:00\.000Z$/.test(card.createdAt))).toBe(true);
    expect(cards.find((card) => card.id === 'card-2')?.categories).toEqual([
      { id: 'section', name: '资料分析', parentId: null },
      { id: 'topic', name: '基础公式', parentId: 'section' },
    ]);
    expect(cards.find((card) => card.id === 'card-2')?.quizQuestion).toBe('AI 题面-card-2');
  });

  it('按原始内容去重，避免一个初始稿衍生多个问题重复发送', () => {
    const resource = setup();
    insertCard(resource, {
      id: 'source',
      rawInput: '相同初始稿',
      rawContentJson: JSON.stringify({ type: 'doc', content: [{ type: 'text', text: '相同初始稿' }] }),
      createdAt: '2026-08-07T08:00:00.000Z',
    });
    insertCard(resource, {
      id: 'derived',
      rawInput: '相同初始稿',
      rawContentJson: JSON.stringify({ type: 'doc', content: [{ type: 'text', text: '相同初始稿' }] }),
      createdAt: '2026-08-07T08:01:00.000Z',
    });

    const cards = selectRandomOriginalCards(resource.db, {
      limit: 10,
      random: () => 0,
      now: () => new Date('2026-08-07T23:00:00.000Z'),
    });

    expect(cards).toHaveLength(1);
    expect(cards[0].id).toBe('derived');
  });

  it('排除未来创建的卡片，空库返回空数组', () => {
    const resource = setup();
    insertCard(resource, {
      id: 'future',
      rawInput: '未来卡片',
      createdAt: '2026-08-08T00:00:00.000Z',
    });

    expect(
      selectRandomOriginalCards(resource.db, {
        now: () => new Date('2026-08-07T23:00:00.000Z'),
      }),
    ).toEqual([]);
  });

  it('排除尚未生成可靠 AI 题面的初始稿', () => {
    const resource = setup();
    insertCard(resource, { id: 'without-quiz', rawInput: '只有规范表述', quizQuestion: null });

    expect(selectRandomOriginalCards(resource.db)).toEqual([]);
  });

  it('指定编号时只返回对应初始稿并去重，非随机模式保持新内容优先', () => {
    const resource = setup();
    const sharedContent = JSON.stringify({ type: 'doc', content: [{ type: 'text', text: '同一初始稿' }] });
    insertCard(resource, {
      id: 'source',
      rawInput: '同一初始稿',
      rawContentJson: sharedContent,
      createdAt: '2026-08-07T08:00:00.000Z',
    });
    insertCard(resource, {
      id: 'derived',
      rawInput: '同一初始稿',
      rawContentJson: sharedContent,
      createdAt: '2026-08-07T08:01:00.000Z',
    });
    insertCard(resource, {
      id: 'other',
      rawInput: '另一份初始稿',
      createdAt: '2026-08-07T08:02:00.000Z',
    });
    insertCard(resource, {
      id: 'not-selected',
      rawInput: '未选中的初始稿',
      createdAt: '2026-08-07T08:03:00.000Z',
    });

    const cards = selectOriginalCards(resource.db, {
      cardIds: ['source', 'derived', 'other'],
      randomize: false,
      now: () => new Date('2026-08-07T23:00:00.000Z'),
    });

    expect(cards.map(({ id }) => id)).toEqual(['other', 'derived']);
  });
});
