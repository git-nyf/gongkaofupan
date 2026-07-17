import express from 'express';
import { z } from 'zod';
import type { StudySessionInput } from '../../shared/contracts';
import { StudyServiceError, type StudyService } from './service';

const identifierArraySchema = z
  .array(z.string().transform((value) => value.trim()).refine(Boolean))
  .transform((values) => [...new Set(values)]);

const dateSchema = (endOfDay: boolean) =>
  z.string().transform((value, context) => {
    const normalized = normalizeDate(value, endOfDay);
    if (normalized === undefined) {
      context.addIssue({ code: z.ZodIssueCode.custom });
      return z.NEVER;
    }
    return normalized;
  });

const studySessionSchema = z
  .object({
    categoryIds: identifierArraySchema,
    cardIds: identifierArraySchema,
    tagIds: identifierArraySchema,
    rating: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]).optional(),
    mastery: z.enum(['unseen', 'again', 'hard', 'good']).optional(),
    createdFrom: dateSchema(false).optional(),
    createdTo: dateSchema(true).optional(),
    count: z.number().int().min(1).max(100),
    order: z.enum(['fixed', 'random']),
    dueFirst: z.boolean(),
  })
  .strict()
  .refine(
    (value) => !value.createdFrom || !value.createdTo || value.createdFrom <= value.createdTo,
  );

const reviewSchema = z
  .object({
    quizItemId: z.string().transform((value) => value.trim()).refine(Boolean),
    rating: z.enum(['again', 'hard', 'good']),
  })
  .strict();

export function createStudyRouter(studyService: StudyService) {
  const router = express.Router();

  router.post('/api/study/sessions', (request, response) => {
    const parsed = studySessionSchema.safeParse(request.body);
    if (!parsed.success) {
      sendInvalidRequest(response);
      return;
    }

    try {
      response.status(200).json(studyService.createSession(parsed.data as StudySessionInput));
    } catch (error) {
      sendSafeError(response, error);
    }
  });

  router.post('/api/reviews', (request, response) => {
    const parsed = reviewSchema.safeParse(request.body);
    if (!parsed.success) {
      sendInvalidRequest(response);
      return;
    }

    try {
      response.status(200).json(studyService.review(parsed.data));
    } catch (error) {
      sendSafeError(response, error);
    }
  });

  return router;
}

function normalizeDate(value: string, endOfDay: boolean): string | undefined {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const suffix = endOfDay ? 'T23:59:59.999Z' : 'T00:00:00.000Z';
    const date = new Date(`${value}${suffix}`);
    return date.toISOString().slice(0, 10) === value ? date.toISOString() : undefined;
  }
  if (!z.string().datetime({ offset: true }).safeParse(value).success) return undefined;
  return new Date(value).toISOString();
}

function sendInvalidRequest(response: express.Response) {
  response.status(400).json({ code: 'invalid_request', message: '请求参数不合法' });
}

function sendSafeError(response: express.Response, error: unknown) {
  if (error instanceof StudyServiceError && error.code === 'not_found') {
    response.status(404).json({ code: 'not_found', message: '题面不存在' });
    return;
  }
  response.status(500).json({ code: 'internal_error', message: '请求处理失败' });
}
