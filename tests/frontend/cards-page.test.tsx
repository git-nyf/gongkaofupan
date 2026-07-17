// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CardDetail, CardSearchResult } from '../../shared/contracts';
import App from '../../src/App';

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
    rating: 4,
    mastery: 'hard',
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

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
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
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
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

describe('卡片库表格和管理操作', () => {
  it('呈现固定列、明确 AI 状态和只在详情抽屉出现的原始输入', async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse(searchResult([card({ aiStatus: 'needs_input' }), card({ id: 'card-2', normalizedStatement: '待整理卡片', aiStatus: 'pending' })])),
    );
    const user = userEvent.setup();
    renderAt('/cards');

    expect((await screen.findAllByRole('columnheader')).map((header) => header.textContent)).toEqual([
      '选择',
      '知识点',
      '板块',
      '不会标注',
      '下次复习',
      '操作',
    ]);
    expect(within(screen.getByRole('table')).getAllByRole('cell', { name: '不会标注 2 次' })).toHaveLength(2);
    expect(within(screen.getByRole('table')).getByText('待完善')).toBeInTheDocument();
    expect(within(screen.getByRole('table')).getByText('待整理')).toBeInTheDocument();
    expect(screen.queryByText('广陵=扬州')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '查看广陵与扬州为对应关系详情' }));
    const detail = screen.getByRole('dialog', { name: '卡片详情' });
    expect(detail).toHaveTextContent('广陵=扬州');
    expect(within(detail).getByText('不会标注次数')).toBeInTheDocument();
    expect(within(detail).getByText('2 次')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '关闭详情' })).toHaveAttribute('title', '关闭详情');
  });

  it('规范知识为空时表格和操作名称使用中性占位，原文仍只在详情抽屉显示', async () => {
    const rawInput = '只允许详情查看的唯一原文';
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse(searchResult([card({ aiStatus: 'pending', normalizedStatement: '', rawInput })])),
    );
    const user = userEvent.setup();
    renderAt('/cards');

    const table = await screen.findByRole('table');
    expect(within(table).getByText('待生成知识点')).toBeInTheDocument();
    expect(table.outerHTML).not.toContain(rawInput);
    expect(within(table).queryByText(rawInput)).not.toBeInTheDocument();
    expect(within(table).queryByRole('checkbox', { name: new RegExp(rawInput) })).not.toBeInTheDocument();
    expect(within(table).queryByRole('button', { name: new RegExp(rawInput) })).not.toBeInTheDocument();
    expect(within(table).queryByRole('link', { name: new RegExp(rawInput) })).not.toBeInTheDocument();

    const confirmMock = vi.mocked(confirm).mockReturnValueOnce(false);
    await user.click(within(table).getByRole('button', { name: '删除待生成知识点' }));
    const confirmMessage = String(confirmMock.mock.calls[0]?.[0]);
    expect(confirmMessage).toContain('待生成知识点');
    expect(confirmMessage).not.toContain(rawInput);

    await user.click(within(table).getByRole('button', { name: '查看待生成知识点详情' }));
    expect(screen.getByRole('dialog', { name: '卡片详情' })).toHaveTextContent(rawInput);
  });

  it('选中后只提供批量添加标签和归档，成功刷新并清空选择', async () => {
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

  it('单卡归档后默认移除，删除需确认且分页写回 URL', async () => {
    let items = [card()];
    const fetchMock = vi.mocked(fetch).mockImplementation(async (input, init) => {
      const path = String(input);
      if (init?.method === 'PATCH') {
        items = [];
        return jsonResponse(card({ archived: true }));
      }
      if (init?.method === 'DELETE') return new Response(null, { status: 204 });
      return jsonResponse({ items, total: 41, page: 1, pageSize: 20 });
    });
    const user = userEvent.setup();
    renderAt('/cards');
    await user.click(await screen.findByRole('button', { name: '归档广陵与扬州为对应关系' }));
    await waitFor(() => expect(screen.queryByText('广陵与扬州为对应关系')).not.toBeInTheDocument());

    items = [card()];
    await user.click(screen.getByRole('button', { name: '重新加载' }));
    await screen.findByText('广陵与扬州为对应关系');
    await user.click(screen.getByRole('button', { name: '删除广陵与扬州为对应关系' }));
    expect(confirm).toHaveBeenCalledWith('确认永久删除“广陵与扬州为对应关系”？此操作不可撤销。');
    expect(fetchMock.mock.calls.some(([path, init]) => path === '/api/cards/card-1' && init?.method === 'DELETE')).toBe(true);

    const nextPage = screen.getByRole('button', { name: '下一页' });
    await waitFor(() => expect(nextPage).not.toBeDisabled());
    await user.click(nextPage);
    expect(new URLSearchParams(window.location.search).get('page')).toBe('2');
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
          ? jsonResponse({ items: [card()], total: 21, page: 2, pageSize: 20 })
          : jsonResponse({ items: [], total: 20, page: 2, pageSize: 20 });
      }
      return new Promise<Response>((resolve) => { resolvePageOne = resolve; });
    });
    const user = userEvent.setup();
    renderAt('/cards?page=2&pageSize=20');

    await user.click(await screen.findByRole('button', { name: '删除广陵与扬州为对应关系' }));
    await waitFor(() => expect(new URLSearchParams(window.location.search).get('page')).toBe('1'));
    expect(screen.getByText('正在加载卡片')).toBeInTheDocument();
    expect(screen.queryByText('第 2 / 1 页')).not.toBeInTheDocument();

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
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog', { name: '卡片详情' })).not.toBeInTheDocument();
    expect(viewButton).toHaveFocus();
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
    expect(await screen.findByRole('radio', { name: '错题录入' })).toBeChecked();
    expect(screen.getByRole('heading', { name: '编辑卡片' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: '模板' })).toHaveValue('常识判断');
    expect(screen.getByRole('textbox', { name: '原始内容' })).toHaveTextContent('广陵=扬州');
    expect(screen.getByRole('textbox', { name: '正确解析' })).toHaveValue('广陵对应扬州');
    expect(screen.getByRole('checkbox', { name: '常识判断' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: '文史' })).toBeChecked();
    expect(screen.getByLabelText('标签')).toHaveValue('古今地名');
    expect(screen.getByText('已保存附件：广陵.png')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '保存并自动整理' }));
    await screen.findByText('已保存并完成整理');
    await user.click(screen.getByRole('button', { name: '保存并自动整理' }));
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
