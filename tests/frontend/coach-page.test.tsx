// @vitest-environment jsdom

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CardDetail, CardSearchResult, CoachResponse, CoachStatus } from '../../shared/contracts';
import { CoachPage } from '../../src/pages/CoachPage';

const readyStatus: CoachStatus = {
  deepseek: 'ready',
  huasheng: 'ready',
  zhangGong: 'not_configured',
  webSearch: 'unavailable',
};

const coachResponse: CoachResponse = {
  resolvedModule: 'logic',
  teacher: 'huasheng13',
  questionType: '削弱论证',
  answer: '选择 B。',
  steps: ['定位结论', '寻找反例'],
  conclusion: 'B 直接削弱因果关系。',
  pitfalls: ['不要只看选项语气强弱'],
  followUps: ['还能用什么方式削弱？'],
  trainingPlan: ['完成 3 道同类题', '复述削弱路径'],
  methodReferences: [{ id: 'logic-1', name: '论证削弱', source: 'huasheng13', summary: '优先找因果漏洞' }],
  sources: [{
    title: '公开题源',
    url: 'https://example.com/question',
    domain: 'example.com',
    summary: '用于核对题干。',
  }],
  webSearchStatus: 'ready',
};

function card(): CardDetail {
  return {
    id: 'card-1',
    entryMode: 'mistake',
    rawInput: '削弱题中要优先识别论点与论据。',
    rawContentJson: null,
    template: '判断推理',
    normalizedStatement: '削弱论证',
    wrongPoint: '',
    analysis: '',
    mnemonic: '',
    extension: '',
    notes: '',
    aiStatus: 'ready',
    sourceType: '',
    sourceDetail: '',
    wrongCount: 1,
    archived: false,
    createdAt: '2026-08-19T00:00:00.000Z',
    updatedAt: '2026-08-19T00:00:00.000Z',
    categories: [{ id: 'logic', name: '判断推理', parentId: null }],
    tags: [{ id: 'weaken', name: '削弱', origin: 'user' }],
    attachments: [],
    quizItems: [],
  };
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function deferredResponse() {
  let resolve!: (response: Response) => void;
  const promise = new Promise<Response>((next) => { resolve = next; });
  return { promise, resolve };
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async (input) => {
    if (String(input) === '/api/coach/status') return jsonResponse(readyStatus);
    throw new Error(`unexpected request: ${String(input)}`);
  }));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('AI 公考教练页面', () => {
  it('加载四项能力状态并提供五种模式分段选择', async () => {
    const user = userEvent.setup();
    render(<CoachPage />);

    expect(await screen.findByText('DeepSeek')).toBeInTheDocument();
    const status = screen.getByRole('region', { name: '能力状态' });
    expect(within(status).getAllByText('可用')).toHaveLength(2);
    expect(within(status).getByText('未配置')).toBeInTheDocument();
    expect(within(status).getByText('暂不可用')).toBeInTheDocument();

    const modes = screen.getByRole('radiogroup', { name: '题型模式' });
    for (const name of ['自动识别', '判断推理', '资料分析', '数量关系', '言语理解']) {
      expect(within(modes).getByRole('radio', { name })).toBeInTheDocument();
    }
    await user.click(within(modes).getByRole('radio', { name: '言语理解' }));
    expect(within(modes).getByRole('radio', { name: '言语理解' })).toBeChecked();
  });

  it('Ctrl+Enter 发送连续消息，普通 Enter 不发送，并展示结构化辅助内容', async () => {
    const fetchMock = vi.mocked(fetch).mockImplementation(async (input, init) => {
      if (String(input) === '/api/coach/status') return jsonResponse(readyStatus);
      if (String(input) === '/api/coach/messages') {
        const request = JSON.parse(String(init?.body)) as { messages: Array<{ role: string; content: string }> };
        expect(request.messages.at(-1)).toEqual({ role: 'user', content: '这道题怎么做？' });
        return jsonResponse(coachResponse);
      }
      throw new Error(`unexpected request: ${String(input)}`);
    });
    const user = userEvent.setup();
    render(<CoachPage />);
    const input = screen.getByRole('textbox', { name: '输入题目或追问' });

    await user.type(input, '这道题怎么做？');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(fetchMock.mock.calls.filter(([path]) => String(path) === '/api/coach/messages')).toHaveLength(0);
    fireEvent.keyDown(input, { key: 'Enter', ctrlKey: true });

    expect(await screen.findByText('选择 B。')).toBeInTheDocument();
    expect(screen.getByText('定位结论')).toBeInTheDocument();
    expect(screen.getByText('B 直接削弱因果关系。')).toBeInTheDocument();
    expect(screen.getByText('不要只看选项语气强弱')).toBeInTheDocument();
    expect(screen.getByText('完成 3 道同类题')).toBeInTheDocument();
    expect(screen.getByText('AI 原创练习')).toBeInTheDocument();
    expect(screen.getByText('还能用什么方式削弱？')).toBeInTheDocument();
    expect(screen.getByText('论证削弱')).toBeInTheDocument();
    expect(screen.getByText('花生十三 · 削弱论证')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /公开题源/ })).toHaveAttribute('href', 'https://example.com/question');

    await user.type(input, '为什么？');
    fireEvent.keyDown(input, { key: 'Enter', ctrlKey: true });
    await waitFor(() => expect(fetchMock.mock.calls.filter(([path]) => String(path) === '/api/coach/messages')).toHaveLength(2));
    const secondBody = JSON.parse(String(fetchMock.mock.calls.filter(([path]) => String(path) === '/api/coach/messages')[1][1]?.body));
    expect(secondBody.messages).toEqual([
      { role: 'user', content: '这道题怎么做？' },
      { role: 'assistant', content: '选择 B。' },
      { role: 'user', content: '为什么？' },
    ]);
  });

  it('请求期间禁止重复发送，Escape 中止且保留草稿', async () => {
    const request = deferredResponse();
    let requestSignal: AbortSignal | null = null;
    const fetchMock = vi.mocked(fetch).mockImplementation(async (input, init) => {
      if (String(input) === '/api/coach/status') return jsonResponse(readyStatus);
      if (String(input) === '/api/coach/messages') {
        requestSignal = init?.signal as AbortSignal;
        return request.promise;
      }
      throw new Error(`unexpected request: ${String(input)}`);
    });
    const user = userEvent.setup();
    render(<CoachPage />);
    const input = screen.getByRole('textbox', { name: '输入题目或追问' });
    await user.type(input, '保留这段草稿');

    fireEvent.keyDown(input, { key: 'Enter', ctrlKey: true });
    expect(await screen.findByRole('button', { name: '正在发送' })).toBeDisabled();
    fireEvent.keyDown(input, { key: 'Enter', ctrlKey: true });
    expect(fetchMock.mock.calls.filter(([path]) => String(path) === '/api/coach/messages')).toHaveLength(1);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect((requestSignal as unknown as AbortSignal).aborted).toBe(true);
    expect(input).toHaveValue('保留这段草稿');
    expect(await screen.findByRole('button', { name: '发送' })).toBeEnabled();
  });

  it('组合输入期间不触发快捷键，并呈现联网禁用和失败状态', async () => {
    const fetchMock = vi.mocked(fetch).mockImplementation(async (input, init) => {
      if (String(input) === '/api/coach/status') return jsonResponse(readyStatus);
      if (String(input) === '/api/coach/messages') {
        const body = JSON.parse(String(init?.body)) as { includeWebSearch: boolean };
        return jsonResponse({
          ...coachResponse,
          sources: [],
          webSearchStatus: body.includeWebSearch ? 'failed' : 'disabled',
        });
      }
      throw new Error(`unexpected request: ${String(input)}`);
    });
    const user = userEvent.setup();
    render(<CoachPage />);
    const input = screen.getByRole('textbox', { name: '输入题目或追问' });
    await user.type(input, '题目');
    fireEvent.compositionStart(input);
    fireEvent.keyDown(input, { key: 'Enter', ctrlKey: true });
    expect(fetchMock.mock.calls.filter(([path]) => String(path) === '/api/coach/messages')).toHaveLength(0);
    fireEvent.compositionEnd(input);

    fireEvent.keyDown(input, { key: 'Enter', ctrlKey: true });
    expect(await screen.findByText('本轮未启用联网搜索')).toBeInTheDocument();

    await user.type(input, '继续');
    await user.click(screen.getByRole('checkbox', { name: '联网搜索' }));
    fireEvent.keyDown(input, { key: 'Enter', ctrlKey: true });
    expect(await screen.findByText('联网搜索失败，本轮回答未受影响')).toBeInTheDocument();
  });

  it('防抖模糊搜索卡片并支持单选和移除', async () => {
    vi.useFakeTimers();
    const result: CardSearchResult = { items: [card()], total: 1, page: 1, pageSize: 8 };
    const fetchMock = vi.mocked(fetch).mockImplementation(async (input) => {
      if (String(input) === '/api/coach/status') return jsonResponse(readyStatus);
      if (String(input).startsWith('/api/cards?')) return jsonResponse(result);
      if (String(input) === '/api/coach/messages') return jsonResponse(coachResponse);
      throw new Error(`unexpected request: ${String(input)}`);
    });
    render(<CoachPage />);
    const search = screen.getByRole('searchbox', { name: '搜索关联卡片' });

    fireEvent.change(search, { target: { value: '削弱 题' } });
    await act(async () => { await vi.advanceTimersByTimeAsync(199); });
    expect(fetchMock.mock.calls.filter(([path]) => String(path).startsWith('/api/cards?'))).toHaveLength(0);
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });

    expect(screen.getByRole('option', { name: /削弱题中要优先识别/ })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/cards?contentVersion=original&archived=false&page=1&pageSize=8&query=%E5%89%8A%E5%BC%B1+%E9%A2%98',
      expect.any(Object),
    );
    fireEvent.click(screen.getByRole('option', { name: /削弱题中要优先识别/ }));
    expect(screen.getByText('已关联：削弱题中要优先识别论点与论据。')).toBeInTheDocument();
    expect(screen.getByText('判断推理 · 削弱')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox', { name: '输入题目或追问' }), { target: { value: '关联卡片后提问' } });
    fireEvent.click(screen.getByRole('button', { name: '发送' }));
    await act(async () => { await Promise.resolve(); });
    const messageCall = fetchMock.mock.calls.find(([path]) => String(path) === '/api/coach/messages');
    expect(JSON.parse(String(messageCall?.[1]?.body))).toMatchObject({ cardId: 'card-1' });
    fireEvent.click(screen.getByRole('button', { name: '移除关联卡片' }));
    expect(screen.queryByText('已关联：削弱题中要优先识别论点与论据。')).not.toBeInTheDocument();
  });

  it('CSS 约束双列、窄屏单列、无横向溢出与辅助功能降级', async () => {
    const css = await readFile(resolve(process.cwd(), 'src/styles/coach.css'), 'utf8');

    expect(css).toMatch(/grid-template-columns:\s*minmax\(0,\s*1\.8fr\)\s+minmax\(18rem,\s*1fr\)/);
    expect(css).toMatch(/@media\s*\(max-width:\s*900px\)/);
    expect(css).toMatch(/grid-template-columns:\s*minmax\(0,\s*1fr\)/);
    expect(css).toMatch(/overflow-x:\s*hidden/);
    expect(css).toMatch(/overflow-wrap:\s*anywhere/);
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
    expect(css).toContain('@media (prefers-reduced-transparency: reduce)');
    expect(css).not.toMatch(/border-radius:\s*(?:[1-9]\d+|9)px/);
  });
});
