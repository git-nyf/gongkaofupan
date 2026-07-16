import type { NormalizeCardInput, NormalizedCard } from '../../shared/contracts';
import { DEEPSEEK_SYSTEM_PROMPT } from './prompt';
import type { AiProvider } from './provider';
import { normalizedCardSchema } from './schema';

export type DeepSeekErrorCode =
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
            response_format: { type: 'json_object' },
            messages: [
              { role: 'system', content: DEEPSEEK_SYSTEM_PROMPT },
              { role: 'user', content: JSON.stringify(input) },
            ],
          }),
          signal: AbortSignal.timeout(20_000),
        },
      );
    } catch (error) {
      if (
        error instanceof DOMException &&
        (error.name === 'TimeoutError' || error.name === 'AbortError')
      ) {
        throw new DeepSeekError('timeout');
      }
      throw new DeepSeekError('http_error');
    }

    if (!response.ok) {
      throw new DeepSeekError('http_error');
    }

    let responseBody: unknown;
    try {
      responseBody = await response.json();
    } catch {
      throw new DeepSeekError('invalid_json');
    }

    const content = readContent(responseBody);
    if (content === null || content.trim().length === 0) {
      throw new DeepSeekError('empty_response');
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
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

export function createDeepSeekProvider(
  config: DeepSeekConfig,
  fetchImpl: typeof fetch = globalThis.fetch,
): AiProvider {
  return new DeepSeekAiProvider(config, fetchImpl);
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
