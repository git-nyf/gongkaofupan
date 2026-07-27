// @vitest-environment jsdom

import { readFileSync } from 'node:fs';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DashboardPage,
  dashboardCountdownStorageKey,
  dashboardMemoStorageKey,
} from '../../src/pages/DashboardPage';

const dashboardResponse = {
  dueToday: 6,
  addedToday: 2,
  conquestPending: 3,
  weakness: [],
};

const settingsResponse = {
  defaultSessionSize: 20,
  defaultOrder: 'random',
  dueFirst: true,
  defaultFocusMinutes: 25,
  qqMusicPath: '',
  qqMusicAvailable: false,
  deepseekConfigured: false,
};

const cardSearchResponse = {
  items: [
    {
      id: 'card-1',
      quizItems: [
        { id: 'quiz-1', question: '政府提升公共服务效能的关键是什么？' },
        { id: 'quiz-2', question: '  ' },
      ],
    },
    {
      id: 'card-2',
      quizItems: [
        { id: 'quiz-3', question: '政府提升公共服务效能的关键是什么？' },
        { id: 'quiz-4', question: '基层治理如何更好回应群众诉求？' },
      ],
    },
  ],
  total: 2,
  page: 1,
  pageSize: 100,
};

beforeEach(() => {
  window.localStorage.clear();
  vi.stubGlobal('fetch', createFetchMock());
});

