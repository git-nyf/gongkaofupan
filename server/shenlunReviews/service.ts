import type {
  ShenlunReview,
  ShenlunReviewStateUpdate,
  ShenlunReviewSummary,
  ShenlunReviewWriteInput,
} from './contracts';
import { ShenlunReviewRepository, type DatabaseProvider } from './repository';

interface ShenlunReviewServiceDependencies {
  database: DatabaseProvider;
  now?: () => Date;
}

export interface ShenlunReviewService {
  list(archived?: boolean): ShenlunReviewSummary[];
  get(id: string): ShenlunReview;
  create(input: ShenlunReviewWriteInput): ShenlunReview;
  update(id: string, input: ShenlunReviewWriteInput): ShenlunReview;
  updateState(id: string, state: ShenlunReviewStateUpdate): ShenlunReview;
}

export class ShenlunReviewServiceError extends Error {
  constructor(readonly code: 'not_found') {
    super(code);
    this.name = 'ShenlunReviewServiceError';
  }
}

const structuralPlaceholderPattern = /[\u200B\u2060\uE000-\uF8FF]/gu;

export function createShenlunReviewService({
  database,
  now = () => new Date(),
}: ShenlunReviewServiceDependencies): ShenlunReviewService {
  const repository = new ShenlunReviewRepository(database);

  const get = (id: string) => {
    const review = repository.get(id);
    if (!review) throw new ShenlunReviewServiceError('not_found');
    return review;
  };

  return {
    list(archived = false) {
      return repository.list(archived).map(toSummary);
    },

    get,

    create(input) {
      const id = repository.create(input, now().toISOString());
      return get(id);
    },

    update(id, input) {
      const updated = repository.update(id, input, now().toISOString());
      if (!updated) throw new ShenlunReviewServiceError('not_found');
      return get(id);
    },

    updateState(id, state) {
      const updated = repository.updateState(id, state, now().toISOString());
      if (!updated) throw new ShenlunReviewServiceError('not_found');
      return get(id);
    },
  };
}

function toSummary(review: ShenlunReview): ShenlunReviewSummary {
  const visibleText = review.text.replace(structuralPlaceholderPattern, '');
  return {
    id: review.id,
    title: review.title,
    template: review.template,
    excerpt: Array.from(visibleText.trim()).slice(0, 80).join(''),
    characterCount: Array.from(visibleText).filter((character) => !/\s/u.test(character)).length,
    pinned: review.pinned,
    archived: review.archived,
    createdAt: review.createdAt,
    updatedAt: review.updatedAt,
  };
}
