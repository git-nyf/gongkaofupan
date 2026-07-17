import { Rating, State } from 'ts-fsrs';
import { describe, expect, it } from 'vitest';
import type { QuizItemSchedulingState } from '../../shared/contracts';
import {
  masteryRank,
  scheduleNext,
  toFsrsCard,
  toFsrsRating,
} from '../../server/study/scheduler';

const now = new Date('2026-07-17T10:00:00.000Z');

function schedulingState(
  overrides: Partial<QuizItemSchedulingState> = {},
): QuizItemSchedulingState {
  return {
    dueAt: '2026-07-16T10:00:00.000Z',
    stability: 4.5,
    difficulty: 6.25,
    elapsedDays: 2,
    scheduledDays: 3,
    learningSteps: 7,
    reps: 3,
    lapses: 1,
    state: State.Review,
    lastReviewAt: '2026-07-14T10:00:00.000Z',
    ...overrides,
  };
}

describe('FSRS 调度映射', () => {
  it.each([
    ['again', Rating.Again],
    ['hard', Rating.Hard],
    ['good', Rating.Good],
  ] as const)('把 %s 映射到对应 FSRS 等级', (rating, expected) => {
    expect(toFsrsRating(rating)).toBe(expected);
  });

  it('只暴露三级业务等级，不产生 Easy 或 Manual 路径', () => {
    const ratings = (['again', 'hard', 'good'] as const).map(toFsrsRating);

    expect(ratings).toEqual([Rating.Again, Rating.Hard, Rating.Good]);
    expect(ratings).not.toContain(Rating.Easy);
    expect(ratings).not.toContain(Rating.Manual);
  });

  it('按顺序定义四级掌握度排名', () => {
    expect(masteryRank).toEqual({ unseen: 0, again: 1, hard: 2, good: 3 });
  });

  it('把数据库调度字段完整转换为 FSRS Card 且不携带 learning_steps', () => {
    const input = schedulingState();
    const snapshot = structuredClone(input);

    const card = toFsrsCard(input);

    expect(card).toEqual({
      due: new Date(input.dueAt),
      stability: input.stability,
      difficulty: input.difficulty,
      elapsed_days: input.elapsedDays,
      scheduled_days: input.scheduledDays,
      reps: input.reps,
      lapses: input.lapses,
      state: input.state,
      last_review: new Date(input.lastReviewAt!),
    });
    expect(card).not.toHaveProperty('learning_steps');
    expect(input).toEqual(snapshot);
  });

  it('没有上次复习时间时不虚构 last_review', () => {
    expect(toFsrsCard(schedulingState({ lastReviewAt: null }))).not.toHaveProperty('last_review');
  });

  it.each(['again', 'hard', 'good'] as const)(
    '新题面使用空卡计算 %s 并返回完整 card 与 log',
    (rating) => {
      const input = schedulingState({ reps: 0, dueAt: '2030-01-01T00:00:00.000Z' });
      const snapshot = structuredClone(input);

      const result = scheduleNext(input, rating, now);

      expect(result.log.rating).toBe(toFsrsRating(rating));
      expect(result.log.review).toEqual(now);
      expect(result.card.reps).toBe(1);
      expect(result.card.last_review).toEqual(now);
      expect(result.card.due.getTime()).toBeGreaterThan(now.getTime());
      expect(Number.isFinite(result.card.stability)).toBe(true);
      expect(Number.isFinite(result.card.difficulty)).toBe(true);
      expect(Object.keys(result.card).sort()).toEqual(
        ['difficulty', 'due', 'elapsed_days', 'lapses', 'last_review', 'reps', 'scheduled_days', 'stability', 'state'].sort(),
      );
      expect(input).toEqual(snapshot);
    },
  );

  it.each(['again', 'hard', 'good'] as const)(
    '已有题面保留历史状态后计算 %s',
    (rating) => {
      const input = schedulingState();
      const snapshot = structuredClone(input);

      const result = scheduleNext(input, rating, now);

      expect(result.log.rating).toBe(toFsrsRating(rating));
      expect(result.log.due).toBeInstanceOf(Date);
      expect(Number.isNaN(result.log.due.getTime())).toBe(false);
      expect(result.card.reps).toBe(input.reps + 1);
      expect(result.card.last_review).toEqual(now);
      expect(result.card.due.getTime()).toBeGreaterThan(now.getTime());
      expect(input).toEqual(snapshot);
    },
  );
});
