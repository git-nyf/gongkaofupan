// @vitest-environment jsdom

import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ShenlunReviewLibrary } from '../../src/components/ShenlunReviewLibrary';

const summary = {
  id: 'review-1',
  title: '基层治理答题复盘',
  template: 400,
  excerpt: '从群众诉求出发，完善基层协商机制。',
  characterCount: 312,
  pinned: false,
  archived: false,
  createdAt: '2026-08-08T02:00:00.000Z',
  updatedAt: '2026-08-09T03:04:00.000Z',
};

const anotherSummary = {
  id: 'review-2',
  title: '数字政府建设复盘',
  template: 800,
  excerpt: '以数据共享提升公共服务效率。',
  characterCount: 726,
  pinned: false,
  archived: false,
  createdAt: '2026-08-07T02:00:00.000Z',
  updatedAt: '2026-08-08T03:04:00.000Z',
};

const detail = {
  id: summary.id,
  title: summary.title,
  template: summary.template,
  text: '重点论述并删改',
  marks: [
    { id: 'mark-bold', type: 'bold', start: 0, end: 2 },
    { id: 'mark-color', type: 'color', color: 'red', start: 0, end: 2 },
    { id: 'mark-underline', type: 'underline', start: 2, end: 4 },
    { id: 'mark-strike', type: 'strike', start: 5, end: 7 },
  ],
  notes: '注意[复盘条目](/review#review-item-target)与措施对应。',
  standardAnswer: '以党建引领基层治理，健全群众参与机制。',
  annotations: [
    {
      id: 'annotation-1',
      start: 0,
      end: 2,
      quote: '重点',
      body: '总括词应当先行。',
      createdAt: '2026-08-09T03:00:00.000Z',
      detached: false,
    },
  ],
  pinned: false,
  archived: false,
  createdAt: summary.createdAt,
  updatedAt: summary.updatedAt,
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('申论复盘卡片库', () => {
  it('加载摘要列表并显示卡片信息与编辑入口', async () => {
    const fetchMock = mockApi({ list: [summary] });

    renderLibrary();

    expect(await screen.findByRole('heading', { name: '基层治理答题复盘' })).toBeInTheDocument();
    expect(screen.getByText(summary.excerpt)).toBeInTheDocument();
    expect(screen.getByText('400 字模板')).toBeInTheDocument();
    expect(screen.getByText('实际 312 字')).toBeInTheDocument();
    expect(screen.getByText(/更新于 2026\/08\/09/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '编辑基层治理答题复盘' })).toHaveAttribute(
      'href',
      '/shenlun/review-1',
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('/api/shenlun-reviews', expect.any(Object));
  });

  it('没有复盘时提供新建申论入口', async () => {
    mockApi({ list: [] });

    renderLibrary();

    expect(await screen.findByText('还没有申论复盘')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '新建申论' })).toHaveAttribute('href', '/shenlun');
  });

  it('支持按标题、正文摘要和字数模板模糊搜索申论复盘', async () => {
    const user = userEvent.setup();
    mockApi({ list: [summary, anotherSummary] });

    renderLibrary();
    const search = await screen.findByRole('searchbox', { name: '搜索申论复盘' });

    await user.type(search, '群众诉求');
    expect(screen.getByRole('heading', { name: summary.title })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: anotherSummary.title })).not.toBeInTheDocument();

    await user.clear(search);
    await user.type(search, '800字');
    expect(screen.queryByRole('heading', { name: summary.title })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: anotherSummary.title })).toBeInTheDocument();

    await user.clear(search);
    await user.type(search, '政府 建设');
    expect(screen.getByRole('heading', { name: anotherSummary.title })).toBeInTheDocument();
  });

  it('搜索无结果时可以清空条件并恢复全部申论卡片', async () => {
    const user = userEvent.setup();
    mockApi({ list: [summary, anotherSummary] });

    renderLibrary();
    const search = await screen.findByRole('searchbox', { name: '搜索申论复盘' });
    await user.type(search, '不存在的申论');

    expect(screen.getByRole('status')).toHaveTextContent('没有匹配的申论复盘');
    await user.click(screen.getByRole('button', { name: '清空申论搜索' }));

    expect(search).toHaveValue('');
    expect(screen.getByRole('heading', { name: summary.title })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: anotherSummary.title })).toBeInTheDocument();
  });

  it('支持置顶、归档查看和恢复申论复盘', async () => {
    const user = userEvent.setup();
    const archivedSummary = { ...summary, pinned: true, archived: true };
    const fetchMock = mockApi({ list: [summary], archivedList: [archivedSummary] });

    renderLibrary();
    await screen.findByRole('heading', { name: summary.title });

    await user.click(screen.getByRole('button', { name: `置顶${summary.title}` }));
    await waitFor(() => expect(screen.getByRole('button', { name: `取消置顶${summary.title}` })).toBeInTheDocument());
    expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))).toEqual({ pinned: true });

    await user.click(screen.getByRole('button', { name: `归档${summary.title}` }));
    await waitFor(() => expect(screen.queryByRole('heading', { name: summary.title })).not.toBeInTheDocument());
    expect(JSON.parse(String(fetchMock.mock.calls[2]?.[1]?.body))).toEqual({ archived: true });

    await user.click(screen.getByRole('button', { name: '已归档' }));
    expect(await screen.findByRole('heading', { name: summary.title })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: `预览${summary.title}` })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: `恢复归档${summary.title}` }));
    await waitFor(() => expect(screen.queryByRole('heading', { name: summary.title })).not.toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledWith('/api/shenlun-reviews?archived=true', expect.any(Object));
  });

  it('按需加载完整复盘并在可关闭抽屉中保留正文格式和复盘内容', async () => {
    const user = userEvent.setup();
    const fetchMock = mockApi({ list: [summary], detail });

    renderLibrary();
    const previewButton = await screen.findByRole('button', { name: '预览基层治理答题复盘' });
    await user.click(previewButton);

    const dialog = await screen.findByRole('dialog', { name: '复盘预览：基层治理答题复盘' });
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/shenlun-reviews/review-1',
      expect.any(Object),
    );
    expect(within(dialog).getByText('重点')).toHaveProperty('tagName', 'STRONG');
    expect(within(dialog).getByText('重点').closest('[data-text-color="red"]')).not.toBeNull();
    expect(within(dialog).getByText('论述')).toHaveProperty('tagName', 'U');
    expect(within(dialog).getByText('删改')).toHaveProperty('tagName', 'S');
    expect(within(dialog).getByText(detail.standardAnswer)).toBeInTheDocument();
    expect(within(dialog).getByRole('link', { name: '复盘条目' })).toHaveAttribute(
      'href',
      '/review#review-item-target',
    );
    expect(within(dialog).getByText('“重点”')).toBeInTheDocument();
    expect(within(dialog).getByText('总括词应当先行。')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(previewButton).toHaveFocus();
  });

  it('列表请求失败时显示可感知的错误信息', async () => {
    mockApi({ listStatus: 500 });

    renderLibrary();

    expect(await screen.findByRole('alert')).toHaveTextContent('暂时无法加载申论复盘');
  });

  it('列表请求失败后可就地重新加载', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ code: 'internal_error', message: '读取失败' }, 500))
      .mockResolvedValueOnce(jsonResponse([summary]));
    vi.stubGlobal('fetch', fetchMock);
    renderLibrary();

    await user.click(await screen.findByRole('button', { name: '重新加载申论复盘' }));

    expect(await screen.findByRole('heading', { name: '基层治理答题复盘' })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

function renderLibrary() {
  return render(
    <MemoryRouter>
      <ShenlunReviewLibrary />
    </MemoryRouter>,
  );
}

function mockApi(options: {
  list?: Array<typeof summary>;
  archivedList?: Array<typeof summary>;
  detail?: typeof detail;
  listStatus?: number;
}) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    if (path === '/api/shenlun-reviews') {
      const status = options.listStatus ?? 200;
      return jsonResponse(
        status === 200
          ? options.list ?? []
          : { code: 'internal_error', message: '申论复盘读取失败' },
        status,
      );
    }
    if (path === '/api/shenlun-reviews?archived=true') {
      return jsonResponse(options.archivedList ?? []);
    }
    if (path === `/api/shenlun-reviews/${summary.id}` && init?.method === 'PATCH') {
      return jsonResponse({
        ...detail,
        ...JSON.parse(String(init.body)),
      });
    }
    if (path === `/api/shenlun-reviews/${summary.id}` && options.detail) {
      return jsonResponse(options.detail);
    }
    return jsonResponse({ code: 'not_found', message: '复盘不存在' }, 404);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
