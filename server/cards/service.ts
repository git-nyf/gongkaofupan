import { unlink } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import type {
  AttachmentInput,
  BulkCardUpdateInput,
  CardDetail,
  CardFolderContents,
  CardFolderSummary,
  CardSearchInput,
  CardSearchResult,
  CardUpdateInput,
  CreateCardInput,
  NormalizeCardInput,
  NormalizedCard,
  OriginalCardRewriteInput,
  OriginalCardRewriteResult,
} from '../../shared/contracts';
import type { AiProvider } from '../ai/provider';
import {
  CardRepository,
  CardRepositoryError,
  type DatabaseProvider,
  type RandomOriginalFilter,
  type RetryWork,
} from './repository';
import { createExcelWorkbook } from './exportExcel';

export interface CardService {
  create(input: CreateCardInput): Promise<CardDetail>;
  search(input: CardSearchInput): CardSearchResult;
  listFolders(): CardFolderSummary[];
  createFolder(name: string): CardFolderSummary;
  deleteFolder(folderId: string): void;
  getFolderContents(folderId: string): CardFolderContents;
  addCardsToFolder(folderId: string, cardIds: string[]): CardFolderSummary;
  removeCardsFromFolder(folderId: string, cardIds: string[]): CardFolderSummary;
  randomOriginal(input: RandomOriginalFilter): CardDetail | null;
  countRandomOriginals(input: RandomOriginalFilter): number;
  get(cardId: string): CardDetail;
  update(cardId: string, input: CardUpdateInput): Promise<CardDetail>;
  rewriteOriginal(cardId: string, input: OriginalCardRewriteInput): Promise<OriginalCardRewriteResult>;
  bulkUpdate(ids: string[], input: BulkCardUpdateInput): number;
  delete(cardId: string): Promise<void>;
  addAttachments(cardId: string, attachments: AttachmentInput[]): CardDetail;
  deleteAttachment(cardId: string, attachmentId: string): Promise<void>;
  exportAllAsExcel(): Promise<Buffer>;
  retryAi(cardId: string): Promise<CardDetail>;
  recoverStaleProcessing(now: Date): number;
  retryPendingBatch(limit: number): Promise<{ attempted: number; ready: number; stillPending: number }>;
}

export type CardServiceErrorCode =
  | 'folder_name_conflict'
  | 'folder_resource_not_found'
  | 'invalid_categories'
  | 'invalid_state'
  | 'not_found'
  | 'processing_conflict';

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
  uploadsDirectory?: string;
}

