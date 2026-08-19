import express from 'express';
import { z } from 'zod';
import type { CoachMessageInput } from '../../shared/contracts';
import { CoachServiceError, type CoachService, type CoachServiceErrorCode } from './service';

const messageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1).max(10_000),
}).strict();

export const coachMessageSchema = z.object({
  mode: z.enum(['auto', 'logic', 'data', 'quantity', 'verbal']),
  messages: z.array(messageSchema).min(1).max(20)
    .refine((messages) => messages.at(-1)?.role === 'user'),
  cardId: z.string().min(1).optional(),
  includeWebSearch: z.boolean(),
}).strict();

const errorResponses: Record<CoachServiceErrorCode, { status: number; message: string }> = {
  route_uncertain: { status: 409, message: '无法确定题型，请手动选择模块' },
  provider_unavailable: { status: 503, message: '老师方法源暂不可用' },
  not_found: { status: 404, message: '关联卡片不存在' },
  ai_unavailable: { status: 502, message: 'AI 教练暂不可用' },
};

export function createCoachRouter(coachService: CoachService) {
  const router = express.Router();

  router.get('/status', async (_request, response) => {
    response.status(200).json(await coachService.getStatus());
  });

  router.post('/messages', async (request, response) => {
    const parsed = coachMessageSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({ code: 'invalid_request', message: '请求参数不合法' });
      return;
    }
    try {
      response.status(200).json(await coachService.respond(parsed.data as CoachMessageInput));
    } catch (error) {
      sendSafeError(response, error);
    }
  });

  return router;
}

function sendSafeError(response: express.Response, error: unknown) {
  const code = error instanceof CoachServiceError ? error.code : 'ai_unavailable';
  const mapped = errorResponses[code];
  response.status(mapped.status).json({ code, message: mapped.message });
}