afterEach(() => {
  cleanup();
  delete document.documentElement.dataset.motion;
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('学习驾驶舱', () => {
  it('玻璃表面和小控件只使用批准的圆角变量', () => {
    const css = readFileSync('src/styles/dashboard-glass.css', 'utf8');

    expect(css).toContain('border-radius: var(--glass-radius-surface);');
    expect(css).toContain('border-radius: var(--glass-radius-control);');
    expect(css).not.toMatch(/border-radius:\s*(?:6|8)px/);
    expect(css).toMatch(/\.dashboard-question-barrage\.is-motion-reduced\s*\{[^}]*overflow-y:\s*auto;/s);
    expect(css).toMatch(/\.dashboard-question-barrage\.is-motion-reduced\s*\{[^}]*mask-image:\s*none;/s);
    expect(css).toMatch(/\.dashboard-question-barrage\.is-motion-reduced[\s\S]*\.dashboard-question-barrage__item\s*\{[^}]*animation:\s*none;/s);
    expect(css).toMatch(/\.dashboard-page--liquid \.dashboard-question-barrage__item\s*\{[^}]*min-height:\s*46px;/s);
    expect(css).not.toContain('calc(-100vw - 100%)');
    expect(css).toMatch(/@keyframes dashboard-question-float\s*\{[\s\S]*translate3d\(-8px,\s*-2px,\s*0\)/s);
    expect(css).toMatch(/\.dashboard-page--liquid \.dashboard-memo__list label\.liquid-pressable\s*\{[^}]*min-height:\s*44px;/s);
  });

  it('为主要模块、日期格和操作控件应用分层液态玻璃反馈', async () => {
    render(<DashboardPage />, { wrapper: MemoryRouter });

    await screen.findByText('今日待复习');

    for (const selector of [
      '.focus-console',
      '.dashboard-status',
      '.dashboard-calendar',
      '.dashboard-date-countdown',
      '.dashboard-memo',
    ]) {
      expect(document.querySelector(selector)).toHaveClass(
        'liquid-glass',
        'liquid-glass--regular',
      );
    }

    expect(screen.getByRole('link', { name: '开始背诵' })).toHaveClass('liquid-pressable');
    for (const name of ['开始专注', '重置专注', '保存倒计时', '添加备忘']) {
      expect(screen.getByRole('button', { name })).toHaveClass(
        'liquid-glass',
        'liquid-glass--thin',
        'liquid-pressable',
      );
    }
    expect(screen.getByRole('button', { name: '25 分钟' })).toHaveClass(
      'liquid-glass',
      'liquid-glass--thin',
      'liquid-pressable',
    );
    expect(screen.getByRole('button', { name: '下一个月' })).toHaveClass(
      'liquid-glass',
      'liquid-glass--thin',
      'liquid-pressable',
    );
    expect(screen.getByLabelText('倒计时名称')).toHaveClass(
      'liquid-glass',
      'liquid-glass--thin',
    );
    expect(document.querySelector('.dashboard-calendar__table time')).toHaveClass(
      'liquid-glass',
      'liquid-glass--thin',
    );
    expect(document.querySelector('.dashboard-question-barrage__track')).not.toHaveClass('liquid-pressable');
  });

  it('展示为人民服务主题、AI 衍生问题和紧凑学习统计，并按当前默认设置进入背诵', async () => {
    render(<DashboardPage />, { wrapper: MemoryRouter });

    expect(await screen.findByText('今日待复习')).toBeInTheDocument();
    expect(screen.getByText('为人民服务')).toBeInTheDocument();
    const status = screen.getByRole('region', { name: 'AI 衍生问题' });
    expect(within(status).getByText('政府提升公共服务效能的关键是什么？')).toBeInTheDocument();
    expect(within(status).getByText('6')).toBeInTheDocument();
    expect(screen.getByText('已新增')).toBeInTheDocument();
    expect(within(status).getByText('2')).toBeInTheDocument();
    expect(screen.getByText('待攻克')).toBeInTheDocument();
    expect(within(status).getByText('3')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '开始背诵' })).toHaveAttribute(
      'href',
      '/study?count=20&order=random&dueFirst=true',
    );
  });

  it('卡片接口失败时展示 AI 问题空态且不影响学习数据', async () => {
    vi.stubGlobal('fetch', createFetchMock(settingsResponse, { cardsStatus: 503 }));
    render(<DashboardPage />, { wrapper: MemoryRouter });

    expect(await screen.findByText('暂无 AI 衍生问题，先去录入并完成 AI 优化吧。')).toBeInTheDocument();
    const status = screen.getByRole('region', { name: 'AI 衍生问题' });
    expect(within(status).getByText('6')).toBeInTheDocument();
    expect(screen.queryByText('学习概览加载失败，请刷新后重试')).not.toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith(
      '/api/cards?contentVersion=optimized&archived=false&page=1&pageSize=100',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it('从优化卡片中提取去重后的 AI 衍生问题并停止请求时政接口', async () => {
    render(<DashboardPage />, { wrapper: MemoryRouter });

    expect(await screen.findByText('今日待复习')).toBeInTheDocument();
    const status = screen.getByRole('region', { name: 'AI 衍生问题' });
    expect(within(status).getAllByText('政府提升公共服务效能的关键是什么？')).toHaveLength(1);
    expect(within(status).getByText('基层治理如何更好回应群众诉求？')).toBeInTheDocument();
    expect(within(status).getAllByRole('listitem')).toHaveLength(2);
    expect(fetch).toHaveBeenCalledWith(
      '/api/cards?contentVersion=optimized&archived=false&page=1&pageSize=100',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(fetch).not.toHaveBeenCalledWith(
      '/api/current-affairs',
      expect.anything(),
    );
  });

  it('没有 AI 衍生问题时展示明确空态并保留今日统计', async () => {
    vi.stubGlobal('fetch', createFetchMock(settingsResponse, { cards: { ...cardSearchResponse, items: [], total: 0 } }));
    render(<DashboardPage />, { wrapper: MemoryRouter });

    expect(await screen.findByText('暂无 AI 衍生问题，先去录入并完成 AI 优化吧。')).toBeInTheDocument();
    const status = screen.getByRole('region', { name: 'AI 衍生问题' });
    expect(within(status).getByText('今日待复习')).toBeInTheDocument();
    expect(within(status).getByText('6')).toBeInTheDocument();
  });

  it('减少动态效果时将 AI 问题改为可滚动的静态列表', async () => {
    document.documentElement.dataset.motion = 'reduced';
    render(<DashboardPage />, { wrapper: MemoryRouter });

    expect(await screen.findByText('今日待复习')).toBeInTheDocument();
    const barrage = screen.getByLabelText('AI 衍生问题随机弹幕');
    expect(barrage).toHaveClass('is-motion-reduced');
    expect(barrage).toHaveAttribute('tabindex', '0');
    expect(within(barrage).getAllByRole('listitem')).toHaveLength(2);
  });

  it('支持开始、暂停、继续、完成反馈和重置', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', createFetchMock({ ...settingsResponse, defaultFocusMinutes: 5 }));
    render(<DashboardPage />, { wrapper: MemoryRouter });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    const timer = screen.getByRole('timer');
    expect(timer).toHaveTextContent('05:00');
    expect(timer).toHaveAttribute('aria-live', 'off');
    expect(screen.getByText('学习倒计时')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '开始专注' }));
    act(() => vi.advanceTimersByTime(1_000));
    expect(screen.getByText('04:59')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '暂停专注' }));
    act(() => vi.advanceTimersByTime(2_000));
    expect(screen.getByText('04:59')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '继续专注' }));
    act(() => vi.advanceTimersByTime(299_000));
    expect(screen.getByRole('status')).toHaveTextContent('本轮专注完成');
    expect(screen.getByText('00:00')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '重置专注' }));
    expect(screen.getByText('05:00')).toBeInTheDocument();
    expect(screen.queryByText('本轮专注完成')).not.toBeInTheDocument();
  });

  it('离开总览后按真实经过时间继续专注倒计时', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 20, 12));
    vi.stubGlobal('fetch', createFetchMock({ ...settingsResponse, defaultFocusMinutes: 5 }));
    const first = render(<DashboardPage />, { wrapper: MemoryRouter });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    fireEvent.click(screen.getByRole('button', { name: '开始专注' }));
    first.unmount();

    vi.setSystemTime(new Date(2026, 6, 20, 12, 1, 1));
    render(<DashboardPage />, { wrapper: MemoryRouter });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByRole('timer')).toHaveTextContent('03:59');
    expect(screen.getByRole('button', { name: '暂停专注' })).toBeInTheDocument();
  });

  it('暂停后离开总览不会消耗剩余专注时间', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 20, 12));
    vi.stubGlobal('fetch', createFetchMock({ ...settingsResponse, defaultFocusMinutes: 5 }));
    const first = render(<DashboardPage />, { wrapper: MemoryRouter });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    fireEvent.click(screen.getByRole('button', { name: '开始专注' }));
    act(() => vi.advanceTimersByTime(1_000));
    fireEvent.click(screen.getByRole('button', { name: '暂停专注' }));
    first.unmount();

    vi.setSystemTime(new Date(2026, 6, 20, 12, 3, 1));
    render(<DashboardPage />, { wrapper: MemoryRouter });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByRole('timer')).toHaveTextContent('04:59');
    expect(screen.getByRole('button', { name: '继续专注' })).toBeInTheDocument();
  });

  it('离开总览期间到期后返回显示本轮完成', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 20, 12));
    vi.stubGlobal('fetch', createFetchMock({ ...settingsResponse, defaultFocusMinutes: 5 }));
    const first = render(<DashboardPage />, { wrapper: MemoryRouter });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    fireEvent.click(screen.getByRole('button', { name: '开始专注' }));
    first.unmount();

    vi.setSystemTime(new Date(2026, 6, 20, 12, 5, 1));
    render(<DashboardPage />, { wrapper: MemoryRouter });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByRole('timer')).toHaveTextContent('00:00');
    expect(screen.getByRole('status')).toHaveTextContent('本轮专注完成');
  });

  it('提供 5、15、25、45 分钟常用时长', async () => {
    render(<DashboardPage />, { wrapper: MemoryRouter });
    await screen.findByText('25:00');

    for (const minutes of [5, 15, 25, 45]) {
      expect(screen.getByRole('button', { name: `${minutes} 分钟` })).toBeInTheDocument();
    }
    expect(screen.getByRole('button', { name: '25 分钟' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '45 分钟' })).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(screen.getByRole('button', { name: '45 分钟' }));
    expect(screen.getByText('45:00')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '25 分钟' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: '45 分钟' })).toHaveAttribute('aria-pressed', 'true');
  });

  it.each(['html 设置', '系统偏好'] as const)(
    '%s要求减少动态效果时，AI 问题停止漂浮并可滚动完整查看',
    async (source) => {
      if (source === 'html 设置') {
        document.documentElement.dataset.motion = 'reduced';
      } else {
        vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: true }));
      }
      render(<DashboardPage />, { wrapper: MemoryRouter });

      await screen.findByText('今日待复习');

      const barrage = screen.getByLabelText('AI 衍生问题随机弹幕');
      expect(barrage).toHaveClass('is-motion-reduced');
      expect(barrage).toHaveAttribute('tabindex', '0');
      expect(within(barrage).getAllByRole('listitem')).toHaveLength(2);
    },
  );

  it('以周一为首日展示固定六周的翻页月历，可切换上下月并标记今天', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 19, 12));
    render(<DashboardPage />, { wrapper: MemoryRouter });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const month = screen.getByText('2026年7月');
    expect(month).toHaveAttribute('datetime', '2026-07');
    expect(screen.getByText('翻页月历')).toBeInTheDocument();

    const calendar = screen.getByRole('table', { name: '2026年7月月历' });
    expect(within(calendar).getAllByRole('columnheader').map(({ textContent }) => textContent)).toEqual([
      '周一',
      '周二',
      '周三',
      '周四',
      '周五',
      '周六',
      '周日',
    ]);
    expect(within(calendar).getAllByRole('cell')).toHaveLength(42);

    const dates = calendar.querySelectorAll('tbody time');
    expect(dates).toHaveLength(42);
    expect(dates[0]).toHaveAttribute('datetime', '2026-06-29');
    expect(dates[0].closest('td')).toHaveClass('is-outside-month');
    expect(dates[41]).toHaveAttribute('datetime', '2026-08-09');
    expect(dates[41].closest('td')).toHaveClass('is-outside-month');
    expect(calendar.querySelector('time[aria-current="date"]')).toHaveAttribute(
      'datetime',
      '2026-07-19',
    );

    fireEvent.click(screen.getByRole('button', { name: '下一个月' }));
    expect(screen.getByText('2026年8月')).toHaveAttribute('datetime', '2026-08');
    const august = screen.getByRole('table', { name: '2026年8月月历' });
    expect(within(august).getAllByRole('cell')).toHaveLength(42);
    expect(august.querySelector('tbody time')).toHaveAttribute('datetime', '2026-07-27');
    expect(august.closest('.dashboard-calendar__flip-stage')).toHaveClass('is-flipping-next');

    fireEvent.click(screen.getByRole('button', { name: '上一个月' }));
    expect(screen.getByText('2026年7月')).toHaveAttribute('datetime', '2026-07');
    expect(screen.getByRole('table', { name: '2026年7月月历' })
      .closest('.dashboard-calendar__flip-stage')).toHaveClass('is-flipping-previous');
  });

  it.each(['html 设置', '系统偏好'] as const)(
    '%s要求减少动态效果时，月历只更新内容而不执行3D翻页',
    async (source) => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 6, 19, 12));
      if (source === 'html 设置') {
        document.documentElement.dataset.motion = 'reduced';
      } else {
        vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: true }));
      }
      render(<DashboardPage />, { wrapper: MemoryRouter });

      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });

      fireEvent.click(screen.getByRole('button', { name: '下一个月' }));

      expect(screen.getByText('2026年8月')).toHaveAttribute('datetime', '2026-08');
      expect(screen.getByRole('table', { name: '2026年8月月历' })
        .closest('.dashboard-calendar__flip-stage')).not.toHaveClass('is-flipping-next');
    },
  );

  it('在本机新增、完成、恢复和删除轻量备忘', async () => {
    const first = render(<DashboardPage />, { wrapper: MemoryRouter });
    await screen.findByText('今日待复习');

    const input = screen.getByRole('textbox', { name: '新备忘' });
    fireEvent.change(input, { target: { value: '复习资料分析公式' } });
    fireEvent.click(screen.getByRole('button', { name: '添加备忘' }));
    expect(screen.getByText('复习资料分析公式')).toBeInTheDocument();

    const completionToggle = screen.getByRole('checkbox', { name: '完成复习资料分析公式' });
    expect(completionToggle.closest('label')).toHaveClass('liquid-pressable');
    fireEvent.click(completionToggle);
    expect(JSON.parse(window.localStorage.getItem(dashboardMemoStorageKey) ?? '{}')).toMatchObject({
      version: 1,
      items: [{ text: '复习资料分析公式', completed: true }],
    });

    first.unmount();
    render(<DashboardPage />, { wrapper: MemoryRouter });
    await screen.findByText('今日待复习');
    expect(screen.getByRole('checkbox', { name: '完成复习资料分析公式' })).toBeChecked();

    fireEvent.click(screen.getByRole('button', { name: '删除复习资料分析公式' }));
    expect(screen.queryByText('复习资料分析公式')).not.toBeInTheDocument();
  });
});

