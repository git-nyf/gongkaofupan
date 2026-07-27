// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ReviewPage } from '../../src/pages/ReviewPage';

interface ReviewSectionFixture {
  id: string;
  name: string;
  hidden: boolean;
  createdAt: string;
}

interface ReviewBoardFixture {
  id: string;
  name: string;
  hidden: boolean;
  createdAt: string;
  sections: ReviewSectionFixture[];
}

interface ReviewImageFixture {
  id: string;
  url: string;
  originalName: string;
  mimeType: string;
  byteSize: number;
  createdAt: string;
  sectionId: string;
}

const createdAt = '2026-07-20T00:00:00.000Z';

function section(id: string, name: string, hidden = false): ReviewSectionFixture {
  return { id, name, hidden, createdAt };
}

function board(
  id: string,
  name: string,
  sections: ReviewSectionFixture[],
  hidden = false,
): ReviewBoardFixture {
  return { id, name, hidden, createdAt, sections };
}

function reviewImage(id: string, originalName: string, sectionId: string): ReviewImageFixture {
  return {
    id,
    url: `/uploads/review/${id}.png`,
    originalName,
    mimeType: 'image/png',
    byteSize: 1024,
    createdAt,
    sectionId,
  };
}

function defaultBoards() {
  return [
    board('board-data', '资料', [section('section-data', '资料分析')]),
    board('board-language', '言语', [
      section('section-main-idea', '中心理解'),
      section('section-next', '后文推断'),
      section('section-fill', '逻辑填空'),
    ]),
    board('board-judgement', '判断', [section('section-figure', '图形推理')]),
  ];
}

