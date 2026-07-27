import {
  Rating,
  State,
  createEmptyCard,
  fsrs,
  type Card,
  type RecordLogItem,
} from 'ts-fsrs';
import type { QuizItemSchedulingState } from '../../shared/contracts';

export type InternalReviewRating = 'again' | 'good';

export const masteryRank = { unseen: 0, again: 1, hard: 2, good: 3 } as const;

export function toFsrsRating(
  rating: InternalReviewRating,
): Rating.Again | Rating.Good {
  switch (rating) {
    case 'again':
      return Rating.Again;
    case 'good':
      return Rating.Good;
  }
}

export function toFsrsCard(item: QuizItemSchedulingState): Card {
  return {
    due: new Date(item.dueAt),
    stability: item.stability,
    difficulty: item.difficulty,
    elapsed_days: item.elapsedDays,
    scheduled_days: item.scheduledDays,
    reps: item.reps,
    lapses: item.lapses,
    state: item.state as State,
    ...(item.lastReviewAt ? { last_review: new Date(item.lastReviewAt) } : {}),
  };
}

export function scheduleNext(
  item: QuizItemSchedulingState,
  rating: InternalReviewRating,
  now: Date,
): RecordLogItem {
  const card = item.reps === 0 ? createEmptyCard(now) : toFsrsCard(item);
  return fsrs().next(card, now, toFsrsRating(rating));
}