describe('目标日倒计时', () => {
  it('保存未来目标日并显示剩余天数', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 20, 12));
    render(<DashboardPage />, { wrapper: MemoryRouter });

    const countdown = await findCountdownSection();
    setCountdown(countdown, '国考', '2026-08-01');

    expect(within(countdown).getByText('距离 国考')).toBeInTheDocument();
    expect(within(countdown).getByText('还有 12 天')).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem(dashboardCountdownStorageKey) ?? '{}')).toEqual({
      version: 1,
      title: '国考',
      targetDate: '2026-08-01',
    });
  });

  it('重新挂载后恢复已保存的目标日', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 20, 12));
    const first = render(<DashboardPage />, { wrapper: MemoryRouter });

    setCountdown(await findCountdownSection(), '国考', '2026-08-01');
    first.unmount();

    render(<DashboardPage />, { wrapper: MemoryRouter });
    const restored = await findCountdownSection();
    expect(within(restored).getByLabelText('倒计时名称')).toHaveValue('国考');
    expect(within(restored).getByLabelText('目标日期')).toHaveValue('2026-08-01');
    expect(within(restored).getByText('距离 国考')).toBeInTheDocument();
    expect(within(restored).getByText('还有 12 天')).toBeInTheDocument();
  });

  it.each([
    ['2026-07-20', '就是今天'],
    ['2026-07-15', '已过去 5 天'],
  ])('目标日为 %s 时显示“%s”', async (targetDate, message) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 20, 12));
    render(<DashboardPage />, { wrapper: MemoryRouter });

    const countdown = await findCountdownSection();
    setCountdown(countdown, '国考', targetDate);

    expect(within(countdown).getByText(message)).toBeInTheDocument();
  });

  it('清除目标日后删除本地存储并回到空态', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 20, 12));
    render(<DashboardPage />, { wrapper: MemoryRouter });

    const countdown = await findCountdownSection();
    setCountdown(countdown, '国考', '2026-08-01');
    fireEvent.click(within(countdown).getByRole('button', { name: '清除倒计时' }));

    expect(window.localStorage.getItem(dashboardCountdownStorageKey)).toBeNull();
    expect(within(countdown).getByLabelText('倒计时名称')).toHaveValue('');
    expect(within(countdown).getByLabelText('目标日期')).toHaveValue('');
    expect(within(countdown).queryByText('距离 国考')).not.toBeInTheDocument();
    expect(within(countdown).queryByText('还有 12 天')).not.toBeInTheDocument();
  });
});

async function findCountdownSection() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
  const heading = screen.getByRole('heading', { name: '目标日倒计时' });
  const section = heading.closest('section');
  if (!section) throw new Error('目标日倒计时标题应位于 section 内');
  return section;
}

function setCountdown(section: HTMLElement, name: string, targetDate: string) {
  fireEvent.change(within(section).getByLabelText('倒计时名称'), { target: { value: name } });
  fireEvent.change(within(section).getByLabelText('目标日期'), { target: { value: targetDate } });
  fireEvent.click(within(section).getByRole('button', { name: '保存倒计时' }));
}

function createFetchMock(
  settings = settingsResponse,
  options: {
    cards?: typeof cardSearchResponse;
    cardsStatus?: number;
  } = {},
) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const path = String(input);
    if (path === '/api/cards?contentVersion=optimized&archived=false&page=1&pageSize=100') {
      const status = options.cardsStatus ?? 200;
      return new Response(JSON.stringify(status === 200 ? options.cards ?? cardSearchResponse : {
        code: 'cards_unavailable',
        message: '卡片暂不可用',
      }), {
        status,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const body = path === '/api/dashboard' ? dashboardResponse : settings;
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  });
}
