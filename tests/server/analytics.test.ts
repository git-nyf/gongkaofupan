import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../../server/app';
import { createAnalyticsService } from '../../server/analytics/service';
import { createTestDatabase } from '../helpers/testDatabase';

type TestDatabase = ReturnType<typeof createTestDatabase>;

const fixedNow = new Date('2026-07-17T12:00:00.000Z');

interface CardFixture {
  id: string;
  categoryId: string;
  mastery?: 'unseen' | 'again' | 'hard' | 'good';
  archived?: boolean;
  aiStatus?: 'processing' | 'ready' | 'pending' | 'needs_input';
  createdAt: string;
  dueAt?: string;
  title?: string;
}

function localDayRange(now: Date) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const next = new Date(start);
  next.setDate(next.getDate() + 1);
  return { start: start.toISOString(), next: next.toISOString() };
}

function insertCard(database: TestDatabase, fixture: CardFixture) {
  database.db
    .prepare(`
      INSERT INTO cards (
        id, entry_mode, raw_input, normalized_statement, analysis, rating,
        mastery, wrong_count, ai_status, archived, created_at, updated_at
      ) VALUES (?, 'mistake', ?, ?, '解析', 1, ?, 0, ?, ?, ?, ?)
    `)
    .run(
      fixture.id,
      `原文-${fixture.id}`,
      fixture.title ?? `标题-${fixture.id}`,
      fixture.mastery ?? 'unseen',
      fixture.aiStatus ?? 'ready',
      fixture.archived ? 1 : 0,
      fixture.createdAt,
      fixture.createdAt,
    );
  database.db
    .prepare('INSERT INTO card_categories (card_id, category_id) VALUES (?, ?)')
    .run(fixture.id, fixture.categoryId);
  database.db
    .prepare(`
      INSERT INTO quiz_items (
        id, card_id, direction, question, answer, due_at, created_at
      ) VALUES (?, ?, 'single', ?, '答案', ?, ?)
    `)
    .run(
      `quiz-${fixture.id}`,
      fixture.id,
      `问题-${fixture.id}`,
      fixture.dueAt ?? fixture.createdAt,
      fixture.createdAt,
    );
}

