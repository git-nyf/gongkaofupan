// @vitest-environment jsdom

import { readFile } from 'node:fs/promises';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CardDetail, CardSearchResult } from '../../shared/contracts';
import App from '../../src/App';

const motionMock = vi.hoisted(() => ({
  animate: vi.fn(),
  stop: vi.fn(),
}));

vi.mock('motion', () => ({ animate: motionMock.animate }));

class TestPointerEvent extends MouseEvent {
  pointerId: number;
  isPrimary: boolean;

  constructor(type: string, init: PointerEventInit = {}) {
    super(type, init);
    this.pointerId = init.pointerId ?? 1;
    this.isPrimary = init.isPrimary ?? true;
  }
}

function card(overrides: Partial<CardDetail> = {}): CardDetail {
  return {
    id: 'card-1',
    entryMode: 'mistake',
    rawInput: '广陵=扬州',
    rawContentJson: JSON.stringify({
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: '广陵=扬州' }] }],
    }),
    template: '常识判断',
    normalizedStatement: '广陵与扬州为对应关系',
    wrongPoint: '混淆古今地名',
    analysis: '广陵对应扬州',
    mnemonic: '广陵扬州',
    extension: '金陵对应南京',
    notes: '复习地名',
    aiStatus: 'ready',
    sourceType: '历年真题',
    sourceDetail: '2025 国考',
    wrongCount: 2,
    archived: false,
    createdAt: '2026-07-16T00:00:00.000Z',
    updatedAt: '2026-07-17T00:00:00.000Z',
    categories: [
      { id: '常识判断', name: '常识判断', parentId: null },
      { id: '常识判断/文史', name: '文史', parentId: '常识判断' },
    ],
    tags: [
      { id: 'tag-user', name: '古今地名', origin: 'user' },
      { id: 'tag-ai', name: '历史常识', origin: 'ai' },
    ],
    attachments: [
      {
        id: 'attachment-1',
        url: '/uploads/guangling.png',
        originalName: '广陵.png',
        mimeType: 'image/png',
        byteSize: 128,
      },
    ],
    quizItems: [
      {
        id: 'quiz-1',
        direction: 'forward',
        question: '广陵对应哪里？',
        answer: '扬州',
        dueAt: '2026-07-20T00:00:00.000Z',
      },
    ],
    ...overrides,
  };
}

function searchResult(items: CardDetail[] = [card()]): CardSearchResult {
  return { items, total: items.length, page: 1, pageSize: 20 };
}

function folder(overrides: Partial<{
  id: string;
  name: string;
  originalCount: number;
  cardIds: string[];
  createdAt: string;
  updatedAt: string;
}> = {}) {
  return {
    id: 'folder-1',
    name: '公考资料夹',
    originalCount: 1,
    cardIds: [],
    createdAt: '2026-07-20T00:00:00.000Z',
    updatedAt: '2026-07-20T00:00:00.000Z',
    ...overrides,
  };
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function blobResponse(content = 'xlsx') {
  return new Response(content, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    },
  });
}

function renderAt(path: string) {
  window.history.pushState({}, '', path);
  return render(<App />);
}

beforeEach(() => {
  Object.defineProperty(Range.prototype, 'getBoundingClientRect', {
    configurable: true,
    value: () => new DOMRect(),
  });
  Object.defineProperty(Range.prototype, 'getClientRects', {
    configurable: true,
    value: () => [],
  });
  Object.defineProperty(document, 'elementFromPoint', {
    configurable: true,
    value: () => null,
  });
  window.history.pushState({}, '', '/');
  vi.stubGlobal('fetch', vi.fn());
  vi.stubGlobal('confirm', vi.fn(() => true));
  vi.stubGlobal('PointerEvent', TestPointerEvent);
  motionMock.stop.mockReset();
  motionMock.animate.mockReset();
  motionMock.animate.mockImplementation((from: number, target: number, options?: {
    onComplete?: () => void;
    onUpdate?: (value: number) => void;
  }) => {
    if (target === 0) {
      options?.onUpdate?.(0);
      options?.onComplete?.();
    }
    return { stop: motionMock.stop };
  });
});

