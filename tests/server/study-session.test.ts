import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import type { Mastery, StudySessionInput } from '../../shared/contracts';
import { createApp } from '../../server/app';
import { scheduleNext } from '../../server/study/scheduler';
import { createStudyService } from '../../server/study/service';
import { createTestDatabase } from '../helpers/testDatabase';

const fixedNow = new Date('2026-07-17T10:00:00.000Z');
const defaultCategoryIds = ['常识判断', '常识判断/法律'];

type TestDatabase = ReturnType<typeof createTestDatabase>;

interface InsertCardOptions {
  id: string;
  createdAt?: string;
  categoryIds?: string[];
  tags?: Array<{ id: string; name: string; origin?: 'user' | 'ai' }>;
  rating?: number;
  mastery?: Mastery;
  aiStatus?: 'processing' | 'ready' | 'pending' | 'needs_input';
  archived?: boolean;
  wrongCount?: number;
  quizItems?: Array<{
    id: string;
    direction?: 'single' | 'forward' | 'reverse';
    question?: string;
    answer?: string;
    mastery?: Mastery;
    dueAt?: string;
    createdAt?: string;
    stability?: number;
    difficulty?: number;
    elapsedDays?: number;
    scheduledDays?: number;
    learningSteps?: number;
    reps?: number;
    lapses?: number;
    state?: number;
    lastReviewAt?: string | null;
  }>;
}

