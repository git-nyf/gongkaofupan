import express from 'express';
import { z } from 'zod';
import type {
  CardSearchInput,
  CreateCardInput,
  OriginalCardRewriteInput,
} from '../../shared/contracts';
import { CardServiceError, type CardService } from './service';

const attachmentSchema = z
  .object({
    id: z.string(),
    storedName: z.string(),
    originalName: z.string(),
    mimeType: z.string(),
    byteSize: z.number().int().nonnegative(),
  })
  .strict();

export const createCardSchema = z
  .object({
    entryMode: z.enum(['mistake', 'knowledge']),
    rawInput: z.string().refine((value) => value.trim().length > 0),
    rawContentJson: z.string().nullable(),
    wrongPoint: z.string(),
    analysis: z.string(),
    mnemonic: z.string(),
    extension: z.string(),
    notes: z.string(),
    categoryIds: z.array(z.string()).min(1),
    userTags: z.array(z.string()).transform(normalizeNames),
    template: z.string(),
    sourceType: z.string(),
    sourceDetail: z.string(),
    attachments: z.array(attachmentSchema).max(0),
  })
  .strict();

const quizItemUpdateSchema = z
  .object({
    id: z.string().transform((value) => value.trim()).refine(Boolean),
    question: z.string().transform((value) => value.trim()).refine(Boolean),
    answer: z.string().transform((value) => value.trim()).refine(Boolean),
  })
  .strict();

const cardUpdateSchema = z
  .object({
    rawInput: z.string().transform((value) => value.trim()).refine(Boolean),
    rawContentJson: z.string().nullable(),
    normalizedStatement: z.string(),
    wrongPoint: z.string(),
    analysis: z.string(),
    mnemonic: z.string(),
    extension: z.string(),
    notes: z.string(),
    categoryIds: z.array(z.string()),
    userTags: z.array(z.string()).transform(normalizeNames),
    template: z.string(),
    sourceType: z.string(),
    sourceDetail: z.string(),
    archived: z.boolean(),
    quizItems: z.array(quizItemUpdateSchema).max(12).refine(hasUniqueQuizItemIds),
  })
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0);

const originalCardRewriteSchema = z
  .object({
    rawInput: z.string().transform((value) => value.trim()).refine(Boolean),
    rawContentJson: z.string().nullable(),
    wrongPoint: z.string(),
    analysis: z.string(),
    mnemonic: z.string(),
    extension: z.string(),
    notes: z.string(),
    categoryIds: z.array(z.string()).min(1),
    userTags: z.array(z.string()).transform(normalizeNames),
    template: z.string(),
    sourceType: z.string(),
    sourceDetail: z.string(),
  })
  .strict();

const bulkUpdateSchema = z
  .object({
    ids: z.array(z.string().min(1)).min(1).transform((ids) => [...new Set(ids)]),
    tags: z
      .array(z.string())
      .transform(normalizeNames)
      .refine((tags) => tags.length > 0)
      .optional(),
    archived: z.boolean().optional(),
    position: z.enum(['top', 'bottom']).optional(),
  })
  .strict()
  .refine(
    (value) => value.tags !== undefined || value.archived !== undefined || value.position !== undefined,
  );

const retryBodySchema = z.object({}).strict();
const createFolderSchema = z
  .object({
    name: z.string().trim().min(1).max(40),
  })
  .strict();
const addFolderCardsSchema = z
  .object({
    cardIds: z.array(z.string().trim().min(1)).min(1),
  })
  .strict();
const allowedSearchKeys = new Set([
  'query',
  'categoryIds',
  'tagIds',
  'aiStatus',
  'archived',
  'createdFrom',
  'createdTo',
  'page',
  'pageSize',
  'contentVersion',
]);
const allowedRandomOriginalKeys = new Set(['categoryIds', 'createdFrom', 'createdTo']);

