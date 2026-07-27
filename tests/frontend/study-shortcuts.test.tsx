// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { StudySessionResult } from '../../shared/contracts';
import App from '../../src/App';

const session: StudySessionResult = {
  totalAvailable: 2,
  items: [
    {
      quizItemId: 'shortcut-one',
      cardId: 'shortcut-card-one',
      question: '快捷键第一题',
      answer: '第一题答案',
      rawInput: '快捷键第一题原始输入',
      normalizedStatement: '第一题知识点',
      analysis: '',
      mnemonic: '',
      extension: '',
      notes: '',
      wrongCount: 0,
      archived: false,
      categories: [],
      tags: [],
    },
    {
      quizItemId: 'shortcut-two',
      cardId: 'shortcut-card-two',
      question: '快捷键第二题',
      answer: '第二题答案',
      normalizedStatement: '第二题知识点',
      rawInput: '快捷键第二题原始输入',
      analysis: '',
      mnemonic: '',
      extension: '',
      notes: '',
      wrongCount: 0,
      archived: false,
      categories: [],
      tags: [],
    },
  ],
};

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function reviewResponse(quizItemId: string, cardId: string, result: 'known' | 'unknown') {
  return jsonResponse({
    quizItemId,
    cardId,
    result,
    nextDueAt: '2026-07-21T00:00:00.000Z',
    wrongCount: result === 'unknown' ? 1 : 0,
  });
}

function reviewRequestCount() {
  return vi.mocked(fetch).mock.calls.filter(([input]) => String(input) === '/api/reviews').length;
}