function insertReview(
  database: TestDatabase,
  cardId: string,
  rating: 'again' | 'hard' | 'good',
  reviewedAt: string,
  sequence: number,
) {
  database.db
    .prepare(`
      INSERT INTO review_logs (
        id, quiz_item_id, card_id, rating, previous_due_at, next_due_at, reviewed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
    .run(
      `review-${cardId}-${sequence}`,
      `quiz-${cardId}`,
      cardId,
      rating,
      reviewedAt,
      reviewedAt,
      reviewedAt,
    );
}

describe('总览与复盘统计', () => {
  const databases: TestDatabase[] = [];

  afterEach(() => {
    databases.splice(0).forEach((database) => database.dispose());
  });

  function setup() {
    const database = createTestDatabase();
    databases.push(database);
    const service = createAnalyticsService({ database: database.manager, now: () => fixedNow });
    return { database, service, app: createApp({ analyticsService: service }) };
  }

  it('按本机今日边界统计到期、新增和待攻克卡片', async () => {
    const { start, next } = localDayRange(fixedNow);
    const beforeStart = new Date(new Date(start).getTime() - 1).toISOString();
    const beforeNext = new Date(new Date(next).getTime() - 1).toISOString();
    const { database, app } = setup();

    insertCard(database, {
      id: 'due-again',
      categoryId: '资料分析',
      mastery: 'again',
      createdAt: beforeStart,
      dueAt: start,
    });
    insertCard(database, {
      id: 'due-hard',
      categoryId: '常识判断',
      mastery: 'hard',
      createdAt: beforeStart,
      dueAt: beforeNext,
    });
    insertCard(database, {
      id: 'future-good',
      categoryId: '资料分析',
      mastery: 'good',
      createdAt: start,
      dueAt: next,
    });
    insertCard(database, {
      id: 'archived-again',
      categoryId: '资料分析',
      mastery: 'again',
      archived: true,
      createdAt: beforeStart,
      dueAt: start,
    });
    insertCard(database, {
      id: 'pending-again',
      categoryId: '资料分析',
      mastery: 'again',
      aiStatus: 'pending',
      createdAt: beforeStart,
      dueAt: start,
    });

    const response = await request(app).get('/api/dashboard');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      dueToday: 2,
      addedToday: 1,
      conquestPending: 2,
    });
    expect(response.body).not.toHaveProperty('lastSevenDays');
    expect(response.body).not.toHaveProperty('streakDays');
  });

  it('薄弱板块只按真实复习记录计算 Again*2+Hard 并统计涉及卡片数', async () => {
    const { database, app } = setup();
    const old = '2026-07-10T08:00:00.000Z';
    for (const fixture of [
      { id: 'data-a', categoryId: '资料分析' },
      { id: 'data-b', categoryId: '资料分析' },
      { id: 'common-a', categoryId: '常识判断' },
      { id: 'good-only', categoryId: '言语理解' },
      { id: 'never-reviewed', categoryId: '数量关系' },
    ]) {
      insertCard(database, { ...fixture, createdAt: old });
    }
    insertReview(database, 'data-a', 'again', '2026-07-11T08:00:00.000Z', 1);
    insertReview(database, 'data-a', 'again', '2026-07-12T08:00:00.000Z', 2);
    insertReview(database, 'data-b', 'hard', '2026-07-13T08:00:00.000Z', 1);
    insertReview(database, 'common-a', 'hard', '2026-07-14T08:00:00.000Z', 1);
    insertReview(database, 'good-only', 'good', '2026-07-15T08:00:00.000Z', 1);

    const response = await request(app).get('/api/review-summary');

    expect(response.status).toBe(200);
    expect(response.body.weakness).toEqual([
      { categoryId: '资料分析', categoryName: '资料分析', score: 5, cardCount: 2 },
      { categoryId: '常识判断', categoryName: '常识判断', score: 1, cardCount: 1 },
    ]);
    expect(response.body.weakness).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ categoryName: '言语理解' }),
        expect.objectContaining({ categoryName: '数量关系' }),
      ]),
    );
  });

  it('高频错题按 Again 次数降序并以最近错误时间打破并列', async () => {
    const { database, app } = setup();
    const old = '2026-07-10T08:00:00.000Z';
    for (const fixture of [
      { id: 'older-tie', title: '并列但较早', categoryId: '资料分析' },
      { id: 'newer-tie', title: '并列且较近', categoryId: '资料分析' },
      { id: 'single-error', title: '单次错误', categoryId: '常识判断' },
      { id: 'hard-only', title: '只有模糊', categoryId: '常识判断' },
    ]) {
      insertCard(database, { ...fixture, createdAt: old });
    }
    insertReview(database, 'older-tie', 'again', '2026-07-11T08:00:00.000Z', 1);
    insertReview(database, 'older-tie', 'again', '2026-07-12T08:00:00.000Z', 2);
    insertReview(database, 'newer-tie', 'again', '2026-07-11T09:00:00.000Z', 1);
    insertReview(database, 'newer-tie', 'again', '2026-07-13T08:00:00.000Z', 2);
    insertReview(database, 'single-error', 'again', '2026-07-14T08:00:00.000Z', 1);
    insertReview(database, 'hard-only', 'hard', '2026-07-15T08:00:00.000Z', 1);

    const response = await request(app).get('/api/review-summary');

    expect(response.body.frequentMistakes).toEqual([
      {
        cardId: 'newer-tie',
        title: '并列且较近',
        wrongCount: 2,
        lastWrongAt: '2026-07-13T08:00:00.000Z',
      },
      {
        cardId: 'older-tie',
        title: '并列但较早',
        wrongCount: 2,
        lastWrongAt: '2026-07-12T08:00:00.000Z',
      },
      {
        cardId: 'single-error',
        title: '单次错误',
        wrongCount: 1,
        lastWrongAt: '2026-07-14T08:00:00.000Z',
      },
    ]);
  });

  it('总览复用同一薄弱板块口径，未装配服务时接口不存在', async () => {
    const { database, app } = setup();
    insertCard(database, {
      id: 'weak-card',
      categoryId: '资料分析',
      createdAt: '2026-07-10T08:00:00.000Z',
    });
    insertReview(database, 'weak-card', 'again', '2026-07-11T08:00:00.000Z', 1);

    expect((await request(app).get('/api/dashboard')).body.weakness).toEqual([
      { categoryId: '资料分析', categoryName: '资料分析', score: 2, cardCount: 1 },
    ]);
    expect((await request(createApp()).get('/api/dashboard')).status).toBe(404);
    expect((await request(createApp()).get('/api/review-summary')).status).toBe(404);
  });
});