export function createCardRouter(cardService: CardService) {
  const router = express.Router();

  router.post('/', async (request, response) => {
    const parsed = createCardSchema.safeParse(request.body);
    if (!parsed.success) {
      sendInvalidRequest(response);
      return;
    }

    try {
      const detail = await cardService.create(parsed.data as CreateCardInput);
      response.status(201).json(detail);
    } catch (error) {
      sendSafeError(response, error);
    }
  });

  router.get('/', (request, response) => {
    const parsed = parseSearchInput(request.query);
    if (!parsed) {
      sendInvalidRequest(response);
      return;
    }
    try {
      response.status(200).json(cardService.search(parsed));
    } catch (error) {
      sendSafeError(response, error);
    }
  });

  router.get('/random-original/count', (request, response) => {
    const parsed = parseRandomOriginalInput(request.query);
    if (!parsed) {
      sendInvalidRequest(response);
      return;
    }
    try {
      response.status(200).json({ totalAvailable: cardService.countRandomOriginals(parsed) });
    } catch (error) {
      sendSafeError(response, error);
    }
  });

  router.get('/random-original', (request, response) => {
    const parsed = parseRandomOriginalInput(request.query);
    if (!parsed) {
      sendInvalidRequest(response);
      return;
    }
    try {
      response.status(200).json({ card: cardService.randomOriginal(parsed) });
    } catch (error) {
      sendSafeError(response, error);
    }
  });

  router.get('/export', async (_request, response) => {
    try {
      const workbook = await cardService.exportAllAsExcel();
      const fileName = `gongkao-original-content-${formatTimestamp(new Date())}.xlsx`;
      response.status(200);
      response.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      response.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      response.send(workbook);
    } catch (error) {
      sendSafeError(response, error);
    }
  });

  router.patch('/bulk', (request, response) => {
    const parsed = bulkUpdateSchema.safeParse(request.body);
    if (!parsed.success) {
      sendInvalidRequest(response);
      return;
    }
    const { ids, ...update } = parsed.data;
    try {
      response.status(200).json({ updated: cardService.bulkUpdate(ids, update) });
    } catch (error) {
      sendSafeError(response, error);
    }
  });

  router.get('/folders', (_request, response) => {
    try {
      response.status(200).json(cardService.listFolders());
    } catch (error) {
      sendSafeError(response, error);
    }
  });

  router.post('/folders', (request, response) => {
    const parsed = createFolderSchema.safeParse(request.body);
    if (!parsed.success) {
      sendInvalidRequest(response);
      return;
    }
    try {
      response.status(201).json(cardService.createFolder(parsed.data.name));
    } catch (error) {
      sendSafeError(response, error);
    }
  });

  router.delete('/folders/:folderId', (request, response) => {
    try {
      cardService.deleteFolder(request.params.folderId);
      response.status(204).end();
    } catch (error) {
      sendSafeError(response, error);
    }
  });

  router.get('/folders/:folderId/cards', (request, response) => {
    try {
      response.status(200).json(cardService.getFolderContents(request.params.folderId));
    } catch (error) {
      sendSafeError(response, error);
    }
  });

  router.post('/folders/:folderId/cards', (request, response) => {
    const parsed = addFolderCardsSchema.safeParse(request.body);
    if (!parsed.success) {
      sendInvalidRequest(response);
      return;
    }
    try {
      response
        .status(200)
        .json(cardService.addCardsToFolder(request.params.folderId, parsed.data.cardIds));
    } catch (error) {
      sendSafeError(response, error);
    }
  });

  router.delete('/folders/:folderId/cards', (request, response) => {
    const parsed = addFolderCardsSchema.safeParse(request.body);
    if (!parsed.success) {
      sendInvalidRequest(response);
      return;
    }
    try {
      response
        .status(200)
        .json(cardService.removeCardsFromFolder(request.params.folderId, parsed.data.cardIds));
    } catch (error) {
      sendSafeError(response, error);
    }
  });

  router.get('/:id', (request, response) => {
    try {
      response.status(200).json(cardService.get(request.params.id));
    } catch (error) {
      sendSafeError(response, error);
    }
  });

  router.patch('/:id', async (request, response) => {
    const parsed = cardUpdateSchema.safeParse(request.body);
    if (!parsed.success) {
      sendInvalidRequest(response);
      return;
    }
    try {
      response.status(200).json(await cardService.update(request.params.id, parsed.data));
    } catch (error) {
      sendSafeError(response, error);
    }
  });

  router.put('/:id/original', async (request, response) => {
    const parsed = originalCardRewriteSchema.safeParse(request.body);
    if (!parsed.success) {
      sendInvalidRequest(response);
      return;
    }
    try {
      response.status(200).json(
        await cardService.rewriteOriginal(
          request.params.id,
          parsed.data as OriginalCardRewriteInput,
        ),
      );
    } catch (error) {
      sendSafeError(response, error);
    }
  });

  router.delete('/:id', async (request, response) => {
    try {
      await cardService.delete(request.params.id);
      response.status(204).end();
    } catch (error) {
      sendSafeError(response, error);
    }
  });

  router.post('/:id/retry-ai', async (request, response) => {
    const body = request.body === undefined ? {} : request.body;
    if (!retryBodySchema.safeParse(body).success) {
      sendInvalidRequest(response);
      return;
    }

    try {
      response.status(200).json(await cardService.retryAi(request.params.id));
    } catch (error) {
      sendSafeError(response, error);
    }
  });

  return router;
}

