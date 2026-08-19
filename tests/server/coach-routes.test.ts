import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import type { CoachResponse } from '../../shared/contracts';
import type { CoachStatus } from '../../shared/contracts';
import { createApp } from '../../server/app';
import { createCoachRouter } from '../../server/coach/routes';
import { CoachServiceError, type CoachService } from '../../server/coach/service';

const response: CoachResponse = {
  resolvedModule: 'logic',
  teacher: 'huasheng13',
  questionType: 'logic_reasoning',
  answer: '选择 A。',
  steps: [],
  conclusion: '答案为 A。',
  pitfalls: [],
  followUps: [],
  trainingPlan: [],
  methodReferences: [],
  sources: [],
  webSearchStatus: 'disabled',
};

function service(overrides: Partial<CoachService> = {}): CoachService {
  return {
    getStatus: vi.fn<CoachService['getStatus']>(async () => ({
      deepseek: 'ready',
      huasheng: 'ready',
      zhangGong: 'not_configured',
      webSearch: 'not_configured',
    } satisfies CoachStatus)),
    respond: vi.fn(async () => response),
    ...overrides,
  };
}

function routerApp(coachService: CoachService) {
  const app = express();
  app.use(express.json({ strict: false }));
  app.use('/api/coach', createCoachRouter(coachService));
  return app;
}

const validBody = {
  mode: 'logic',
  messages: [{ role: 'user', content: '以下哪项最能削弱结论？' }],
  includeWebSearch: false,
};

describe('AI 公考教练路由', () => {
  it('返回能力状态并通过应用入口挂载消息接口', async () => {
    const coachService = service();
    const status = await request(createApp({ coachService })).get('/api/coach/status');
    const message = await request(createApp({ coachService })).post('/api/coach/messages').send(validBody);

    expect(status.status).toBe(200);
    expect(status.body).toEqual({
      deepseek: 'ready', huasheng: 'ready', zhangGong: 'not_configured', webSearch: 'not_configured',
    });
    expect(message.status).toBe(200);
    expect(message.body).toEqual(response);
  });

  it.each([
    ['空消息', { ...validBody, messages: [] }],
    ['消息过多', { ...validBody, messages: Array.from({ length: 21 }, () => ({ role: 'user', content: '题目' })) }],
    ['空内容', { ...validBody, messages: [{ role: 'user', content: '' }] }],
    ['内容过长', { ...validBody, messages: [{ role: 'user', content: '题'.repeat(10_001) }] }],
    ['最后不是用户', { ...validBody, messages: [{ role: 'assistant', content: '回答' }] }],
    ['未知字段', { ...validBody, unexpected: true }],
    ['消息未知字段', { ...validBody, messages: [{ role: 'user', content: '题目', hidden: true }] }],
    ['显式空请求体', null],
  ])('严格拒绝%s', async (_name, body) => {
    const coachService = service();
    const result = await request(routerApp(coachService))
      .post('/api/coach/messages')
      .set('Content-Type', 'application/json')
      .send(body === null ? 'null' : body);

    expect(result.status).toBe(400);
    expect(result.body).toEqual({ code: 'invalid_request', message: '请求参数不合法' });
    expect(coachService.respond).not.toHaveBeenCalled();
  });

  it.each([
    ['route_uncertain', 409, '无法确定题型，请手动选择模块'],
    ['provider_unavailable', 503, '老师方法源暂不可用'],
    ['not_found', 404, '关联卡片不存在'],
    ['ai_unavailable', 502, 'AI 教练暂不可用'],
  ] as const)('将 %s 映射为固定安全响应', async (code, status, message) => {
    const coachService = service({
      respond: vi.fn(async () => { throw new CoachServiceError(code); }),
    });
    const result = await request(routerApp(coachService)).post('/api/coach/messages').send(validBody);

    expect(result.status).toBe(status);
    expect(result.body).toEqual({ code, message });
  });

  it('未知异常不泄露并返回 AI 不可用', async () => {
    const coachService = service({
      respond: vi.fn(async () => { throw new Error('Authorization: Bearer secret'); }),
    });
    const result = await request(routerApp(coachService)).post('/api/coach/messages').send(validBody);

    expect(result.status).toBe(502);
    expect(result.body).toEqual({ code: 'ai_unavailable', message: 'AI 教练暂不可用' });
    expect(JSON.stringify(result.body)).not.toContain('secret');
  });
});