export function createCardService({
  database,
  aiProvider,
  now = () => new Date(),
  uploadsDirectory,
}: CardServiceDependencies): CardService {
  const repository = new CardRepository(database);
  const resolvedUploadsDirectory = uploadsDirectory ? resolve(uploadsDirectory) : undefined;

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

  const removeStoredFiles = async (storedNames: string[]) => {
    if (!resolvedUploadsDirectory) return;
    let failed = false;
    for (const storedName of storedNames) {
      if (!isSystemStoredName(storedName)) {
        failed = true;
        continue;
      }
      const filePath = resolve(resolvedUploadsDirectory, storedName);
      if (!filePath.startsWith(`${resolvedUploadsDirectory}${sep}`)) {
        failed = true;
        continue;
      }
      try {
        await unlink(filePath);
      } catch (error) {
        if (!isMissingFileError(error)) failed = true;
      }
    }
    if (failed) throw new Error('附件文件删除失败');
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
        mastery: 'unseen',
      });
    },

    search(input) {
      const { ids, total } = repository.search(input);
      return {
        items: ids.map((id) => repository.getDetail(id)),
        total,
        page: input.page,
        pageSize: input.pageSize,
      };
    },

    listFolders() {
      try {
        return repository.listFolders();
      } catch (error) {
        throw mapRepositoryError(error);
      }
    },

    createFolder(name) {
      try {
        const folderId = repository.createFolderInTransaction(name.trim(), now().toISOString());
        return repository.getFolderSummary(folderId);
      } catch (error) {
        throw mapRepositoryError(error);
      }
    },

    deleteFolder(folderId) {
      try {
        repository.deleteFolderInTransaction(folderId);
      } catch (error) {
        throw mapRepositoryError(error);
      }
    },

    getFolderContents(folderId) {
      try {
        const folder = repository.getFolderSummary(folderId);
        const cardIds = repository.getFolderCardIds(folderId);
        return {
          folder,
          cards: repository.getFolderDetails(cardIds),
        };
      } catch (error) {
        throw mapRepositoryError(error);
      }
    },

    addCardsToFolder(folderId, cardIds) {
      try {
        repository.addCardsToFolderInTransaction(
          folderId,
          [...new Set(cardIds)],
          now().toISOString(),
        );
        return repository.getFolderSummary(folderId);
      } catch (error) {
        throw mapRepositoryError(error);
      }
    },

    removeCardsFromFolder(folderId, cardIds) {
      try {
        repository.removeCardsFromFolderInTransaction(
          folderId,
          [...new Set(cardIds)],
          now().toISOString(),
        );
        return repository.getFolderSummary(folderId);
      } catch (error) {
        throw mapRepositoryError(error);
      }
    },

    randomOriginal(input) {
      const cardId = repository.randomOriginalId(input);
      return cardId === null ? null : repository.getDetail(cardId);
    },

    countRandomOriginals(input) {
      return repository.countRandomOriginalSources(input);
    },

    get(cardId) {
      try {
        return repository.getDetail(cardId);
      } catch (error) {
        throw mapRepositoryError(error);
      }
    },

    async update(cardId, updateInput) {
      const prepared = prepareUpdateInput(updateInput);
      try {
        const result = repository.updateInTransaction(cardId, prepared, now().toISOString());
        if (result.shouldRetryAi) return retryAi(cardId);
        return repository.getDetail(cardId);
      } catch (error) {
        throw mapRepositoryError(error);
      }
    },

    async rewriteOriginal(cardId, rewriteInput) {
      const prepared = prepareOriginalRewriteInput(rewriteInput);
      let work: RetryWork;
      try {
        work = repository.beginOriginalRewriteInTransaction(cardId, prepared, now().toISOString());
      } catch (error) {
        throw mapRepositoryError(error);
      }

      const card = await normalizeAndComplete(cardId, work);
      return {
        card,
        derivedCount: repository.countOriginalGroup(cardId),
      };
    },

    bulkUpdate(ids, updateInput) {
      const uniqueIds = [...new Set(ids)];
      const prepared: BulkCardUpdateInput = {
        ...updateInput,
        tags: updateInput.tags === undefined ? undefined : normalizeNames(updateInput.tags),
      };
      try {
        return repository.bulkUpdateInTransaction(uniqueIds, prepared, now().toISOString());
      } catch (error) {
        throw mapRepositoryError(error);
      }
    },

    async delete(cardId) {
      let storedNames: string[];
      try {
        storedNames = repository.deleteInTransaction(cardId);
      } catch (error) {
        throw mapRepositoryError(error);
      }
      await removeStoredFiles(storedNames);
    },

    addAttachments(cardId, attachments) {
      try {
        repository.addAttachmentsInTransaction(
          cardId,
          attachments.map((attachment) => ({ ...attachment })),
          now().toISOString(),
        );
        return repository.getDetail(cardId);
      } catch (error) {
        throw mapRepositoryError(error);
      }
    },

    async deleteAttachment(cardId, attachmentId) {
      let storedName: string;
      try {
        storedName = repository.deleteAttachmentInTransaction(cardId, attachmentId);
      } catch (error) {
        throw mapRepositoryError(error);
      }
      await removeStoredFiles([storedName]);
    },

    exportAllAsExcel() {
      return createExcelWorkbook(repository.exportAllData());
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

function prepareUpdateInput(input: CardUpdateInput): CardUpdateInput {
  return {
    ...input,
    rawInput: input.rawInput?.trim(),
    categoryIds: input.categoryIds === undefined ? undefined : [...new Set(input.categoryIds)],
    userTags: input.userTags === undefined ? undefined : normalizeNames(input.userTags),
    quizItems: input.quizItems?.map((item) => ({
      id: item.id.trim(),
      question: item.question.trim(),
      answer: item.answer.trim(),
    })),
  };
}

function prepareOriginalRewriteInput(input: OriginalCardRewriteInput): OriginalCardRewriteInput {
  return {
    ...input,
    rawInput: input.rawInput.trim(),
    categoryIds: [...new Set(input.categoryIds)],
    userTags: normalizeNames(input.userTags),
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

function normalizeNames(names: string[]) {
  return [...new Set(names.map((name) => name.trim()).filter(Boolean))];
}

function isSystemStoredName(storedName: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(?:png|jpg|webp)$/i.test(
    storedName,
  );
}

function isMissingFileError(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    Reflect.get(error, 'code') === 'ENOENT'
  );
}
