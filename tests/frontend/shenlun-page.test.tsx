// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ShenlunPage } from '../../src/pages/ShenlunPage';
import { shenlunDraftStorageKey } from '../../src/shenlun/draft';

const emptyListResponse = () => new Response(JSON.stringify([]), {
  status: 200,
  headers: { 'Content-Type': 'application/json' },
});

function renderPage(path = '/shenlun') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/shenlun" element={<ShenlunPage />} />
        <Route path="/shenlun/:reviewId" element={<ShenlunPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  window.localStorage.clear();
  vi.stubGlobal('print', vi.fn());
  vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(emptyListResponse())));
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('申论页面', () => {
  it('默认显示 400 字、固定 25 列和紧凑编辑工具栏', () => {
    const { container } = renderPage();

    expect(screen.getByRole('heading', { level: 1, name: '申论' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '400字' })).toHaveAttribute('aria-pressed', 'true');
    expect(container.querySelectorAll('.shenlun-row')).toHaveLength(16);
    expect(container.querySelectorAll('.shenlun-row:first-child .shenlun-cell')).toHaveLength(25);
    expect(screen.getByRole('button', { name: '加粗' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '下划线' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '删除线' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '保存回顾' })).toBeInTheDocument();
    expect(document.querySelector('.shenlun-title-print')).toHaveTextContent('未命名申论');
    expect(screen.queryByRole('button', { name: /粘贴文本/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /清空答题|清空备注/ })).not.toBeInTheDocument();
  });

  it('点击任意空白方格后输入，并可用 Ctrl+A 和 Delete 清空正文', async () => {
    const user = userEvent.setup();
    const { container } = renderPage();
    const sixthCell = container.querySelector<HTMLElement>('[data-cell-index="5"]');
    expect(sixthCell).not.toBeNull();

    await user.click(sixthCell!);
    const editor = screen.getByRole('textbox', { name: '申论正文编辑区' });
    fireEvent.keyDown(editor, { key: '申' });

    expect(screen.getByText('已用 1 / 400 字')).toBeInTheDocument();
    expect(container.querySelector('[data-source-index="5"]')).toHaveTextContent('申');

    fireEvent.keyDown(editor, { ctrlKey: true, key: 'a' });
    fireEvent.keyDown(editor, { key: 'Delete' });
    expect(screen.getByText('已用 0 / 400 字')).toBeInTheDocument();
  });

  it('键盘粘贴从当前光标插入，超限时刷新水印和淡红警示', async () => {
    const user = userEvent.setup();
    const { container } = renderPage();
    await user.click(screen.getByRole('button', { name: '200字' }));
    await user.click(container.querySelector<HTMLElement>('[data-cell-index="0"]')!);
    const editor = screen.getByRole('textbox', { name: '申论正文编辑区' });

    fireEvent.paste(editor, {
      clipboardData: { getData: () => '申'.repeat(201) },
    });

    expect(screen.getByText('已用 201 / 200 字')).toBeInTheDocument();
    expect(screen.getByText('(200字)')).toBeInTheDocument();
    expect(container.querySelectorAll('.shenlun-row')).toHaveLength(9);
    expect(container.querySelectorAll('.shenlun-cell--overflow')).toHaveLength(1);
  });

  it('支持从当前选区复制可见文本，并用剪切删除正文', async () => {
    const user = userEvent.setup();
    const { container } = renderPage();
    await user.click(container.querySelector<HTMLElement>('[data-cell-index="5"]')!);
    const editor = screen.getByRole('textbox', { name: '申论正文编辑区' });
    fireEvent.paste(editor, { clipboardData: { getData: () => '申论' } });
    fireEvent.keyDown(editor, { ctrlKey: true, key: 'a' });

    const setCopyData = vi.fn();
    fireEvent.copy(editor, { clipboardData: { setData: setCopyData } });
    expect(setCopyData).toHaveBeenCalledWith('text/plain', '申论');

    const setCutData = vi.fn();
    fireEvent.cut(editor, { clipboardData: { setData: setCutData } });
    expect(setCutData).toHaveBeenCalledWith('text/plain', '申论');
    expect(screen.getByText('已用 0 / 400 字')).toBeInTheDocument();
  });

  it('选区支持加粗、下划线、删除线以及撤销重做快捷键', async () => {
    const user = userEvent.setup();
    const { container } = renderPage();
    await user.click(container.querySelector<HTMLElement>('[data-cell-index="0"]')!);
    const editor = screen.getByRole('textbox', { name: '申论正文编辑区' });
    fireEvent.paste(editor, { clipboardData: { getData: () => '申论格式' } });
    fireEvent.keyDown(editor, { ctrlKey: true, key: 'a' });
    fireEvent.keyDown(editor, { ctrlKey: true, key: 'b' });
    fireEvent.keyDown(editor, { ctrlKey: true, key: 'u' });
    fireEvent.keyDown(editor, { ctrlKey: true, shiftKey: true, key: 'x' });

    expect(container.querySelectorAll('.shenlun-cell__character--bold')).toHaveLength(4);
    expect(container.querySelectorAll('.shenlun-cell__character--underline')).toHaveLength(4);
    expect(container.querySelectorAll('.shenlun-cell__character--strike')).toHaveLength(4);

    fireEvent.keyDown(editor, { ctrlKey: true, key: 'z' });
    expect(container.querySelectorAll('.shenlun-cell__character--strike')).toHaveLength(0);
    fireEvent.keyDown(editor, { ctrlKey: true, key: 'y' });
    expect(container.querySelectorAll('.shenlun-cell__character--strike')).toHaveLength(4);
  });

  it('跨格选区支持设置文字颜色', async () => {
    const user = userEvent.setup();
    const { container } = renderPage();
    await user.click(container.querySelector<HTMLElement>('[data-cell-index="0"]')!);
    const editor = screen.getByRole('textbox', { name: '申论正文编辑区' });
    fireEvent.paste(editor, { clipboardData: { getData: () => '申论格式' } });
    fireEvent.keyDown(editor, { ctrlKey: true, key: 'a' });

    await user.click(screen.getByRole('button', { name: '文字颜色：红色' }));

    expect(container.querySelectorAll('.shenlun-cell__character--color-red')).toHaveLength(4);
  });

  it('从右向左拖选时包含起点格、目标格和中间全部文字', async () => {
    const user = userEvent.setup();
    const { container } = renderPage();
    await user.click(container.querySelector<HTMLElement>('[data-cell-index="0"]')!);
    const editor = screen.getByRole('textbox', { name: '申论正文编辑区' });
    fireEvent.paste(editor, { clipboardData: { getData: () => '甲乙丙' } });

    const thirdCell = container.querySelector<HTMLElement>('[data-cell-index="2"]')!;
    const firstCell = container.querySelector<HTMLElement>('[data-cell-index="0"]')!;
    fireEvent.mouseDown(thirdCell, { buttons: 1 });
    fireEvent.mouseEnter(firstCell, { buttons: 1 });
    fireEvent.keyDown(editor, { ctrlKey: true, key: 'b' });

    expect(container.querySelectorAll('.shenlun-cell__character--bold')).toHaveLength(3);
  });

  it('选中文字后把添加批注入口悬浮在选区末格旁边', async () => {
    const user = userEvent.setup();
    const { container } = renderPage();
    await user.click(container.querySelector<HTMLElement>('[data-cell-index="0"]')!);
    const editor = screen.getByRole('textbox', { name: '申论正文编辑区' });
    fireEvent.paste(editor, { clipboardData: { getData: () => '甲乙丙' } });

    const firstCell = container.querySelector<HTMLElement>('[data-cell-index="0"]')!;
    const thirdCell = container.querySelector<HTMLElement>('[data-cell-index="2"]')!;
    vi.spyOn(thirdCell, 'getBoundingClientRect').mockReturnValue({
      bottom: 110,
      height: 30,
      left: 100,
      right: 130,
      top: 80,
      width: 30,
      x: 100,
      y: 80,
      toJSON: () => ({}),
    } as DOMRect);

    fireEvent.mouseDown(firstCell, { buttons: 1 });
    fireEvent.mouseEnter(thirdCell, { buttons: 1 });

    const action = (await screen.findByRole('button', { name: '添加批注' }))
      .closest<HTMLElement>('.shenlun-selection-action')!;
    await waitFor(() => expect(action).toHaveStyle({ left: '138px', top: '76px' }));
    expect(action.parentElement).toBe(document.body);
    expect(action.closest('.shenlun-sheet-scroll')).toBeNull();
  });

  it('写作焦点下支持模板、保存和批注快捷键', async () => {
    const user = userEvent.setup();
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({
      id: 'review-shortcut',
      title: '甲乙',
      template: 200,
      text: '甲乙',
      marks: [],
      notes: '',
      standardAnswer: '',
      annotations: [],
      createdAt: '2026-08-09T00:00:00.000Z',
      updatedAt: '2026-08-09T00:00:00.000Z',
    }), { status: 201, headers: { 'Content-Type': 'application/json' } }));
    const { container } = renderPage();
    await user.click(container.querySelector<HTMLElement>('[data-cell-index="0"]')!);
    const editor = screen.getByRole('textbox', { name: '申论正文编辑区' });
    fireEvent.paste(editor, { clipboardData: { getData: () => '甲乙' } });

    fireEvent.keyDown(editor, { altKey: true, key: '1' });
    expect(screen.getByRole('button', { name: '200字' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('已用 2 / 200 字')).toBeInTheDocument();

    fireEvent.keyDown(editor, { ctrlKey: true, key: 's' });
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('已保存'));

    fireEvent.keyDown(editor, { ctrlKey: true, key: 'a' });
    fireEvent.keyDown(editor, { ctrlKey: true, key: 'Enter' });
    expect(screen.getByRole('textbox', { name: '批注内容' })).toBeInTheDocument();
    fireEvent.keyDown(editor, { key: 'Escape' });
    expect(screen.queryByRole('textbox', { name: '批注内容' })).not.toBeInTheDocument();
  });

  it('方向键移动自定义光标，移动端输入事件也能写入正文', async () => {
    const user = userEvent.setup();
    const { container } = renderPage();
    await user.click(container.querySelector<HTMLElement>('[data-cell-index="0"]')!);
    const editor = screen.getByRole('textbox', { name: '申论正文编辑区' });
    fireEvent.paste(editor, { clipboardData: { getData: () => '甲乙' } });
    fireEvent.keyDown(editor, { key: 'ArrowLeft' });
    fireEvent.keyDown(editor, { key: '丙' });
    expect(screen.getByRole('textbox', { name: '标题' })).toHaveValue('甲丙乙');

    fireEvent.change(editor, { target: { value: '丁' } });
    expect(screen.getByRole('textbox', { name: '标题' })).toHaveValue('甲丙丁乙');
  });

  it('中文输入法未提供组合结果时仍从输入框提交文字且不崩溃', async () => {
    const user = userEvent.setup();
    const { container } = renderPage();
    await user.click(container.querySelector<HTMLElement>('[data-cell-index="0"]')!);
    const editor = screen.getByRole('textbox', { name: '申论正文编辑区' });

    fireEvent.compositionStart(editor);
    fireEvent.keyDown(editor, { key: '申' });
    fireEvent.change(editor, { target: { value: '申' } });
    fireEvent.compositionEnd(editor);
    fireEvent.change(editor, { target: { value: '申' } });

    expect(screen.getByText('已用 1 / 400 字')).toBeInTheDocument();
    expect(container.querySelector('[data-source-index="0"]')).toHaveTextContent('申');
  });

  it('输入代理跟随末格显示拼音，并可从模板最后一格继续写入溢出格', async () => {
    const user = userEvent.setup();
    const { container } = renderPage();
    await user.click(screen.getByRole('button', { name: '200字' }));
    const lastCell = container.querySelector<HTMLElement>('[data-cell-index="199"]')!;
    vi.spyOn(lastCell, 'getBoundingClientRect').mockReturnValue({
      bottom: 150,
      height: 30,
      left: 100,
      right: 130,
      top: 120,
      width: 30,
      x: 100,
      y: 120,
      toJSON: () => ({}),
    } as DOMRect);

    await user.click(lastCell);
    const editor = screen.getByRole('textbox', { name: '申论正文编辑区' });
    await waitFor(() => {
      expect(editor).toHaveStyle({ left: '100px', top: '120px', height: '30px' });
    });

    fireEvent.compositionStart(editor);
    fireEvent.change(editor, { target: { value: 'mo' } });
    expect(editor).toHaveValue('mo');
    fireEvent.change(editor, { target: { value: '末' } });
    fireEvent.compositionEnd(editor, { data: '末' });

    expect(screen.getByText('已用 1 / 200 字')).toBeInTheDocument();
    expect(container.querySelector('[data-cell-index="199"]')).toHaveTextContent('末');
    expect(container.querySelector('[data-cell-index="199"]')).toHaveClass('shenlun-cell--caret-end');

    fireEvent.compositionStart(editor);
    fireEvent.change(editor, { target: { value: 'xu' } });
    expect(editor).toHaveValue('xu');
    fireEvent.change(editor, { target: { value: '续' } });
    fireEvent.compositionEnd(editor, { data: '续' });

    expect(screen.getByText('已用 2 / 200 字')).toBeInTheDocument();
    expect(container.querySelector('[data-cell-index="200"]')).toHaveTextContent('续');
  });

  it('再次点击当前光标格时重新对齐输入法代理位置', async () => {
    const user = userEvent.setup();
    const { container } = renderPage();
    const firstCell = container.querySelector<HTMLElement>('[data-cell-index="0"]')!;
    const editor = screen.getByRole('textbox', { name: '申论正文编辑区' });
    let leftAtFocus = '';
    vi.spyOn(editor, 'focus').mockImplementation(() => {
      leftAtFocus = editor.style.left;
    });
    vi.spyOn(firstCell, 'getBoundingClientRect').mockReturnValue({
      bottom: 180,
      height: 30,
      left: 140,
      right: 170,
      top: 150,
      width: 30,
      x: 140,
      y: 150,
      toJSON: () => ({}),
    } as DOMRect);

    await user.click(firstCell);

    expect(editor.parentElement).toBe(document.body);
    expect(leftAtFocus).toBe('140px');
    await waitFor(() => {
      expect(editor).toHaveStyle({ left: '140px', top: '150px', height: '30px' });
    });
  });

  it('页面滚动后输入法代理继续跟随当前方格', async () => {
    const user = userEvent.setup();
    const { container } = renderPage();
    const firstCell = container.querySelector<HTMLElement>('[data-cell-index="0"]')!;
    let top = 150;
    vi.spyOn(firstCell, 'getBoundingClientRect').mockImplementation(() => ({
      bottom: top + 30,
      height: 30,
      left: 140,
      right: 170,
      top,
      width: 30,
      x: 140,
      y: top,
      toJSON: () => ({}),
    } as DOMRect));
    await user.click(firstCell);
    const editor = screen.getByRole('textbox', { name: '申论正文编辑区' });
    expect(editor).toHaveStyle({ top: '150px' });

    top = 80;
    fireEvent.scroll(window);

    await waitFor(() => expect(editor).toHaveStyle({ top: '80px' }));
  });

  it('空格作为正文字符占一格并计入总字数', async () => {
    const user = userEvent.setup();
    const { container } = renderPage();
    await user.click(container.querySelector<HTMLElement>('[data-cell-index="0"]')!);
    const editor = screen.getByRole('textbox', { name: '申论正文编辑区' });

    fireEvent.keyDown(editor, { key: ' ' });

    expect(screen.getByText('已用 1 / 400 字')).toBeInTheDocument();
  });

  it('标准答案支持直接输入和 txt/md 文件导入', async () => {
    const user = userEvent.setup();
    renderPage();
    const standardAnswer = screen.getByRole('textbox', { name: '标准答案' });
    await user.type(standardAnswer, '直接输入');
    expect(standardAnswer).toHaveValue('直接输入');
    expect(document.querySelector('.shenlun-standard-answer__print')).toHaveTextContent('直接输入');

    const file = new File(['文件答案'], 'answer.md', { type: 'text/markdown' });
    await user.upload(screen.getByLabelText('导入标准答案文件'), file);
    await waitFor(() => expect(standardAnswer).toHaveValue('文件答案'));
    expect(document.querySelector('.shenlun-standard-answer__print')).toHaveTextContent('文件答案');
  });

  it('新建保存使用 POST，随后同页保存更新原记录', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({
        id: 'review-1',
        title: '申论正文',
        template: 400,
        text: '申论正文',
        marks: [],
        notes: '',
        standardAnswer: '',
        annotations: [],
        createdAt: '2026-08-09T00:00:00.000Z',
        updatedAt: '2026-08-09T00:00:00.000Z',
      }), { status: 201, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        id: 'review-1',
        title: '申论正文',
        template: 400,
        text: '申论正文',
        marks: [],
        notes: '',
        standardAnswer: '',
        annotations: [],
        createdAt: '2026-08-09T00:00:00.000Z',
        updatedAt: '2026-08-09T00:01:00.000Z',
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    const { container } = renderPage();
    await user.click(container.querySelector<HTMLElement>('[data-cell-index="0"]')!);
    fireEvent.paste(screen.getByRole('textbox', { name: '申论正文编辑区' }), {
      clipboardData: { getData: () => '申论正文' },
    });

    await user.click(screen.getByRole('button', { name: '保存回顾' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('已保存'));
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/shenlun-reviews');
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ method: 'POST' });

    await user.click(screen.getByRole('button', { name: '保存回顾' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchMock.mock.calls[1]?.[0]).toBe('/api/shenlun-reviews/review-1');
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({ method: 'PUT' });
  });

  it('从已保存稿新建空白申论时不覆盖旧记录', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockImplementation(async (input, init) => {
      const path = String(input);
      if (path === '/api/shenlun-reviews/saved-review' && !init?.method) {
        return new Response(JSON.stringify({
          id: 'saved-review',
          title: '已经保存的旧稿',
          template: 800,
          text: '旧稿正文',
          marks: [{ id: 'old-mark', type: 'bold', start: 0, end: 2 }],
          notes: '旧稿备注',
          standardAnswer: '旧稿标准答案',
          annotations: [],
          createdAt: '2026-08-09T00:00:00.000Z',
          updatedAt: '2026-08-09T00:00:00.000Z',
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      if (path === '/api/shenlun-reviews' && init?.method === 'POST') {
        const body = JSON.parse(String(init.body));
        return new Response(JSON.stringify({
          id: 'new-review',
          ...body,
          createdAt: '2026-08-09T01:00:00.000Z',
          updatedAt: '2026-08-09T01:00:00.000Z',
        }), { status: 201, headers: { 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify({ code: 'unexpected_request' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    });
    const { container } = renderPage('/shenlun/saved-review');
    await waitFor(() => expect(screen.getByRole('textbox', { name: '标题' })).toHaveValue('已经保存的旧稿'));

    await user.click(screen.getByRole('button', { name: '新建申论' }));

    expect(screen.getByRole('textbox', { name: '标题' })).toHaveValue('');
    expect(screen.getByText('已用 0 / 400 字')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: '标准答案' })).toHaveValue('');
    expect(screen.getByRole('textbox', { name: '普通备注' })).toHaveValue('');

    await user.click(container.querySelector<HTMLElement>('[data-cell-index="0"]')!);
    fireEvent.paste(screen.getByRole('textbox', { name: '申论正文编辑区' }), {
      clipboardData: { getData: () => '全新申论正文' },
    });
    await user.click(screen.getByRole('button', { name: '保存回顾' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('已保存'));

    expect(fetchMock).toHaveBeenCalledWith('/api/shenlun-reviews', expect.objectContaining({ method: 'POST' }));
    expect(fetchMock.mock.calls.some(([path, init]) => (
      String(path) === '/api/shenlun-reviews/saved-review' && init?.method === 'PUT'
    ))).toBe(false);
  });

  it('原复盘记录不存在时自动新建并恢复保存状态', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockImplementation(async (input, init) => {
      const path = String(input);
      if (path === '/api/shenlun-reviews/missing-review' && !init?.method) {
        return new Response(JSON.stringify({ code: 'not_found', message: '申论复盘不存在' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (path === '/api/shenlun-reviews/missing-review' && init?.method === 'PUT') {
        return new Response(JSON.stringify({ code: 'not_found', message: '申论复盘不存在' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (path === '/api/shenlun-reviews' && init?.method === 'POST') {
        const body = JSON.parse(String(init.body));
        return new Response(JSON.stringify({
          ...body,
          id: 'replacement-review',
          createdAt: '2026-08-09T00:00:00.000Z',
          updatedAt: '2026-08-09T00:00:00.000Z',
        }), { status: 201, headers: { 'Content-Type': 'application/json' } });
      }
      return emptyListResponse();
    });
    const { container } = renderPage('/shenlun/missing-review');
    await user.click(container.querySelector<HTMLElement>('[data-cell-index="0"]')!);
    fireEvent.keyDown(screen.getByRole('textbox', { name: '申论正文编辑区' }), { key: '申' });

    await user.click(screen.getByRole('button', { name: '保存回顾' }));

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('已保存'));
    expect(fetchMock.mock.calls.some(([path, init]) => (
      path === '/api/shenlun-reviews/missing-review' && init?.method === 'PUT'
    ))).toBe(true);
    expect(fetchMock.mock.calls.some(([path, init]) => (
      path === '/api/shenlun-reviews' && init?.method === 'POST'
    ))).toBe(true);
  });

  it('保存后修改模板会清除已保存状态', async () => {
    const user = userEvent.setup();
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({
      id: 'review-dirty',
      title: '申论正文',
      template: 400,
      text: '申论正文',
      marks: [],
      notes: '',
      standardAnswer: '',
      annotations: [],
      createdAt: '2026-08-09T00:00:00.000Z',
      updatedAt: '2026-08-09T00:00:00.000Z',
    }), { status: 201, headers: { 'Content-Type': 'application/json' } }));
    const { container } = renderPage();
    await user.click(container.querySelector<HTMLElement>('[data-cell-index="0"]')!);
    fireEvent.paste(screen.getByRole('textbox', { name: '申论正文编辑区' }), {
      clipboardData: { getData: () => '申论正文' },
    });
    await user.click(screen.getByRole('button', { name: '保存回顾' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('已保存'));

    await user.click(screen.getByRole('button', { name: '200字' }));

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('保存请求期间继续编辑时不误报最新内容已保存', async () => {
    const user = userEvent.setup();
    let resolveSave!: (response: Response) => void;
    vi.mocked(fetch).mockReturnValueOnce(new Promise((resolve) => { resolveSave = resolve; }));
    const { container } = renderPage();
    await user.click(container.querySelector<HTMLElement>('[data-cell-index="0"]')!);
    const editor = screen.getByRole('textbox', { name: '申论正文编辑区' });
    fireEvent.paste(editor, { clipboardData: { getData: () => '旧稿' } });
    await user.click(screen.getByRole('button', { name: '保存回顾' }));
    fireEvent.keyDown(editor, { key: '新' });

    resolveSave(new Response(JSON.stringify({
      id: 'review-race',
      title: '旧稿',
      template: 400,
      text: '旧稿',
      marks: [],
      notes: '',
      standardAnswer: '',
      annotations: [],
      createdAt: '2026-08-09T00:00:00.000Z',
      updatedAt: '2026-08-09T00:00:00.000Z',
    }), { status: 201, headers: { 'Content-Type': 'application/json' } }));

    await waitFor(() => expect(screen.getByRole('button', { name: '保存回顾' })).not.toBeDisabled());
    expect(screen.queryByText('已保存')).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: '标题' })).toHaveValue('旧稿新');
  });

  it('从本地草稿恢复原记录编号后继续使用 PUT 更新', async () => {
    const user = userEvent.setup();
    window.localStorage.setItem(shenlunDraftStorageKey, JSON.stringify({
      version: 2,
      template: 400,
      title: '续写原记录',
      titleTouched: true,
      text: '原正文',
      standardAnswer: '',
      marks: [],
      notes: '',
      annotations: [],
      reviewId: 'review-local',
    }));
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({
      id: 'review-local',
      title: '续写原记录',
      template: 400,
      text: '原正文',
      marks: [],
      notes: '',
      standardAnswer: '',
      annotations: [],
      createdAt: '2026-08-09T00:00:00.000Z',
      updatedAt: '2026-08-09T00:01:00.000Z',
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    renderPage();

    await user.click(screen.getByRole('button', { name: '保存回顾' }));

    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(vi.mocked(fetch).mock.calls[0]?.[0]).toBe('/api/shenlun-reviews/review-local');
    expect(vi.mocked(fetch).mock.calls[0]?.[1]).toMatchObject({ method: 'PUT' });
  });

  it('横向滚动答题纸时重新计算批注箭头', async () => {
    const requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
      const id = window.setTimeout(() => callback(0), 0);
      return id;
    });
    vi.stubGlobal('requestAnimationFrame', requestAnimationFrame);
    window.localStorage.setItem(shenlunDraftStorageKey, JSON.stringify({
      version: 2,
      template: 400,
      title: '箭头复算',
      titleTouched: true,
      text: '甲',
      standardAnswer: '',
      marks: [],
      notes: '',
      annotations: [{
        id: 'arrow-1',
        start: 0,
        end: 1,
        quote: '甲',
        body: '批注',
        createdAt: '2026-08-09T00:00:00.000Z',
        detached: false,
      }],
    }));
    const { container } = renderPage();
    const connectors = await waitFor(() => {
      const element = container.querySelector('.shenlun-connectors');
      expect(element).toBeInTheDocument();
      return element!;
    });
    expect(connectors.querySelector('path[marker-end]')).toHaveAttribute('stroke', 'currentColor');
    expect(connectors.querySelector('marker path')).toHaveAttribute('fill', 'currentColor');
    requestAnimationFrame.mockClear();

    fireEvent.scroll(container.querySelector('.shenlun-sheet-scroll')!);

    expect(requestAnimationFrame).toHaveBeenCalledTimes(1);
  });

  it('从复盘记录进入时加载详情，并更新原记录', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.mocked(fetch);
    const detail = {
      id: 'review-2',
      title: '已保存标题',
      template: 800,
      text: '已保存正文',
      marks: [{ id: 'mark-1', type: 'bold', start: 0, end: 3 }],
      notes: '已保存备注',
      standardAnswer: '已保存答案',
      annotations: [],
      createdAt: '2026-08-09T00:00:00.000Z',
      updatedAt: '2026-08-09T00:00:00.000Z',
    };
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify(detail), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify(detail), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }));

    renderPage('/shenlun/review-2');
    await waitFor(() => expect(screen.getByRole('textbox', { name: '标题' })).toHaveValue('已保存标题'));
    expect(screen.getByRole('textbox', { name: '标准答案' })).toHaveValue('已保存答案');
    expect(screen.getByRole('textbox', { name: '普通备注' })).toHaveValue('已保存备注');

    await user.click(screen.getByRole('button', { name: '保存回顾' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchMock.mock.calls[1]?.[0]).toBe('/api/shenlun-reviews/review-2');
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({ method: 'PUT' });
  });

  it('自动保存 v2 本地草稿并恢复标准答案和备注', async () => {
    const user = userEvent.setup();
    const first = renderPage();
    await user.type(screen.getByRole('textbox', { name: '标准答案' }), '本地答案');
    await user.type(screen.getByRole('textbox', { name: '普通备注' }), '本地备注');
    first.unmount();

    renderPage();
    expect(screen.getByRole('textbox', { name: '标准答案' })).toHaveValue('本地答案');
    expect(screen.getByRole('textbox', { name: '普通备注' })).toHaveValue('本地备注');
    expect(window.localStorage.getItem(shenlunDraftStorageKey)).toContain('"version":2');
  });

  it('刷新恢复自动标题后继续随正文更新', async () => {
    const first = renderPage();
    const firstCell = first.container.querySelector<HTMLElement>('[data-cell-index="0"]')!;
    fireEvent.mouseDown(firstCell);
    fireEvent.paste(screen.getByRole('textbox', { name: '申论正文编辑区' }), {
      clipboardData: { getData: () => '第一段' },
    });
    expect(screen.getByRole('textbox', { name: '标题' })).toHaveValue('第一段');
    first.unmount();

    renderPage();
    fireEvent.paste(screen.getByRole('textbox', { name: '申论正文编辑区' }), {
      clipboardData: { getData: () => '继续' },
    });

    expect(screen.getByRole('textbox', { name: '标题' })).toHaveValue('第一段继续');
    expect(document.querySelector('.shenlun-title-print')).toHaveTextContent('第一段继续');
  });

  it('右侧批注可上下交换顺序', async () => {
    const user = userEvent.setup();
    window.localStorage.setItem(shenlunDraftStorageKey, JSON.stringify({
      version: 2,
      template: 400,
      title: '批注排序',
      text: '甲乙',
      standardAnswer: '',
      marks: [],
      notes: '',
      annotations: [
        { id: 'a1', start: 0, end: 1, quote: '甲', body: '批注一', createdAt: '2026-08-09T00:00:00.000Z', detached: false },
        { id: 'a2', start: 1, end: 2, quote: '乙', body: '批注二', createdAt: '2026-08-09T00:00:01.000Z', detached: false },
      ],
    }));
    const { container } = renderPage();

    expect([...container.querySelectorAll('.shenlun-annotation-card__body')].map((item) => item.textContent)).toEqual(['批注一', '批注二']);
    await user.click(screen.getByRole('button', { name: '下移批注 甲' }));
    expect([...container.querySelectorAll('.shenlun-annotation-card__body')].map((item) => item.textContent)).toEqual(['批注二', '批注一']);
    expect(screen.getByRole('button', { name: '上移批注 甲' })).not.toBeDisabled();
  });
});
