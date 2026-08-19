import { z } from 'zod';
import type {
  CoachConversationMessage,
  CoachMethodReference,
  CoachModule,
  CoachResponse,
  CoachTeacher,
} from '../../shared/contracts';
import type { WebSearchResult } from './webSearch';
import { COACH_SYSTEM_PROMPT } from './prompt';

export interface CoachAiInput {
  resolvedModule: CoachModule;
  teacher: CoachTeacher;
  messages: CoachConversationMessage[];
  methodContext: string;
  methods: CoachMethodReference[];
  cardContext?: { rawInput: string; categories: string[]; tags: string[] };
  search: WebSearchResult;
}

export interface CoachAiProvider {
  respond(input: CoachAiInput): Promise<CoachResponse>;
  isConfigured(): boolean;
}

export interface CoachDeepSeekConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

export type CoachDeepSeekErrorCode =
  | 'not_configured'
  | 'timeout'
  | 'http_error'
  | 'empty_response'
  | 'invalid_json'
  | 'invalid_schema';

export class CoachDeepSeekError extends Error {
  constructor(readonly code: CoachDeepSeekErrorCode) {
    super(`DeepSeek 教练调用失败：${code}`);
    this.name = 'CoachDeepSeekError';
  }
}

const shortText = z.string().trim().min(1).max(320);
const longText = z.string().trim().min(1).max(20_000);
const list = z.array(z.string().trim().min(1).max(4_000)).max(12);
const httpsUrl = z.string().url().refine((value) => new URL(value).protocol === 'https:');

const webSourceSchema = z.object({
  title: shortText,
  url: httpsUrl,
  domain: shortText,
  summary: z.string().max(2_000),
}).strict();

function methodSchema<TSource extends 'huasheng13' | 'zhang_gong'>(source: TSource) {
  return z.object({
    id: shortText,
    name: shortText,
    source: z.literal(source),
    summary: z.string().max(4_000),
  }).strict();
}

const responseFields = {
  questionType: shortText,
  answer: longText,
  steps: list,
  conclusion: longText,
  pitfalls: list,
  followUps: list,
  trainingPlan: list,
  sources: z.array(webSourceSchema).max(12),
  webSearchStatus: z.enum(['ready', 'disabled', 'failed', 'empty']),
};

const coachResponseSchema = z.discriminatedUnion('teacher', [
  z.object({
    ...responseFields,
    resolvedModule: z.enum(['logic', 'data', 'quantity']),
    teacher: z.literal('huasheng13'),
    methodReferences: z.array(methodSchema('huasheng13')).max(12),
  }).strict(),
  z.object({
    ...responseFields,
    resolvedModule: z.literal('verbal'),
    teacher: z.literal('zhang_gong'),
    methodReferences: z.array(methodSchema('zhang_gong')).max(12),
  }).strict(),
]);

export function createCoachDeepSeekProvider(
  config: CoachDeepSeekConfig,
  fetchImpl: typeof fetch = globalThis.fetch,
): CoachAiProvider {
  const isConfigured = () => config.apiKey.trim().length > 0;

  return {
    isConfigured,
    async respond(input) {
      if (!isConfigured()) throw new CoachDeepSeekError('not_configured');

      let response: Response;
      try {
        response = await fetchImpl(
          `${config.baseUrl.replace(/\/+$/, '')}/chat/completions`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${config.apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: config.model,
              thinking: { type: 'disabled' },
              temperature: 0.2,
              max_tokens: 8192,
              response_format: { type: 'json_object' },
              messages: [
                { role: 'system', content: COACH_SYSTEM_PROMPT },
                { role: 'user', content: JSON.stringify(input) },
              ],
            }),
            signal: AbortSignal.timeout(90_000),
          },
        );
      } catch (error) {
        throw new CoachDeepSeekError(isTimeoutError(error) ? 'timeout' : 'http_error');
      }

      if (!response.ok) {
        try {
          await response.body?.cancel();
        } catch {
          // 屏蔽上游响应体和断流异常。
        }
        throw new CoachDeepSeekError('http_error');
      }

      let payload: unknown;
      try {
        payload = await response.json();
      } catch (error) {
        throw new CoachDeepSeekError(isTimeoutError(error) ? 'timeout' : 'invalid_json');
      }

      const content = readContent(payload);
      if (content === null || content.trim().length === 0) {
        throw new CoachDeepSeekError('empty_response');
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(extractJson(content));
      } catch {
        throw new CoachDeepSeekError('invalid_json');
      }

      const result = coachResponseSchema.safeParse(parsed);
      if (!result.success) throw new CoachDeepSeekError('invalid_schema');
      return result.data;
    },
  };
}

function readContent(payload: unknown): string | null {
  if (payload === null || typeof payload !== 'object') return null;
  const choices = Reflect.get(payload, 'choices');
  if (!Array.isArray(choices) || choices.length === 0) return null;
  const message = Reflect.get(choices[0], 'message');
  if (message === null || typeof message !== 'object') return null;
  const content = Reflect.get(message, 'content');
  return typeof content === 'string' ? content : null;
}

function extractJson(content: string): string {
  const trimmed = content.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);
  return fenced?.[1]?.trim() ?? trimmed;
}

function isTimeoutError(error: unknown): boolean {
  return error instanceof DOMException
    && (error.name === 'TimeoutError' || error.name === 'AbortError');
}
