// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ReviewPage } from '../../src/pages/ReviewPage';

const createdAt = '2026-07-21T00:00:00.000Z';

const initialBoards = [
  {
    id: 'board-language',
    name: '言语',
    hidden: false,
    createdAt,
    sections: [
      { id: 'section-main', name: '中心理解', hidden: false, createdAt },
      { id: 'section-fill', name: '逻辑填空', hidden: false, createdAt },
    ],
  },
  {
    id: 'board-judgement',
    name: '判断',
    hidden: false,
    createdAt,
    sections: [{ id: 'section-figure', name: '图形推理', hidden: false, createdAt }],
  },
];

const initialItems = [
  {
    id: 'image-main',
    sectionId: 'section-main',
    url: '/api/review-images/image-main/file',
    originalName: '中心理解.png',
    mimeType: 'image/png',
    byteSize: 1024,
    createdAt,
  },
  {
    id: 'image-fill',
    sectionId: 'section-fill',
    url: '/api/review-images/image-fill/file',
    originalName: '逻辑填空.png',
    mimeType: 'image/png',
    byteSize: 1024,
    createdAt,
  },
];

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function requestBody(init?: RequestInit) {
  return JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>;
}

function mockReviewApi(
  suppliedBoards = initialBoards,
  suppliedItems = initialItems,
) {
  let boards = structuredClone(suppliedBoards);

  vi.mocked(fetch).mockImplementation(async (input, init) => {
    const url = String(input);
    const method = init?.method ?? 'GET';

    if (url === '/api/review-images' && method === 'GET') {
      return jsonResponse({ items: suppliedItems, boards });
    }

    const boardMatch = url.match(/^\/api\/review-boards\/([^/]+)$/);
    if (boardMatch && method === 'PATCH') {
      const hidden = Boolean(requestBody(init).hidden);
      const board = boards.find(({ id }) => id === boardMatch[1]);
      if (!board) throw new Error('未找到大板块');
      board.hidden = hidden;
      return jsonResponse({ board: structuredClone(board) });
    }

    const sectionMatch = url.match(/^\/api\/review-sections\/([^/]+)$/);
    if (sectionMatch && method === 'PATCH') {
      const hidden = Boolean(requestBody(init).hidden);
      const board = boards.find(({ sections }) => (
        sections.some(({ id }) => id === sectionMatch[1])
      ));
      const section = board?.sections.find(({ id }) => id === sectionMatch[1]);
      if (!section) throw new Error('未找到小板块');
      section.hidden = hidden;
      return jsonResponse({ section: structuredClone(section) });
    }

    throw new Error(`未模拟的请求：${method} ${url}`);
  });
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('复盘板块归档', () => {
  it('归档大板块后从主内容消失并进入已归档区，恢复后重新出现', async () => {
    mockReviewApi();
    const user = userEvent.setup();
    render(<ReviewPage />);

    expect(await screen.findByRole('heading', { name: '判断' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '管理板块' }));
    await user.click(screen.getByRole('button', { name: '归档大板块 判断' }));

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: '判断' })).not.toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: '管理板块' })).toHaveFocus();
    const archived = screen.getByRole('region', { name: '已归档板块' });
    expect(within(archived).getByText('判断')).toBeInTheDocument();
    expect(within(archived).getByRole('button', { name: '恢复大板块 判断' })).toBeInTheDocument();
    expectRequest('/api/review-boards/board-judgement', { hidden: true });
    expectNoDeleteRequest();

    await user.click(within(archived).getByRole('button', { name: '恢复大板块 判断' }));

    expect(await screen.findByRole('heading', { name: '判断' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '管理板块' })).toHaveFocus();
    expectRequest('/api/review-boards/board-judgement', { hidden: false });
    expectNoDeleteRequest();
  });

  it('归档小板块后从轮播与上传选择中消失，图片保留且可恢复', async () => {
    mockReviewApi();
    const user = userEvent.setup();
    render(<ReviewPage />);

    const tabs = await screen.findByRole('tablist', { name: '言语小板块' });
    await user.click(within(tabs).getByRole('tab', { name: '逻辑填空' }));
    expect(screen.getByLabelText('选择言语/逻辑填空错题图片')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '管理板块' }));
    await user.click(screen.getByRole('button', { name: '归档小板块 言语/逻辑填空' }));

    await waitFor(() => {
      expect(within(tabs).queryByRole('tab', { name: '逻辑填空' })).not.toBeInTheDocument();
    });
    expect(screen.queryByLabelText('选择言语/逻辑填空错题图片')).not.toBeInTheDocument();
    const archived = screen.getByRole('region', { name: '已归档板块' });
    expect(within(archived).getByText('言语 / 逻辑填空')).toBeInTheDocument();
    expect(within(archived).getByRole('button', {
      name: '恢复小板块 言语/逻辑填空',
    })).toBeInTheDocument();
    expectRequest('/api/review-sections/section-fill', { hidden: true });
    expectNoDeleteRequest();

    await user.click(within(archived).getByRole('button', {
      name: '恢复小板块 言语/逻辑填空',
    }));

    expect(await within(tabs).findByRole('tab', { name: '逻辑填空' })).toBeInTheDocument();
    expect(within(tabs).getByRole('tab', { name: '中心理解' })).toHaveAttribute('aria-selected', 'true');
    expectRequest('/api/review-sections/section-fill', { hidden: false });
    expectNoDeleteRequest();
  });

  it('并发归档时各自保持 pending，前一个完成不会释放后一个按钮', async () => {
    const pending = mockDelayedReviewApi();
    render(<ReviewPage />);

    await screen.findByRole('heading', { name: '判断' });
    await userEvent.setup().click(screen.getByRole('button', { name: '管理板块' }));
    const boardButton = screen.getByRole('button', { name: '归档大板块 判断' });
    const sectionButton = screen.getByRole('button', { name: '归档小板块 言语/逻辑填空' });

    fireEvent.click(boardButton);
    fireEvent.click(sectionButton);
    await waitFor(() => expect(pending.requests).toHaveLength(2));
    expect(boardButton).toBeDisabled();
    expect(sectionButton).toBeDisabled();

    pending.resolve('/api/review-boards/board-judgement', { hidden: true });
    await waitFor(() => expect(screen.queryByRole('heading', { name: '判断' })).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: '归档小板块 言语/逻辑填空' })).toBeDisabled();

    pending.resolve('/api/review-sections/section-fill', { hidden: true });
    await waitFor(() => expect(screen.getByRole('button', { name: '恢复小板块 言语/逻辑填空' })).toBeInTheDocument());
    expect(pending.requests.filter(({ path }) => path === '/api/review-boards/board-judgement')).toHaveLength(1);
    expect(pending.requests.filter(({ path }) => path === '/api/review-sections/section-fill')).toHaveLength(1);
    expectNoDeleteRequest();
  });

  it('归档请求失败后可重试，仅发送两次 PATCH 且恢复后焦点稳定', async () => {
    let patchCount = 0;
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const url = String(input);
      const method = init?.method ?? 'GET';
      if (url === '/api/review-images' && method === 'GET') {
        return jsonResponse({ items: initialItems, boards: structuredClone(initialBoards) });
      }
      if (url === '/api/review-boards/board-judgement' && method === 'PATCH') {
        patchCount += 1;
        if (patchCount === 1) return jsonResponse({ code: 'failed' }, 500);
        return jsonResponse({
          board: { ...structuredClone(initialBoards[1]), hidden: true },
        });
      }
      throw new Error(`未模拟的请求：${method} ${url}`);
    });
    const user = userEvent.setup();
    render(<ReviewPage />);

    await screen.findByRole('heading', { name: '判断' });
    await user.click(screen.getByRole('button', { name: '管理板块' }));
    const archiveButton = screen.getByRole('button', { name: '归档大板块 判断' });
    await user.click(archiveButton);
    await screen.findByRole('alert');
    expect(archiveButton).not.toBeDisabled();

    await user.click(archiveButton);
    await waitFor(() => expect(screen.getByRole('button', { name: '恢复大板块 判断' })).toBeInTheDocument());
    expect(patchCount).toBe(2);
    expect(screen.getByRole('button', { name: '管理板块' })).toHaveFocus();
    expectNoDeleteRequest();
  });

  it('父板块可直接恢复已归档子板块，恢复按钮保持 pending 且不删除图片', async () => {
    const boards = structuredClone(initialBoards);
    boards[0].sections[1].hidden = true;
    const pending = mockDelayedReviewApi(boards);
    render(<ReviewPage />);

    await screen.findByRole('heading', { name: '言语' });
    await userEvent.setup().click(screen.getByRole('button', { name: '管理板块' }));
    const archived = screen.getByRole('region', { name: '已归档板块' });
    const restoreButton = within(archived).getByRole('button', { name: '恢复小板块 言语/逻辑填空' });
    fireEvent.click(restoreButton);
    await waitFor(() => expect(pending.requests).toHaveLength(1));
    expect(restoreButton).toBeDisabled();
    pending.resolve('/api/review-sections/section-fill', { hidden: false });
    const restoredSection = await within(screen.getByRole('tablist', { name: '言语小板块' })).findByRole('tab', { name: '逻辑填空' });
    expect(screen.getByRole('button', { name: '管理板块' })).toHaveFocus();
    await userEvent.setup().click(restoredSection);
    expect(pending.requests.filter(({ path }) => path === '/api/review-sections/section-fill')).toHaveLength(1);
    expect(screen.getByRole('img', { name: '错题图片 逻辑填空.png' })).toBeInTheDocument();
    expectNoDeleteRequest();
  });
});

