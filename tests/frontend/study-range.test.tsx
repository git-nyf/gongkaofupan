// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import type { StudySessionResult } from '../../shared/contracts';
import { StudyPage } from '../../src/pages/StudyPage';

const session: StudySessionResult = {
  totalAvailable: 8,
  items: [
    {
      quizItemId: 'range-quiz',
      cardId: 'range-card',
      question: '范围筛选题目',
      answer: '范围筛选答案',
      rawInput: '范围筛选原始输入',
      normalizedStatement: '范围筛选知识点',
      analysis: '',
      mnemonic: '',
      extension: '',
      notes: '',
      wrongCount: 0,
      archived: false,
      categories: [{ id: '资料分析', name: '资料分析', parentId: null }],
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

function renderStudyPage() {
  return render(
    <BrowserRouter>
      <StudyPage />
    </BrowserRouter>,
  );
}

function mockSessionRequests() {
  const bodies: Array<Record<string, unknown>> = [];
  vi.mocked(fetch).mockImplementation(async (input, init) => {
    if (String(input) !== '/api/study/sessions') {
      throw new Error(`unexpected request: ${String(input)}`);
    }
    bodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
    return jsonResponse(session);
  });
  return bodies;
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

describe('背诵范围选择', () => {
  it('按一级板块和录入日期开始背诵，并同步请求参数与地址栏', async () => {
    const bodies = mockSessionRequests();
    const user = userEvent.setup();
    renderStudyPage();

    await screen.findByRole('heading', { name: '开始本轮背诵' });
    const rootCategory = screen.getByRole('checkbox', { name: '资料分析' });
    const childCategory = screen.getByRole('checkbox', { name: '基础公式' });
    expect(rootCategory).not.toBeChecked();
    expect(childCategory).not.toBeChecked();
    expect(screen.getByLabelText('开始日期')).toHaveValue('');
    expect(screen.getByLabelText('结束日期')).toHaveValue('');

    await user.click(rootCategory);
    await user.type(screen.getByLabelText('开始日期'), '2026-07-01');
    await user.type(screen.getByLabelText('结束日期'), '2026-07-20');
    await user.click(screen.getByRole('button', { name: '开始背诵' }));

    await waitFor(() => expect(bodies).toHaveLength(5));
    expect(bodies[4]).toEqual({
      categoryIds: ['资料分析'],
      cardIds: [],
      tagIds: [],
      createdFrom: '2026-07-01',
      createdTo: '2026-07-20',
      count: 2,
      order: 'random',
      dueFirst: false,
    });
    const params = new URLSearchParams(window.location.search);
    expect(params.getAll('categoryIds')).toEqual(['资料分析']);
    expect(params.get('createdFrom')).toBe('2026-07-01');
    expect(params.get('createdTo')).toBe('2026-07-20');
  });

  it('从一级板块改选子板块时移除所属一级板块', async () => {
    const bodies = mockSessionRequests();
    const user = userEvent.setup();
    renderStudyPage();

    await screen.findByRole('heading', { name: '开始本轮背诵' });
    const rootCategory = screen.getByRole('checkbox', { name: '资料分析' });
    const childCategory = screen.getByRole('checkbox', { name: '基础公式' });
    await user.click(rootCategory);
    expect(rootCategory).toBeChecked();

    await user.click(childCategory);
    expect(rootCategory).not.toBeChecked();
    expect(childCategory).toBeChecked();
    await user.click(screen.getByRole('button', { name: '开始背诵' }));

    await waitFor(() => expect(bodies).toHaveLength(4));
    expect(bodies[2]).toMatchObject({
      categoryIds: ['资料分析/基础公式'],
      count: 1,
      order: 'fixed',
    });
    expect(bodies[3]).toMatchObject({ categoryIds: ['资料分析/基础公式'] });
    expect(bodies[3].categoryIds).not.toContain('资料分析');
    expect(new URLSearchParams(window.location.search).getAll('categoryIds')).toEqual([
      '资料分析/基础公式',
    ]);
  });

  it('开始日期晚于结束日期时提示并阻止创建新会话', async () => {
    const bodies = mockSessionRequests();
    const user = userEvent.setup();
    renderStudyPage();

    await screen.findByRole('heading', { name: '开始本轮背诵' });
    await user.type(screen.getByLabelText('开始日期'), '2026-07-21');
    await user.type(screen.getByLabelText('结束日期'), '2026-07-20');

    expect(screen.getByText('开始日期不能晚于结束日期')).toBeInTheDocument();
    const startButton = screen.getByRole('button', { name: '开始背诵' });
    expect(startButton).toBeDisabled();
    fireEvent.click(startButton);
    expect(bodies).toHaveLength(2);
  });

  it('未设置时间范围时创建的新会话不发送日期字段', async () => {
    const bodies = mockSessionRequests();
    const user = userEvent.setup();
    renderStudyPage();

    await screen.findByRole('heading', { name: '开始本轮背诵' });
    const countInput = screen.getByLabelText('手动数量');
    await user.clear(countInput);
    await user.type(countInput, '3');
    await user.click(screen.getByRole('button', { name: '开始背诵' }));

    await waitFor(() => expect(bodies).toHaveLength(2));
    expect(bodies[1]).toEqual({
      categoryIds: [],
      cardIds: [],
      tagIds: [],
      count: 3,
      order: 'random',
      dueFirst: false,
    });
    expect(bodies[1]).not.toHaveProperty('createdFrom');
    expect(bodies[1]).not.toHaveProperty('createdTo');
  });
});
