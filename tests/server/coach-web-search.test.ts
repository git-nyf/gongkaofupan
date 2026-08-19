import { describe, expect, it, vi } from 'vitest';
import { readConfig } from '../../server/config';
import { createWebSearchAdapter } from '../../server/coach/webSearch';

describe('AI 教练联网搜索配置', () => {
  it('从 TAVILY_API_KEY 读取并清理密钥', () => {
    const config = readConfig({ TAVILY_API_KEY: '  tvly-test-key  ' });

    expect(config.coach.tavilyApiKey).toBe('tvly-test-key');
  });

  it('按 Tavily Bearer 鉴权契约请求且不在正文中携带密钥', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({
      results: [
        { title: '资料来源', url: 'https://example.com/source', content: '摘要' },
      ],
    }), { status: 200 }));
    const adapter = createWebSearchAdapter({ apiKey: 'tvly-test-key', fetchImpl });

    await expect(adapter.search('资料分析题')).resolves.toMatchObject({ status: 'ready' });

    const [, init] = fetchImpl.mock.calls[0]!;
    expect(init?.headers).toEqual({
      authorization: 'Bearer tvly-test-key',
      'content-type': 'application/json',
    });
    expect(JSON.parse(String(init?.body))).toEqual({
      query: '资料分析题',
      search_depth: 'basic',
      max_results: 5,
      include_answer: false,
    });
  });

  it('未配置时不发请求，上游失败时返回可降级状态', async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const disabled = createWebSearchAdapter({ apiKey: '', fetchImpl });

    await expect(disabled.search('题目')).resolves.toEqual({ status: 'disabled', sources: [] });
    expect(fetchImpl).not.toHaveBeenCalled();

    const failed = createWebSearchAdapter({
      apiKey: 'tvly-test-key',
      fetchImpl: vi.fn<typeof fetch>(async () => new Response('unauthorized', { status: 401 })),
    });
    await expect(failed.search('题目')).resolves.toEqual({ status: 'failed', sources: [] });
  });
});
