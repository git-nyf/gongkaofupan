// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import type { StudySessionResult } from '../../shared/contracts';
import { StudyPage } from '../../src/pages/StudyPage';

const studyItem: StudySessionResult['items'][number] = {
  quizItemId: 'range-preview-quiz',
  cardId: 'range-preview-card',
  question: '范围预览不应提前展示的题目',
  answer: '范围预览答案',
  rawInput: '范围预览原始输入',
  normalizedStatement: '范围预览知识点',
  analysis: '',
  mnemonic: '',
  extension: '',
  notes: '',
  wrongCount: 0,
  archived: false,
  categories: [{ id: '资料分析', name: '资料分析', parentId: null }],
  tags: [],
};

function sessionResult(totalAvailable: number, question = studyItem.question): StudySessionResult {
  return {
    totalAvailable,
    items: totalAvailable === 0 ? [] : [{ ...studyItem, question }],
  };
}

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function requestBody(init?: RequestInit) {
  return JSON.parse(String(init?.body)) as Record<string, unknown>;
}

function renderStudyPage() {
  return render(
    <BrowserRouter>
      <StudyPage />
    </BrowserRouter>,
  );
}

function expectCoverTotal(total: number) {
  expect(screen.getByRole('heading', { name: '背诵' }).closest('header')).toHaveTextContent(`可用 ${total} 张`);
  expect(screen.getByText('可用题面').nextElementSibling).toHaveTextContent(String(total));
}