function parseSearchInput(query: express.Request['query']): CardSearchInput | undefined {
  if (Object.keys(query).some((key) => !allowedSearchKeys.has(key))) return undefined;
  const queryText = readScalar(query.query);
  const categoryIds = readArray(query.categoryIds);
  const tagIds = readArray(query.tagIds);
  const page = readInteger(query.page, 1, Number.MAX_SAFE_INTEGER);
  const pageSize = readInteger(query.pageSize, 1, 100);
  const contentVersion = readEnum(query.contentVersion, ['optimized', 'original'] as const);
  const aiStatus = readEnum(
    query.aiStatus,
    ['processing', 'ready', 'pending', 'needs_input'] as const,
  );
  const archived = readEnum(query.archived, ['true', 'false'] as const);
  const createdFrom = readDate(query.createdFrom, false);
  const createdTo = readDate(query.createdTo, true);

  if (
    queryText === null ||
    categoryIds === null ||
    tagIds === null ||
    page === null ||
    pageSize === null ||
    contentVersion === null ||
    aiStatus === null ||
    archived === null ||
    createdFrom === null ||
    createdTo === null
  ) {
    return undefined;
  }

  const input: CardSearchInput = {
    contentVersion: contentVersion ?? 'optimized',
    query: queryText ?? '',
    categoryIds: categoryIds ?? [],
    tagIds: tagIds ?? [],
    archived: archived === 'true',
    page: page ?? 1,
    pageSize: pageSize ?? 20,
  };
  if (aiStatus !== undefined) input.aiStatus = aiStatus;
  if (createdFrom !== undefined) input.createdFrom = createdFrom;
  if (createdTo !== undefined) input.createdTo = createdTo;
  if (input.createdFrom && input.createdTo && input.createdFrom > input.createdTo) return undefined;
  return input;
}

function parseRandomOriginalInput(query: express.Request['query']): {
  categoryIds: string[];
  createdFrom?: string;
  createdTo?: string;
} | undefined {
  if (Object.keys(query).some((key) => !allowedRandomOriginalKeys.has(key))) return undefined;
  const categoryIds = readArray(query.categoryIds);
  const createdFrom = readDate(query.createdFrom, false);
  const createdTo = readDate(query.createdTo, true);
  if (categoryIds === null || createdFrom === null || createdTo === null) return undefined;

  const input: {
    categoryIds: string[];
    createdFrom?: string;
    createdTo?: string;
  } = { categoryIds: categoryIds ?? [] };
  if (createdFrom !== undefined) input.createdFrom = createdFrom;
  if (createdTo !== undefined) input.createdTo = createdTo;
  if (input.createdFrom && input.createdTo && input.createdFrom > input.createdTo) return undefined;
  return input;
}

function readScalar(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  return typeof value === 'string' ? value : null;
}

function readArray(value: unknown): string[] | null | undefined {
  if (value === undefined) return undefined;
  if (typeof value === 'string') return [value];
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
    ? [...new Set(value)]
    : null;
}

function readInteger(
  value: unknown,
  minimum: number,
  maximum: number,
): number | null | undefined {
  const scalar = readScalar(value);
  if (scalar === undefined || scalar === null) return scalar;
  if (!/^[1-9]\d*$/.test(scalar)) return null;
  const number = Number(scalar);
  return Number.isSafeInteger(number) && number >= minimum && number <= maximum ? number : null;
}

function readEnum<const T extends readonly string[]>(
  value: unknown,
  values: T,
): T[number] | null | undefined {
  const scalar = readScalar(value);
  if (scalar === undefined || scalar === null) return scalar;
  return values.includes(scalar) ? (scalar as T[number]) : null;
}

function readDate(value: unknown, endOfDay: boolean): string | null | undefined {
  const scalar = readScalar(value);
  if (scalar === undefined || scalar === null) return scalar;
  if (/^\d{4}-\d{2}-\d{2}$/.test(scalar)) {
    const suffix = endOfDay ? 'T23:59:59.999Z' : 'T00:00:00.000Z';
    const date = new Date(`${scalar}${suffix}`);
    return date.toISOString().slice(0, 10) === scalar ? date.toISOString() : null;
  }
  if (!z.string().datetime({ offset: true }).safeParse(scalar).success) return null;
  return new Date(scalar).toISOString();
}

function normalizeNames(names: string[]) {
  return [...new Set(names.map((name) => name.trim()).filter(Boolean))];
}

function hasUniqueQuizItemIds(items: Array<{ id: string }>) {
  return new Set(items.map(({ id }) => id)).size === items.length;
}

function sendInvalidRequest(response: express.Response) {
  response.status(400).json({ code: 'invalid_request', message: '请求参数不合法' });
}

function sendSafeError(response: express.Response, error: unknown) {
  if (error instanceof CardServiceError) {
    if (error.code === 'folder_resource_not_found') {
      response.status(404).json({ code: 'not_found', message: '请求的资源不存在' });
      return;
    }
    if (error.code === 'folder_name_conflict') {
      response.status(409).json({ code: 'folder_name_conflict', message: '文件夹名称已存在' });
      return;
    }
    if (error.code === 'not_found') {
      response.status(404).json({ code: 'not_found', message: '卡片不存在' });
      return;
    }
    if (error.code === 'invalid_state') {
      response.status(409).json({ code: 'invalid_state', message: '当前卡片状态不允许此操作' });
      return;
    }
    if (error.code === 'processing_conflict') {
      response.status(409).json({
        code: 'processing_conflict',
        message: '卡片正在整理，请稍后再编辑相关内容',
      });
      return;
    }
    sendInvalidRequest(response);
    return;
  }

  response.status(500).json({ code: 'internal_error', message: '请求处理失败' });
}

function formatTimestamp(value: Date) {
  const iso = value.toISOString();
  return `${iso.slice(0, 10).replaceAll('-', '')}-${iso.slice(11, 19).replaceAll(':', '')}`;
}
