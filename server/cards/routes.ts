import express from 'express';
import { z } from 'zod';
import type { CardSearchInput, CreateCardInput } from '../../shared/contracts';
import { CardServiceError, type CardService } from './service';

const ratingSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
]);

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
    rating: ratingSchema,
    initialMastery: z.enum(['unseen', 'again', 'hard', 'good']),
    attachments: z.array(attachmentSchema).max(0),
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
    rating: ratingSchema,
    mastery: z.enum(['unseen', 'again', 'hard', 'good']),
    archived: z.boolean(),
  })
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0);

const bulkUpdateSchema = z
  .object({
    ids: z.array(z.string().min(1)).min(1).transform((ids) => [...new Set(ids)]),
    rating: ratingSchema.optional(),
    tags: z.array(z.string()).transform(normalizeNames).optional(),
    archived: z.boolean().optional(),
  })
  .strict()
  .refine(
    (value) => value.rating !== undefined || value.tags !== undefined || value.archived !== undefined,
  );

const retryBodySchema = z.object({}).strict();
const allowedSearchKeys = new Set([
  'query',
  'categoryIds',
  'tagIds',
  'rating',
  'mastery',
  'aiStatus',
  'archived',
  'createdFrom',
  'createdTo',
  'page',
  'pageSize',
]);

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
  const rating = readInteger(query.rating, 1, 5);
  const page = readInteger(query.page, 1, Number.MAX_SAFE_INTEGER);
  const pageSize = readInteger(query.pageSize, 1, 100);
  const mastery = readEnum(query.mastery, ['unseen', 'again', 'hard', 'good'] as const);
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
    rating === null ||
    page === null ||
    pageSize === null ||
    mastery === null ||
    aiStatus === null ||
    archived === null ||
    createdFrom === null ||
    createdTo === null
  ) {
    return undefined;
  }

  const input: CardSearchInput = {
    query: queryText ?? '',
    categoryIds: categoryIds ?? [],
    tagIds: tagIds ?? [],
    archived: archived === 'true',
    page: page ?? 1,
    pageSize: pageSize ?? 20,
  };
  if (rating !== undefined) input.rating = rating as 1 | 2 | 3 | 4 | 5;
  if (mastery !== undefined) input.mastery = mastery;
  if (aiStatus !== undefined) input.aiStatus = aiStatus;
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

function sendInvalidRequest(response: express.Response) {
  response.status(400).json({ code: 'invalid_request', message: '请求参数不合法' });
}

function sendSafeError(response: express.Response, error: unknown) {
  if (error instanceof CardServiceError) {
    if (error.code === 'not_found') {
      response.status(404).json({ code: 'not_found', message: '卡片不存在' });
      return;
    }
    if (error.code === 'invalid_state') {
      response.status(409).json({ code: 'invalid_state', message: '当前卡片状态不可重新整理' });
      return;
    }
    sendInvalidRequest(response);
    return;
  }

  response.status(500).json({ code: 'internal_error', message: '请求处理失败' });
}
