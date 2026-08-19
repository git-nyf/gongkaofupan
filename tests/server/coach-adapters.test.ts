import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  createHuashengAdapter,
  type McpToolClient,
} from '../../server/coach/huasheng';
import { createZhangGongAdapter } from '../../server/coach/zhangGong';
import { createWebSearchAdapter } from '../../server/coach/webSearch';

function textResult(value: unknown) {
  return { content: [{ type: 'text', text: JSON.stringify(value) }] };
}

function fakeMcp(callTool: McpToolClient['callTool']): McpToolClient {
  return {
    listTools: async () => [],
    callTool,
    close: async () => undefined,
  };
}

describe('教练外部能力适配器', () => {
  it('花生自动路由将 verbal_reasoning 归一为 verbal', async () => {
    const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
    const adapter = createHuashengAdapter({
      url: 'http://127.0.0.1:8000/sse',
      clientFactory: async () => fakeMcp(async (name, args) => {
        calls.push({ name, args });
        if (name === 'route_xingce_question') {
          return textResult({ module_guess: 'verbal_reasoning' });
        }
        throw new Error(`unexpected tool: ${name}`);
      }),
    });

    const context = await adapter.load({ mode: 'auto', question: '下列哪项说法正确？' });

    expect(context.module).toBe('verbal');
    expect(context.questionType).toBe('verbal_reasoning');
    expect(context.methods).toEqual([]);
    expect(calls).toEqual([{
      name: 'route_xingce_question',
      args: { question_text: '下列哪项说法正确？' },
    }]);
  });

  it('花生自动路由不确定时保留可用状态，不误报 unavailable', async () => {
    const adapter = createHuashengAdapter({
      url: 'http://127.0.0.1:8000/sse',
      clientFactory: async () => fakeMcp(async (name) => {
        if (name === 'route_xingce_question') return textResult({ module_guess: 'unknown' });
        throw new Error(`unexpected tool: ${name}`);
      }),
    });

    await expect(adapter.load({ mode: 'auto', question: '无法确定题型' })).rejects.toMatchObject({
      code: 'route_uncertain',
    });
    await expect(adapter.getStatus()).resolves.toBe('ready');
  });

  it('花生手动数量模式按真实契约顺序请求脚手架、方法和方法卡', async () => {
    const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
    const adapter = createHuashengAdapter({
      url: 'http://127.0.0.1:8000/sse',
      clientFactory: async () => fakeMcp(async (name, args) => {
        calls.push({ name, args });
        if (name === 'get_quantity_relation_scaffold') {
          return textResult({ scaffold: '统一工作总量后列式' });
        }
        if (name === 'search_methods') {
          return textResult({ results: [{ method_id: 'q-1', name: '工程问题', summary: '统一总量' }] });
        }
        if (name === 'get_method_card') {
          return textResult({
            method_id: 'q-1',
            card: { id: 'q-1', method_name: '工程问题', summary: '统一总量' },
          });
        }
        throw new Error(`unexpected tool: ${name}`);
      }),
    });

    const context = await adapter.load({ mode: 'quantity', question: '甲乙合作完成工程问题' });

    expect(context.module).toBe('quantity');
    expect(context.methods).toEqual([
      { id: 'q-1', name: '工程问题', source: 'huasheng13', summary: '统一总量' },
    ]);
    expect(context.promptContext).toContain('统一工作总量后列式');
    expect(calls).toEqual([
      { name: 'get_quantity_relation_scaffold', args: {} },
      {
        name: 'search_methods',
        args: { query: '甲乙合作完成工程问题', module: 'quantity', top_k: 3 },
      },
      { name: 'get_method_card', args: { method_id: 'q-1' } },
    ]);
  });

  it.each([
    ['graphic_reasoning', 'get_graphic_reasoning_scaffold'],
    ['definition_judgement', 'get_definition_judgement_scaffold'],
    ['analogy_reasoning', 'get_analogy_reasoning_scaffold'],
    ['logic_analysis', 'get_logic_analysis_scaffold'],
  ])('uses the dedicated zero-argument scaffold for auto-routed %s', async (questionType, scaffoldName) => {
    const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
    const adapter = createHuashengAdapter({
      url: 'http://127.0.0.1:8000/sse',
      clientFactory: async () => fakeMcp(async (name, args) => {
        calls.push({ name, args });
        if (name === 'route_xingce_question') return textResult({ module_guess: questionType });
        if (name === scaffoldName) return textResult({ scaffold: `${questionType} scaffold` });
        if (name === 'search_methods') return textResult({ results: [] });
        throw new Error(`unexpected tool: ${name}`);
      }),
    });

    const context = await adapter.load({ mode: 'auto', question: 'auto-routed logic question' });

    expect(context.questionType).toBe(questionType);
    expect(context.promptContext).toContain(`${questionType} scaffold`);
    expect(calls).toEqual([
      { name: 'route_xingce_question', args: { question_text: 'auto-routed logic question' } },
      { name: scaffoldName, args: {} },
      {
        name: 'search_methods',
        args: { query: 'auto-routed logic question', module: 'logic', top_k: 3 },
      },
    ]);
  });

  it('times out a stalled Huasheng tool call and still closes the client', async () => {
    vi.useFakeTimers();
    try {
      const close = vi.fn(async () => undefined);
      const adapter = createHuashengAdapter({
        url: 'http://127.0.0.1:8000/sse',
        clientFactory: async () => ({
          listTools: async () => [],
          callTool: async () => new Promise<never>(() => undefined),
          close,
        }),
      });

      const pending = adapter.load({ mode: 'logic', question: 'stalled tool call' });
      const rejection = pending.then(() => undefined, (error) => error);
      await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(20_000);

      await expect(rejection).resolves.toMatchObject({ code: 'unavailable' });
      expect(close).toHaveBeenCalledOnce();
    } finally {
      vi.useRealTimers();
    }
  });

  it('花生 solver 使用 question_text 参数', async () => {
    const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
    const adapter = createHuashengAdapter({
      url: 'http://127.0.0.1:8000/sse',
      clientFactory: async () => fakeMcp(async (name, args) => {
        calls.push({ name, args });
        if (name === 'solve_logic_reasoning') return textResult({ analysis: '识别定义' });
        if (name === 'search_methods') return textResult({ results: [] });
        throw new Error(`unexpected tool: ${name}`);
      }),
    });

    await adapter.load({ mode: 'logic', question: '这是一道判断题' });

    expect(calls).toEqual([
      { name: 'search_methods', args: { query: '这是一道判断题', module: 'logic', top_k: 3 } },
      { name: 'solve_logic_reasoning', args: { question_text: '这是一道判断题' } },
    ]);
  });

  it('花生工具错误只暴露 unavailable，不泄露上游正文', async () => {
    const adapter = createHuashengAdapter({
      url: 'http://127.0.0.1:8000/sse',
      clientFactory: async () => fakeMcp(async () => {
        throw new Error('上游秘密正文：internal stack trace');
      }),
    });

    await expect(adapter.load({ mode: 'logic', question: '这是一道判断题' })).rejects.toMatchObject({
      code: 'unavailable',
      message: expect.not.stringContaining('上游秘密正文'),
    });
    await expect(adapter.getStatus()).resolves.toBe('unavailable');
  });

  it('张弓只读取 SKILL.md 和题型对应引用文件', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'zhang-gong-'));
    await mkdir(join(directory, 'references'));
    await writeFile(join(directory, 'SKILL.md'), '张弓总原则');
    await writeFile(join(directory, 'references', '02-选词填空SOP.md'), '选词方法');
    await writeFile(join(directory, 'references', '03-语句表达SOP.md'), '语句方法');
    await writeFile(join(directory, 'references', '01-中心理解SOP.md'), '中心理解方法');
    await writeFile(join(directory, 'references', '04-不应读取.md'), '不应进入上下文');

    const adapter = createZhangGongAdapter({ directory });
    const context = await adapter.load('请判断这个选词填空的成语用法');

    expect(context.module).toBe('verbal');
    expect(context.questionType).toBe('言语理解');
    expect(context.methods).toEqual([
      {
        id: '02-选词填空SOP.md',
        name: '选词填空SOP',
        source: 'zhang_gong',
        summary: '选词方法',
      },
    ]);
    expect(context.promptContext).toContain('张弓总原则');
    expect(context.promptContext).toContain('选词方法');
    expect(context.promptContext).not.toContain('不应进入上下文');
  });

  it('张弓路径缺失返回 not_configured', async () => {
    const adapter = createZhangGongAdapter({ directory: join(tmpdir(), 'missing-zhang-gong') });

    await expect(adapter.getStatus()).resolves.toBe('not_configured');
    await expect(adapter.load('语句排序题')).rejects.toMatchObject({ code: 'not_configured' });
  });

  it('Tavily 只保留 HTTPS 来源并限制为三条', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({
      results: [
        { title: '第一条', url: 'https://example.com/one', content: '摘要一' },
        { title: '重复条', url: 'https://example.com/one', content: '重复' },
        { title: '非安全', url: 'http://example.com/two', content: '不应保留' },
        { title: '第二条', url: 'https://example.com/two', content: '摘要二' },
        { title: '第三条', url: 'https://example.com/three', content: '摘要三' },
        { title: '第四条', url: 'https://example.com/four', content: '超出限制' },
      ],
    }), { status: 200 }));
    const adapter = createWebSearchAdapter({ apiKey: 'test-key', fetchImpl });

    const result = await adapter.search('工程问题');

    expect(result.status).toBe('ready');
    expect(result.sources).toHaveLength(3);
    expect(result.sources.map(({ url }) => url)).toEqual([
      'https://example.com/one',
      'https://example.com/two',
      'https://example.com/three',
    ]);
    expect(result.sources[0].domain).toBe('example.com');
    expect(result.sources[0].summary).toBe('摘要一');
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://api.tavily.com/search',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('Tavily 未配置不发请求，失败返回 failed', async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const disabled = createWebSearchAdapter({ apiKey: '', fetchImpl });

    await expect(disabled.search('题目')).resolves.toEqual({ status: 'disabled', sources: [] });
    expect(fetchImpl).not.toHaveBeenCalled();

    const failed = createWebSearchAdapter({
      apiKey: 'test-key',
      fetchImpl: vi.fn<typeof fetch>(async () => new Response('bad gateway', { status: 502 })),
    });
    await expect(failed.search('题目')).resolves.toEqual({ status: 'failed', sources: [] });
  });

  it('aborts a stalled Tavily request after the configured timeout', async () => {
    vi.useFakeTimers();
    try {
      let requestSignal: AbortSignal | null | undefined;
      const fetchImpl = vi.fn<typeof fetch>(async (_input, init) => {
        requestSignal = init?.signal;
        return new Promise<Response>((_resolve, reject) => {
          requestSignal?.addEventListener(
            'abort',
            () => reject(new DOMException('Aborted', 'AbortError')),
            { once: true },
          );
        });
      });
      const adapter = createWebSearchAdapter({
        apiKey: 'test-key',
        fetchImpl,
        timeoutMs: 15_000,
      });

      const pending = adapter.search('stalled Tavily request');
      await vi.advanceTimersByTimeAsync(14_999);
      expect(fetchImpl).toHaveBeenCalledOnce();
      expect(requestSignal?.aborted).toBe(false);

      await vi.advanceTimersByTimeAsync(1);
      await expect(pending).resolves.toEqual({ status: 'failed', sources: [] });
      expect(requestSignal?.aborted).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});
