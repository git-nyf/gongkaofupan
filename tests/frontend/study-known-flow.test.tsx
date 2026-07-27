// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReviewResult, StudySessionResult } from '../../shared/contracts';
import App from '../../src/App';

const items = [
  {
    quizItemId: 'known-one',
    cardId: 'known-card-one',
    question: '自动前进第一题',
    answer: '第一题答案',
    rawInput: '用户完整输入第一行\n用户完整输入第二行与分数 3/5',
    normalizedStatement: '第一题知识点',
    analysis: '第一题解析',
    mnemonic: '',
    extension: '',
    notes: '',
    wrongCount: 0,
    archived: false,
    categories: [],
    tags: [],
  },
  {
    quizItemId: 'known-two',
    cardId: 'known-card-two',
    question: '自动前进第二题',
    answer: '第二题答案',
    rawInput: '第二题完整原始输入',
    normalizedStatement: '第二题知识点',
    analysis: '第二题解析',
    mnemonic: '',
    extension: '',
    notes: '',
    wrongCount: 0,
    archived: false,
    categories: [],
    tags: [],
  },
] satisfies StudySessionResult['items'];

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function reviewResult(quizItemId: string, cardId: string): ReviewResult {
  return {
    quizItemId,
    cardId,
    result: 'known',
    nextDueAt: '2026-07-20T00:00:00.000Z',
    wrongCount: 0,
  };
}

beforeEach(() => {
  window.localStorage.clear();
  window.history.pushState({}, '', '/study?count=2&order=fixed');
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('记住后的自动前进与完整原文', () => {
  it('揭晓后显示完整原始输入，提交期间锁定导航，成功后自动进入下一张', async () => {
    let resolveReview!: (response: Response) => void;
    const pendingReview = new Promise<Response>((resolve) => {
      resolveReview = resolve;
    });
    vi.mocked(fetch).mockImplementation(async (input) => {
      if (String(input).startsWith('/api/cards/random-original/count')) {
        return jsonResponse({ totalAvailable: 2 });
      }
      if (String(input) === '/api/study/sessions') {
        return jsonResponse({ items, totalAvailable: 2 });
      }
      if (String(input) === '/api/reviews') return pendingReview;
      throw new Error(`unexpected request: ${String(input)}`);
    });
    const user = userEvent.setup();
    render(<App />);

    await screen.findByRole('heading', { name: '开始本轮背诵' });
    await user.click(screen.getByRole('button', { name: '开始背诵' }));
    expect(await screen.findByText('自动前进第一题')).toBeInTheDocument();
    expect(screen.queryByText(/用户完整输入第一行/)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '查看答案' }));
    expect(screen.getByText(/用户完整输入第一行/)).toHaveTextContent(
      '用户完整输入第一行 用户完整输入第二行与分数 3/5',
    );

    await user.click(screen.getByRole('button', { name: '记住了' }));
    expect(screen.getByRole('button', { name: '下一张' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '结束本轮' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: '按设置抽取' })).not.toBeInTheDocument();

    resolveReview(jsonResponse(reviewResult('known-one', 'known-card-one')));
    expect(await screen.findByText('自动前进第二题')).toBeInTheDocument();
    expect(screen.queryByText('第二题完整原始输入')).not.toBeInTheDocument();
    const studyRequests = vi
      .mocked(fetch)
      .mock.calls.map(([input]) => String(input))
      .filter((path) => path === '/api/study/sessions' || path === '/api/reviews');
    expect(studyRequests).toEqual(['/api/study/sessions', '/api/reviews']);
  });

  it('最后一张记住成功后直接进入本轮总结', async () => {
    vi.mocked(fetch).mockImplementation(async (input) => {
      if (String(input).startsWith('/api/cards/random-original/count')) {
        return jsonResponse({ totalAvailable: 1 });
      }
      if (String(input) === '/api/study/sessions') {
        return jsonResponse({ items: [items[0]], totalAvailable: 1 });
      }
      if (String(input) === '/api/reviews') {
        return jsonResponse(reviewResult('known-one', 'known-card-one'));
      }
      throw new Error(`unexpected request: ${String(input)}`);
    });
    const user = userEvent.setup();
    render(<App />);

    await screen.findByRole('heading', { name: '开始本轮背诵' });
    await user.click(screen.getByRole('button', { name: '开始背诵' }));
    await screen.findByText('自动前进第一题');
    await user.click(screen.getByRole('button', { name: '查看答案' }));
    await user.click(screen.getByRole('button', { name: '记住了' }));

    expect(await screen.findByRole('heading', { name: '本轮完成' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('记住了').nextElementSibling).toHaveTextContent('1'));
    await user.click(screen.getByRole('button', { name: '下一页' }));
    expect(await screen.findByRole('heading', { name: '开始本轮背诵' })).toBeInTheDocument();
    expect(screen.queryByText('自动前进第一题')).not.toBeInTheDocument();
  });
});