beforeEach(() => {
  window.localStorage.clear();
  window.history.pushState({}, '', '/study?count=2&order=fixed');
  vi.stubGlobal('fetch', vi.fn(async (input) => {
    if (String(input) === '/api/study/sessions') {
      return new Response(JSON.stringify(session), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (String(input).startsWith('/api/cards/random-original/count')) {
      return jsonResponse({ count: 2 });
    }
    throw new Error(`unexpected request: ${String(input)}`);
  }));
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('背诵键盘快捷操作', () => {
  it('空格查看答案，左右方向键切换题目并收起答案', async () => {
    render(<App />);
    await screen.findByRole('heading', { name: '开始本轮背诵' });
    fireEvent.click(screen.getByRole('button', { name: '开始背诵' }));
    expect(await screen.findByText('快捷键第一题')).toBeInTheDocument();

    fireEvent.keyDown(window, { code: 'Space', key: ' ' });
    expect(screen.getByText('第一题答案')).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(screen.getByText('快捷键第二题')).toBeInTheDocument();
    expect(screen.queryByText('第一题答案')).not.toBeInTheDocument();
    expect(screen.queryByText('第二题答案')).not.toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(screen.getByText('快捷键第一题')).toBeInTheDocument();
    expect(screen.queryByText('第一题答案')).not.toBeInTheDocument();
  });

  it('输入控件、组合键和长按重复事件不触发页面快捷操作', async () => {
    render(<App />);
    await screen.findByRole('heading', { name: '开始本轮背诵' });
    const countInput = screen.getByLabelText('手动数量');
    countInput.focus();

    fireEvent.keyDown(countInput, { code: 'Space', key: ' ' });
    fireEvent.keyDown(countInput, { key: 'ArrowRight' });
    expect(screen.getByRole('heading', { name: '开始本轮背诵' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '开始背诵' }));
    expect(await screen.findByText('快捷键第一题')).toBeInTheDocument();
    const endButton = screen.getByRole('button', { name: '结束本轮' });
    endButton.focus();
    fireEvent.keyDown(endButton, { code: 'Space', key: ' ' });
    fireEvent.keyDown(endButton, { key: 'ArrowRight' });
    expect(screen.queryByText('第一题答案')).not.toBeInTheDocument();
    expect(screen.getByText('快捷键第一题')).toBeInTheDocument();

    endButton.blur();
    fireEvent.keyDown(window, { ctrlKey: true, key: 'ArrowRight' });
    fireEvent.keyDown(window, { key: 'ArrowRight', repeat: true });
    expect(screen.getByText('快捷键第一题')).toBeInTheDocument();
  });

  it('Y 直接提交记住了并自动进入下一张', async () => {
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      if (String(input) === '/api/study/sessions') return jsonResponse(session);
      if (String(input).startsWith('/api/cards/random-original/count')) return jsonResponse({ count: 2 });
      if (String(input) === '/api/reviews') {
        const body = JSON.parse(String(init?.body));
        return reviewResponse(body.quizItemId, 'shortcut-card-one', body.result);
      }
      throw new Error(`unexpected request: ${String(input)}`);
    });
    render(<App />);

    await screen.findByRole('heading', { name: '开始本轮背诵' });
    fireEvent.click(screen.getByRole('button', { name: '开始背诵' }));
    expect(await screen.findByText('快捷键第一题')).toBeInTheDocument();

    const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Y' });
    fireEvent(window, event);

    expect(event.defaultPrevented).toBe(true);
    expect(await screen.findByText('快捷键第二题')).toBeInTheDocument();
    const reviewCall = vi.mocked(fetch).mock.calls.find(([input]) => String(input) === '/api/reviews');
    expect(JSON.parse(String(reviewCall?.[1]?.body))).toEqual({
      quizItemId: 'shortcut-one',
      result: 'known',
    });
  });

  it('n 直接提交不会、显示答案并停留当前题', async () => {
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      if (String(input) === '/api/study/sessions') return jsonResponse(session);
      if (String(input).startsWith('/api/cards/random-original/count')) return jsonResponse({ count: 2 });
      if (String(input) === '/api/reviews') {
        const body = JSON.parse(String(init?.body));
        return reviewResponse(body.quizItemId, 'shortcut-card-one', body.result);
      }
      throw new Error(`unexpected request: ${String(input)}`);
    });
    render(<App />);

    await screen.findByRole('heading', { name: '开始本轮背诵' });
    fireEvent.click(screen.getByRole('button', { name: '开始背诵' }));
    expect(await screen.findByText('快捷键第一题')).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'n' });

    expect(await screen.findByText('第一题答案')).toBeInTheDocument();
    expect(screen.getByText('快捷键第一题')).toBeInTheDocument();
    expect(screen.queryByText('快捷键第二题')).not.toBeInTheDocument();
    const reviewCall = vi.mocked(fetch).mock.calls.find(([input]) => String(input) === '/api/reviews');
    expect(JSON.parse(String(reviewCall?.[1]?.body))).toEqual({
      quizItemId: 'shortcut-one',
      result: 'unknown',
    });
  });

  it('保护封面、可编辑区、已处理事件、输入法、重复和组合键', async () => {
    render(<App />);
    await screen.findByRole('heading', { name: '开始本轮背诵' });

    fireEvent.keyDown(window, { key: 'y' });
    expect(reviewRequestCount()).toBe(0);

    fireEvent.click(screen.getByRole('button', { name: '开始背诵' }));
    expect(await screen.findByText('快捷键第一题')).toBeInTheDocument();
    const editable = document.createElement('textarea');
    document.body.append(editable);
    fireEvent.keyDown(editable, { key: 'y' });
    editable.remove();

    const prevented = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'y' });
    prevented.preventDefault();
    fireEvent(window, prevented);
    fireEvent.keyDown(window, { isComposing: true, key: 'y' });
    fireEvent.keyDown(window, { key: 'y', repeat: true });
    fireEvent.keyDown(window, { ctrlKey: true, key: 'y' });
    fireEvent.keyDown(window, { metaKey: true, key: 'y' });
    fireEvent.keyDown(window, { altKey: true, key: 'y' });
    fireEvent.keyDown(window, { key: 'Y', shiftKey: true });

    expect(reviewRequestCount()).toBe(0);
    expect(screen.getByText('快捷键第一题')).toBeInTheDocument();
  });

  it('提交中与当前题已记录后不重复请求', async () => {
    let resolveReview!: (response: Response) => void;
    const pendingReview = new Promise<Response>((resolve) => {
      resolveReview = resolve;
    });
    vi.mocked(fetch).mockImplementation(async (input) => {
      if (String(input) === '/api/study/sessions') return jsonResponse(session);
      if (String(input).startsWith('/api/cards/random-original/count')) return jsonResponse({ count: 2 });
      if (String(input) === '/api/reviews') return pendingReview;
      throw new Error(`unexpected request: ${String(input)}`);
    });
    render(<App />);

    await screen.findByRole('heading', { name: '开始本轮背诵' });
    fireEvent.click(screen.getByRole('button', { name: '开始背诵' }));
    expect(await screen.findByText('快捷键第一题')).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'n' });
    fireEvent.keyDown(window, { key: 'n' });
    fireEvent.keyDown(window, { key: 'y' });
    expect(reviewRequestCount()).toBe(1);

    resolveReview(reviewResponse('shortcut-one', 'shortcut-card-one', 'unknown'));
    expect(await screen.findByText('第一题答案')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'y' });
    fireEvent.keyDown(window, { key: 'n' });
    await waitFor(() => expect(reviewRequestCount()).toBe(1));
  });
});