beforeEach(() => {
  window.localStorage.clear();
  window.history.pushState({}, '', '/study?count=2');
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('背诵范围即时预览', () => {
  it('勾选板块后立即刷新题面总数，但保持封面且不提前修改地址栏', async () => {
    window.history.pushState({}, '', '/study?count=2&cardIds=card-a&tagIds=tag-a');
    const bodies: Array<Record<string, unknown>> = [];
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      if (String(input) !== '/api/study/sessions') throw new Error(`未模拟的请求：${String(input)}`);
      const body = requestBody(init);
      bodies.push(body);
      return jsonResponse(body.order === 'fixed' ? sessionResult(3) : sessionResult(8));
    });
    const user = userEvent.setup();
    renderStudyPage();

    await screen.findByRole('heading', { name: '开始本轮背诵' });
    await user.click(screen.getByRole('checkbox', { name: '资料分析' }));

    await waitFor(() => expect(bodies).toHaveLength(2));
    expect(bodies[1]).toEqual({
      categoryIds: ['资料分析'],
      cardIds: ['card-a'],
      tagIds: ['tag-a'],
      count: 1,
      order: 'fixed',
      dueFirst: false,
    });
    expectCoverTotal(3);
    expect(screen.getByRole('heading', { name: '开始本轮背诵' })).toBeInTheDocument();
    expect(screen.queryByText(studyItem.question)).not.toBeInTheDocument();
    expect(new URLSearchParams(window.location.search).getAll('categoryIds')).toEqual([]);
  });

  it('开始和结束日期每次有效变化都立即刷新最新题面总数', async () => {
    const bodies: Array<Record<string, unknown>> = [];
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      if (String(input) !== '/api/study/sessions') throw new Error(`未模拟的请求：${String(input)}`);
      const body = requestBody(init);
      bodies.push(body);
      if (body.createdTo) return jsonResponse(sessionResult(2));
      if (body.createdFrom) return jsonResponse(sessionResult(5));
      return jsonResponse(sessionResult(8));
    });
    renderStudyPage();

    await screen.findByRole('heading', { name: '开始本轮背诵' });
    fireEvent.change(screen.getByLabelText('开始日期'), { target: { value: '2026-07-01' } });
    await waitFor(() => expect(bodies).toHaveLength(2));
    expect(bodies[1]).toMatchObject({
      createdFrom: '2026-07-01',
      count: 1,
      order: 'fixed',
      dueFirst: false,
    });
    expect(bodies[1]).not.toHaveProperty('createdTo');
    expectCoverTotal(5);

    fireEvent.change(screen.getByLabelText('结束日期'), { target: { value: '2026-07-20' } });
    await waitFor(() => expect(bodies).toHaveLength(3));
    expect(bodies[2]).toMatchObject({
      createdFrom: '2026-07-01',
      createdTo: '2026-07-20',
      count: 1,
      order: 'fixed',
      dueFirst: false,
    });
    expectCoverTotal(2);
    expect(screen.getByRole('heading', { name: '开始本轮背诵' })).toBeInTheDocument();
  });

  it('快速改选父子板块时只采用最后一次预览结果', async () => {
    const bodies: Array<Record<string, unknown>> = [];
    const pending: Array<{ resolve: (response: Response) => void }> = [];
    vi.mocked(fetch).mockImplementation((input, init) => {
      if (String(input) !== '/api/study/sessions') throw new Error(`未模拟的请求：${String(input)}`);
      const body = requestBody(init);
      bodies.push(body);
      if (bodies.length === 1) return Promise.resolve(jsonResponse(sessionResult(8)));
      return new Promise<Response>((resolve) => pending.push({ resolve }));
    });
    const user = userEvent.setup();
    renderStudyPage();

    await screen.findByRole('heading', { name: '开始本轮背诵' });
    await user.click(screen.getByRole('checkbox', { name: '资料分析' }));
    await waitFor(() => expect(pending).toHaveLength(1));
    await user.click(screen.getByRole('checkbox', { name: '基础公式' }));
    await waitFor(() => expect(pending).toHaveLength(2));
    expect(bodies[1]).toMatchObject({ categoryIds: ['资料分析'], order: 'fixed' });
    expect(bodies[2]).toMatchObject({ categoryIds: ['资料分析/基础公式'], order: 'fixed' });

    await act(async () => pending[1].resolve(jsonResponse(sessionResult(2))));
    await waitFor(() => expectCoverTotal(2));
    await act(async () => pending[0].resolve(jsonResponse(sessionResult(7))));
    await act(async () => Promise.resolve());
    expectCoverTotal(2);
  });

  it('日期范围非法时不发起新的预览并禁用开始', async () => {
    const bodies: Array<Record<string, unknown>> = [];
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      if (String(input) !== '/api/study/sessions') throw new Error(`未模拟的请求：${String(input)}`);
      bodies.push(requestBody(init));
      return jsonResponse(sessionResult(8));
    });
    renderStudyPage();

    await screen.findByRole('heading', { name: '开始本轮背诵' });
    fireEvent.change(screen.getByLabelText('开始日期'), { target: { value: '2026-07-21' } });
    await waitFor(() => expect(bodies).toHaveLength(2));
    fireEvent.change(screen.getByLabelText('结束日期'), { target: { value: '2026-07-20' } });

    expect(screen.getByText('开始日期不能晚于结束日期')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '开始背诵' })).toBeDisabled();
    await act(async () => Promise.resolve());
    expect(bodies).toHaveLength(2);
  });

  it('预览结果为零时显示零题并保持封面，且不能开始背诵', async () => {
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      if (String(input) !== '/api/study/sessions') throw new Error(`未模拟的请求：${String(input)}`);
      const body = requestBody(init);
      return jsonResponse(body.order === 'fixed' ? sessionResult(0) : sessionResult(8));
    });
    const user = userEvent.setup();
    renderStudyPage();

    await screen.findByRole('heading', { name: '开始本轮背诵' });
    await user.click(screen.getByRole('checkbox', { name: '资料分析' }));

    await waitFor(() => expectCoverTotal(0));
    expect(screen.getByRole('heading', { name: '开始本轮背诵' })).toBeInTheDocument();
    expect(screen.queryByText(studyItem.question)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '开始背诵' })).toBeDisabled();
    expect(new URLSearchParams(window.location.search).getAll('categoryIds')).toEqual([]);
  });

  it('点击开始后才写入筛选地址并创建正式随机会话', async () => {
    const bodies: Array<Record<string, unknown>> = [];
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      if (String(input) !== '/api/study/sessions') throw new Error(`未模拟的请求：${String(input)}`);
      const body = requestBody(init);
      bodies.push(body);
      if (body.order === 'fixed') return jsonResponse(sessionResult(3));
      if (Array.isArray(body.categoryIds) && body.categoryIds.includes('资料分析')) {
        return jsonResponse(sessionResult(3, '正式范围题目'));
      }
      return jsonResponse(sessionResult(8));
    });
    const user = userEvent.setup();
    renderStudyPage();

    await screen.findByRole('heading', { name: '开始本轮背诵' });
    await user.click(screen.getByRole('checkbox', { name: '资料分析' }));
    await waitFor(() => expect(bodies).toHaveLength(2));
    expect(new URLSearchParams(window.location.search).getAll('categoryIds')).toEqual([]);

    await user.click(screen.getByRole('button', { name: '开始背诵' }));

    await waitFor(() => expect(bodies).toHaveLength(3));
    expect(bodies[2]).toEqual({
      categoryIds: ['资料分析'],
      cardIds: [],
      tagIds: [],
      count: 2,
      order: 'random',
      dueFirst: false,
    });
    expect(new URLSearchParams(window.location.search).getAll('categoryIds')).toEqual(['资料分析']);
    expect(await screen.findByText('正式范围题目')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '开始本轮背诵' })).not.toBeInTheDocument();
  });
});
