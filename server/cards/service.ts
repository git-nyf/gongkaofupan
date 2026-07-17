import type {
  CardDetail,
  CreateCardInput,
  NormalizeCardInput,
  NormalizedCard,
} from '../../shared/contracts';
import type { AiProvider } from '../ai/provider';
import {
  CardRepository,
  CardRepositoryError,
  type DatabaseProvider,
  type RetryWork,
} from './repository';

export interface CardService {
  create(input: CreateCardInput): Promise<CardDetail>;
  retryAi(cardId: string): Promise<CardDetail>;
  recoverStaleProcessing(now: Date): number;
  retryPendingBatch(limit: number): Promise<{ attempted: number; ready: number; stillPending: number }>;
}

export type CardServiceErrorCode = 'invalid_categories' | 'invalid_state' | 'not_found';

export class CardServiceError extends Error {
  constructor(readonly code: CardServiceErrorCode) {
    super(code);
    this.name = 'CardServiceError';
  }
}

interface CardServiceDependencies {
  database: DatabaseProvider;
  aiProvider: AiProvider;
  now?: () => Date;
}

export function createCardService({
  database,
  aiProvider,
  now = () => new Date(),
}: CardServiceDependencies): CardService {
  const repository = new CardRepository(database);

  async function normalizeAndComplete(
    cardId: string,
    work: RetryWork,
  ): Promise<CardDetail> {
    let normalized: NormalizedCard;
    try {
      normalized = await aiProvider.normalize(work.normalizeInput);
    } catch (error) {
      repository.markPendingInCompensationTransaction(
        cardId,
        toSafeAiErrorCode(error),
        now().toISOString(),
      );
      return repository.getDetail(cardId);
    }

    try {
      const status =
        normalized.question_type === 'unstructured' || normalized.quiz_items.length === 0
          ? 'needs_input'
          : 'ready';
      repository.completeInTransaction(cardId, normalized, status, work.mastery, now().toISOString());
    } catch {
      repository.markPendingInCompensationTransaction(cardId, 'storage_error', now().toISOString());
    }
    return repository.getDetail(cardId);
  }

  const retryAi = async (cardId: string) => {
    let work: RetryWork;
    try {
      work = repository.beginRetryInTransaction(cardId, now().toISOString());
    } catch (error) {
      throw mapRepositoryError(error);
    }
    return normalizeAndComplete(cardId, work);
  };

  return {
    async create(createInput) {
      const prepared = prepareCreateInput(createInput);
      let cardId: string;
      try {
        cardId = repository.insertRawCardInTransaction(prepared, now().toISOString());
      } catch (error) {
        throw mapRepositoryError(error);
      }

      return normalizeAndComplete(cardId, {
        normalizeInput: toNormalizeInput(prepared),
        mastery: prepared.initialMastery,
      });
    },

    retryAi,

    recoverStaleProcessing(recoveryNow) {
      return repository.recoverStaleProcessing(recoveryNow);
    },

    async retryPendingBatch(limit) {
      const safeLimit = Math.min(20, Math.max(0, Math.trunc(Number.isFinite(limit) ? limit : 0)));
      const cardIds = repository.listPendingIds(safeLimit);
      let ready = 0;
      let stillPending = 0;

      for (const cardId of cardIds) {
        try {
          const detail = await retryAi(cardId);
          if (detail.aiStatus === 'ready') ready += 1;
          else stillPending += 1;
        } catch {
          stillPending += 1;
        }
      }

      return { attempted: cardIds.length, ready, stillPending };
    },
  };
}

function prepareCreateInput(input: CreateCardInput): CreateCardInput {
  return {
    ...input,
    categoryIds: [...new Set(input.categoryIds)],
    userTags: [...new Set(input.userTags.map((tag) => tag.trim()).filter(Boolean))],
    attachments: input.attachments.map((attachment) => ({ ...attachment })),
  };
}

function toNormalizeInput(input: CreateCardInput): NormalizeCardInput {
  return {
    entry_mode: input.entryMode,
    raw_input: input.rawInput,
    selected_categories: [...input.categoryIds],
    template: input.template,
    existing_fields: {
      wrong_point: input.wrongPoint,
      analysis: input.analysis,
      mnemonic: input.mnemonic,
      extension: input.extension,
      notes: input.notes,
    },
  };
}

function mapRepositoryError(error: unknown): Error {
  if (error instanceof CardRepositoryError) {
    return new CardServiceError(error.code);
  }
  return error instanceof Error ? error : new Error('卡片存储失败');
}

function toSafeAiErrorCode(error: unknown) {
  const code =
    typeof error === 'object' && error !== null && typeof Reflect.get(error, 'code') === 'string'
      ? String(Reflect.get(error, 'code'))
      : '';
  return [
    'not_configured',
    'timeout',
    'http_error',
    'empty_response',
    'invalid_json',
    'invalid_schema',
  ].includes(code)
    ? code
    : 'ai_error';
}