function defaultImages() {
  return [
    reviewImage('data-one', '资料一.png', 'section-data'),
    reviewImage('data-two', '资料二.png', 'section-data'),
    reviewImage('language-one', '中心理解一.png', 'section-main-idea'),
    reviewImage('language-two', '中心理解二.png', 'section-main-idea'),
    reviewImage('next-one', '后文推断.png', 'section-next'),
    reviewImage('fill-one', '逻辑填空.png', 'section-fill'),
    reviewImage('judgement-one', '图形推理.png', 'section-figure'),
  ];
}

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
  initialBoards = defaultBoards(),
  initialImages = defaultImages(),
) {
  let boards = structuredClone(initialBoards);
  let images = structuredClone(initialImages);

  vi.mocked(fetch).mockImplementation(async (input, init) => {
    const url = String(input);
    const method = init?.method ?? 'GET';

    if (url === '/api/review-images' && method === 'GET') {
      return jsonResponse({ items: images, boards });
    }

    if (url === '/api/review-boards/order' && method === 'PUT') {
      const ids = requestBody(init).ids as string[];
      const boardsById = new Map(boards.map((item) => [item.id, item]));
      boards = ids.map((id) => boardsById.get(id)).filter((item): item is ReviewBoardFixture => Boolean(item));
      return jsonResponse({ boards: structuredClone(boards) });
    }

    if (url === '/api/review-boards' && method === 'POST') {
      const created = board('board-custom', String(requestBody(init).name), []);
      boards = [...boards, created];
      return jsonResponse({ board: created }, 201);
    }

    const boardSectionOrderMatch = url.match(/^\/api\/review-boards\/([^/]+)\/sections\/order$/);
    if (boardSectionOrderMatch && method === 'PUT') {
      const ids = requestBody(init).ids as string[];
      const updated = boards.find(({ id }) => id === boardSectionOrderMatch[1]);
      if (!updated) return jsonResponse({ code: 'not_found', message: 'not found' }, 404);
      const sectionsById = new Map(updated.sections.map((item) => [item.id, item]));
      updated.sections = ids
        .map((id) => sectionsById.get(id))
        .filter((item): item is ReviewSectionFixture => Boolean(item));
      return jsonResponse({ board: structuredClone(updated) });
    }

    const boardSectionMatch = url.match(/^\/api\/review-boards\/([^/]+)\/sections$/);
    if (boardSectionMatch && method === 'POST') {
      const created = section('section-custom', String(requestBody(init).name));
      boards = boards.map((item) => (
        item.id === boardSectionMatch[1]
          ? { ...item, sections: [...item.sections, created] }
          : item
      ));
      return jsonResponse({ section: created }, 201);
    }

    const boardMatch = url.match(/^\/api\/review-boards\/([^/]+)$/);
    if (boardMatch && method === 'PATCH') {
      const hidden = Boolean(requestBody(init).hidden);
      const updated = boards.find(({ id }) => id === boardMatch[1]);
      if (!updated) return jsonResponse({ code: 'not_found', message: 'not found' }, 404);
      Object.assign(updated, { hidden });
      return jsonResponse({ board: structuredClone(updated) });
    }

    const sectionMatch = url.match(/^\/api\/review-sections\/([^/]+)$/);
    if (sectionMatch && method === 'PATCH') {
      const hidden = Boolean(requestBody(init).hidden);
      let updated: ReviewSectionFixture | undefined;
      boards = boards.map((item) => ({
        ...item,
        sections: item.sections.map((child) => {
          if (child.id !== sectionMatch[1]) return child;
          updated = { ...child, hidden };
          return updated;
        }),
      }));
      return updated
        ? jsonResponse({ section: updated })
        : jsonResponse({ code: 'not_found', message: 'not found' }, 404);
    }

    const uploadUrl = new URL(url, 'http://localhost');
    if (uploadUrl.pathname === '/api/review-images' && method === 'POST') {
      const sectionId = uploadUrl.searchParams.get('sectionId') ?? '';
      const uploaded = reviewImage('uploaded', '新上传.png', sectionId);
      images = [...images, uploaded];
      return jsonResponse({ items: [uploaded] }, 201);
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

describe('错题积累多板块与图片查看器', () => {
  it('展示默认三个大板块和言语的三个小板块', async () => {
    mockReviewApi();

    render(<ReviewPage />);

    expect(await screen.findByRole('heading', { name: '资料' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '言语' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '判断' })).toBeInTheDocument();

    const languageSections = screen.getByRole('tablist', { name: '言语小板块' });
    expect(within(languageSections).getByRole('tab', { name: '中心理解' })).toBeInTheDocument();
    expect(within(languageSections).getByRole('tab', { name: '后文推断' })).toBeInTheDocument();
    expect(within(languageSections).getByRole('tab', { name: '逻辑填空' })).toBeInTheDocument();
  });

  it('切换言语小板块后只呈现该小板块的图片', async () => {
    mockReviewApi();
    const user = userEvent.setup();
    render(<ReviewPage />);

    const languageSections = await screen.findByRole('tablist', { name: '言语小板块' });
    expect(screen.getByRole('button', { name: '放大查看 中心理解一.png' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '放大查看 逻辑填空.png' })).not.toBeInTheDocument();

    await user.click(within(languageSections).getByRole('tab', { name: '逻辑填空' }));

    expect(screen.getByRole('button', { name: '放大查看 逻辑填空.png' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '放大查看 中心理解一.png' })).not.toBeInTheDocument();
  });

  it('可新增大板块并在其中新增小板块', async () => {
    mockReviewApi();
    const user = userEvent.setup();
    render(<ReviewPage />);
    await screen.findByRole('heading', { name: '资料' });

    await user.type(screen.getByLabelText('新大板块名称'), '常识');
    await user.click(screen.getByRole('button', { name: '新增大板块' }));

    expect(await screen.findByRole('heading', { name: '常识' })).toBeInTheDocument();
    expectJsonRequest('/api/review-boards', 'POST', { name: '常识' });

    await user.type(screen.getByLabelText('常识的新小板块名称'), '科技常识');
    await user.click(screen.getByRole('button', { name: '为常识新增小板块' }));

    const customSections = await screen.findByRole('tablist', { name: '常识小板块' });
    expect(within(customSections).getByRole('tab', { name: '科技常识' })).toBeInTheDocument();
    expectJsonRequest('/api/review-boards/board-custom/sections', 'POST', { name: '科技常识' });
  });

  it('归档大板块和小板块后从内容区消失，并可在管理区恢复且图片不被删除', async () => {
    mockReviewApi();
    const user = userEvent.setup();
    render(<ReviewPage />);
    await screen.findByRole('heading', { name: '判断' });

    await user.click(screen.getByText('管理板块'));
    await user.click(screen.getByRole('button', { name: '归档大板块 判断' }));
    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: '判断' })).not.toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: '恢复大板块 判断' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '恢复大板块 判断' }));
    expect(await screen.findByRole('heading', { name: '判断' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: '错题图片 图形推理.png' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '归档小板块 言语/后文推断' }));
    const languageSections = screen.getByRole('tablist', { name: '言语小板块' });
    await waitFor(() => {
      expect(within(languageSections).queryByRole('tab', { name: '后文推断' })).not.toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: '恢复小板块 言语/后文推断' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '恢复小板块 言语/后文推断' }));
    const restoredSection = await within(languageSections).findByRole('tab', { name: '后文推断' });
    await user.click(restoredSection);
    expect(screen.getByRole('img', { name: '错题图片 后文推断.png' })).toBeInTheDocument();
    expect(vi.mocked(fetch).mock.calls.some(([, init]) => init?.method === 'DELETE')).toBe(false);
  });

  it('仅重排活动板块并在完整 ids 中保留归档项位置', async () => {
    const boards = [
      board('board-data', '资料', [
        section('section-analysis', '资料分析'),
        section('section-archived', '已归档资料', true),
        section('section-speed', '速算技巧'),
        section('section-growth', '增长率'),
      ]),
      board('board-archived', '已归档大板块', [], true),
      board('board-language', '言语', [section('section-language', '中心理解')]),
      board('board-judgement', '判断', [section('section-figure', '图形推理')]),
    ];
    mockReviewApi(boards, []);
    const user = userEvent.setup();
    render(<ReviewPage />);
    await screen.findByRole('heading', { level: 2, name: '资料' });
    await user.click(screen.getByRole('button', { name: '管理板块' }));

    expect(screen.getByRole('button', { name: '上移大板块 资料' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '下移大板块 判断' })).toBeDisabled();
    const moveBoardDown = screen.getByRole('button', { name: '下移大板块 资料' });
    await user.click(moveBoardDown);

    expect(screen.getAllByRole('heading', { level: 2 }).map(({ textContent }) => textContent))
      .toEqual(['言语', '资料', '判断']);
    expectJsonRequest('/api/review-boards/order', 'PUT', {
      ids: ['board-language', 'board-archived', 'board-data', 'board-judgement'],
    });
    expect(moveBoardDown).toHaveFocus();

    const moveSectionDown = screen.getByRole('button', {
      name: '下移小板块 资料/资料分析',
    });
    await user.click(moveSectionDown);

    expect(within(screen.getByRole('tablist', { name: '资料小板块' }))
      .getAllByRole('tab').map(({ textContent }) => textContent))
      .toEqual(['速算技巧', '资料分析', '增长率']);
    expectJsonRequest('/api/review-boards/board-data/sections/order', 'PUT', {
      ids: ['section-speed', 'section-archived', 'section-analysis', 'section-growth'],
    });
    expect(moveSectionDown).toHaveFocus();
  });

  it('排序时只禁用相关控件，失败后回滚顺序并保留焦点', async () => {
    const boards = [
      board('board-data', '资料', [
        section('section-analysis', '资料分析'),
        section('section-speed', '速算技巧'),
      ]),
      board('board-language', '言语', [
        section('section-main-idea', '中心理解'),
        section('section-next', '后文推断'),
        section('section-fill', '逻辑填空'),
      ]),
      board('board-judgement', '判断', [section('section-figure', '图形推理')]),
    ];
    mockReviewApi(boards, []);
    const user = userEvent.setup();
    render(<ReviewPage />);
    await screen.findByRole('heading', { level: 2, name: '资料' });
    await user.click(screen.getByRole('button', { name: '管理板块' }));

    let finishBoardOrder: ((response: Response) => void) | undefined;
    vi.mocked(fetch).mockImplementation((input, init) => {
      if (String(input) === '/api/review-boards/order' && init?.method === 'PUT') {
        return new Promise<Response>((resolve) => {
          finishBoardOrder = resolve;
        });
      }
      throw new Error(`未模拟的请求：${init?.method ?? 'GET'} ${String(input)}`);
    });
    const moveBoardDown = screen.getByRole('button', { name: '下移大板块 资料' });
    await user.click(moveBoardDown);

    expect(screen.getAllByRole('heading', { level: 2 }).map(({ textContent }) => textContent))
      .toEqual(['言语', '资料', '判断']);
    expect(screen.getByRole('button', { name: '下移大板块 资料' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '下移小板块 言语/中心理解' })).toBeEnabled();
    expect(screen.getByRole('button', { name: '归档大板块 资料' })).toBeEnabled();
    finishBoardOrder?.(jsonResponse({ code: 'failed', message: 'failed' }, 500));

    await waitFor(() => {
      expect(screen.getAllByRole('heading', { level: 2 }).map(({ textContent }) => textContent))
        .toEqual(['资料', '言语', '判断']);
    });
    expect(screen.getByRole('alert')).toHaveTextContent('大板块排序失败，请稍后重试');
    expect(moveBoardDown).toHaveFocus();

    let finishSectionOrder: ((response: Response) => void) | undefined;
    vi.mocked(fetch).mockImplementation((input, init) => {
      if (
        String(input) === '/api/review-boards/board-language/sections/order'
        && init?.method === 'PUT'
      ) {
        return new Promise<Response>((resolve) => {
          finishSectionOrder = resolve;
        });
      }
      throw new Error(`未模拟的请求：${init?.method ?? 'GET'} ${String(input)}`);
    });
    const moveSectionDown = screen.getByRole('button', {
      name: '下移小板块 言语/中心理解',
    });
    await user.click(moveSectionDown);

    expect(within(screen.getByRole('tablist', { name: '言语小板块' }))
      .getAllByRole('tab').map(({ textContent }) => textContent))
      .toEqual(['后文推断', '中心理解', '逻辑填空']);
    expect(screen.getByRole('button', { name: '下移小板块 言语/中心理解' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '下移小板块 资料/资料分析' })).toBeEnabled();
    expect(screen.getByRole('button', { name: '下移大板块 资料' })).toBeEnabled();
    expect(screen.getByRole('button', { name: '归档小板块 言语/中心理解' })).toBeEnabled();
    finishSectionOrder?.(jsonResponse({ code: 'failed', message: 'failed' }, 500));

    await waitFor(() => {
      expect(within(screen.getByRole('tablist', { name: '言语小板块' }))
        .getAllByRole('tab').map(({ textContent }) => textContent))
        .toEqual(['中心理解', '后文推断', '逻辑填空']);
    });
    expect(screen.getByRole('alert')).toHaveTextContent('小板块排序失败，请稍后重试');
    expect(moveSectionDown).toHaveFocus();
  });

  it('上传请求携带当前选中小板块的 sectionId', async () => {
    mockReviewApi();
    const user = userEvent.setup();
    render(<ReviewPage />);

    const languageSections = await screen.findByRole('tablist', { name: '言语小板块' });
    await user.click(within(languageSections).getByRole('tab', { name: '逻辑填空' }));
    const dropzone = screen.getByRole('group', {
      name: '言语 / 逻辑填空 错题图片拖放与粘贴区域',
    });
    const file = new File(['png'], '新上传.png', { type: 'image/png' });

    fireEvent.drop(dropzone, {
      dataTransfer: { files: [file], types: ['Files'], dropEffect: 'none' },
    });

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        '/api/review-images?sectionId=section-fill',
        expect.objectContaining({ method: 'POST', body: expect.any(FormData) }),
      );
    });
  });

  it('聚焦某大板块舞台后，左右键只切换该板块的图片', async () => {
    mockReviewApi();
    render(<ReviewPage />);

    const languageStage = await screen.findByRole('group', {
      name: '言语 / 中心理解 错题图片拖放与粘贴区域',
    });
    const dataOne = screen.getByRole('img', { name: '错题图片 资料一.png' });
    const languageOne = screen.getByRole('img', { name: '错题图片 中心理解一.png' });
    const languageTwo = screen.getByRole('img', { name: '错题图片 中心理解二.png' });
    expect(dataOne.closest('figure')).toHaveAttribute('data-active', 'true');
    expect(languageOne.closest('figure')).toHaveAttribute('data-active', 'true');

    languageStage.focus();
    fireEvent.keyDown(languageStage, { key: 'ArrowRight' });

    expect(languageTwo.closest('figure')).toHaveAttribute('data-active', 'true');
    expect(languageOne.closest('figure')).toHaveAttribute('data-active', 'false');
    expect(dataOne.closest('figure')).toHaveAttribute('data-active', 'true');
  });

  it('点击图片可浅色放大查看，并可缩放、恢复和按 Esc 关闭', async () => {
    mockReviewApi();
    const user = userEvent.setup();
    render(<ReviewPage />);

    await user.click(await screen.findByRole('button', { name: '放大查看 中心理解二.png' }));
    const dialog = screen.getByRole('dialog', { name: '放大查看错题图片' });
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByText('100%')).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: '放大图片' }));
    expect(within(dialog).getByText('150%')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: '放大图片' }));
    expect(within(dialog).getByText('200%')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: '缩小图片' }));
    expect(within(dialog).getByText('150%')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: '恢复原始比例' }));
    expect(within(dialog).getByText('100%')).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: '放大查看错题图片' })).not.toBeInTheDocument();
  });
});

function expectJsonRequest(path: string, method: string, body: Record<string, unknown>) {
  const matchingCall = vi.mocked(fetch).mock.calls.find(([input, init]) => (
    String(input) === path && init?.method === method
  ));
  expect(matchingCall).toBeDefined();
  expect(requestBody(matchingCall?.[1])).toEqual(body);
}