afterEach(() => {
  cleanup();
  document.documentElement.removeAttribute('data-motion');
  document.body.style.overflow = '';
  document.body.style.paddingRight = '';
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('卡片库筛选与状态', () => {
  it('从 URL 恢复现有筛选、忽略旧筛选并以重复键请求卡片列表', async () => {
    const fetchMock = vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ items: [], total: 150, page: 3, pageSize: 50 }),
    );
    renderAt(
      '/cards?query=广陵&categoryIds=常识判断&categoryIds=政治理论&tagIds=tag-a&tagIds=tag-b&rating=4&mastery=hard&aiStatus=needs_input&archived=true&createdFrom=2026-07-01&createdTo=2026-07-17&page=3&pageSize=50',
    );

    expect(await screen.findByRole('textbox', { name: '搜索卡片' })).toHaveValue('广陵');
    expect(screen.getByLabelText('板块编号')).toHaveValue('常识判断，政治理论');
    expect(screen.getByLabelText('标签编号')).toHaveValue('tag-a，tag-b');
    expect(screen.queryByLabelText('星级筛选')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('掌握度筛选')).not.toBeInTheDocument();
    expect(screen.getByLabelText('AI 状态筛选')).toHaveValue('needs_input');
    expect(screen.getByLabelText('归档状态筛选')).toHaveValue('true');
    expect(screen.getByLabelText('录入开始日期')).toHaveValue('2026-07-01');
    expect(screen.getByLabelText('录入结束日期')).toHaveValue('2026-07-17');
    expect(screen.getByLabelText('每页数量')).toHaveValue('50');

    await waitFor(() => {
      const currentParams = new URLSearchParams(window.location.search);
      expect(currentParams.has('rating')).toBe(false);
      expect(currentParams.has('mastery')).toBe(false);
    });
    const currentParams = new URLSearchParams(window.location.search);
    expect(currentParams.get('query')).toBe('广陵');
    expect(currentParams.getAll('categoryIds')).toEqual(['常识判断', '政治理论']);
    expect(currentParams.getAll('tagIds')).toEqual(['tag-a', 'tag-b']);
    expect(currentParams.get('aiStatus')).toBe('needs_input');
    expect(currentParams.get('archived')).toBe('true');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const requested = new URL(String(fetchMock.mock.calls[0]?.[0]), 'http://localhost');
    expect(requested.pathname).toBe('/api/cards');
    expect(requested.searchParams.get('query')).toBe('广陵');
    expect(requested.searchParams.getAll('categoryIds')).toEqual(['常识判断', '政治理论']);
    expect(requested.searchParams.getAll('tagIds')).toEqual(['tag-a', 'tag-b']);
    expect(Object.fromEntries(requested.searchParams)).toMatchObject({
      contentVersion: 'optimized',
      aiStatus: 'needs_input',
      archived: 'true',
      createdFrom: '2026-07-01',
      createdTo: '2026-07-17',
      page: '3',
      pageSize: '50',
    });
    expect(requested.searchParams.has('rating')).toBe(false);
    expect(requested.searchParams.has('mastery')).toBe(false);
  });

  it('搜索严格等待 300ms 后同步 URL 并请求，旧响应不会覆盖新结果', async () => {
    vi.useFakeTimers();
    const resolvers: Array<(response: Response) => void> = [];
    const fetchMock = vi.mocked(fetch).mockImplementation(
      () => new Promise<Response>((resolve) => resolvers.push(resolve)),
    );
    renderAt('/cards');
    resolvers.shift()?.(jsonResponse(searchResult([])));
    await act(async () => Promise.resolve());

    fireEvent.change(screen.getByRole('textbox', { name: '搜索卡片' }), {
      target: { value: '广' },
    });
    act(() => vi.advanceTimersByTime(299));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(window.location.search).not.toContain('query=');

    await act(async () => {
      vi.advanceTimersByTime(1);
      await Promise.resolve();
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(new URLSearchParams(window.location.search).get('query')).toBe('广');

    fireEvent.change(screen.getByRole('textbox', { name: '搜索卡片' }), {
      target: { value: '扬州' },
    });
    await act(async () => {
      vi.advanceTimersByTime(300);
      await Promise.resolve();
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    resolvers[1]?.(jsonResponse(searchResult([card({ normalizedStatement: '扬州结果' })])));
    await act(async () => Promise.resolve());
    resolvers[0]?.(jsonResponse(searchResult([card({ normalizedStatement: '过期结果' })])));
    await act(async () => Promise.resolve());

    expect(screen.getByText('扬州结果')).toBeInTheDocument();
    expect(screen.queryByText('过期结果')).not.toBeInTheDocument();
  });

  it('逐字输入多值板块和标签时保留输入草稿并立即写入重复查询键', async () => {
    const fetchMock = vi.mocked(fetch).mockResolvedValue(jsonResponse(searchResult([])));
    const user = userEvent.setup();
    renderAt('/cards');
    await screen.findByText('暂无符合条件的卡片');

    const tagInput = screen.getByLabelText('标签编号');
    await user.type(tagInput, 'tag-a,tag-b');
    expect(tagInput).toHaveValue('tag-a,tag-b');
    expect(new URLSearchParams(window.location.search).getAll('tagIds')).toEqual(['tag-a', 'tag-b']);

    const categoryInput = screen.getByLabelText('板块编号');
    await user.type(categoryInput, '常识判断,政治理论');
    expect(categoryInput).toHaveValue('常识判断,政治理论');
    const currentParams = new URLSearchParams(window.location.search);
    expect(currentParams.getAll('categoryIds')).toEqual(['常识判断', '政治理论']);
    expect(currentParams.getAll('tagIds')).toEqual(['tag-a', 'tag-b']);

    await user.tab();
    expect(categoryInput).toHaveValue('常识判断，政治理论');
    const requested = new URL(String(fetchMock.mock.calls.at(-1)?.[0]), 'http://localhost');
    expect(requested.searchParams.getAll('categoryIds')).toEqual(['常识判断', '政治理论']);
    expect(requested.searchParams.getAll('tagIds')).toEqual(['tag-a', 'tag-b']);
  });

  it('直接访问超出总页数的 URL 时跳到最后有效页并保持加载态', async () => {
    let resolveLastPage: ((response: Response) => void) | undefined;
    vi.mocked(fetch).mockImplementation(async (input) => {
      const params = new URL(String(input), 'http://localhost').searchParams;
      if (params.get('page') === '9') {
        return jsonResponse({ items: [], total: 21, page: 9, pageSize: 20 });
      }
      return new Promise<Response>((resolve) => { resolveLastPage = resolve; });
    });
    renderAt('/cards?page=9&pageSize=20');

    await waitFor(() => expect(new URLSearchParams(window.location.search).get('page')).toBe('2'));
    expect(screen.getByText('正在加载卡片')).toBeInTheDocument();
    expect(screen.queryByText('第 9 / 1 页')).not.toBeInTheDocument();

    await act(async () => resolveLastPage?.(jsonResponse({ items: [card()], total: 21, page: 2, pageSize: 20 })));
    expect(await screen.findByText('广陵与扬州为对应关系')).toBeInTheDocument();
    expect(screen.getByText('第 2 / 2 页')).toBeInTheDocument();
  });

  it('稳定呈现加载、失败和空列表状态', async () => {
    let rejectRequest: ((reason: Error) => void) | undefined;
    vi.mocked(fetch).mockReturnValue(
      new Promise<Response>((_resolve, reject) => { rejectRequest = reject; }),
    );
    const view = renderAt('/cards');
    expect(screen.getByText('正在加载卡片')).toBeInTheDocument();
    await act(async () => rejectRequest?.(new Error('offline')));
    expect(await screen.findByRole('alert')).toHaveTextContent('卡片加载失败，请稍后重试');

    view.unmount();
    vi.mocked(fetch).mockResolvedValue(jsonResponse(searchResult([])));
    renderAt('/cards');
    expect(await screen.findByText('暂无符合条件的卡片')).toBeInTheDocument();
  });
});

describe('卡片库初始稿文件夹', () => {
  it('仅在用户初始稿主卡片显示全部文件夹归属且不显示空占位', async () => {
    const groupedCards = [
      card({ rawInput: '同一份原始资料', rawContentJson: '', normalizedStatement: '第一道衍生问题' }),
      card({ id: 'card-2', rawInput: '同一份原始资料', rawContentJson: '', normalizedStatement: '第二道衍生问题' }),
      card({ id: 'card-3', rawInput: '未归属初始稿', rawContentJson: '', normalizedStatement: '独立问题' }),
    ];
    vi.mocked(fetch).mockImplementation(async (input) => {
      const path = String(input);
      if (path === '/api/cards/folders') {
        return jsonResponse([
          folder({ cardIds: ['card-2'] }),
          folder({ id: 'folder-2', name: '申论素材', cardIds: ['card-1'] }),
        ]);
      }
      if (path === '/api/cards/folders/folder-1/cards') {
        return jsonResponse({ folder: folder({ cardIds: ['card-2'] }), cards: [groupedCards[1]] });
      }
      return jsonResponse(searchResult(groupedCards));
    });
    const user = userEvent.setup();
    renderAt('/cards?contentVersion=original');

    const mainList = await screen.findByRole('list', { name: '卡片列表' });
    const mainCards = within(mainList).getAllByRole('listitem');
    const assignedCard = mainCards.find((item) => item.textContent?.includes('同一份原始资料'))!;
    const unassignedCard = mainCards.find((item) => item.textContent?.includes('未归属初始稿'))!;
    expect(within(assignedCard).getByLabelText('已加入文件夹：公考资料夹、申论素材')).toHaveTextContent('公考资料夹');
    expect(within(assignedCard).getByLabelText('已加入文件夹：公考资料夹、申论素材')).toHaveTextContent('申论素材');
    expect(within(unassignedCard).queryByLabelText(/已加入文件夹/)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '打开公考资料夹' }));
    const folderPreview = await screen.findByRole('list', { name: '公考资料夹中的卡片' });
    expect(within(folderPreview).queryByLabelText(/已加入文件夹/)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'AI 优化稿' }));
    await screen.findByRole('list', { name: '卡片列表' });
    expect(screen.queryByLabelText(/已加入文件夹/)).not.toBeInTheDocument();
  });

  it('仅在用户初始稿显示文件夹区域，切换回来时重新加载且保持收起', async () => {
    let folderLoads = 0;
    vi.mocked(fetch).mockImplementation(async (input) => {
      const path = String(input);
      if (path === '/api/cards/folders') {
        folderLoads += 1;
        return jsonResponse([folder()]);
      }
      if (path === '/api/cards/folders/folder-1/cards') {
        return jsonResponse({ folder: folder(), cards: [card()] });
      }
      return jsonResponse(searchResult());
    });
    const user = userEvent.setup();
    renderAt('/cards');

    await screen.findByRole('list', { name: '卡片列表' });
    expect(screen.queryByRole('region', { name: '初始稿文件夹' })).not.toBeInTheDocument();
    expect(folderLoads).toBe(0);

    await user.click(screen.getByRole('button', { name: '用户初始稿' }));
    expect(await screen.findByRole('region', { name: '初始稿文件夹' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '打开公考资料夹' }));
    expect(await screen.findByRole('list', { name: '公考资料夹中的卡片' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'AI 优化稿' }));
    expect(screen.queryByRole('region', { name: '初始稿文件夹' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '用户初始稿' }));

    await waitFor(() => expect(folderLoads).toBe(2));
    expect(screen.queryByRole('list', { name: '公考资料夹中的卡片' })).not.toBeInTheDocument();
  });

  it('可用内联输入创建文件夹，输入限制为 40 个字符', async () => {
    const created = folder({ id: 'folder-2', name: '申论素材', originalCount: 0 });
    const requests: Array<{ path: string; init?: RequestInit }> = [];
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const path = String(input);
      requests.push({ path, init });
      if (path === '/api/cards/folders' && init?.method === 'POST') return jsonResponse(created, 201);
      if (path === '/api/cards/folders') return jsonResponse([folder()]);
      return jsonResponse(searchResult());
    });
    const user = userEvent.setup();
    renderAt('/cards?contentVersion=original');

    const input = await screen.findByRole('textbox', { name: '文件夹名称' });
    expect(input).toHaveAttribute('maxlength', '40');
    await user.type(input, '申论素材{Enter}');

    expect(await screen.findByRole('button', { name: '打开申论素材' })).toBeInTheDocument();
    expect(input).toHaveValue('');
    const createRequest = requests.find(({ path, init }) => path === '/api/cards/folders' && init?.method === 'POST');
    expect(JSON.parse(String(createRequest?.init?.body))).toEqual({ name: '申论素材' });
  });

  it('创建失败时保留输入、已有文件夹和主卡片并显示稳定错误', async () => {
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const path = String(input);
      if (path === '/api/cards/folders' && init?.method === 'POST') {
        return jsonResponse({ code: 'internal_error', message: '请求处理失败' }, 500);
      }
      if (path === '/api/cards/folders') return jsonResponse([folder()]);
      return jsonResponse(searchResult());
    });
    const user = userEvent.setup();
    renderAt('/cards?contentVersion=original');

    const input = await screen.findByRole('textbox', { name: '文件夹名称' });
    await user.type(input, '未保存文件夹{Enter}');

    expect(await screen.findByRole('alert')).toHaveTextContent('创建文件夹失败，请稍后重试');
    expect(input).toHaveValue('未保存文件夹');
    expect(screen.getByRole('button', { name: '打开公考资料夹' })).toBeInTheDocument();
    expect(screen.getByRole('list', { name: '卡片列表' })).toHaveTextContent('广陵=扬州');
  });

  it('点击文件夹可展开只读初始稿预览、打开现有详情并再次点击收起', async () => {
    vi.mocked(fetch).mockImplementation(async (input) => {
      const path = String(input);
      if (path === '/api/cards/folders') return jsonResponse([folder()]);
      if (path === '/api/cards/folders/folder-1/cards') {
        return jsonResponse({ folder: folder(), cards: [card()] });
      }
      return jsonResponse(searchResult());
    });
    const user = userEvent.setup();
    renderAt('/cards?contentVersion=original');

    const openButton = await screen.findByRole('button', { name: '打开公考资料夹' });
    await user.click(openButton);

    const previewList = await screen.findByRole('list', { name: '公考资料夹中的卡片' });
    expect(within(previewList).getByText('广陵=扬州')).toBeInTheDocument();
    expect(within(previewList).queryByRole('button', { name: /归档|置顶|置底|删除/ })).not.toBeInTheDocument();
    await user.click(within(previewList).getByRole('button', { name: '查看广陵与扬州为对应关系详情' }));
    expect(screen.getByRole('dialog', { name: '卡片详情' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '关闭详情' }));

    await user.click(screen.getByRole('button', { name: '收起公考资料夹' }));
    expect(screen.queryByRole('list', { name: '公考资料夹中的卡片' })).not.toBeInTheDocument();
  });

  it('删除文件夹会明确确认且只移除文件夹并收起内容', async () => {
    const assignedFolder = folder({ cardIds: ['card-1'] });
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const path = String(input);
      if (path === '/api/cards/folders') return jsonResponse([assignedFolder]);
      if (path === '/api/cards/folders/folder-1/cards') {
        return jsonResponse({ folder: assignedFolder, cards: [card()] });
      }
      if (path === '/api/cards/folders/folder-1' && init?.method === 'DELETE') {
        return new Response(null, { status: 204 });
      }
      return jsonResponse(searchResult());
    });
    const user = userEvent.setup();
    renderAt('/cards?contentVersion=original');

    expect(await screen.findByLabelText('已加入文件夹：公考资料夹')).toBeInTheDocument();
    await user.click(await screen.findByRole('button', { name: '打开公考资料夹' }));
    await screen.findByRole('list', { name: '公考资料夹中的卡片' });
    await user.click(screen.getByRole('button', { name: '删除公考资料夹' }));

    expect(confirm).toHaveBeenCalledWith('确认删除文件夹“公考资料夹”？只删除文件夹，不会删除卡片。');
    await waitFor(() => expect(screen.queryByRole('button', { name: '打开公考资料夹' })).not.toBeInTheDocument());
    expect(screen.queryByLabelText('已加入文件夹：公考资料夹')).not.toBeInTheDocument();
    expect(screen.queryByRole('list', { name: '公考资料夹中的卡片' })).not.toBeInTheDocument();
    expect(screen.getByRole('list', { name: '卡片列表' })).toHaveTextContent('广陵=扬州');
  });

  it('可从文件夹预览移除单份初始稿并保留主卡片', async () => {
    const cards = [
      card({ rawInput: '误加的初始稿', normalizedStatement: '问题一' }),
      card({ id: 'card-2', rawInput: '误加的初始稿', normalizedStatement: '问题二' }),
    ];
    let folderLoads = 0;
    let contentLoads = 0;
    const requests: Array<{ path: string; init?: RequestInit }> = [];
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const path = String(input);
      requests.push({ path, init });
      if (path.startsWith('/api/cards?')) return jsonResponse(searchResult(cards));
      if (path === '/api/cards/folders') {
        folderLoads += 1;
        return jsonResponse([folder({
          originalCount: folderLoads > 1 ? 0 : 1,
          cardIds: folderLoads > 1 ? [] : ['card-1', 'card-2'],
        })]);
      }
      if (path === '/api/cards/folders/folder-1/cards' && init?.method === 'DELETE') {
        return jsonResponse(folder({ originalCount: 0, cardIds: [] }));
      }
      if (path === '/api/cards/folders/folder-1/cards') {
        contentLoads += 1;
        return jsonResponse({
          folder: folder({ originalCount: contentLoads > 1 ? 0 : 1 }),
          cards: contentLoads > 1 ? [] : cards,
        });
      }
      throw new Error('unexpected request: ' + path);
    });
    const user = userEvent.setup();
    renderAt('/cards?contentVersion=original');

    expect(await screen.findByLabelText('已加入文件夹：公考资料夹')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '打开公考资料夹' }));
    await user.click(await screen.findByRole('button', { name: '从公考资料夹移除问题一' }));

    const removeRequest = requests.find(({ path, init }) => (
      path === '/api/cards/folders/folder-1/cards' && init?.method === 'DELETE'
    ));
    expect(JSON.parse(String(removeRequest?.init?.body))).toEqual({ cardIds: ['card-1', 'card-2'] });
    expect(await screen.findByText('文件夹中暂无初始稿')).toBeInTheDocument();
    expect(screen.queryByLabelText('已加入文件夹：公考资料夹')).not.toBeInTheDocument();
    expect(screen.getByRole('list', { name: '卡片列表' })).toHaveTextContent('误加的初始稿');
  });

  it('拖入文件夹提交当前初始稿整组编号并仅刷新文件夹数据', async () => {
    const rawInput = '同一份原始资料';
    const cards = [
      card({ rawInput, normalizedStatement: '第一道衍生问题' }),
      card({ id: 'card-2', rawInput, normalizedStatement: '第二道衍生问题' }),
    ];
    let folderListLoads = 0;
    let folderContentLoads = 0;
    let cardListLoads = 0;
    const requests: Array<{ path: string; init?: RequestInit }> = [];
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const path = String(input);
      requests.push({ path, init });
      if (path.startsWith('/api/cards?')) {
        cardListLoads += 1;
        return jsonResponse(searchResult(cards));
      }
      if (path === '/api/cards/folders') {
        folderListLoads += 1;
        return jsonResponse([folder({ originalCount: folderListLoads > 1 ? 2 : 1 })]);
      }
      if (path === '/api/cards/folders/folder-1/cards' && init?.method === 'POST') {
        return jsonResponse({ folder: folder({ originalCount: 2 }), cards });
      }
      if (path === '/api/cards/folders/folder-1/cards') {
        folderContentLoads += 1;
        return jsonResponse({ folder: folder(), cards: folderContentLoads > 1 ? cards : [] });
      }
      throw new Error('unexpected request: ' + path);
    });
    const user = userEvent.setup();
    renderAt('/cards?contentVersion=original');

    const folderButton = await screen.findByRole('button', { name: '打开公考资料夹' });
    await user.click(folderButton);
    await screen.findByText('文件夹中暂无初始稿');
    const mainList = screen.getByRole('list', { name: '卡片列表' });
    const mainCard = within(mainList).getByRole('listitem');
    expect(mainCard).toHaveAttribute('draggable', 'true');
    const transfer = new Map<string, string>();
    const dataTransfer = {
      dropEffect: 'none',
      effectAllowed: 'none',
      getData: vi.fn((type: string) => transfer.get(type) ?? ''),
      setData: vi.fn((type: string, value: string) => transfer.set(type, value)),
    } as unknown as DataTransfer;

    fireEvent.dragStart(mainCard, { dataTransfer });
    fireEvent.dragOver(folderButton, { dataTransfer });
    fireEvent.drop(folderButton, { dataTransfer });

    await waitFor(() => expect(requests.some(({ path, init }) => (
      path === '/api/cards/folders/folder-1/cards' && init?.method === 'POST'
    ))).toBe(true));
    const addRequest = requests.find(({ path, init }) => (
      path === '/api/cards/folders/folder-1/cards' && init?.method === 'POST'
    ));
    expect(JSON.parse(String(addRequest?.init?.body))).toEqual({ cardIds: ['card-1', 'card-2'] });
    await waitFor(() => {
      expect(folderListLoads).toBe(2);
      expect(folderContentLoads).toBe(2);
    });
    expect(cardListLoads).toBe(1);
    expect(within(mainList).getByText(rawInput)).toBeInTheDocument();
  });

  it('每份用户初始稿可通过键盘选择文件夹并提交整组编号', async () => {
    const rawInput = '同一份原始资料';
    const cards = [
      card({ rawInput, normalizedStatement: '第一道衍生问题' }),
      card({ id: 'card-2', rawInput, normalizedStatement: '第二道衍生问题' }),
    ];
    let folderLoads = 0;
    const requests: Array<{ path: string; init?: RequestInit }> = [];
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const path = String(input);
      requests.push({ path, init });
      if (path.startsWith('/api/cards?')) return jsonResponse(searchResult(cards));
      if (path === '/api/cards/folders') {
        folderLoads += 1;
        return jsonResponse([folder({ cardIds: folderLoads > 1 ? ['card-2'] : [] })]);
      }
      if (path === '/api/cards/folders/folder-1/cards' && init?.method === 'POST') {
        return jsonResponse({ folder: folder(), cards });
      }
      throw new Error('unexpected request: ' + path);
    });
    const user = userEvent.setup();
    renderAt('/cards?contentVersion=original');

    const picker = await screen.findByRole('combobox', { name: '将第一道衍生问题加入文件夹' });
    await user.selectOptions(picker, 'folder-1');

    await waitFor(() => expect(requests.some(({ path, init }) => (
      path === '/api/cards/folders/folder-1/cards' && init?.method === 'POST'
    ))).toBe(true));
    const addRequest = requests.find(({ path, init }) => (
      path === '/api/cards/folders/folder-1/cards' && init?.method === 'POST'
    ));
    expect(JSON.parse(String(addRequest?.init?.body))).toEqual({ cardIds: ['card-1', 'card-2'] });
    expect(await screen.findByLabelText('已加入文件夹：公考资料夹')).toBeInTheDocument();
    expect(screen.getByRole('list', { name: '卡片列表' })).toHaveTextContent(rawInput);
  });

  it('加入请求期间切换文件夹后旧文件夹刷新不得覆盖当前内容', async () => {
    const firstFolder = folder();
    const secondFolder = folder({ id: 'folder-2', name: '申论素材' });
    const firstInitialCard = card({ id: 'first-initial', rawInput: '旧文件夹初始内容' });
    const firstRefreshedCard = card({ id: 'first-refreshed', rawInput: '不应显示的旧文件夹刷新内容' });
    const secondCard = card({ id: 'second-card', rawInput: '当前文件夹内容' });
    let firstFolderLoads = 0;
    let resolveAdd: ((response: Response) => void) | undefined;
    const fetchMock = vi.mocked(fetch).mockImplementation(async (input, init) => {
      const path = String(input);
      if (path.startsWith('/api/cards?')) return jsonResponse(searchResult());
      if (path === '/api/cards/folders') return jsonResponse([firstFolder, secondFolder]);
      if (path === '/api/cards/folders/folder-1/cards' && init?.method === 'POST') {
        return new Promise<Response>((resolve) => { resolveAdd = resolve; });
      }
      if (path === '/api/cards/folders/folder-1/cards') {
        firstFolderLoads += 1;
        return jsonResponse({
          folder: firstFolder,
          cards: [firstFolderLoads === 1 ? firstInitialCard : firstRefreshedCard],
        });
      }
      if (path === '/api/cards/folders/folder-2/cards') {
        return jsonResponse({ folder: secondFolder, cards: [secondCard] });
      }
      throw new Error('unexpected request: ' + path);
    });
    const user = userEvent.setup();
    renderAt('/cards?contentVersion=original');

    await user.click(await screen.findByRole('button', { name: '打开公考资料夹' }));
    await screen.findByText('旧文件夹初始内容');
    const picker = screen.getByRole('combobox', { name: '将广陵与扬州为对应关系加入文件夹' });
    await user.selectOptions(picker, 'folder-1');
    await waitFor(() => expect(resolveAdd).toBeTypeOf('function'));

    await user.click(screen.getByRole('button', { name: '打开申论素材' }));
    expect(await screen.findByRole('list', { name: '申论素材中的卡片' })).toHaveTextContent('当前文件夹内容');

    await act(async () => resolveAdd?.(jsonResponse(firstFolder)));
    await waitFor(() => expect(picker).not.toBeDisabled());

    const activeList = screen.getByRole('list', { name: '申论素材中的卡片' });
    expect(activeList).toHaveTextContent('当前文件夹内容');
    expect(activeList).not.toHaveTextContent('不应显示的旧文件夹刷新内容');
    expect(fetchMock.mock.calls.filter(([path, init]) => (
      path === '/api/cards/folders/folder-1/cards' && init?.method !== 'POST'
    ))).toHaveLength(1);
    expect(fetchMock.mock.calls.filter(([path, init]) => (
      path === '/api/cards/folders/folder-2/cards' && init?.method !== 'POST'
    ))).toHaveLength(2);
  });

  it('文件夹列表失败时单独提示且不清空主卡片', async () => {
    vi.mocked(fetch).mockImplementation(async (input) => {
      const path = String(input);
      if (path === '/api/cards/folders') {
        return jsonResponse({ code: 'internal_error', message: '请求处理失败' }, 500);
      }
      return jsonResponse(searchResult());
    });
    renderAt('/cards?contentVersion=original');

    expect(await screen.findByRole('alert')).toHaveTextContent('文件夹加载失败，请稍后重试');
    expect(screen.getByRole('list', { name: '卡片列表' })).toHaveTextContent('广陵=扬州');
  });
});

