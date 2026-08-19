import type {
  CoachCapabilityState,
  CoachWebSource,
} from '../../shared/contracts';

export interface WebSearchResult {
  status: 'ready' | 'disabled' | 'failed' | 'empty';
  sources: CoachWebSource[];
}
export interface WebSearchAdapter {
  getStatus(): CoachCapabilityState;
  search(query: string): Promise<WebSearchResult>;
  isConfigured(): boolean;
}

export interface WebSearchAdapterOptions {
  apiKey: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

const TAVILY_URL = 'https://api.tavily.com/search';
const DEFAULT_TIMEOUT_MS = 15_000;

function truncate(value: string, maxLength: number): string {
  return value.length > maxLength ? `${value.slice(0, maxLength)}…` : value;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function sourceFrom(value: unknown): CoachWebSource | undefined {
  const record = asRecord(value);
  if (!record || typeof record.url !== 'string') return undefined;
  let url: URL;
  try {
    url = new URL(record.url);
  } catch {
    return undefined;
  }
  if (url.protocol !== 'https:') return undefined;
  const title = typeof record.title === 'string' ? record.title : url.hostname;
  const summaryValue = record.content ?? record.summary ?? '';
  const summary = typeof summaryValue === 'string' ? summaryValue : JSON.stringify(summaryValue);
  return {
    title: truncate(title, 320),
    url: url.toString(),
    domain: url.hostname,
    summary: truncate(summary ?? '', 320),
  };
}

export function createWebSearchAdapter(options: WebSearchAdapterOptions): WebSearchAdapter {
  const fetchImpl = options.fetchImpl ?? fetch;
  const apiKey = options.apiKey.trim();
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const search = async (query: string): Promise<WebSearchResult> => {
    if (!apiKey) return { status: 'disabled', sources: [] };
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(TAVILY_URL, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${apiKey}`,
          'content-type': 'application/json',
        },
        signal: controller.signal,
        body: JSON.stringify({
          query,
          search_depth: 'basic',
          max_results: 5,
          include_answer: false,
        }),
      });
      if (!response.ok) return { status: 'failed', sources: [] };
      const payload: unknown = await response.json();
      const results = asRecord(payload)?.results;
      if (!Array.isArray(results)) return { status: 'empty', sources: [] };
      const sources: CoachWebSource[] = [];
      const seen = new Set<string>();
      for (const result of results) {
        const source = sourceFrom(result);
        if (!source || seen.has(source.url)) continue;
        seen.add(source.url);
        sources.push(source);
        if (sources.length === 3) break;
      }
      return sources.length > 0
        ? { status: 'ready', sources }
        : { status: 'empty', sources: [] };
    } catch {
      return { status: 'failed', sources: [] };
    } finally {
      clearTimeout(timeout);
    }
  };

  return {
    getStatus: () => apiKey ? 'ready' : 'not_configured',
    search,
    isConfigured: () => Boolean(apiKey),
  };
}
