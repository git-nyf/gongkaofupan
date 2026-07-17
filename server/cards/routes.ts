import express from 'express';
import { z } from 'zod';
import type { CreateCardInput } from '../../shared/contracts';
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

const createCardSchema = z
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
    userTags: z.array(z.string()).transform((tags) => [
      ...new Set(tags.map((tag) => tag.trim()).filter(Boolean)),
    ]),
    template: z.string(),
    sourceType: z.string(),
    sourceDetail: z.string(),
    rating: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
    initialMastery: z.enum(['unseen', 'again', 'hard', 'good']),
    attachments: z.array(attachmentSchema).max(0),
  })
  .strict();

const retryBodySchema = z.object({}).strict();

export function createCardRouter(cardService: CardService) {
  const router = express.Router();

  router.post('/', async (request, response) => {
    const parsed = createCardSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({ code: 'invalid_request', message: '请求参数不合法' });
      return;
    }

    try {
      const detail = await cardService.create(parsed.data as CreateCardInput);
      response.status(201).json(detail);
    } catch (error) {
      sendSafeError(response, error);
    }
  });

  router.post('/:id/retry-ai', async (request, response) => {
    if (!retryBodySchema.safeParse(request.body ?? {}).success) {
      response.status(400).json({ code: 'invalid_request', message: '请求参数不合法' });
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
    response.status(400).json({ code: 'invalid_request', message: '请求参数不合法' });
    return;
  }

  response.status(500).json({ code: 'internal_error', message: '请求处理失败' });
}
