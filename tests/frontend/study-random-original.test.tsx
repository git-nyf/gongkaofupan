// @vitest-environment jsdom

import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import type { CardDetail, StudySessionResult } from '../../shared/contracts';
import { StudyPage } from '../../src/pages/StudyPage';

const emptySession: StudySessionResult = { items: [], totalAvailable: 0 };

function card(overrides: Partial<CardDetail> = {}): CardDetail {
  return {
    id: 'original-card-1',
    entryMode: 'mistake',
    rawInput: '资料分析重点，要先看口径',
    rawContentJson: JSON.stringify({
      type: 'doc',
      content: [{
        type: 'paragraph',
        content: [
          {
            type: 'text',
            text: '资料分析重点',
            marks: [
              { type: 'bold' },
              { type: 'textStyle', attrs: { color: '#c64232' } },
            ],
          },
          { type: 'text', text: '，要先看口径' },
        ],
      }],
    }),
    template: '资料分析',
    normalizedStatement: '先看统计口径',
    wrongPoint: '',
    analysis: '',
    mnemonic: '',
    extension: '',
    notes: '',
    aiStatus: 'ready',
    sourceType: '',
    sourceDetail: '',
    wrongCount: 0,
    archived: false,
    createdAt: '2026-07-17T08:30:00.000Z',
    updatedAt: '2026-07-17T08:30:00.000Z',
    categories: [
      { id: '资料分析', name: '资料分析', parentId: null },
      { id: '资料分析/时间陷阱', name: '时间陷阱', parentId: '资料分析' },
    ],
    tags: [],
    attachments: [],
    quizItems: [],
    ...overrides,
  };
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
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

function randomCalls() {
  return vi.mocked(fetch).mock.calls.filter(([input]) => (
    String(input) === '/api/cards/random-original'
    || String(input).startsWith('/api/cards/random-original?')
  ));
}

function randomRequestUrls() {
  return randomCalls().map(([input]) => new URL(String(input), 'http://localhost'));
}

function randomCountCalls() {
  return vi.mocked(fetch).mock.calls.filter(([input]) => (
    String(input) === '/api/cards/random-original/count'
    || String(input).startsWith('/api/cards/random-original/count?')
  ));
}

function reviewCalls() {
  return vi.mocked(fetch).mock.calls.filter(([input]) => String(input) === '/api/reviews');
}

beforeEach(() => {
  window.localStorage.clear();
  window.history.pushState({}, '', '/study');
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('背诵页随机查看用户初始稿', () => {
  it('初始全部范围立即显示匹配初始稿总数', async () => {
    vi.mocked(fetch).mockImplementation(async (input) => {
      const path = String(input);
      if (path === '/api/study/sessions') return jsonResponse(emptySession);
      if (path === '/api/cards/random-original/count') {
        return jsonResponse({ totalAvailable: 12 });
      }
      throw new Error(`未模拟的请求：${path}`);
    });
    renderStudyPage();

    await screen.findByText('暂无可背诵卡组');
    const scope = screen.getByRole('group', { name: '初始稿抽取范围' });
    expect(await within(scope).findByText('匹配初始稿 12 份')).toBeInTheDocument();
    expect(randomCalls()).toHaveLength(0);
  });

  it('快速切换板块后即时显示最新匹配数且不被旧响应覆盖', async () => {
    let resolveInitialCount!: (response: Response) => void;
    const initialCount = new Promise<Response>((resolve) => {
      resolveInitialCount = resolve;
    });
    vi.mocked(fetch).mockImplementation(async (input) => {
      const path = String(input);
      if (path === '/api/study/sessions') return jsonResponse(emptySession);
      if (path === '/api/cards/random-original/count') return initialCount;
      if (path === '/api/cards/random-original/count?categoryIds=%E8%B5%84%E6%96%99%E5%88%86%E6%9E%90') {
        return jsonResponse({ totalAvailable: 3 });
      }
      throw new Error(`未模拟的请求：${path}`);
    });
    const user = userEvent.setup();
    renderStudyPage();

    await screen.findByText('暂无可背诵卡组');
    await waitFor(() => expect(randomCountCalls()).toHaveLength(1));
    const scope = screen.getByRole('group', { name: '初始稿抽取范围' });
    await user.click(within(scope).getByRole('checkbox', { name: '初始稿范围：资料分析' }));

    expect(await within(scope).findByText('匹配初始稿 3 份')).toBeInTheDocument();
    expect(randomCalls()).toHaveLength(0);
    await act(async () => resolveInitialCount(jsonResponse({ totalAvailable: 99 })));
    expect(within(scope).getByText('匹配初始稿 3 份')).toBeInTheDocument();
  });

  it('匹配数量加载失败不阻止手动抽取，非法日期不发送计数请求', async () => {
    vi.mocked(fetch).mockImplementation(async (input) => {
      const path = String(input);
      if (path === '/api/study/sessions') return jsonResponse(emptySession);
      if (path.startsWith('/api/cards/random-original/count')) {
        return jsonResponse({ code: 'count_failed', message: 'failed' }, 500);
      }
      if (path.startsWith('/api/cards/random-original')) return jsonResponse({ card: null });
      throw new Error(`未模拟的请求：${path}`);
    });
    const user = userEvent.setup();
    renderStudyPage();

    await screen.findByText('暂无可背诵卡组');
    const scope = screen.getByRole('group', { name: '初始稿抽取范围' });
    expect(await within(scope).findByText('匹配数量加载失败，仍可手动抽取')).toBeInTheDocument();
    const drawButton = screen.getByRole('button', { name: '随机抽取用户初始稿' });
    expect(drawButton).toBeEnabled();
    await user.click(drawButton);
    expect(randomCalls()).toHaveLength(1);

    const countBeforeInvalidRange = randomCountCalls().length;
    await user.type(within(scope).getByLabelText('初始稿范围开始日期'), '2026-07-20');
    await user.type(within(scope).getByLabelText('初始稿范围结束日期'), '2026-07-01');
    expect(within(scope).getByRole('alert')).toHaveTextContent('开始日期不能晚于结束日期');
    expect(randomCountCalls()).toHaveLength(countBeforeInvalidRange + 1);
  });

  it('可独立选择大小板块和录入日期，点击抽取时才带重复分类参数请求', async () => {
    vi.mocked(fetch).mockImplementation(async (input) => {
      if (String(input) === '/api/study/sessions') return jsonResponse(emptySession);
      if (String(input).startsWith('/api/cards/random-original?')) {
        return jsonResponse({ card: card() });
      }
      throw new Error(`未模拟的请求：${String(input)}`);
    });
    const user = userEvent.setup();
    renderStudyPage();

    await screen.findByText('暂无可背诵卡组');
    const scope = screen.getByRole('group', { name: '初始稿抽取范围' });
    const parent = within(scope).getByRole('checkbox', { name: '初始稿范围：言语理解' });
    const child = within(scope).getByRole('checkbox', { name: '初始稿范围：时间陷阱' });
    const upperParent = screen.getByRole('checkbox', { name: '言语理解' });

    await user.click(parent);
    await user.click(child);
    await user.type(within(scope).getByLabelText('初始稿范围开始日期'), '2026-07-01');
    await user.type(within(scope).getByLabelText('初始稿范围结束日期'), '2026-07-20');

    expect(upperParent).not.toBeChecked();
    expect(randomCalls()).toHaveLength(0);
    await user.click(screen.getByRole('button', { name: '随机抽取用户初始稿' }));

    const [requestUrl] = randomRequestUrls();
    expect(requestUrl.searchParams.getAll('categoryIds')).toEqual([
      '言语理解',
      '资料分析/时间陷阱',
    ]);
    expect(requestUrl.searchParams.get('createdFrom')).toBe('2026-07-01');
    expect(requestUrl.searchParams.get('createdTo')).toBe('2026-07-20');
    expect(await screen.findByText('资料分析重点')).toBeInTheDocument();
  });

  it('反馈后沿用当前范围，范围变化清除旧结果但保留本次计数', async () => {
    const cards = [
      card({ id: 'first', rawInput: '第一份初始稿', rawContentJson: null }),
      card({ id: 'second', rawInput: '第二份初始稿', rawContentJson: null }),
    ];
    vi.mocked(fetch).mockImplementation(async (input) => {
      if (String(input) === '/api/study/sessions') return jsonResponse(emptySession);
      if (String(input).startsWith('/api/cards/random-original?')) {
        return jsonResponse({ card: cards.shift() ?? null });
      }
      throw new Error(`未模拟的请求：${String(input)}`);
    });
    const user = userEvent.setup();
    renderStudyPage();

    await screen.findByText('暂无可背诵卡组');
    const scope = screen.getByRole('group', { name: '初始稿抽取范围' });
    await user.click(within(scope).getByRole('checkbox', { name: '初始稿范围：资料分析' }));
    await user.click(screen.getByRole('button', { name: '随机抽取用户初始稿' }));
    expect(await screen.findByText('第一份初始稿')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '记住了' }));
    expect(await screen.findByText('第二份初始稿')).toBeInTheDocument();
    expect(randomRequestUrls().map((url) => url.searchParams.getAll('categoryIds'))).toEqual([
      ['资料分析'],
      ['资料分析'],
    ]);

    await user.click(within(scope).getByRole('checkbox', { name: '初始稿范围：资料分析' }));
    expect(screen.queryByText('第二份初始稿')).not.toBeInTheDocument();
    expect(screen.getByText('记住 1')).toBeInTheDocument();
    expect(screen.getByText('没记住 0')).toBeInTheDocument();
    expect(randomCalls()).toHaveLength(2);
  });

  it('日期倒置时显示错误并禁止抽取，请求期间禁用范围控件', async () => {
    let resolveRandom!: (response: Response) => void;
    const pendingRandom = new Promise<Response>((resolve) => {
      resolveRandom = resolve;
    });
    vi.mocked(fetch).mockImplementation(async (input) => {
      if (String(input) === '/api/study/sessions') return jsonResponse(emptySession);
      if (String(input).startsWith('/api/cards/random-original/count')) {
        return jsonResponse({ totalAvailable: 1 });
      }
      if (String(input).startsWith('/api/cards/random-original')) return pendingRandom;
      throw new Error(`未模拟的请求：${String(input)}`);
    });
    const user = userEvent.setup();
    renderStudyPage();

    await screen.findByText('暂无可背诵卡组');
    const scope = screen.getByRole('group', { name: '初始稿抽取范围' });
    const startDate = within(scope).getByLabelText('初始稿范围开始日期');
    const endDate = within(scope).getByLabelText('初始稿范围结束日期');
    await user.type(startDate, '2026-07-20');
    await user.type(endDate, '2026-07-01');

    expect(within(scope).getByRole('alert')).toHaveTextContent('开始日期不能晚于结束日期');
    const drawButton = screen.getByRole('button', { name: '随机抽取用户初始稿' });
    expect(drawButton).toBeDisabled();
    expect(randomCalls()).toHaveLength(0);

    await user.clear(endDate);
    await user.type(endDate, '2026-07-21');
    await user.click(drawButton);
    expect(startDate).toBeDisabled();
    expect(endDate).toBeDisabled();
    expect(within(scope).getByRole('checkbox', { name: '初始稿范围：资料分析' })).toBeDisabled();

    await act(async () => resolveRandom(jsonResponse({ card: card() })));
    expect(await screen.findByText('资料分析重点')).toBeInTheDocument();
  });

  it('点击前不请求，真实请求期间显示抽牌态，成功保留富文本和必要元数据', async () => {
    let resolveRandom!: (response: Response) => void;
    const pendingRandom = new Promise<Response>((resolve) => {
      resolveRandom = resolve;
    });
    vi.mocked(fetch).mockImplementation(async (input) => {
      if (String(input) === '/api/study/sessions') return jsonResponse(emptySession);
      if (String(input) === '/api/cards/random-original') return pendingRandom;
      throw new Error(`未模拟的请求：${String(input)}`);
    });
    const user = userEvent.setup();
    renderStudyPage();

    await screen.findByText('暂无可背诵卡组');
    expect(randomCalls()).toHaveLength(0);
    expect(screen.getByText('记住 0')).toBeInTheDocument();
    expect(screen.getByText('没记住 0')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '没记住' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '记住了' })).not.toBeInTheDocument();
    const button = screen.getByRole('button', { name: '随机抽取用户初始稿' });
    await user.click(button);

    expect(randomCalls()).toHaveLength(1);
    expect(screen.getByRole('button', { name: '正在抽取用户初始稿' })).toBeDisabled();
    expect(screen.getByText('正在洗牌并抽取初始稿…')).toHaveAttribute('role', 'status');

    await act(async () => resolveRandom(jsonResponse({ card: card() })));
    const markedText = await screen.findByText('资料分析重点');
    const resultCard = markedText.closest('article');
    expect(resultCard).not.toBeNull();
    expect(markedText).toHaveStyle({ color: '#c64232' });
    expect(markedText.closest('strong')).not.toBeNull();
    expect(within(resultCard!).getByText('资料分析 / 时间陷阱')).toBeInTheDocument();
    expect(within(resultCard!).getByText('录入时间')).toBeInTheDocument();
    expect(resultCard!.querySelector('time')).toHaveAttribute('datetime', '2026-07-17T08:30:00.000Z');
    expect(screen.getByRole('img', { name: '开国大典牌面' })).toHaveAttribute('src', '/diy/开国大典.jpg');
    const feedbackButtons = screen.getAllByRole('button').filter((candidate) => (
      candidate.getAttribute('aria-label') === '没记住'
      || candidate.getAttribute('aria-label') === '记住了'
    ));
    expect(feedbackButtons.map((candidate) => candidate.getAttribute('aria-label'))).toEqual(['没记住', '记住了']);
  });

  it('反馈只计入本次页面会话，点击后立即抽取下一份且请求期间不会重复提交', async () => {
    let resolveSecond!: (response: Response) => void;
    const secondRandom = new Promise<Response>((resolve) => {
      resolveSecond = resolve;
    });
    let randomAttempt = 0;
    vi.mocked(fetch).mockImplementation(async (input) => {
      if (String(input) === '/api/study/sessions') return jsonResponse(emptySession);
      if (String(input) === '/api/cards/random-original') {
        randomAttempt += 1;
        if (randomAttempt === 1) {
          return jsonResponse({ card: card({ id: 'first', rawInput: '第一份初始稿', rawContentJson: null }) });
        }
        if (randomAttempt === 2) return secondRandom;
        return jsonResponse({ card: card({ id: 'third', rawInput: '第三份初始稿', rawContentJson: null }) });
      }
      throw new Error(`未模拟的请求：${String(input)}`);
    });
    const user = userEvent.setup();
    renderStudyPage();

    await screen.findByText('暂无可背诵卡组');
    await user.click(screen.getByRole('button', { name: '随机抽取用户初始稿' }));
    expect(await screen.findByText('第一份初始稿')).toBeInTheDocument();

    const rememberedButton = screen.getByRole('button', { name: '记住了' });
    await act(async () => {
      rememberedButton.click();
      rememberedButton.click();
    });

    expect(screen.getByText('记住 1')).toBeInTheDocument();
    expect(screen.getByText('没记住 0')).toBeInTheDocument();
    expect(randomCalls()).toHaveLength(2);
    expect(reviewCalls()).toHaveLength(0);
    expect(screen.queryByRole('button', { name: '记住了' })).not.toBeInTheDocument();

    await act(async () => resolveSecond(jsonResponse({
      card: card({ id: 'second', rawInput: '第二份初始稿', rawContentJson: null }),
    })));
    expect(await screen.findByText('第二份初始稿')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '没记住' }));

    expect(screen.getByText('记住 1')).toBeInTheDocument();
    expect(screen.getByText('没记住 1')).toBeInTheDocument();
    expect(await screen.findByText('第三份初始稿')).toBeInTheDocument();
    expect(randomCalls()).toHaveLength(3);
    expect(reviewCalls()).toHaveLength(0);
  });

  it('空库返回明确状态且组件位于页面内容底部', async () => {
    vi.mocked(fetch).mockImplementation(async (input) => {
      if (String(input) === '/api/study/sessions') return jsonResponse(emptySession);
      if (String(input) === '/api/cards/random-original') return jsonResponse({ card: null });
      throw new Error(`未模拟的请求：${String(input)}`);
    });
    const user = userEvent.setup();
    const { container } = renderStudyPage();

    await screen.findByText('暂无可背诵卡组');
    await user.click(screen.getByRole('button', { name: '随机抽取用户初始稿' }));

    expect(await screen.findByText('还没有可抽取的用户初始稿。')).toBeInTheDocument();
    expect(container.querySelector('.study-page')?.lastElementChild).toHaveClass('study-random-original');
    expect(screen.getByRole('button', { name: '再次抽取用户初始稿' })).toBeEnabled();
  });

  it('请求错误显示中文错误，并可重新抽取', async () => {
    let attempts = 0;
    vi.mocked(fetch).mockImplementation(async (input) => {
      if (String(input) === '/api/study/sessions') return jsonResponse(emptySession);
      if (String(input) === '/api/cards/random-original') {
        attempts += 1;
        return attempts === 1
          ? jsonResponse({ code: 'random_failed', message: 'failed' }, 500)
          : jsonResponse({ card: card({ rawInput: '重试后抽中', rawContentJson: null }) });
      }
      throw new Error(`未模拟的请求：${String(input)}`);
    });
    const user = userEvent.setup();
    renderStudyPage();

    await screen.findByText('暂无可背诵卡组');
    await user.click(screen.getByRole('button', { name: '随机抽取用户初始稿' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('抽取失败，请检查连接后重试。');

    await user.click(screen.getByRole('button', { name: '重新抽取用户初始稿' }));
    expect(await screen.findByText('重试后抽中')).toBeInTheDocument();
    expect(randomCalls()).toHaveLength(2);
  });

  it('反馈后的下一次抽取失败时保留计数，重新挂载则清零', async () => {
    let randomAttempt = 0;
    vi.mocked(fetch).mockImplementation(async (input) => {
      if (String(input) === '/api/study/sessions') return jsonResponse(emptySession);
      if (String(input) === '/api/cards/random-original') {
        randomAttempt += 1;
        return randomAttempt === 1
          ? jsonResponse({ card: card({ rawInput: '待反馈初始稿', rawContentJson: null }) })
          : jsonResponse({ code: 'random_failed', message: 'failed' }, 500);
      }
      throw new Error(`未模拟的请求：${String(input)}`);
    });
    const user = userEvent.setup();
    const firstView = renderStudyPage();

    await screen.findByText('暂无可背诵卡组');
    await user.click(screen.getByRole('button', { name: '随机抽取用户初始稿' }));
    expect(await screen.findByText('待反馈初始稿')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '记住了' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('抽取失败，请检查连接后重试。');
    expect(screen.getByText('记住 1')).toBeInTheDocument();
    expect(screen.getByText('没记住 0')).toBeInTheDocument();
    expect(reviewCalls()).toHaveLength(0);

    firstView.unmount();
    renderStudyPage();
    await screen.findByText('暂无可背诵卡组');
    expect(screen.getByText('记住 0')).toBeInTheDocument();
    expect(screen.getByText('没记住 0')).toBeInTheDocument();
  });

  it('已有结果时可再次抽取并替换为新结果', async () => {
    const cards = [
      card({ id: 'first', rawInput: '第一份初始稿', rawContentJson: null }),
      card({ id: 'second', rawInput: '第二份初始稿', rawContentJson: null }),
    ];
    vi.mocked(fetch).mockImplementation(async (input) => {
      if (String(input) === '/api/study/sessions') return jsonResponse(emptySession);
      if (String(input) === '/api/cards/random-original') return jsonResponse({ card: cards.shift() ?? null });
      throw new Error(`未模拟的请求：${String(input)}`);
    });
    const user = userEvent.setup();
    renderStudyPage();

    await screen.findByText('暂无可背诵卡组');
    await user.click(screen.getByRole('button', { name: '随机抽取用户初始稿' }));
    expect(await screen.findByText('第一份初始稿')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '再次抽取用户初始稿' }));
    expect(await screen.findByText('第二份初始稿')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText('第一份初始稿')).not.toBeInTheDocument());
    expect(randomCalls()).toHaveLength(2);
  });
});