function mockDelayedReviewApi(suppliedBoards = initialBoards, suppliedItems = initialItems) {
  const boards = structuredClone(suppliedBoards);
  const requests: Array<{
    path: string;
    body: Record<string, unknown>;
    resolve: (response: Response) => void;
  }> = [];

  vi.mocked(fetch).mockImplementation(async (input, init) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    if (url === '/api/review-images' && method === 'GET') {
      return jsonResponse({ items: suppliedItems, boards });
    }
    if (method === 'PATCH' && (url.startsWith('/api/review-boards/') || url.startsWith('/api/review-sections/'))) {
      return new Promise<Response>((resolve) => {
        requests.push({ path: url, body: requestBody(init), resolve });
      });
    }
    throw new Error(`未模拟的请求：${method} ${url}`);
  });

  return {
    requests,
    resolve(path: string, body: Record<string, unknown>) {
      const request = requests.find((candidate) => candidate.path === path && !candidate.body.__resolved);
      if (!request) throw new Error(`未找到 pending 请求：${path}`);
      request.body.__resolved = true;
      if (path.startsWith('/api/review-boards/')) {
        const board = boards.find(({ id }) => path.endsWith(id));
        if (!board) throw new Error('未找到大板块');
        board.hidden = Boolean(body.hidden);
        request.resolve(jsonResponse({ board: structuredClone(board) }));
      } else {
        const section = boards.flatMap(({ sections }) => sections).find(({ id }) => path.endsWith(id));
        if (!section) throw new Error('未找到小板块');
        section.hidden = Boolean(body.hidden);
        request.resolve(jsonResponse({ section: structuredClone(section) }));
      }
    },
  };
}

function expectRequest(path: string, body: Record<string, unknown>) {
  const matchingCall = vi.mocked(fetch).mock.calls.find(([input, init]) => (
    String(input) === path
    && init?.method === 'PATCH'
    && JSON.stringify(requestBody(init)) === JSON.stringify(body)
  ));
  expect(matchingCall).toBeDefined();
}

function expectNoDeleteRequest() {
  expect(vi.mocked(fetch).mock.calls.some(([, init]) => init?.method === 'DELETE')).toBe(false);
}
