import express from 'express';
import { z } from 'zod';
import type { ShenlunReviewWriteInput } from './contracts';
import { ShenlunReviewServiceError, type ShenlunReviewService } from './service';

const templateSchema = z.union([
  z.literal(200),
  z.literal(400),
  z.literal(800),
  z.literal(1000),
]);

const markSchema = z
  .object({
    id: z.string().trim().min(1),
    type: z.enum(['bold', 'underline', 'strike', 'color']),
    color: z.enum(['red', 'blue', 'green']).optional(),
    start: z.number().int().nonnegative(),
    end: z.number().int().positive(),
  })
  .strict()
  .refine((mark) => mark.end > mark.start)
  .refine((mark) => (
    mark.type === 'color' ? mark.color !== undefined : mark.color === undefined
  ));

const annotationSchema = z
  .object({
    id: z.string().trim().min(1),
    start: z.number().int().nonnegative(),
    end: z.number().int().nonnegative(),
    quote: z.string(),
    body: z.string(),
    createdAt: z.string().datetime({ offset: true }),
    detached: z.boolean(),
  })
  .strict()
  .refine((annotation) => annotation.end >= annotation.start);

const reviewInputSchema = z
  .object({
    title: z.string().trim().min(1).max(80),
    template: templateSchema,
    text: z.string(),
    marks: z.array(markSchema),
    notes: z.string(),
    standardAnswer: z.string(),
    annotations: z.array(annotationSchema),
  })
  .strict()
  .superRefine((input, context) => {
    input.marks.forEach((mark, index) => {
      if (mark.end > input.text.length) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['marks', index, 'end'],
          message: '格式区间超出正文',
        });
      }
    });
    input.annotations.forEach((annotation, index) => {
      if (!annotation.detached && annotation.end > input.text.length) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['annotations', index, 'end'],
          message: '批注区间超出正文',
        });
      }
      if (
        !annotation.detached
        && input.text.slice(annotation.start, annotation.end).replace(/\uE000/gu, '') !== annotation.quote
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['annotations', index, 'quote'],
          message: '批注原文与正文区间不一致',
        });
      }
    });
  });

const stateInputSchema = z
  .object({
    pinned: z.boolean().optional(),
    archived: z.boolean().optional(),
  })
  .strict()
  .refine((input) => input.pinned !== undefined || input.archived !== undefined);

const archivedQuerySchema = z.enum(['true', 'false']).optional();

export function createShenlunReviewRouter(service: ShenlunReviewService) {
  const router = express.Router();

  router.get('/', (request, response) => {
    const archived = archivedQuerySchema.safeParse(request.query.archived);
    if (!archived.success) {
      response.status(400).json({ code: 'invalid_request', message: '请求参数不合法' });
      return;
    }
    response.status(200).json(service.list(archived.data === 'true'));
  });

  router.get('/:id', (request, response) => {
    try {
      response.status(200).json(service.get(request.params.id));
    } catch (error) {
      sendSafeError(response, error);
    }
  });

  router.post('/', (request, response) => {
    const input = parseInput(request.body, response);
    if (!input) return;
    response.status(201).json(service.create(input));
  });

  router.put('/:id', (request, response) => {
    const input = parseInput(request.body, response);
    if (!input) return;
    try {
      response.status(200).json(service.update(request.params.id, input));
    } catch (error) {
      sendSafeError(response, error);
    }
  });

  router.patch('/:id', (request, response) => {
    const parsed = stateInputSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({ code: 'invalid_request', message: '请求参数不合法' });
      return;
    }
    try {
      response.status(200).json(service.updateState(request.params.id, parsed.data));
    } catch (error) {
      sendSafeError(response, error);
    }
  });

  return router;
}

function parseInput(body: unknown, response: express.Response): ShenlunReviewWriteInput | null {
  const parsed = reviewInputSchema.safeParse(body);
  if (!parsed.success) {
    response.status(400).json({ code: 'invalid_request', message: '请求参数不合法' });
    return null;
  }
  return parsed.data;
}

function sendSafeError(response: express.Response, error: unknown) {
  if (error instanceof ShenlunReviewServiceError && error.code === 'not_found') {
    response.status(404).json({ code: 'not_found', message: '申论复盘不存在' });
    return;
  }
  response.status(500).json({ code: 'internal_error', message: '申论复盘操作失败' });
}
