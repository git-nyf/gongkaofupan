// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import type { StudySessionResult } from '../../shared/contracts';
import { StudyPage } from '../../src/pages/StudyPage';

const session: StudySessionResult = {
  totalAvailable: 8,
  items: [
    {
      quizItemId: 'quiz-forward',
      cardId: 'card-1',
      question: '广陵对应哪里？',
      answer: '扬州',
      rawInput: '完整原始输入：广陵对应扬州。\n第二行保留。',
      normalizedStatement: '广陵与扬州为对应关系',
      analysis: '广陵对应扬州',
      mnemonic: '广陵扬州',
      extension: '',
      notes: '',
      wrongCount: 2,
      archived: false,
      categories: [{ id: '常识判断', name: '常识判断', parentId: null }],
      tags: [],
    },
    {
      quizItemId: 'quiz-reverse',
      cardId: 'card-1',
      question: '扬州古称什么？',
      answer: '广陵',
      rawInput: '完整原始输入：扬州古称广陵。',
      normalizedStatement: '广陵与扬州为对应关系',
      analysis: '广陵对应扬州',
      mnemonic: '',
      extension: '',
      notes: '',
      wrongCount: 2,
      archived: false,
      categories: [{ id: '常识判断', name: '常识判断', parentId: null }],
      tags: [],
    },
  ],
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function isRandomOriginalCountRequest(input: Parameters<typeof fetch>[0]) {
  return String(input).startsWith('/api/cards/random-original/count');
}

function countRequests(path: string) {
  return vi.mocked(fetch).mock.calls.filter(([input]) => String(input) === path).length;
}

function renderStudyPage() {
  return render(
    <BrowserRouter>
      <StudyPage />
    </BrowserRouter>,
  );
}

beforeEach(() => {
  window.localStorage.clear();
  delete document.documentElement.dataset.motion;
  window.history.pushState({}, '', '/study?count=2&order=random');
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('不会标注背诵页', () => {
  it('专属样式以页面作用域覆盖后载全局样式并保留摇杆 3D 变换', () => {
    const css = readFileSync('src/styles/study-glass.css', 'utf8');

    expect(css).toMatch(/\.study-page \.study-card__question p\s*{[^}]*font-size:\s*1\.5rem;/s);
    expect(css).toMatch(/\.study-page \.study-card\s*{[^}]*background:\s*rgba\(255, 255, 255,/s);
    expect(css).toMatch(/\.study-page \.study-joystick\s*{[^}]*perspective:\s*420px;/s);
    expect(css).toMatch(/\.study-page \.study-joystick::before\s*{[^}]*translate3d\(/s);
    expect(css).toMatch(
      /@media \(prefers-contrast: more\)[\s\S]*\.study-page \.study-cover,[\s\S]*border-color:\s*var\(--glass-edge-contrast\);/,
    );
  });

  it('先显示封面和精简抽题入口，手动开始后才显示题目', async () => {
    vi.mocked(fetch).mockImplementation(async (input) => {
      if (isRandomOriginalCountRequest(input)) return jsonResponse({ totalAvailable: 8 });
      if (String(input) === '/api/study/sessions') return jsonResponse(session);
      throw new Error(`unexpected request: ${String(input)}`);
    });
    const user = userEvent.setup();
    renderStudyPage();

    expect(await screen.findByRole('heading', { name: '开始本轮背诵' })).toBeInTheDocument();
    expect(document.querySelector('.study-cover')).toHaveClass('liquid-glass', 'liquid-glass--thick');
    expect(document.querySelector('.study-cover__book img')).toHaveAttribute('src', '/diy/开国大典.jpg');
    expect(document.querySelector('.study-cover__book img')).toHaveClass('study-cover__image');
    expect(document.querySelector('.study-controls')).toHaveClass('liquid-glass', 'liquid-glass--thick');
    expect(screen.queryByText('广陵对应哪里？')).not.toBeInTheDocument();
    expect(screen.getByLabelText('手动数量')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '开始背诵' })).toHaveClass('liquid-pressable');
    expect(screen.getByRole('button', { name: '下拉摇杆随机抽取题数' })).not.toHaveClass('liquid-pressable');
    expect(screen.queryByLabelText('到期优先')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '固定' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '5' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '开始背诵' }));
    expect(await screen.findByText('广陵对应哪里？')).toBeInTheDocument();
    expect(document.querySelector('.study-card')).toHaveClass('liquid-glass', 'liquid-glass--regular');
    expect(document.querySelector('.study-card__question')).toHaveClass('liquid-glass__nested');
    expect(screen.queryByRole('heading', { name: '开始本轮背诵' })).not.toBeInTheDocument();
  });

  it('点击摇杆只更新抽中题数，主动开始后才按最终题数抽取', async () => {
    const bodies: unknown[] = [];
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      if (isRandomOriginalCountRequest(input)) return jsonResponse({ totalAvailable: 8 });
      if (String(input) === '/api/study/sessions') {
        bodies.push(JSON.parse(String(init?.body)));
        return jsonResponse({ items: [session.items[0]], totalAvailable: 8 });
      }
      throw new Error(`unexpected request: ${String(input)}`);
    });
    renderStudyPage();

    expect(await screen.findByRole('heading', { name: '开始本轮背诵' })).toBeInTheDocument();
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    vi.useFakeTimers();
    const joystick = screen.getByRole('button', { name: '下拉摇杆随机抽取题数' });
    fireEvent.click(joystick);
    expect(joystick).not.toBeDisabled();

    expect(countRequests('/api/study/sessions')).toBe(1);
    act(() => vi.advanceTimersByTime(58));
    expect(screen.getByRole('heading', { name: '开始本轮背诵' })).toBeInTheDocument();
    expect(joystick).toHaveAttribute('data-gesture-state', 'rolling');
    await act(async () => {
      vi.advanceTimersByTime(242);
      await Promise.resolve();
    });
    expect(screen.getByRole('heading', { name: '开始本轮背诵' })).toBeInTheDocument();
    expect(screen.getByText('已抽取 5 题')).toBeInTheDocument();
    expect(screen.getByLabelText('手动数量')).toHaveValue(5);
    expect(screen.queryByText('广陵对应哪里？')).not.toBeInTheDocument();
    expect(bodies).toHaveLength(1);
    expect(window.location.search).toContain('count=2');

    vi.useRealTimers();
    fireEvent.click(screen.getByRole('button', { name: '开始背诵' }));

    await waitFor(() => expect(countRequests('/api/study/sessions')).toBe(2));
    expect(await screen.findByText('广陵对应哪里？')).toBeInTheDocument();
    expect(bodies[1]).toEqual({
      categoryIds: [],
      cardIds: [],
      tagIds: [],
      count: 5,
      order: 'random',
      dueFirst: false,
    });
    expect(window.location.search).toContain('count=5');
    expect(window.location.search).not.toContain('order=');
    expect(window.location.search).not.toContain('dueFirst=');
  });

  it('手动输入本轮数量后按随机顺序且关闭到期优先抽取', async () => {
    const bodies: unknown[] = [];
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      if (isRandomOriginalCountRequest(input)) return jsonResponse({ totalAvailable: 8 });
      if (String(input) === '/api/study/sessions') {
        bodies.push(JSON.parse(String(init?.body)));
        return jsonResponse({ items: [session.items[0]], totalAvailable: 8 });
      }
      throw new Error(`unexpected request: ${String(input)}`);
    });
    const user = userEvent.setup();
    renderStudyPage();

    expect(await screen.findByRole('heading', { name: '开始本轮背诵' })).toBeInTheDocument();
    await user.clear(screen.getByLabelText('手动数量'));
    await user.type(screen.getByLabelText('手动数量'), '5');
    await user.click(screen.getByRole('button', { name: '开始背诵' }));

    await waitFor(() => expect(countRequests('/api/study/sessions')).toBe(2));
    expect(await screen.findByText('广陵对应哪里？')).toBeInTheDocument();
    expect(bodies).toEqual([
      {
        categoryIds: [],
        cardIds: [],
        tagIds: [],
        count: 2,
        order: 'random',
        dueFirst: false,
      },
      {
        categoryIds: [],
        cardIds: [],
        tagIds: [],
        count: 5,
        order: 'random',
        dueFirst: false,
      },
    ]);
    expect(window.location.search).toContain('count=5');
    expect(window.location.search).not.toContain('order=');
    expect(window.location.search).not.toContain('dueFirst=');
  });

  it('候选超过一百时以单轮上限抽取，减弱动效不执行快速滚动', async () => {
    window.localStorage.setItem(
      'gongkao-experience-v1',
      JSON.stringify({ version: 1, motionLevel: 'reduced' }),
    );
    const bodies: unknown[] = [];
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      if (isRandomOriginalCountRequest(input)) return jsonResponse({ totalAvailable: 150 });
      if (String(input) === '/api/study/sessions') {
        bodies.push(JSON.parse(String(init?.body)));
        return jsonResponse({ items: [session.items[0]], totalAvailable: 150 });
      }
      throw new Error(`unexpected request: ${String(input)}`);
    });
    const intervalSpy = vi.spyOn(window, 'setInterval');
    vi.spyOn(Math, 'random').mockReturnValue(0.9999);
    renderStudyPage();

    expect(await screen.findByRole('heading', { name: '开始本轮背诵' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '下拉摇杆随机抽取题数' }));

    expect(countRequests('/api/study/sessions')).toBe(1);
    expect(screen.getByRole('heading', { name: '开始本轮背诵' })).toBeInTheDocument();
    expect(screen.getByText('已抽取 100 题')).toBeInTheDocument();
    expect(screen.queryByText('广陵对应哪里？')).not.toBeInTheDocument();
    expect(intervalSpy.mock.calls.some(([, delay]) => delay === 58)).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: '开始背诵' }));

    await waitFor(() => expect(countRequests('/api/study/sessions')).toBe(2));
    expect(bodies[1]).toMatchObject({ count: 100, order: 'random', dueFirst: false });
    expect(await screen.findByText('广陵对应哪里？')).toBeInTheDocument();
  });

  it('点击不会后揭示答案、更新次数并停留当前题，再手动进入下一张共享次数', async () => {
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      if (isRandomOriginalCountRequest(input)) return jsonResponse({ totalAvailable: 8 });
      if (String(input) === '/api/study/sessions') {
        expect(JSON.parse(String(init?.body))).toEqual({
          categoryIds: [],
          cardIds: [],
          tagIds: [],
          count: 2,
          order: 'random',
          dueFirst: false,
        });
        return jsonResponse(session);
      }
      if (String(input) === '/api/reviews') {
        expect(JSON.parse(String(init?.body))).toEqual({
          quizItemId: 'quiz-forward',
          result: 'unknown',
        });
        return jsonResponse({
          quizItemId: 'quiz-forward',
          cardId: 'card-1',
          result: 'unknown',
          nextDueAt: '2026-07-18T00:00:00.000Z',
          wrongCount: 3,
        });
      }
      throw new Error(`unexpected request: ${String(input)}`);
    });
    const user = userEvent.setup();
    renderStudyPage();

    expect(await screen.findByRole('heading', { name: '开始本轮背诵' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '开始背诵' }));
    expect(await screen.findByText('广陵对应哪里？')).toBeInTheDocument();
    expect(screen.getByText('2 次')).toBeInTheDocument();
    expect(screen.queryByText('扬州')).not.toBeInTheDocument();
    expect(screen.queryByText('广陵与扬州为对应关系')).not.toBeInTheDocument();
    expect(screen.queryByText('广陵对应扬州')).not.toBeInTheDocument();
    expect(screen.queryByText('广陵扬州')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '不会 +1' }));

    expect(await screen.findByText('已标注不会，本卡共 3 次')).toBeInTheDocument();
    expect(screen.getByText('扬州')).toBeInTheDocument();
    expect(screen.getByText('广陵与扬州为对应关系')).toBeInTheDocument();
    expect(screen.getByText('广陵对应扬州')).toBeInTheDocument();
    expect(screen.getByText('广陵扬州')).toBeInTheDocument();
    expect(screen.getByText('第 1 / 2 张')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '不会 +1' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: '下一张' }));
    expect(screen.getByText('扬州古称什么？')).toBeInTheDocument();
    expect(screen.getByText('3 次')).toBeInTheDocument();
    await waitFor(() => expect(countRequests('/api/reviews')).toBe(1));
    expect(countRequests('/api/study/sessions')).toBe(1);
  });

  it('查看答案不会提交复习记录，记住了不增加次数并自动结束单题轮次', async () => {
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      if (isRandomOriginalCountRequest(input)) return jsonResponse({ totalAvailable: 8 });
      if (String(input) === '/api/study/sessions') {
        return jsonResponse({ items: [session.items[0]], totalAvailable: 8 });
      }
      if (String(input) === '/api/reviews') {
        expect(JSON.parse(String(init?.body))).toEqual({
          quizItemId: 'quiz-forward',
          result: 'known',
        });
        return jsonResponse({
          quizItemId: 'quiz-forward',
          cardId: 'card-1',
          result: 'known',
          nextDueAt: '2026-07-20T00:00:00.000Z',
          wrongCount: 2,
        });
      }
      throw new Error(`unexpected request: ${String(input)}`);
    });
    const user = userEvent.setup();
    renderStudyPage();

    await screen.findByRole('heading', { name: '开始本轮背诵' });
    await user.click(screen.getByRole('button', { name: '开始背诵' }));
    await screen.findByText('广陵对应哪里？');
    expect(screen.queryByText('广陵与扬州为对应关系')).not.toBeInTheDocument();
    expect(screen.queryByText('广陵对应扬州')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '查看答案' }));
    expect(document.querySelector('.study-card__answer')).toHaveClass('liquid-glass__nested');
    expect(countRequests('/api/study/sessions')).toBe(1);
    expect(countRequests('/api/reviews')).toBe(0);
    expect(screen.getByText('广陵与扬州为对应关系')).toBeInTheDocument();
    expect(screen.getByText('广陵对应扬州')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '记住了' }));

    expect(await screen.findByRole('heading', { name: '本轮完成' })).toBeInTheDocument();
    expect(document.querySelector('.study-summary')).toHaveClass('liquid-glass', 'liquid-glass--regular');
    expect(screen.getByText('本轮全部记住，状态很稳。')).toBeInTheDocument();
    expect(countRequests('/api/study/sessions')).toBe(1);
    expect(countRequests('/api/reviews')).toBe(1);
  });

  it('提交复习记录期间阻止重复触发，并在离开页面时中止未完成请求', async () => {
    let reviewSignal: AbortSignal | undefined;
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      if (isRandomOriginalCountRequest(input)) return jsonResponse({ totalAvailable: 8 });
      if (String(input) === '/api/study/sessions') return jsonResponse(session);
      if (String(input) === '/api/reviews') {
        reviewSignal = init?.signal ?? undefined;
        return new Promise<Response>((_, reject) => {
          reviewSignal?.addEventListener(
            'abort',
            () => reject(new DOMException('aborted', 'AbortError')),
            { once: true },
          );
        });
      }
      throw new Error(`unexpected request: ${String(input)}`);
    });
    const user = userEvent.setup();
    const view = renderStudyPage();

    await screen.findByRole('heading', { name: '开始本轮背诵' });
    await user.click(screen.getByRole('button', { name: '开始背诵' }));
    await screen.findByText('广陵对应哪里？');
    const unknownButton = screen.getByRole('button', { name: '不会 +1' });
    fireEvent.click(unknownButton);
    fireEvent.click(unknownButton);

    await waitFor(() => expect(countRequests('/api/reviews')).toBe(1));
    expect(countRequests('/api/study/sessions')).toBe(1);
    expect(unknownButton).toBeDisabled();
    expect(reviewSignal?.aborted).toBe(false);

    view.unmount();
    expect(reviewSignal?.aborted).toBe(true);
  });

  it('连续记住时显示轻量反馈，并在本轮结算展示最佳连续记录', async () => {
    const reviewBodies: unknown[] = [];
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      if (isRandomOriginalCountRequest(input)) return jsonResponse({ totalAvailable: 8 });
      if (String(input) === '/api/study/sessions') return jsonResponse(session);
      if (String(input) === '/api/reviews') {
        const body = JSON.parse(String(init?.body));
        reviewBodies.push(body);
        return jsonResponse({
          quizItemId: body.quizItemId,
          cardId: 'card-1',
          result: 'known',
          nextDueAt: '2026-07-20T00:00:00.000Z',
          wrongCount: 2,
        });
      }
      throw new Error(`unexpected request: ${String(input)}`);
    });
    const user = userEvent.setup();
    renderStudyPage();

    await screen.findByRole('heading', { name: '开始本轮背诵' });
    await user.click(screen.getByRole('button', { name: '开始背诵' }));
    await screen.findByText('广陵对应哪里？');
    await user.click(screen.getByRole('button', { name: '查看答案' }));
    await user.click(screen.getByRole('button', { name: '记住了' }));
    await screen.findByText('扬州古称什么？');
    await user.click(screen.getByRole('button', { name: '查看答案' }));
    await user.click(screen.getByRole('button', { name: '记住了' }));

    expect(await screen.findByRole('heading', { name: '本轮完成' })).toBeInTheDocument();

    expect(screen.getByRole('heading', { name: '本轮完成' })).toBeInTheDocument();
    expect(screen.getByText('最佳连续记住')).toBeInTheDocument();
    expect(screen.getByText('本轮全部记住，状态很稳。')).toBeInTheDocument();
    expect(reviewBodies).toEqual([
      { quizItemId: 'quiz-forward', result: 'known' },
      { quizItemId: 'quiz-reverse', result: 'known' },
    ]);
    expect(countRequests('/api/study/sessions')).toBe(1);
    expect(countRequests('/api/reviews')).toBe(2);
  });

  it('不会标注会中断当前连续记住，但保留本轮最佳记录', async () => {
    const threeItemSession: StudySessionResult = {
      totalAvailable: 8,
      items: [
        ...session.items,
        {
          ...session.items[0],
          quizItemId: 'quiz-third',
          cardId: 'card-2',
          question: '第三道题？',
          answer: '第三道答案',
        },
      ],
    };
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      if (isRandomOriginalCountRequest(input)) return jsonResponse({ totalAvailable: 8 });
      if (String(input) === '/api/study/sessions') return jsonResponse(threeItemSession);
      if (String(input) === '/api/reviews') {
        const body = JSON.parse(String(init?.body));
        const isUnknown = body.result === 'unknown';
        return jsonResponse({
          quizItemId: body.quizItemId,
          cardId: body.quizItemId === 'quiz-third' ? 'card-2' : 'card-1',
          result: body.result,
          nextDueAt: '2026-07-20T00:00:00.000Z',
          wrongCount: isUnknown ? 3 : 2,
        });
      }
      throw new Error(`unexpected request: ${String(input)}`);
    });
    const user = userEvent.setup();
    renderStudyPage();

    await screen.findByRole('heading', { name: '开始本轮背诵' });
    await user.click(screen.getByRole('button', { name: '开始背诵' }));
    await screen.findByText('广陵对应哪里？');
    for (let position = 0; position < 2; position += 1) {
      await user.click(screen.getByRole('button', { name: '查看答案' }));
      await user.click(screen.getByRole('button', { name: '记住了' }));
      if (position === 0) await screen.findByText('扬州古称什么？');
    }
    expect(await screen.findByText('连续记住 2 题')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '不会 +1' }));
    expect(await screen.findByText('已标注不会，本卡共 3 次')).toBeInTheDocument();
    expect(screen.queryByText('连续记住 2 题')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '结束本轮' }));

    expect(screen.getByText('最佳连续记住')).toBeInTheDocument();
    expect(screen.getByText('本轮记住的题目更多，继续保持。')).toBeInTheDocument();
  });
});