describe('卡片库表格和管理操作', () => {
  it('页头导出原始内容会下载全量原始稿文件且不改变筛选和已选卡片', async () => {
    const createObjectURL = vi.fn(() => 'blob:export');
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectURL });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeObjectURL });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    const requests: string[] = [];
    const fetchMock = vi.mocked(fetch).mockImplementation(async (input) => {
      const path = String(input);
      requests.push(path);
      if (path === '/api/cards/export') return blobResponse();
      return jsonResponse({ items: [card()], total: 60, page: 2, pageSize: 50 });
    });
    const user = userEvent.setup();
    renderAt('/cards?query=广陵&archived=true&page=2&pageSize=50');

    const checkbox = await screen.findByRole('checkbox', { name: '选择广陵与扬州为对应关系' });
    await user.click(checkbox);
    await user.click(screen.getByRole('button', { name: '导出原始内容' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(requests[1]).toBe('/api/cards/export');
    const currentParams = new URLSearchParams(window.location.search);
    expect(currentParams.get('query')).toBe('广陵');
    expect(currentParams.get('page')).toBe('2');
    expect(checkbox).toBeChecked();
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    const exportedBlob = (createObjectURL.mock.calls[0] as unknown[] | undefined)?.[0];
    expect(Reflect.get(exportedBlob ?? {}, 'size')).toBe(4);
    expect(click).toHaveBeenCalledTimes(1);
    expect(click.mock.instances[0]).toHaveAttribute(
      'download',
      expect.stringMatching(/^gongkao-original-content-\d{8}-\d{6}\.xlsx$/),
    );
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:export');
  });

  it('导出原始内容失败时保留列表并显示稳定提示', async () => {
    vi.mocked(fetch).mockImplementation(async (input) => {
      const path = String(input);
      if (path === '/api/cards/export') {
        return jsonResponse({ code: 'internal_error', message: '请求处理失败' }, 500);
      }
      return jsonResponse(searchResult());
    });
    const user = userEvent.setup();
    renderAt('/cards');

    expect(await screen.findByText('广陵与扬州为对应关系')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '导出原始内容' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('导出失败，请稍后重试');
    expect(screen.getByText('广陵与扬州为对应关系')).toBeInTheDocument();
  });

  it('用语义化小卡片列表呈现状态、元数据和管理操作', async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse(searchResult([card({ aiStatus: 'needs_input' }), card({ id: 'card-2', normalizedStatement: '待整理卡片', aiStatus: 'pending' })])),
    );
    renderAt('/cards');

    const list = await screen.findByRole('list', { name: '卡片列表' });
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(within(items[0]).getByRole('heading', { name: '广陵与扬州为对应关系' })).toBeInTheDocument();
    expect(within(list).getByText('待完善')).toBeInTheDocument();
    expect(within(list).getByText('待整理')).toBeInTheDocument();
    expect(within(list).getAllByLabelText('不会标注 2 次')).toHaveLength(2);
    expect(within(items[0]).getByText('常识判断')).toBeInTheDocument();
    expect(within(items[0]).getByRole('button', { name: '查看广陵与扬州为对应关系详情' })).toBeInTheDocument();
    expect(within(items[0]).getByRole('link', { name: '编辑广陵与扬州为对应关系' })).toBeInTheDocument();
  });

  it('卡片网格、筛选、批量栏与分页使用白色玻璃层级', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(searchResult()));
    const user = userEvent.setup();
    renderAt('/cards');

    const list = await screen.findByRole('list', { name: '卡片列表' });
    expect(screen.getByLabelText('卡片筛选')).toHaveClass('liquid-glass', 'liquid-glass--regular');
    expect(screen.getByRole('group', { name: '内容版本' })).toHaveClass('liquid-glass', 'liquid-glass--thin');
    expect(within(list).getByRole('listitem')).toHaveClass('liquid-glass', 'liquid-glass--regular');
    expect(screen.getByLabelText('卡片分页')).toHaveClass('liquid-glass', 'liquid-glass--thin');
    expect(screen.getByRole('button', { name: '导出原始内容' })).toHaveClass('liquid-pressable');
    expect(screen.getByRole('button', { name: '上一页' })).toHaveClass('liquid-pressable');

    const cardCheckbox = screen.getByRole('checkbox', { name: '选择广陵与扬州为对应关系' });
    expect(cardCheckbox.closest('label')).toHaveClass('cards-card__select', 'liquid-pressable');
    await user.click(cardCheckbox);
    expect(screen.getByLabelText('批量操作')).toHaveClass('liquid-glass', 'liquid-glass--regular');
    expect(screen.getByRole('button', { name: '批量归档' })).toHaveClass('liquid-pressable');
  });

  it('卡片详情逐题展示 AI 优化后的问题和对应答案', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(searchResult()));
    const user = userEvent.setup();
    renderAt('/cards');

    await user.click(await screen.findByRole('button', { name: '查看广陵与扬州为对应关系详情' }));

    const quizRegion = screen.getByRole('region', { name: 'AI 优化题目与答案' });
    const quizItem = within(quizRegion).getByRole('listitem');
    expect(within(quizItem).getByText('广陵对应哪里？')).toBeInTheDocument();
    expect(within(quizItem).getByText('扬州')).toBeInTheDocument();
    expect(screen.getByText('广陵=扬州')).toBeInTheDocument();
  });

  it('内容版本切换时由服务端按对应口径分页，用户初始稿每页稳定显示 20 份', async () => {
    const optimizedItems = Array.from({ length: 20 }, (_, index) => card({
      id: `optimized-${index + 1}`,
      normalizedStatement: `AI 优化题目 ${index + 1}`,
    }));
    const originalItems = Array.from({ length: 20 }, (_, index) => {
      const number = index + 1;
      const rawInput = `用户初始稿 ${number}`;
      const rawContentJson = JSON.stringify({
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: rawInput }] }],
      });
      const first = card({
        id: `original-${number}-1`,
        rawInput,
        rawContentJson,
        normalizedStatement: `初始稿 ${number} 的第一道问题`,
      });
      return index === 0
        ? [first, card({
          id: `original-${number}-2`,
          rawInput,
          rawContentJson,
          normalizedStatement: `初始稿 ${number} 的第二道问题`,
        })]
        : [first];
    }).flat();
    const fetchMock = vi.mocked(fetch).mockImplementation(async (input) => {
      if (String(input) === '/api/cards/folders') return jsonResponse([]);
      const request = new URL(String(input), 'http://localhost');
      return request.searchParams.get('contentVersion') === 'original'
        ? jsonResponse({ items: originalItems, total: 42, page: 1, pageSize: 20 })
        : jsonResponse({ items: optimizedItems, total: 58, page: 2, pageSize: 20 });
    });
    const user = userEvent.setup();
    renderAt('/cards?page=2&pageSize=20');

    let list = await screen.findByRole('list', { name: '卡片列表' });
    const optimizedButton = screen.getByRole('button', { name: 'AI 优化稿' });
    const originalButton = screen.getByRole('button', { name: '用户初始稿' });
    expect(optimizedButton).toHaveAttribute('aria-pressed', 'true');
    expect(originalButton).toHaveAttribute('aria-pressed', 'false');
    expect(within(list).getAllByRole('listitem')).toHaveLength(20);
    expect(within(list).getByText('AI 优化题目 1')).toBeInTheDocument();
    expect(screen.getByText('共 58 张')).toBeInTheDocument();

    await user.click(originalButton);

    await waitFor(() => expect(new URLSearchParams(window.location.search).get('page')).toBe('1'));
    await screen.findByText('当前页 20 份初始稿 · 共 42 份');
    list = screen.getByRole('list', { name: '卡片列表' });
    expect(optimizedButton).toHaveAttribute('aria-pressed', 'false');
    expect(originalButton).toHaveAttribute('aria-pressed', 'true');
    expect(within(list).getAllByRole('listitem')).toHaveLength(20);
    expect(within(list).getByText('用户初始稿 1')).toBeInTheDocument();
    expect(within(list).getByText('衍生 2 个问题')).toBeInTheDocument();
    expect(screen.getByText('当前页 20 份初始稿 · 共 42 份')).toBeInTheDocument();
    expect(screen.getByText('第 1 / 3 页')).toBeInTheDocument();
    const cardRequests = fetchMock.mock.calls.filter(([input]) => String(input).startsWith('/api/cards?'));
    expect(cardRequests).toHaveLength(2);

    const optimizedRequest = new URL(String(cardRequests[0]?.[0]), 'http://localhost');
    const originalRequest = new URL(String(cardRequests[1]?.[0]), 'http://localhost');
    expect(Object.fromEntries(optimizedRequest.searchParams)).toMatchObject({
      contentVersion: 'optimized',
      page: '2',
      pageSize: '20',
    });
    expect(Object.fromEntries(originalRequest.searchParams)).toMatchObject({
      contentVersion: 'original',
      page: '1',
      pageSize: '20',
    });
  });

  it('用户初始稿按原始内容合并衍生问题', async () => {
    const rawInput = '同一份原始资料：增长率为 3/5';
    const rawContentJson = JSON.stringify({
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: rawInput }] }],
    });
    const first = card({
      rawInput,
      rawContentJson,
      normalizedStatement: '第一道衍生问题',
      quizItems: [{ id: 'quiz-1', direction: 'single', question: '第一题？', answer: '答案一', dueAt: '2026-07-20T00:00:00.000Z' }],
    });
    const second = card({
      id: 'card-2',
      rawInput,
      rawContentJson,
      normalizedStatement: '第二道衍生问题',
      quizItems: [{ id: 'quiz-2', direction: 'single', question: '第二题？', answer: '答案二', dueAt: '2026-07-21T00:00:00.000Z' }],
    });
    vi.mocked(fetch).mockImplementation(async (input) => {
      if (String(input) === '/api/cards/folders') return jsonResponse([]);
      const request = new URL(String(input), 'http://localhost');
      return request.searchParams.get('contentVersion') === 'original'
        ? jsonResponse({ items: [first, second], total: 1, page: 1, pageSize: 20 })
        : jsonResponse(searchResult([first, second]));
    });
    const user = userEvent.setup();
    renderAt('/cards');

    let list = await screen.findByRole('list', { name: '卡片列表' });
    await user.click(screen.getByRole('button', { name: '用户初始稿' }));

    await screen.findByText('当前页 1 份初始稿 · 共 1 份');
    list = screen.getByRole('list', { name: '卡片列表' });
    expect(within(list).getAllByText(rawInput)).toHaveLength(1);
    expect(screen.getByText('当前页 1 份初始稿 · 共 1 份')).toBeInTheDocument();
    expect(within(list).getByText('衍生 2 个问题')).toBeInTheDocument();
    expect(within(list).queryByRole('button', { name: '彻底删除第一道衍生问题' })).not.toBeInTheDocument();
    expect(within(list).getByRole('link', { name: '编辑初始稿第一道衍生问题' })).toHaveAttribute(
      'href',
      '/entry?editOriginal=card-1',
    );

    await user.click(within(list).getByRole('button', { name: '查看第一道衍生问题详情' }));
    expect(screen.getByText('同一初始稿衍生 2 个问题')).toBeInTheDocument();
    expect(screen.getByText('第二道衍生问题')).toBeInTheDocument();
    const quizItems = within(screen.getByRole('region', { name: 'AI 优化题目与答案' })).getAllByRole('listitem');
    expect(quizItems).toHaveLength(2);
    expect(within(quizItems[0]).getByText('第一题？')).toBeInTheDocument();
    expect(within(quizItems[0]).getByText('答案一')).toBeInTheDocument();
    expect(within(quizItems[1]).getByText('第二题？')).toBeInTheDocument();
    expect(within(quizItems[1]).getByText('答案二')).toBeInTheDocument();
  });

  it('AI 优化稿可单卡置顶或置底，并提供明确的图标按钮名称', async () => {
    const requests: Array<{ path: string; init?: RequestInit }> = [];
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const path = String(input);
      requests.push({ path, init });
      if (path === '/api/cards/bulk') return jsonResponse({ updated: 1 });
      return jsonResponse(searchResult());
    });
    const user = userEvent.setup();
    renderAt('/cards');

    const topButton = await screen.findByRole('button', { name: '置顶广陵与扬州为对应关系' });
    const bottomButton = screen.getByRole('button', { name: '置底广陵与扬州为对应关系' });
    expect(topButton).toHaveAttribute('title', '置顶广陵与扬州为对应关系');
    expect(bottomButton).toHaveAttribute('title', '置底广陵与扬州为对应关系');
    expect(topButton).toHaveClass('liquid-pressable');

    await user.click(topButton);
    await waitFor(() => expect(requests.filter(({ path }) => path === '/api/cards/bulk')).toHaveLength(1));
    expect(JSON.parse(String(requests.find(({ path }) => path === '/api/cards/bulk')?.init?.body))).toEqual({
      ids: ['card-1'],
      position: 'top',
    });

    await user.click(await screen.findByRole('button', { name: '置底广陵与扬州为对应关系' }));
    await waitFor(() => expect(requests.filter(({ path }) => path === '/api/cards/bulk')).toHaveLength(2));
    expect(JSON.parse(String(requests.filter(({ path }) => path === '/api/cards/bulk')[1]?.init?.body))).toEqual({
      ids: ['card-1'],
      position: 'bottom',
    });
  });

  it('用户初始稿置顶时一次提交同组全部衍生卡片', async () => {
    const rawInput = '同一份原始资料';
    const first = card({ rawInput, normalizedStatement: '第一道衍生问题' });
    const second = card({ id: 'card-2', rawInput, normalizedStatement: '第二道衍生问题' });
    const requests: Array<{ path: string; init?: RequestInit }> = [];
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const path = String(input);
      requests.push({ path, init });
      if (path === '/api/cards/bulk') return jsonResponse({ updated: 2 });
      if (path === '/api/cards/folders') return jsonResponse([]);
      const request = new URL(path, 'http://localhost');
      return request.searchParams.get('contentVersion') === 'original'
        ? jsonResponse(searchResult([first, second]))
        : jsonResponse(searchResult([first, second]));
    });
    const user = userEvent.setup();
    renderAt('/cards');

    await user.click(await screen.findByRole('button', { name: '用户初始稿' }));
    await user.click(await screen.findByRole('button', { name: '置顶第一道衍生问题' }));

    await waitFor(() => expect(requests.filter(({ path }) => path === '/api/cards/bulk')).toHaveLength(1));
    expect(JSON.parse(String(requests.find(({ path }) => path === '/api/cards/bulk')?.init?.body))).toEqual({
      ids: ['card-1', 'card-2'],
      position: 'top',
    });
  });

  it('已归档列表仍可置顶卡片', async () => {
    const requests: Array<{ path: string; init?: RequestInit }> = [];
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const path = String(input);
      requests.push({ path, init });
      if (path === '/api/cards/bulk') return jsonResponse({ updated: 1 });
      return jsonResponse(searchResult([card({ archived: true })]));
    });
    const user = userEvent.setup();
    renderAt('/cards?archived=true');

    await user.click(await screen.findByRole('button', { name: '置顶广陵与扬州为对应关系' }));

    await waitFor(() => expect(requests.filter(({ path }) => path === '/api/cards/bulk')).toHaveLength(1));
    expect(JSON.parse(String(requests.find(({ path }) => path === '/api/cards/bulk')?.init?.body))).toEqual({
      ids: ['card-1'],
      position: 'top',
    });
  });

  it('未归档视图不提供彻底删除入口', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(searchResult()));
    renderAt('/cards');

    await screen.findByText('广陵与扬州为对应关系');
    expect(screen.queryByRole('button', { name: /彻底删除/ })).not.toBeInTheDocument();
  });

  it('已归档 AI 优化稿可彻底删除单卡并刷新列表', async () => {
    let items = [card({ archived: true })];
    const fetchMock = vi.mocked(fetch).mockImplementation(async (input, init) => {
      if (init?.method === 'DELETE') {
        items = [];
        return new Response(null, { status: 204 });
      }
      return jsonResponse(searchResult(items));
    });
    const user = userEvent.setup();
    renderAt('/cards?archived=true');

    const deleteButton = await screen.findByRole('button', { name: '彻底删除广陵与扬州为对应关系' });
    expect(deleteButton).toHaveAttribute('title', '彻底删除广陵与扬州为对应关系');
    await user.click(deleteButton);

    expect(confirm).toHaveBeenCalledWith('确认彻底删除“广陵与扬州为对应关系”？此操作不可撤销。');
    await waitFor(() => expect(fetchMock.mock.calls.some(([path, init]) => path === '/api/cards/card-1' && init?.method === 'DELETE')).toBe(true));
    await waitFor(() => expect(screen.queryByText('广陵与扬州为对应关系')).not.toBeInTheDocument());
  });

  it('已归档用户初始稿彻底删除同组全部衍生卡片', async () => {
    const rawInput = '同一份原始资料';
    const first = card({ archived: true, rawInput, normalizedStatement: '第一道衍生问题' });
    const second = card({ id: 'card-2', archived: true, rawInput, normalizedStatement: '第二道衍生问题' });
    const requests: Array<{ path: string; init?: RequestInit }> = [];
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const path = String(input);
      requests.push({ path, init });
      if (path === '/api/cards/folders') return jsonResponse([]);
      if (init?.method === 'DELETE') return new Response(null, { status: 204 });
      return jsonResponse(searchResult([first, second]));
    });
    const user = userEvent.setup();
    renderAt('/cards?archived=true&contentVersion=original');

    await user.click(await screen.findByRole('button', { name: '彻底删除第一道衍生问题' }));

    expect(confirm).toHaveBeenCalledWith('确认彻底删除“第一道衍生问题”（连同 1 张衍生卡片）？此操作不可撤销。');
    await waitFor(() => expect(requests.filter(({ path, init }) => path.startsWith('/api/cards/') && init?.method === 'DELETE').map(({ path }) => path)).toEqual([
      '/api/cards/card-1',
      '/api/cards/card-2',
    ]));
  });

  it('取消彻底删除不会请求接口', async () => {
    const fetchMock = vi.mocked(fetch).mockResolvedValue(jsonResponse(searchResult([card({ archived: true })])));
    vi.mocked(confirm).mockReturnValueOnce(false);
    const user = userEvent.setup();
    renderAt('/cards?archived=true');

    await user.click(await screen.findByRole('button', { name: '彻底删除广陵与扬州为对应关系' }));

    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'DELETE')).toBe(false);
    expect(screen.getByText('广陵与扬州为对应关系')).toBeInTheDocument();
  });

  it('彻底删除失败时保留列表并显示现有操作失败提示', async () => {
    const fetchMock = vi.mocked(fetch).mockImplementation(async (_input, init) => (
      init?.method === 'DELETE'
        ? jsonResponse({ error: 'failed' }, 500)
        : jsonResponse(searchResult([card({ archived: true })]))
    ));
    const user = userEvent.setup();
    renderAt('/cards?archived=true');

    await user.click(await screen.findByRole('button', { name: '彻底删除广陵与扬州为对应关系' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('操作失败，请稍后重试');
    expect(screen.getByText('广陵与扬州为对应关系')).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'DELETE')).toBe(true);
  });

  it('置底失败时保留当前列表并显示现有操作失败提示', async () => {
    const fetchMock = vi.mocked(fetch).mockImplementation(async (input) => {
      if (String(input) === '/api/cards/bulk') return jsonResponse({ error: 'failed' }, 500);
      return jsonResponse(searchResult());
    });
    const user = userEvent.setup();
    renderAt('/cards');

    await user.click(await screen.findByRole('button', { name: '置底广陵与扬州为对应关系' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('操作失败，请稍后重试');
    expect(screen.getByText('广陵与扬州为对应关系')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('用户初始稿为空时显示中性占位且保留稳定操作名称', async () => {
    vi.mocked(fetch).mockImplementation(async (input) => (
      String(input) === '/api/cards/folders'
        ? jsonResponse([])
        : jsonResponse(searchResult([card({ rawInput: '', rawContentJson: '' })]))
    ));
    const user = userEvent.setup();
    renderAt('/cards');

    let list = await screen.findByRole('list', { name: '卡片列表' });
    await user.click(screen.getByRole('button', { name: '用户初始稿' }));

    await screen.findByText('未填写原始内容');
    list = screen.getByRole('list', { name: '卡片列表' });
    expect(within(list).getByText('未填写原始内容')).toBeInTheDocument();
    expect(within(list).getByRole('button', { name: '查看广陵与扬州为对应关系详情' })).toBeInTheDocument();
  });

  it('待整理和待完善卡片可从卡片库触发 AI 修复并刷新列表', async () => {
    const requests: Array<{ path: string; init?: RequestInit }> = [];
    const pending = card({
      aiStatus: 'pending',
      normalizedStatement: '',
      quizItems: [],
    });
    const ready = card({
      normalizedStatement: '修复后的知识点',
      aiStatus: 'ready',
    });
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const path = String(input);
      requests.push({ path, init });
      if (path === '/api/cards/card-1/retry-ai') return jsonResponse(ready);
      return jsonResponse(searchResult(requests.some((request) => request.path === '/api/cards/card-1/retry-ai') ? [ready] : [pending]));
    });
    const user = userEvent.setup();
    renderAt('/cards');

    expect(await screen.findByText('待生成知识点')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'AI 修复待生成知识点' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'AI 修复待生成知识点' }));

    await waitFor(() => expect(screen.getByText('修复后的知识点')).toBeInTheDocument());
    expect(requests.some(({ path, init }) => path === '/api/cards/card-1/retry-ai' && init?.method === 'POST')).toBe(true);
    expect(JSON.parse(String(requests.find(({ path }) => path === '/api/cards/card-1/retry-ai')?.init?.body))).toEqual({});
    expect(screen.queryByRole('button', { name: 'AI 修复修复后的知识点' })).not.toBeInTheDocument();
  });

  it('AI 修复按钮只显示在待整理和待完善卡片上', async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse(searchResult([
        card({ id: 'pending-card', normalizedStatement: '待整理卡片', aiStatus: 'pending' }),
        card({ id: 'needs-card', normalizedStatement: '待完善卡片', aiStatus: 'needs_input' }),
        card({ id: 'processing-card', normalizedStatement: '整理中卡片', aiStatus: 'processing' }),
        card({ id: 'ready-card', normalizedStatement: '已整理卡片', aiStatus: 'ready' }),
      ])),
    );
    renderAt('/cards');

    expect(await screen.findByRole('button', { name: 'AI 修复待整理卡片' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'AI 修复待完善卡片' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'AI 修复整理中卡片' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'AI 修复已整理卡片' })).not.toBeInTheDocument();
  });

  it('规范知识为空时 AI 优化稿使用中性占位且用户初始稿可见', async () => {
    const rawInput = '用户直接输入的唯一原文';
    vi.mocked(fetch).mockImplementation(async (input) => (
      String(input) === '/api/cards/folders'
        ? jsonResponse([])
        : jsonResponse(searchResult([card({ aiStatus: 'pending', normalizedStatement: '', rawContentJson: '', rawInput })]))
    ));
    const user = userEvent.setup();
    renderAt('/cards');

    let list = await screen.findByRole('list', { name: '卡片列表' });
    expect(within(list).getByText('待生成知识点')).toBeInTheDocument();
    expect(within(list).queryByText(rawInput)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '用户初始稿' }));

    await screen.findByText(rawInput);
    list = screen.getByRole('list', { name: '卡片列表' });
    expect(within(list).getByText(rawInput)).toBeInTheDocument();
    expect(within(list).queryByRole('checkbox', { name: new RegExp(rawInput) })).not.toBeInTheDocument();
    expect(within(list).queryByRole('button', { name: new RegExp(rawInput) })).not.toBeInTheDocument();
    expect(within(list).queryByRole('link', { name: new RegExp(rawInput) })).not.toBeInTheDocument();

    await user.click(within(list).getByRole('button', { name: '查看待生成知识点详情' }));
    expect(screen.getByRole('dialog', { name: '卡片详情' })).toHaveTextContent(rawInput);
  });

  it('用户初始稿预览保留红色与加粗格式', async () => {
    const rawInput = '资料分析重点分数 3/5';
    const rawContentJson = JSON.stringify({
      type: 'doc',
      content: [{
        type: 'paragraph',
        content: [{
          type: 'text',
          text: rawInput,
          marks: [
            { type: 'bold' },
            { type: 'textStyle', attrs: { color: '#c64232' } },
          ],
        }],
      }],
    });
    vi.mocked(fetch).mockImplementation(async (input) => (
      String(input) === '/api/cards/folders'
        ? jsonResponse([])
        : jsonResponse(searchResult([card({ rawContentJson, rawInput })]))
    ));
    const user = userEvent.setup();
    renderAt('/cards');

    let list = await screen.findByRole('list', { name: '卡片列表' });
    await user.click(screen.getByRole('button', { name: '用户初始稿' }));

    await screen.findByText(rawInput);
    list = screen.getByRole('list', { name: '卡片列表' });
    const markedText = within(list).getByText(rawInput);
    expect(markedText).toHaveStyle({ color: '#c64232' });
    expect(markedText.closest('strong')).not.toBeNull();
  });
  it('选中后按当前归档视图提供批量归档或恢复，成功刷新并清空选择', async () => {
    const requests: Array<{ path: string; init?: RequestInit }> = [];
    const fetchMock = vi.mocked(fetch).mockImplementation(async (input, init) => {
      const path = String(input);
      requests.push({ path, init });
      if (path.startsWith('/api/cards?')) return jsonResponse(searchResult());
      return jsonResponse({ updated: 1 });
    });
    const user = userEvent.setup();
    renderAt('/cards');
    const checkbox = await screen.findByRole('checkbox', { name: '选择广陵与扬州为对应关系' });
    expect(screen.queryByRole('button', { name: '批量归档' })).not.toBeInTheDocument();

    await user.click(checkbox);
    expect(screen.queryByLabelText('批量星级')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '批量加星' })).not.toBeInTheDocument();
    const bulkTags = screen.getByLabelText('批量标签');
    expect(bulkTags.closest('label')).toHaveClass('cards-bulk__tags');
    await user.type(bulkTags, ' 高频，冲刺 ');
    await user.click(screen.getByRole('button', { name: '批量添加标签' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    expect(JSON.parse(String(requests[1]?.init?.body))).toEqual({ ids: ['card-1'], tags: ['高频', '冲刺'] });
    expect(checkbox).not.toBeChecked();

    await user.click(checkbox);
    await user.click(screen.getByRole('button', { name: '批量归档' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(5));
    expect(JSON.parse(String(requests[3]?.init?.body))).toEqual({ ids: ['card-1'], archived: true });

    cleanup();
    requests.length = 0;
    fetchMock.mockClear();
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const path = String(input);
      requests.push({ path, init });
      if (path.startsWith('/api/cards?')) return jsonResponse(searchResult([card({ archived: true })]));
      return jsonResponse({ updated: 1 });
    });
    renderAt('/cards?archived=true');

    await user.click(await screen.findByRole('checkbox', { name: '选择广陵与扬州为对应关系' }));
    await user.click(screen.getByRole('button', { name: '批量恢复归档' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    expect(JSON.parse(String(requests[1]?.init?.body))).toEqual({ ids: ['card-1'], archived: false });
  });

  it('筛选请求开始后立即清空旧选择，请求失败也不能批量提交旧编号', async () => {
    let rejectFilter: ((reason: Error) => void) | undefined;
    const fetchMock = vi
      .mocked(fetch)
      .mockResolvedValueOnce(jsonResponse(searchResult()))
      .mockImplementation(() => new Promise<Response>((_resolve, reject) => { rejectFilter = reject; }));
    const user = userEvent.setup();
    renderAt('/cards');

    await user.click(await screen.findByRole('checkbox', { name: '选择广陵与扬州为对应关系' }));
    expect(screen.getByRole('button', { name: '批量归档' })).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('AI 状态筛选'), 'pending');
    expect(screen.queryByRole('button', { name: '批量归档' })).not.toBeInTheDocument();

    await act(async () => rejectFilter?.(new Error('filter failed')));
    expect(await screen.findByRole('alert')).toHaveTextContent('卡片加载失败，请稍后重试');
    expect(screen.queryByRole('button', { name: '批量归档' })).not.toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([path]) => path === '/api/cards/bulk')).toBe(false);
  });

  it('单卡归档后默认移除且分页写回 URL', async () => {
    let items = [card()];
    const fetchMock = vi.mocked(fetch).mockImplementation(async (input, init) => {
      const path = String(input);
      if (init?.method === 'PATCH') {
        items = [];
        return jsonResponse(card({ archived: true }));
      }
      return jsonResponse({ items, total: 41, page: 1, pageSize: 20 });
    });
    const user = userEvent.setup();
    renderAt('/cards');
    await user.click(await screen.findByRole('button', { name: '归档广陵与扬州为对应关系' }));
    await waitFor(() => expect(screen.queryByText('广陵与扬州为对应关系')).not.toBeInTheDocument());

    items = [card()];
    await user.click(screen.getByRole('button', { name: '重新加载' }));
    await screen.findByText('广陵与扬州为对应关系');
    const nextPage = screen.getByRole('button', { name: '下一页' });
    await waitFor(() => expect(nextPage).not.toBeDisabled());
    await user.click(nextPage);
    expect(new URLSearchParams(window.location.search).get('page')).toBe('2');
  });

  it('单卡归档后可立即撤销，已归档视图可恢复归档', async () => {
    let items = [card()];
    const requests: Array<{ path: string; init?: RequestInit }> = [];
    const fetchMock = vi.mocked(fetch).mockImplementation(async (input, init) => {
      const path = String(input);
      requests.push({ path, init });
      if (init?.method === 'PATCH' && path === '/api/cards/card-1') {
        const archived = JSON.parse(String(init.body)).archived as boolean;
        items = archived ? [] : [card()];
        return jsonResponse(card({ archived }));
      }
      if (init?.method === 'PATCH' && path === '/api/cards/bulk') {
        items = [card()];
        return jsonResponse({ updated: 1 });
      }
      return jsonResponse(searchResult(items));
    });
    const user = userEvent.setup();
    renderAt('/cards');

    await user.click(await screen.findByRole('button', { name: '归档广陵与扬州为对应关系' }));
    expect(await screen.findByText('已归档 1 张卡片')).toBeInTheDocument();
    expect(JSON.parse(String(requests.find(({ path, init }) => path === '/api/cards/card-1' && init?.method === 'PATCH')?.init?.body))).toEqual({ archived: true });

    await user.click(screen.getByRole('button', { name: '撤销归档' }));
    await screen.findByText('广陵与扬州为对应关系');
    expect(JSON.parse(String(requests.find(({ path, init }) => path === '/api/cards/bulk' && init?.method === 'PATCH')?.init?.body))).toEqual({ ids: ['card-1'], archived: false });

    cleanup();
    requests.length = 0;
    fetchMock.mockClear();
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const path = String(input);
      requests.push({ path, init });
      if (init?.method === 'PATCH') {
        items = [];
        return jsonResponse(card({ archived: false }));
      }
      return jsonResponse(searchResult(items.map((item) => ({ ...item, archived: true }))));
    });
    renderAt('/cards?archived=true');

    await user.click(await screen.findByRole('button', { name: '恢复归档广陵与扬州为对应关系' }));
    await waitFor(() => expect(screen.queryByText('广陵与扬州为对应关系')).not.toBeInTheDocument());
    expect(JSON.parse(String(requests.find(({ path, init }) => path === '/api/cards/card-1' && init?.method === 'PATCH')?.init?.body))).toEqual({ archived: false });
    expect(screen.queryByRole('button', { name: '归档广陵与扬州为对应关系' })).not.toBeInTheDocument();
  });

  it('末页最后一张删除后回到最后有效页且不呈现越界页码', async () => {
    let pageTwoLoads = 0;
    let resolvePageOne: ((response: Response) => void) | undefined;
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      if (init?.method === 'DELETE') return new Response(null, { status: 204 });
      const params = new URL(String(input), 'http://localhost').searchParams;
      if (params.get('page') === '2') {
        pageTwoLoads += 1;
        return pageTwoLoads === 1
          ? jsonResponse({ items: [card({ archived: true })], total: 21, page: 2, pageSize: 20 })
          : jsonResponse({ items: [], total: 20, page: 2, pageSize: 20 });
      }
      return new Promise<Response>((resolve) => { resolvePageOne = resolve; });
    });
    const user = userEvent.setup();
    renderAt('/cards?archived=true&page=2&pageSize=20');

    await user.click(await screen.findByRole('button', { name: '彻底删除广陵与扬州为对应关系' }));
    await waitFor(() => expect(new URLSearchParams(window.location.search).get('page')).toBe('1'));
    expect(screen.getByText('正在加载卡片')).toBeInTheDocument();
    expect(screen.queryByText('第 2 / 1 页')).not.toBeInTheDocument();

    await waitFor(() => expect(resolvePageOne).toEqual(expect.any(Function)));
    await act(async () => resolvePageOne?.(jsonResponse({
      items: [card({ id: 'card-2', normalizedStatement: '第一页卡片' })],
      total: 20,
      page: 1,
      pageSize: 20,
    })));
    expect(await screen.findByText('第一页卡片')).toBeInTheDocument();
    expect(screen.getByText('第 1 / 1 页')).toBeInTheDocument();
  });

  it('详情抽屉约束键盘焦点，Escape 关闭后恢复查看按钮焦点', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(searchResult()));
    const user = userEvent.setup();
    renderAt('/cards');

    const viewButton = await screen.findByRole('button', { name: '查看广陵与扬州为对应关系详情' });
    await user.click(viewButton);
    const closeButton = screen.getByRole('button', { name: '关闭详情' });
    expect(closeButton).toHaveFocus();

    await user.tab();
    expect(closeButton).toHaveFocus();
    await user.tab({ shift: true });
    expect(closeButton).toHaveFocus();
    motionMock.animate.mockClear();
    await user.keyboard('{Escape}');

    const dialog = screen.getByRole('dialog', { name: '卡片详情' });
    expect(dialog).toHaveAttribute('data-motion-phase', 'closing');
    expect(motionMock.animate).toHaveBeenCalledTimes(1);
    const [from, target, options] = motionMock.animate.mock.calls[0] as unknown as [number, number, { onComplete: () => void }];
    expect(from).toBe(0);
    expect(target).toBe(600);
    act(() => options.onComplete());
    expect(screen.queryByRole('dialog', { name: '卡片详情' })).not.toBeInTheDocument();
    expect(viewButton).toHaveFocus();
  });

  it('详情抽屉内部点击不关闭，遮罩沿下方退场且低动态直接关闭', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(searchResult()));
    const user = userEvent.setup();
    renderAt('/cards');

    const viewButton = await screen.findByRole('button', { name: '查看广陵与扬州为对应关系详情' });
    await user.click(viewButton);
    const dialog = screen.getByRole('dialog', { name: '卡片详情' });
    const backdrop = dialog.parentElement;
    expect(backdrop).not.toBeNull();

    fireEvent.mouseDown(dialog);
    expect(screen.getByRole('dialog', { name: '卡片详情' })).toBeInTheDocument();

    motionMock.animate.mockClear();
    fireEvent.mouseDown(backdrop!);
    expect(screen.getByRole('dialog', { name: '卡片详情' })).toBeInTheDocument();
    const [, target, options] = motionMock.animate.mock.calls[0] as unknown as [number, number, { onComplete: () => void }];
    expect(target).toBe(600);
    act(() => options.onComplete());
    expect(screen.queryByRole('dialog', { name: '卡片详情' })).not.toBeInTheDocument();
    expect(viewButton).toHaveFocus();

    await user.click(viewButton);
    const reducedDialog = screen.getByRole('dialog', { name: '卡片详情' });
    document.documentElement.dataset.motion = 'reduced';
    fireEvent.mouseDown(reducedDialog.parentElement!);
    expect(screen.queryByRole('dialog', { name: '卡片详情' })).not.toBeInTheDocument();
    expect(viewButton).toHaveFocus();
  });

  it('关闭按钮的退场不立即卸载，弹簧故障时仍能按时关闭', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(searchResult()));
    const user = userEvent.setup();
    renderAt('/cards');

    const viewButton = await screen.findByRole('button', { name: '查看广陵与扬州为对应关系详情' });
    await user.click(viewButton);
    motionMock.animate.mockClear();
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole('button', { name: '关闭详情' }));

    expect(screen.getByRole('dialog', { name: '卡片详情' })).toHaveAttribute('data-motion-phase', 'closing');
    expect(motionMock.animate.mock.calls[0]?.[1]).toBe(600);
    act(() => vi.advanceTimersByTime(600));
    expect(screen.queryByRole('dialog', { name: '卡片详情' })).not.toBeInTheDocument();
    expect(viewButton).toHaveFocus();
  });

  it('弹簧启动直接异常时仍会完成关闭并恢复焦点', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(searchResult()));
    const user = userEvent.setup();
    renderAt('/cards');

    const viewButton = await screen.findByRole('button', { name: '查看广陵与扬州为对应关系详情' });
    await user.click(viewButton);
    motionMock.animate.mockImplementationOnce(() => { throw new Error('motion unavailable'); });

    expect(() => fireEvent.click(screen.getByRole('button', { name: '关闭详情' }))).not.toThrow();
    expect(screen.queryByRole('dialog', { name: '卡片详情' })).not.toBeInTheDocument();
    expect(viewButton).toHaveFocus();
  });

  it('详情抽屉使用厚玻璃，拖拽把手不套用按钮按压效果', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(searchResult()));
    const user = userEvent.setup();
    renderAt('/cards');

    await user.click(await screen.findByRole('button', { name: '查看广陵与扬州为对应关系详情' }));
    const dialog = screen.getByRole('dialog', { name: '卡片详情' });
    const handle = dialog.querySelector<HTMLElement>('.cards-drawer__drag-handle');
    const header = dialog.querySelector<HTMLElement>('.cards-drawer__header');
    const setPointerCapture = vi.fn();
    Object.defineProperty(header!, 'setPointerCapture', { configurable: true, value: setPointerCapture });

    expect(dialog).toHaveClass('liquid-glass', 'liquid-glass--thick');
    expect(dialog.parentElement?.parentElement).toBe(document.body);
    expect(motionMock.animate).toHaveBeenCalledWith(600, 0, expect.objectContaining({ type: 'spring' }));
    expect(dialog).toHaveAttribute('data-motion-phase', 'idle');
    expect(screen.getByRole('button', { name: '关闭详情' })).toHaveClass('liquid-pressable');
    expect(handle).not.toBeNull();
    expect(header).not.toBeNull();
    expect(handle).not.toHaveClass('liquid-pressable');
    fireEvent.pointerDown(screen.getByRole('button', { name: '关闭详情' }), { pointerId: 5, isPrimary: true, button: 0 });
    expect(setPointerCapture).not.toHaveBeenCalled();
  });

  it('低动态下抽屉经过 10px 迟滞后一比一跟手并可向下拖动关闭', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(searchResult()));
    const user = userEvent.setup();
    renderAt('/cards');

    await user.click(await screen.findByRole('button', { name: '查看广陵与扬州为对应关系详情' }));
    const dialog = screen.getByRole('dialog', { name: '卡片详情' });
    const handle = dialog.querySelector<HTMLElement>('.cards-drawer__drag-handle');
    const header = dialog.querySelector<HTMLElement>('.cards-drawer__header');
    expect(handle).not.toBeNull();
    expect(header).not.toBeNull();
    document.documentElement.dataset.motion = 'reduced';
    const setPointerCapture = vi.fn();
    const releasePointerCapture = vi.fn();
    Object.defineProperty(header!, 'setPointerCapture', { configurable: true, value: setPointerCapture });
    Object.defineProperty(header!, 'releasePointerCapture', { configurable: true, value: releasePointerCapture });
    vi.spyOn(dialog, 'getBoundingClientRect').mockReturnValue({
      bottom: 600,
      height: 600,
      left: 600,
      right: 1000,
      top: 0,
      width: 400,
      x: 600,
      y: 0,
      toJSON: () => ({}),
    });

    fireEvent.pointerDown(handle!, { pointerId: 7, isPrimary: true, button: 0, clientY: 100 });
    expect(setPointerCapture).toHaveBeenCalledWith(7);
    fireEvent.pointerMove(handle!, { pointerId: 7, isPrimary: true, clientY: 108 });
    expect(dialog).not.toHaveStyle({ transform: 'translate3d(0, 8px, 0)' });
    fireEvent.pointerMove(handle!, { pointerId: 7, isPrimary: true, clientY: 140 });
    expect(dialog).toHaveStyle({ transform: 'translate3d(0, 40px, 0)' });
    fireEvent.pointerMove(handle!, { pointerId: 7, isPrimary: true, clientY: 440 });
    fireEvent.pointerUp(handle!, { pointerId: 7, isPrimary: true, clientY: 440 });

    expect(releasePointerCapture).toHaveBeenCalledWith(7);
    expect(screen.queryByRole('dialog', { name: '卡片详情' })).not.toBeInTheDocument();
  });

  it('高速释放仍按原始速度投影关闭，但退场弹簧速度限幅且可中途重新抓取', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(searchResult()));
    const user = userEvent.setup();
    renderAt('/cards');

    await user.click(await screen.findByRole('button', { name: '查看广陵与扬州为对应关系详情' }));
    const dialog = screen.getByRole('dialog', { name: '卡片详情' });
    const header = dialog.querySelector<HTMLElement>('.cards-drawer__header');
    expect(header).not.toBeNull();
    Object.defineProperty(header!, 'setPointerCapture', { configurable: true, value: vi.fn() });
    Object.defineProperty(header!, 'releasePointerCapture', { configurable: true, value: vi.fn() });
    vi.spyOn(dialog, 'getBoundingClientRect').mockReturnValue({
      bottom: 600,
      height: 600,
      left: 600,
      right: 1000,
      top: 0,
      width: 400,
      x: 600,
      y: 0,
      toJSON: () => ({}),
    });
    motionMock.animate.mockClear();
    motionMock.stop.mockClear();

    fireEvent.pointerDown(header!, { pointerId: 11, isPrimary: true, button: 0, clientY: 0 });
    fireEvent.pointerMove(header!, { pointerId: 11, isPrimary: true, clientY: 320 });
    fireEvent.pointerUp(header!, { pointerId: 11, isPrimary: true, clientY: 320 });

    expect(motionMock.animate).toHaveBeenCalledTimes(1);
    const [from, target, options] = motionMock.animate.mock.calls[0] as unknown as [number, number, {
      bounce: number;
      onComplete: () => void;
      onUpdate: (value: number) => void;
      type: string;
      velocity: number;
    }];
    expect(from).toBe(320);
    expect(target).toBe(600);
    expect(options).toEqual(expect.objectContaining({ type: 'spring', bounce: 0.2 }));
    expect(options.velocity).toBe(1200);

    options.onUpdate(420);
    expect(dialog).toHaveStyle({ transform: 'translate3d(0, 420px, 0)' });
    fireEvent.pointerDown(header!, { pointerId: 12, isPrimary: true, button: 0, clientY: 420 });
    expect(dialog).toHaveAttribute('data-motion-phase', 'dragging');
    expect(motionMock.stop).toHaveBeenCalledTimes(1);
    fireEvent.pointerMove(header!, { pointerId: 12, isPrimary: true, clientY: 0 });
    expect(dialog).toHaveStyle({ transform: 'translate3d(0, 0px, 0)' });
    fireEvent.pointerUp(header!, { pointerId: 12, isPrimary: true, clientY: 0 });
    expect(dialog).toHaveAttribute('data-motion-phase', 'idle');
    expect(dialog).toHaveStyle({ transform: 'translate3d(0, 0px, 0)' });
  });

  it('窗口失焦会取消当前拖拽并回位，之后仍可再次拖动', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(searchResult()));
    const user = userEvent.setup();
    renderAt('/cards');

    await user.click(await screen.findByRole('button', { name: '查看广陵与扬州为对应关系详情' }));
    const dialog = screen.getByRole('dialog', { name: '卡片详情' });
    const handle = dialog.querySelector<HTMLElement>('.cards-drawer__drag-handle');
    const header = dialog.querySelector<HTMLElement>('.cards-drawer__header');
    expect(handle).not.toBeNull();
    expect(header).not.toBeNull();
    const setPointerCapture = vi.fn();
    const releasePointerCapture = vi.fn();
    Object.defineProperty(header!, 'setPointerCapture', { configurable: true, value: setPointerCapture });
    Object.defineProperty(header!, 'releasePointerCapture', { configurable: true, value: releasePointerCapture });
    vi.spyOn(dialog, 'getBoundingClientRect').mockReturnValue({
      bottom: 600,
      height: 600,
      left: 600,
      right: 1000,
      top: 0,
      width: 400,
      x: 600,
      y: 0,
      toJSON: () => ({}),
    });
    motionMock.animate.mockClear();

    fireEvent.pointerDown(handle!, { pointerId: 21, isPrimary: true, button: 0, clientY: 100 });
    fireEvent.pointerMove(handle!, { pointerId: 21, isPrimary: true, clientY: 180 });
    fireEvent(window, new Event('blur'));

    expect(releasePointerCapture).toHaveBeenCalledWith(21);
    expect(dialog).toHaveStyle({ transform: 'translate3d(0, 0px, 0)' });
    expect(dialog).toHaveAttribute('data-motion-phase', 'idle');
    expect(motionMock.animate.mock.calls.at(-1)?.slice(0, 2)).toEqual([80, 0]);

    fireEvent.pointerDown(handle!, { pointerId: 22, isPrimary: true, button: 0, clientY: 100 });
    fireEvent.pointerMove(handle!, { pointerId: 22, isPrimary: true, clientY: 150 });
    expect(setPointerCapture).toHaveBeenLastCalledWith(22);
    expect(dialog).toHaveStyle({ transform: 'translate3d(0, 50px, 0)' });
  });

  it('拖动中按 Escape 会释放指针并专注关闭，后续 pointerup 不得改为回位', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(searchResult()));
    const user = userEvent.setup();
    renderAt('/cards');

    const viewButton = await screen.findByRole('button', { name: '查看广陵与扬州为对应关系详情' });
    await user.click(viewButton);
    const dialog = screen.getByRole('dialog', { name: '卡片详情' });
    const handle = dialog.querySelector<HTMLElement>('.cards-drawer__drag-handle');
    const header = dialog.querySelector<HTMLElement>('.cards-drawer__header');
    expect(handle).not.toBeNull();
    expect(header).not.toBeNull();
    const releasePointerCapture = vi.fn();
    Object.defineProperty(header!, 'setPointerCapture', { configurable: true, value: vi.fn() });
    Object.defineProperty(header!, 'releasePointerCapture', { configurable: true, value: releasePointerCapture });
    vi.spyOn(dialog, 'getBoundingClientRect').mockReturnValue({
      bottom: 600,
      height: 600,
      left: 600,
      right: 1000,
      top: 0,
      width: 400,
      x: 600,
      y: 0,
      toJSON: () => ({}),
    });
    motionMock.animate.mockClear();

    fireEvent.pointerDown(handle!, { pointerId: 31, isPrimary: true, button: 0, clientY: 100 });
    fireEvent.pointerMove(handle!, { pointerId: 31, isPrimary: true, clientY: 200 });
    fireEvent.keyDown(document, { key: 'Escape' });

    expect(releasePointerCapture).toHaveBeenCalledWith(31);
    expect(dialog).toHaveAttribute('data-motion-phase', 'closing');
    expect(motionMock.animate.mock.calls.at(-1)?.slice(0, 2)).toEqual([100, 600]);
    const closeCallCount = motionMock.animate.mock.calls.length;

    fireEvent.pointerUp(handle!, { pointerId: 31, isPrimary: true, clientY: 200 });
    expect(motionMock.animate).toHaveBeenCalledTimes(closeCallCount);
    expect(dialog).toHaveAttribute('data-motion-phase', 'closing');

    const closeOptions = motionMock.animate.mock.calls.at(-1)?.[2] as { onComplete: () => void };
    act(() => closeOptions.onComplete());
    expect(screen.queryByRole('dialog', { name: '卡片详情' })).not.toBeInTheDocument();
    expect(viewButton).toHaveFocus();
  });

  it('抽屉打开时锁定底层滚动并补偿 Windows 滚动条，关闭或卸载后恢复原值', async () => {
    document.body.style.overflow = 'clip';
    document.body.style.paddingRight = '12px';
    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(1000);
    vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(980);
    vi.mocked(fetch).mockResolvedValue(jsonResponse(searchResult()));
    const user = userEvent.setup();
    const view = renderAt('/cards');

    const viewButton = await screen.findByRole('button', { name: '查看广陵与扬州为对应关系详情' });
    await user.click(viewButton);
    expect(document.body.style.overflow).toBe('hidden');
    expect(document.body.style.paddingRight).toBe('32px');

    document.documentElement.dataset.motion = 'reduced';
    fireEvent.click(screen.getByRole('button', { name: '关闭详情' }));
    expect(document.body.style.overflow).toBe('clip');
    expect(document.body.style.paddingRight).toBe('12px');

    await user.click(viewButton);
    expect(document.body.style.overflow).toBe('hidden');
    expect(document.body.style.paddingRight).toBe('32px');
    view.unmount();
    expect(document.body.style.overflow).toBe('clip');
    expect(document.body.style.paddingRight).toBe('12px');
  });

  it('卡片玻璃样式使用圆角令牌并保证选择与操作区 44px 触控高度', async () => {
    const css = await readFile('src/styles/cards-glass.css', 'utf8');

    expect(css).toMatch(/\.cards-filters\.liquid-glass\s*\{[^}]*border-radius:\s*var\(--glass-radius-surface\)/);
    expect(css).toMatch(/\.cards-card\.liquid-glass\s*\{[^}]*border-radius:\s*var\(--glass-radius-surface\)/);
    expect(css).toMatch(/\.cards-page \.cards-content-version button\s*\{[^}]*height:\s*44px[^}]*min-height:\s*44px/);
    expect(css).toMatch(/\.cards-card__select,[^{]*\.cards-action-success button[^{]*\{[^}]*min-height:\s*44px/);
    expect(css).toMatch(/\.cards-row-actions button,[^{]*\.cards-row-actions a\s*\{[^}]*flex-basis:\s*44px[^}]*width:\s*44px[^}]*min-width:\s*44px/);
    expect(css).toMatch(/\.cards-drawer\[data-motion-phase='(?:opening|dragging|settling|closing)'\][^{]*\{[^}]*will-change:\s*transform/);
    expect(css).not.toMatch(/\.cards-drawer\.liquid-glass\s*\{[^}]*will-change:/);
    expect(css).toMatch(/\.cards-drawer-layer\s*\{[^}]*will-change:\s*auto/);
    expect(css).toMatch(/\.cards-drawer-layer\[data-motion-phase='(?:opening|dragging|settling|closing)'\][^{]*\{[^}]*will-change:\s*opacity/);
    expect(css).toMatch(/\.cards-drawer__header\s*\{[^}]*position:\s*sticky[^}]*top:\s*0/);
    expect(css).toMatch(/\.cards-drawer-layer\.cards-drawer-layer\s*\{[^}]*position:\s*fixed[^}]*height:\s*100dvh[^}]*display:\s*flex[^}]*align-items:\s*flex-end[^}]*justify-content:\s*center[^}]*overflow:\s*hidden/);
    expect(css).toMatch(/\.cards-drawer-layer\.cards-drawer-layer\s*\{[^}]*background:\s*rgba\(35, 38, 43, 0\.24\)[^}]*-webkit-backdrop-filter:\s*none[^}]*backdrop-filter:\s*none/);
    expect(css).toMatch(/\.cards-drawer\.liquid-glass\s*\{[^}]*width:\s*min\(960px, calc\(100vw - 32px\)\)[^}]*height:\s*min\(78dvh, 720px\)[^}]*max-height:\s*calc\(100dvh - 24px\)/);
    expect(css).toMatch(/\.cards-drawer\.liquid-glass\s*\{[^}]*border-bottom:\s*0[^}]*border-radius:\s*var\(--glass-radius-overlay\) var\(--glass-radius-overlay\) 0 0/);
  });

  it('项目低动态设置取消文件夹拖入位移和过渡效果', async () => {
    const css = await readFile('src/styles/cards-glass.css', 'utf8');

    expect(css).toMatch(/html\[data-motion='reduced'\] \.cards-folder-tile\.liquid-glass\s*\{[^}]*transition:\s*none/);
    expect(css).toMatch(/html\[data-motion='reduced'\] \.cards-folder-tile\.is-drag-over\s*\{[^}]*transform:\s*none/);
  });
});

