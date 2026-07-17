import {
  Rating,
  State,
  createEmptyCard,
  fsrs,
  type Card,
  type RecordLogItem,
} from 'ts-fsrs';
import type { QuizItemSchedulingState, ReviewInput } from '../../shared/contracts';

export const masteryRank = { unseen: 0, again: 1, hard: 2, good: 3 } as const;

export function toFsrsRating(
  rating: ReviewInput['rating'],
): Rating.Again | Rating.Hard | Rating.Good {
  switch (rating) {
    case 'again':
      return Rating.Again;
    case 'hard':
      return Rating.Hard;
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
  rating: ReviewInput['rating'],
  now: Date,
): RecordLogItem {
  const card = item.reps === 0 ? createEmptyCard(now) : toFsrsCard(item);
  return fsrs().next(card, now, toFsrsRating(rating));
}