function insertCard(database: TestDatabase, options: InsertCardOptions) {
  const createdAt = options.createdAt ?? '2026-07-17T08:00:00.000Z';
  database.db
    .prepare(`
      INSERT INTO cards (
        id, entry_mode, raw_input, normalized_statement, analysis, mnemonic,
        extension, notes, rating, mastery, wrong_count, ai_status, archived,
        created_at, updated_at
      ) VALUES (?, 'knowledge', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .run(
      options.id,
      `原文-${options.id}`,
      `规范-${options.id}`,
      `解析-${options.id}`,
      `口诀-${options.id}`,
      `拓展-${options.id}`,
      `笔记-${options.id}`,
      options.rating ?? 1,
      options.mastery ?? 'unseen',
      options.wrongCount ?? 0,
      options.aiStatus ?? 'ready',
      options.archived ? 1 : 0,
      createdAt,
      createdAt,
    );

  const insertCategory = database.db.prepare(
    'INSERT INTO card_categories (card_id, category_id) VALUES (?, ?)',
  );
  for (const categoryId of options.categoryIds ?? defaultCategoryIds) {
    insertCategory.run(options.id, categoryId);
  }

  for (const tag of options.tags ?? []) {
    database.db.prepare('INSERT OR IGNORE INTO tags (id, name) VALUES (?, ?)').run(tag.id, tag.name);
    database.db
      .prepare('INSERT INTO card_tags (card_id, tag_id, origin) VALUES (?, ?, ?)')
      .run(options.id, tag.id, tag.origin ?? 'user');
  }

  const insertQuiz = database.db.prepare(`
    INSERT INTO quiz_items (
      id, card_id, direction, question, answer, mastery, due_at, stability,
      difficulty, elapsed_days, scheduled_days, learning_steps, reps, lapses,
      state, last_review_at, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const quiz of options.quizItems ?? []) {
    insertQuiz.run(
      quiz.id,
      options.id,
      quiz.direction ?? 'single',
      quiz.question ?? `问题-${quiz.id}`,
      quiz.answer ?? `答案-${quiz.id}`,
      quiz.mastery ?? 'unseen',
      quiz.dueAt ?? '2026-07-18T10:00:00.000Z',
      quiz.stability ?? 0,
      quiz.difficulty ?? 0,
      quiz.elapsedDays ?? 0,
      quiz.scheduledDays ?? 0,
      quiz.learningSteps ?? 0,
      quiz.reps ?? 0,
      quiz.lapses ?? 0,
      quiz.state ?? 0,
      quiz.lastReviewAt ?? null,
      quiz.createdAt ?? createdAt,
    );
  }
}

function sessionInput(overrides: Partial<StudySessionInput> = {}): StudySessionInput {
  return {
    categoryIds: [],
    cardIds: [],
    tagIds: [],
    count: 20,
    order: 'fixed',
    dueFirst: false,
    ...overrides,
  };
}

describe('混合卡组与题面复习', () => {
  const resources: TestDatabase[] = [];

  afterEach(() => {
    resources.splice(0).forEach((resource) => resource.dispose());
  });

  function setup(random: () => number = () => 0.5) {
    const database = createTestDatabase();
    resources.push(database);
    const service = createStudyService({
      database: database.manager,
      now: () => new Date(fixedNow),
      random,
    });
    const app = createApp({ studyService: service });
    return { app, database, service };
  }

  it('固定模式严格按卡片创建时间、题面创建时间和题面编号升序', () => {
    const { database, service } = setup();
    insertCard(database, {
      id: 'card-a',
      createdAt: '2026-07-17T08:00:00.000Z',
      quizItems: [
        { id: 'quiz-z', createdAt: '2026-07-17T08:30:00.000Z' },
        { id: 'quiz-b', createdAt: '2026-07-17T08:15:00.000Z' },
        { id: 'quiz-a', createdAt: '2026-07-17T08:15:00.000Z' },
      ],
    });
    insertCard(database, {
      id: 'card-b',
      createdAt: '2026-07-17T09:00:00.000Z',
      quizItems: [{ id: 'quiz-c', createdAt: '2026-07-16T00:00:00.000Z' }],
    });

    const result = service.createSession(sessionInput({ count: 4 }));

    expect(result.items.map(({ quizItemId }) => quizItemId)).toEqual([
      'quiz-a',
      'quiz-b',
      'quiz-z',
      'quiz-c',
    ]);
  });

  it('到期优先保持到期区固定顺序并仅随机打乱补齐区', () => {
    const { database, service } = setup(() => 0);
    insertCard(database, {
      id: 'card-a',
      quizItems: [
        { id: 'due-a', dueAt: '2026-07-17T09:00:00.000Z' },
        { id: 'future-a', dueAt: '2026-07-18T09:00:00.000Z' },
      ],
    });
    insertCard(database, {
      id: 'card-b',
      createdAt: '2026-07-17T09:00:00.000Z',
      quizItems: [
        { id: 'due-b', dueAt: fixedNow.toISOString() },
        { id: 'future-b', dueAt: '2026-07-19T09:00:00.000Z' },
      ],
    });

    expect(
      service
        .createSession(sessionInput({ count: 4, dueFirst: true, order: 'random' }))
        .items.map(({ quizItemId }) => quizItemId),
    ).toEqual(['due-a', 'due-b', 'future-b', 'future-a']);
  });

  it('非到期优先的随机模式打乱全部候选后截取且不重复', () => {
    const { database, service } = setup(() => 0);
    insertCard(database, {
      id: 'card-a',
      quizItems: [{ id: 'quiz-a' }, { id: 'quiz-b' }, { id: 'quiz-c' }],
    });

    const ids = service
      .createSession(sessionInput({ count: 2, order: 'random' }))
      .items.map(({ quizItemId }) => quizItemId);

    expect(ids).toEqual(['quiz-b', 'quiz-c']);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('排除归档、非 ready 和无题面的卡片，同时把正反题面作为独立候选', () => {
    const { database, service } = setup();
    insertCard(database, { id: 'archived', archived: true, quizItems: [{ id: 'archived-quiz' }] });
    for (const aiStatus of ['pending', 'needs_input', 'processing'] as const) {
      insertCard(database, {
        id: aiStatus,
        aiStatus,
        quizItems: [{ id: `${aiStatus}-quiz` }],
      });
    }
    insertCard(database, { id: 'no-quiz' });
    insertCard(database, {
      id: 'ready',
      quizItems: [
        { id: 'forward', direction: 'forward' },
        { id: 'reverse', direction: 'reverse' },
      ],
    });

    expect(
      service.createSession(sessionInput()).items.map(({ quizItemId }) => quizItemId),
    ).toEqual(['forward', 'reverse']);
  });

  it('分别支持一级/二级分类、卡片、标签、星级、掌握度和日期筛选', () => {
    const { database, service } = setup();
    insertCard(database, {
      id: 'target',
      categoryIds: ['常识判断', '常识判断/法律'],
      tags: [{ id: 'tag-target', name: '目标标签' }],
      rating: 4,
      mastery: 'hard',
      createdAt: '2026-07-15T12:00:00.000Z',
      quizItems: [{ id: 'target-quiz' }],
    });
    insertCard(database, {
      id: 'other',
      categoryIds: ['言语理解', '言语理解/逻辑填空'],
      tags: [{ id: 'tag-other', name: '其他标签' }],
      rating: 2,
      mastery: 'good',
      createdAt: '2026-07-14T12:00:00.000Z',
      quizItems: [{ id: 'other-quiz' }],
    });

    const cases: Array<Partial<StudySessionInput>> = [
      { categoryIds: ['常识判断'] },
      { categoryIds: ['常识判断/法律'] },
      { cardIds: ['target'] },
      { tagIds: ['tag-target'] },
      { rating: 4 },
      { mastery: 'hard' },
      {
        createdFrom: '2026-07-15T00:00:00.000Z',
        createdTo: '2026-07-15T23:59:59.999Z',
      },
    ];

    for (const filters of cases) {
      expect(
        service.createSession(sessionInput(filters)).items.map(({ cardId }) => cardId),
      ).toEqual(['target']);
    }
  });

  it('不同筛选使用 AND、同类编号使用 ANY，注入文本不会扩大范围', () => {
    const { database, service } = setup();
    insertCard(database, {
      id: 'target',
      tags: [{ id: 'tag-target', name: '目标标签' }],
      rating: 5,
      mastery: 'good',
      createdAt: '2026-07-15T12:00:00.000Z',
      quizItems: [{ id: 'target-quiz' }],
    });
    insertCard(database, {
      id: 'other',
      tags: [{ id: 'tag-other', name: '其他标签' }],
      rating: 4,
      mastery: 'hard',
      quizItems: [{ id: 'other-quiz' }],
    });

    const combined = service.createSession(
      sessionInput({
        categoryIds: ['不存在分类', '常识判断/法律'],
        cardIds: ['missing', 'target'],
        tagIds: ['missing-tag', 'tag-target'],
        rating: 5,
        mastery: 'good',
        createdFrom: '2026-07-15T00:00:00.000Z',
        createdTo: '2026-07-15T23:59:59.999Z',
      }),
    );
    const injection = service.createSession(
      sessionInput({ cardIds: ["target' OR 1=1 --"] }),
    );

    expect(combined.items.map(({ quizItemId }) => quizItemId)).toEqual(['target-quiz']);
    expect(injection.items).toEqual([]);
  });

  it('StudyItem 返回答案、规范字段、分类标签和卡片属性', () => {
    const { database, service } = setup();
    insertCard(database, {
      id: 'detail',
      tags: [
        { id: 'tag-user', name: '用户标签', origin: 'user' },
        { id: 'tag-ai', name: 'AI标签', origin: 'ai' },
      ],
      rating: 3,
      mastery: 'hard',
      quizItems: [{ id: 'detail-quiz', question: '明确问题', answer: '明确答案' }],
    });

    const [item] = service.createSession(sessionInput()).items;

    expect(item).toEqual({
      quizItemId: 'detail-quiz',
      cardId: 'detail',
      question: '明确问题',
      answer: '明确答案',
      normalizedStatement: '规范-detail',
      analysis: '解析-detail',
      mnemonic: '口诀-detail',
      extension: '拓展-detail',
      notes: '笔记-detail',
      rating: 3,
      mastery: 'hard',
      archived: false,
      categories: [
        { id: '常识判断', name: '常识判断', parentId: null },
        { id: '常识判断/法律', name: '法律', parentId: '常识判断' },
      ],
      tags: [
        { id: 'tag-ai', name: 'AI标签', origin: 'ai' },
        { id: 'tag-user', name: '用户标签', origin: 'user' },
      ],
    });
  });

  it('会话接口归一化数组和日期，严格拒绝非法请求与数量边界', async () => {
    const { app, database } = setup();
    insertCard(database, {
      id: 'target',
      createdAt: '2026-07-15T12:00:00.000Z',
      quizItems: [{ id: 'target-quiz' }],
    });
    const validBody = {
      categoryIds: [' ', ' 常识判断/法律 ', '常识判断/法律'],
      cardIds: [],
      tagIds: [],
      count: 1,
      order: 'fixed',
      dueFirst: false,
      createdFrom: '2026-07-15',
      createdTo: '2026-07-15T20:00:00+08:00',
    };

    const valid = await request(app).post('/api/study/sessions').send(validBody);
    expect(valid.status).toBe(200);
    expect(valid.body.items.map((item: { quizItemId: string }) => item.quizItemId)).toEqual([
      'target-quiz',
    ]);

    const allBlank = await request(app)
      .post('/api/study/sessions')
      .send({
        ...validBody,
        categoryIds: [' ', '  '],
        cardIds: [' '],
        tagIds: ['   '],
      });
    expect(allBlank.status).toBe(200);
    expect(allBlank.body.items.map((item: { quizItemId: string }) => item.quizItemId)).toEqual([
      'target-quiz',
    ]);

    const invalidBodies = [
      {},
      { ...validBody, count: 0 },
      { ...validBody, count: 101 },
      { ...validBody, count: 1.5 },
      { ...validBody, order: 'sql-random' },
      { ...validBody, dueFirst: 'true' },
      { ...validBody, createdFrom: '2026-02-31' },
      { ...validBody, createdFrom: '2026-07-16', createdTo: '2026-07-15' },
      { ...validBody, extra: true },
    ];
    for (const body of invalidBodies) {
      const response = await request(app).post('/api/study/sessions').send(body);
      expect(response.status).toBe(400);
      expect(JSON.stringify(response.body)).not.toMatch(/SQL|\\AAA错题/i);
    }
  });

  it.each([
    ['again', 1],
    ['hard', 0],
    ['good', 0],
  ] as const)('复习 %s 全量写回 FSRS、日志和错误次数', async (rating, wrongDelta) => {
    const { app, database } = setup();
    const original = {
      dueAt: '2026-07-16T10:00:00.000Z',
      stability: 4.5,
      difficulty: 6.25,
      elapsedDays: 2,
      scheduledDays: 3,
      learningSteps: 7,
      reps: 3,
      lapses: 1,
      state: 2,
      lastReviewAt: '2026-07-14T10:00:00.000Z',
    };
    insertCard(database, {
      id: 'review-card',
      wrongCount: 4,
      quizItems: [{ id: 'review-quiz', ...original }],
    });
    const expected = scheduleNext(original, rating, fixedNow);

    const response = await request(app)
      .post('/api/reviews')
      .send({ quizItemId: 'review-quiz', rating });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      quizItemId: 'review-quiz',
      cardId: 'review-card',
      rating,
      nextDueAt: expected.card.due.toISOString(),
      quizMastery: rating,
      cardMastery: rating,
      wrongCount: 4 + wrongDelta,
    });
    expect(
      database.db
        .prepare(`
          SELECT due_at, stability, difficulty, elapsed_days, scheduled_days,
                 learning_steps, reps, lapses, state, last_review_at, mastery
          FROM quiz_items WHERE id = 'review-quiz'
        `)
        .get(),
    ).toEqual({
      due_at: expected.card.due.toISOString(),
      stability: expected.card.stability,
      difficulty: expected.card.difficulty,
      elapsed_days: expected.card.elapsed_days,
      scheduled_days: expected.card.scheduled_days,
      learning_steps: 7,
      reps: expected.card.reps,
      lapses: expected.card.lapses,
      state: expected.card.state,
      last_review_at: expected.card.last_review!.toISOString(),
      mastery: rating,
    });
    expect(database.db.prepare('SELECT * FROM review_logs').get()).toMatchObject({
      quiz_item_id: 'review-quiz',
      card_id: 'review-card',
      rating,
      previous_due_at: original.dueAt,
      next_due_at: expected.card.due.toISOString(),
      reviewed_at: fixedNow.toISOString(),
    });
  });

  it('双题面独立复习并以最弱题面聚合卡片掌握度', async () => {
    const { app, database } = setup();
    insertCard(database, {
      id: 'double',
      mastery: 'unseen',
      quizItems: [
        { id: 'forward', direction: 'forward', mastery: 'again' },
        { id: 'reverse', direction: 'reverse', mastery: 'good' },
      ],
    });

    const first = await request(app)
      .post('/api/reviews')
      .send({ quizItemId: 'reverse', rating: 'good' });
    const second = await request(app)
      .post('/api/reviews')
      .send({ quizItemId: 'forward', rating: 'hard' });

    expect(first.body.cardMastery).toBe('again');
    expect(second.body.cardMastery).toBe('hard');
    expect(database.db.prepare("SELECT mastery FROM cards WHERE id = 'double'").get()).toEqual({
      mastery: 'hard',
    });
  });

  it('日志插入失败时题面、卡片和日志全部回滚并返回安全 500', async () => {
    const { app, database } = setup();
    insertCard(database, {
      id: 'rollback-card',
      wrongCount: 2,
      mastery: 'unseen',
      quizItems: [{ id: 'rollback-quiz', learningSteps: 9 }],
    });
    const quizBefore = database.db.prepare("SELECT * FROM quiz_items WHERE id = 'rollback-quiz'").get();
    const cardBefore = database.db.prepare("SELECT * FROM cards WHERE id = 'rollback-card'").get();
    database.db.exec(`
      CREATE TRIGGER reject_review_log
      BEFORE INSERT ON review_logs
      BEGIN
        SELECT RAISE(ABORT, 'private SQL detail');
      END
    `);

    const response = await request(app)
      .post('/api/reviews')
      .send({ quizItemId: 'rollback-quiz', rating: 'again' });

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ code: 'internal_error', message: expect.any(String) });
    expect(JSON.stringify(response.body)).not.toMatch(/private SQL detail|SQL|\\AAA错题/i);
    expect(database.db.prepare("SELECT * FROM quiz_items WHERE id = 'rollback-quiz'").get()).toEqual(quizBefore);
    expect(database.db.prepare("SELECT * FROM cards WHERE id = 'rollback-card'").get()).toEqual(cardBefore);
    expect(database.db.prepare('SELECT COUNT(*) AS count FROM review_logs').get()).toEqual({ count: 0 });
  });

  it('严格校验复习请求、不存在返回 404，归档后仍允许复习已有题面', async () => {
    const { app, database } = setup();
    insertCard(database, {
      id: 'archived-current',
      archived: true,
      aiStatus: 'pending',
      quizItems: [{ id: 'current-quiz' }],
    });

    const reviewed = await request(app)
      .post('/api/reviews')
      .send({ quizItemId: 'current-quiz', rating: 'hard' });
    expect(reviewed.status).toBe(200);

    const missing = await request(app)
      .post('/api/reviews')
      .send({ quizItemId: 'missing', rating: 'good' });
    expect(missing.status).toBe(404);
    expect(missing.body).toEqual({ code: 'not_found', message: expect.any(String) });

    for (const body of [
      {},
      { quizItemId: '', rating: 'good' },
      { quizItemId: 'current-quiz', rating: 'easy' },
      { quizItemId: 'current-quiz', rating: 'good', extra: true },
    ]) {
      expect((await request(app).post('/api/reviews').send(body)).status).toBe(400);
    }
  });

  it('仅在提供 studyService 时装配接口，createApp() 继续兼容', async () => {
    expect((await request(createApp()).post('/api/study/sessions').send({})).status).toBe(404);
    expect((await request(createApp()).post('/api/reviews').send({})).status).toBe(404);
    expect((await request(createApp()).get('/api/health')).status).toBe(200);
  });
});