describe('卡片编辑复用录入表单', () => {
  it('从 edit 参数加载并映射全部原字段，连续保存始终 PATCH 同一卡片', async () => {
    const fetchMock = vi.mocked(fetch).mockImplementation(async (input, init) => {
      const path = String(input);
      if (path === '/api/cards/card-1' && (!init?.method || init.method === 'GET')) {
        return jsonResponse(card());
      }
      if (path === '/api/cards/card-1' && init?.method === 'PATCH') return jsonResponse(card());
      throw new Error(`unexpected request: ${path}`);
    });
    const user = userEvent.setup();
    renderAt('/entry?edit=card-1');

    expect(screen.getByText('正在加载卡片')).toBeInTheDocument();
    expect(await screen.findByRole('combobox', { name: '模板' })).toHaveValue('常识判断');
    expect(screen.getByRole('heading', { name: '编辑卡片' })).toBeInTheDocument();
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: '原始内容' })).toHaveTextContent('广陵=扬州');
    expect(screen.getByRole('textbox', { name: '正确解析' })).toHaveValue('广陵对应扬州');
    expect(screen.getByRole('checkbox', { name: '常识判断' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: '文史' })).toBeChecked();
    expect(screen.getByLabelText('标签')).toHaveValue('古今地名');
    expect(screen.getByText('已保存附件：广陵.png')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '保存修改' }));
    await screen.findByText('已保存并完成整理');
    await user.click(screen.getByRole('button', { name: '保存修改' }));
    await waitFor(() => {
      expect(fetchMock.mock.calls.filter(([path, init]) => path === '/api/cards/card-1' && init?.method === 'PATCH')).toHaveLength(2);
    });
    expect(fetchMock.mock.calls.some(([path, init]) => path === '/api/cards' && init?.method === 'POST')).toBe(false);
  });

  it('从编辑页通过 SPA 返回普通录入页后重建新表单并只创建新卡片', async () => {
    const fetchMock = vi.mocked(fetch).mockImplementation(async (input, init) => {
      const path = String(input);
      if (path === '/api/cards/card-1' && (!init?.method || init.method === 'GET')) {
        return jsonResponse(card());
      }
      if (path === '/api/cards' && init?.method === 'POST') {
        return jsonResponse(card({ id: 'new-card', aiStatus: 'pending', quizItems: [] }), 201);
      }
      throw new Error(`unexpected request: ${path}`);
    });
    const user = userEvent.setup();
    renderAt('/entry?edit=card-1');
    expect(await screen.findByRole('textbox', { name: '正确解析' })).toHaveValue('广陵对应扬州');

    await user.click(screen.getByRole('link', { name: '录入' }));
    expect(await screen.findByRole('heading', { name: '录入' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: '原始内容' })).toHaveTextContent(/^$/);
    expect(screen.getByRole('textbox', { name: '正确解析' })).toHaveValue('');
    expect(screen.getByLabelText('标签')).toHaveValue('');
    expect(screen.getByRole('combobox', { name: '模板' })).toHaveValue('言语理解');

    await user.click(screen.getByRole('checkbox', { name: '常识判断' }));
    await user.click(screen.getByRole('checkbox', { name: '文史' }));
    fireEvent.paste(screen.getByRole('textbox', { name: '原始内容' }), {
      clipboardData: { getData: (type: string) => type === 'text/plain' ? '新建卡片原文' : '' },
    });
    await waitFor(() => expect(screen.getByRole('textbox', { name: '原始内容' })).toHaveTextContent('新建卡片原文'));
    await user.click(screen.getByRole('button', { name: '保存并自动整理' }));
    expect(await screen.findByText('已保存，等待重新整理')).toBeInTheDocument();

    expect(fetchMock.mock.calls.filter(([path, init]) => path === '/api/cards' && init?.method === 'POST')).toHaveLength(1);
    expect(fetchMock.mock.calls.some(([path, init]) => path === '/api/cards/card-1' && init?.method === 'PATCH')).toBe(false);
  });
});
