import type { NormalizeCardInput, NormalizedCard } from '../../shared/contracts';
import { DEEPSEEK_SYSTEM_PROMPT } from './prompt';
import type { AiProvider } from './provider';
import { normalizedCardSchema } from './schema';

export type DeepSeekErrorCode =
  | 'not_configured'
  | 'timeout'
  | 'http_error'
  | 'empty_response'
  | 'invalid_json'
  | 'invalid_schema';

export class DeepSeekError extends Error {
  constructor(readonly code: DeepSeekErrorCode) {
    super(`DeepSeek 调用失败：${code}`);
    this.name = 'DeepSeekError';
  }
}

export interface DeepSeekConfig {
  apiKey: string;
  baseUrl: string;
}

const retryableCodes = new Set<DeepSeekErrorCode>([
  'empty_response',
  'invalid_json',
  'invalid_schema',
]);

export class DeepSeekAiProvider implements AiProvider {
  constructor(
    private readonly config: DeepSeekConfig,
    private readonly fetchImpl: typeof fetch = globalThis.fetch,
  ) {}

  async normalize(input: NormalizeCardInput): Promise<NormalizedCard> {
    if (!hasConfiguredDeepSeekApiKey(this.config.apiKey)) {
      throw new DeepSeekError('not_configured');
    }

    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        return await this.request(input);
      } catch (error) {
        if (
          !(error instanceof DeepSeekError) ||
          !retryableCodes.has(error.code) ||
          attempt === 1
        ) {
          throw error;
        }
      }
    }

    throw new DeepSeekError('invalid_schema');
  }

  private async request(input: NormalizeCardInput): Promise<NormalizedCard> {
    let response: Response;
    try {
      response = await this.fetchImpl(
        `${this.config.baseUrl.replace(/\/+$/, '')}/chat/completions`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.config.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'deepseek-v4-flash',
            thinking: { type: 'disabled' },
            temperature: 0.1,
            max_tokens: 8192,
            response_format: { type: 'json_object' },
            messages: [
              { role: 'system', content: DEEPSEEK_SYSTEM_PROMPT },
              { role: 'user', content: JSON.stringify(input) },
            ],
          }),
          signal: AbortSignal.timeout(60_000),
        },
      );
    } catch (error) {
      throw new DeepSeekError(isTimeoutError(error) ? 'timeout' : 'http_error');
    }

    if (!response.ok) {
      try {
        await response.body?.cancel();
      } catch {
        // HTTP 错误保持统一脱敏，不暴露响应体释放失败信息。
      }
      throw new DeepSeekError('http_error');
    }

    let responseBody: unknown;
    try {
      responseBody = await response.json();
    } catch (error) {
      if (isTimeoutError(error)) {
        throw new DeepSeekError('timeout');
      }
      throw new DeepSeekError(error instanceof SyntaxError ? 'invalid_json' : 'http_error');
    }

    const content = readContent(responseBody);
    if (content === null || content.trim().length === 0) {
      throw new DeepSeekError('empty_response');
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(extractJsonObject(content));
    } catch {
      throw new DeepSeekError('invalid_json');
    }

    const normalized = normalizedCardSchema.safeParse(parsed);
    if (!normalized.success) {
      throw new DeepSeekError('invalid_schema');
    }
    return normalized.data;
  }
}

function extractJsonObject(content: string): string {
  const trimmed = content.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);
  if (fenced?.[1]) return fenced[1].trim();

  const firstStart = trimmed.indexOf('{');
  if (firstStart === -1) return trimmed;
  const first = findJsonObjectEnd(trimmed, firstStart);
  if (first === null) return trimmed;
  if (firstStart === 0 && first.end === trimmed.length - 1) return trimmed;
  const nextStart = trimmed.indexOf('{', first.end + 1);
  if (nextStart !== -1 && findJsonObjectEnd(trimmed, nextStart) !== null) return trimmed;
  return first.value;
}

function findJsonObjectEnd(content: string, start: number): { end: number; value: string } | null {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < content.length; index += 1) {
    const char = content[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === '\\' && inString) {
      escaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        return { end: index, value: content.slice(start, index + 1) };
      }
    }
  }
  return null;
}

export function createDeepSeekProvider(
  config: DeepSeekConfig,
  fetchImpl: typeof fetch = globalThis.fetch,
): AiProvider {
  return new DeepSeekAiProvider(config, fetchImpl);
}

export function hasConfiguredDeepSeekApiKey(apiKey: string) {
  return apiKey.trim().length > 0;
}

function readContent(responseBody: unknown): string | null {
  if (typeof responseBody !== 'object' || responseBody === null) return null;
  const choices = Reflect.get(responseBody, 'choices');
  if (!Array.isArray(choices) || choices.length === 0) return null;
  const message = Reflect.get(choices[0], 'message');
  if (typeof message !== 'object' || message === null) return null;
  const content = Reflect.get(message, 'content');
  return typeof content === 'string' ? content : null;
}

function isTimeoutError(error: unknown): boolean {
  return (
    error instanceof DOMException &&
    (error.name === 'TimeoutError' || error.name === 'AbortError')
  );
}
