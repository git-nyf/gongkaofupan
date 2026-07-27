// @vitest-environment jsdom

import { readFileSync } from 'node:fs';
import {
  act,
  cleanup,
  createEvent,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ReviewPage } from '../../src/pages/ReviewPage';

const motionHarness = vi.hoisted(() => ({
  animations: [] as Array<{
    from: number;
    to: number;
    stopped: boolean;
    options: {
      onComplete?: () => void;
      onUpdate?: (value: number) => void;
    };
  }>,
  throwNext: false,
}));

vi.mock('motion', () => ({
  animate: vi.fn((from: number, to: number, options: {
    onComplete?: () => void;
    onUpdate?: (value: number) => void;
  }) => {
    if (motionHarness.throwNext) {
      motionHarness.throwNext = false;
      throw new Error('motion unavailable');
    }
    const animation = { from, to, options, stopped: false };
    motionHarness.animations.push(animation);
    return {
      stop: () => {
        animation.stopped = true;
      },
    };
  }),
}));

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
  sectionId: string;
  url: string;
  originalName: string;
  mimeType: string;
  byteSize: number;
  createdAt: string;
}

class TestPointerEvent extends MouseEvent {
  pointerId: number;
  isPrimary: boolean;

  constructor(type: string, init: PointerEventInit = {}) {
    super(type, init);
    this.pointerId = init.pointerId ?? 1;
    this.isPrimary = init.isPrimary ?? true;
  }
}

const createdAt = '2026-07-20T00:00:00.000Z';
const reviewCss = readFileSync('src/styles/review.css', 'utf8');
const generalSection = section('section-general', '综合');
const dataBoard = board('board-data', '资料', [generalSection]);

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

function reviewImage(
  id: string,
  name = `${id}.png`,
  sectionId = generalSection.id,
): ReviewImageFixture {
  return {
    id,
    sectionId,
    url: `/uploads/review/${id}.png`,
    originalName: name,
    mimeType: 'image/png',
    byteSize: 1024,
    createdAt,
  };
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function mockLoadedImages(
  items = [reviewImage('one'), reviewImage('two'), reviewImage('three')],
  boards: ReviewBoardFixture[] = [dataBoard],
) {
  vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ items, boards }));
  return items;
}

function mockCarouselGeometry(carousel: HTMLElement, step = 240) {
  Object.defineProperty(carousel, 'clientWidth', { configurable: true, value: 800 });
  for (const card of carousel.querySelectorAll<HTMLElement>('.review-card')) {
    vi.spyOn(card, 'getBoundingClientRect').mockImplementation(() => {
      const slot = Number(card.dataset.slot ?? 0);
      return DOMRect.fromRect({ x: 300 + slot * step, y: 100, width: 180, height: 240 });
    });
  }
}

beforeEach(() => {
  motionHarness.animations.length = 0;
  motionHarness.throwNext = false;
  vi.stubGlobal('fetch', vi.fn());
  vi.stubGlobal('PointerEvent', TestPointerEvent);
});

afterEach(() => {
  cleanup();
  delete document.documentElement.dataset.motion;
  vi.restoreAllMocks();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('错题积累图片轮播', () => {
  it('以白色玻璃覆盖板块、舞台和查看器且保持相纸内容清晰不透明', () => {
    expect(reviewCss).toMatch(/\.review-board\.liquid-glass\s*\{[^}]*background:\s*var\(--glass-regular\)/s);
    expect(reviewCss).toMatch(/\.review-stage\.liquid-glass\s*\{[^}]*background:\s*rgba\(255,\s*255,\s*255,/s);
    expect(reviewCss).toMatch(/\.review-viewer\.liquid-glass\s*\{[^}]*background:\s*rgba\(255,\s*255,\s*255,/s);
    expect(reviewCss).toMatch(/\.review-card__view\s*>\s*img\s*\{[^}]*opacity:\s*1;[^}]*filter:\s*none;/s);
    expect(reviewCss).toMatch(/\.review-carousel\[data-gesture-state[^}]*\.review-card\s*\{[^}]*transition:\s*none;/s);
    expect(reviewCss).toMatch(/\.review-page__add-board input\s*\{[^}]*background:\s*rgba\(255,\s*255,\s*255,/s);
    expect(reviewCss).toMatch(/\.review-page__add-board button\s*\{[^}]*min-height:\s*44px;[^}]*background:\s*rgba\(198,\s*66,\s*50,/s);
    expect(reviewCss).toMatch(/\.review-page__page-jump input\s*\{[^}]*width:\s*44px;[^}]*height:\s*44px;/s);
    expect(reviewCss).toMatch(/\.review-manager__board \.review-manager__order-button\s*\{[^}]*width:\s*44px;[^}]*height:\s*44px;/s);
    expect(reviewCss).toMatch(/\.review-board__collapse\s*\{[^}]*width:\s*44px;[^}]*height:\s*44px;[^}]*background:\s*rgba\(255,\s*255,\s*255,/s);
    expect(reviewCss).toMatch(/\.review-board__collapse\s*\{[^}]*transition:\s*opacity [^;]+,\s*transform [^;]+;/s);
    expect(reviewCss).toMatch(/\.review-board__collapse:active\s*\{[^}]*transform:\s*scale\(/s);
    expect(reviewCss).toMatch(/@keyframes review-board-content-in\s*\{[\s\S]*opacity:[\s\S]*transform:/);
    expect(reviewCss).toContain('@media (prefers-reduced-transparency: reduce)');
    expect(reviewCss).toContain('@media (prefers-contrast: more)');
    expect(reviewCss).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*\.review-manager__order-button/);
    expect(reviewCss).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*\.review-board__content[\s\S]*animation:\s*none;/);
    expect(reviewCss).toMatch(/html\[data-motion='reduced'\][\s\S]*\.review-board__content[\s\S]*animation:\s*none;/);
    expect(reviewCss).toMatch(/@media \(max-width: 700px\)[\s\S]*\.review-board__header-actions\s*\{[^}]*max-width:\s*100%;/);
    expect(reviewCss).toMatch(/@media \(min-width: 701px\) and \(max-width: 1100px\)\s*\{[^}]*\.page\.review-page\s*\{[^}]*width:\s*calc\(100% \+ 48px\);[^}]*margin:\s*-24px -24px -40px;/s);
  });

  it('按大板块和小板块加载图片并把第一张置于中心位', async () => {
    mockLoadedImages();

    render(<ReviewPage />);

    expect(screen.getByText('正在整理错题影像')).toBeInTheDocument();
    const firstImage = await screen.findByRole('img', { name: '错题图片 one.png' });
    expect(fetch).toHaveBeenCalledWith('/api/review-images', expect.anything());
    expect(screen.getByRole('heading', { level: 2, name: '资料' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '综合' })).toHaveAttribute('aria-selected', 'true');
    expect(firstImage.closest('figure')).toHaveAttribute('data-active', 'true');
    expect(screen.getByText('3 张错题')).toBeInTheDocument();
  });

  it('每个大板块默认完全展开并用唯一内容容器表达 ARIA 关系', async () => {
    const speechSection = section('section-speech', '中心理解');
    const speechBoard = board('board-speech', '言语', [speechSection]);
    mockLoadedImages(
      [reviewImage('data-one'), reviewImage('speech-one', 'speech-one.png', speechSection.id)],
      [dataBoard, speechBoard],
    );
    render(<ReviewPage />);

    await screen.findByRole('img', { name: '错题图片 data-one.png' });
    const dataToggle = screen.getByRole('button', { name: '收起板块 资料' });
    const speechToggle = screen.getByRole('button', { name: '收起板块 言语' });

    expect(dataToggle).toHaveAttribute('aria-expanded', 'true');
    expect(dataToggle).toHaveAttribute('aria-controls', 'review-board-content-board-data');
    expect(speechToggle).toHaveAttribute('aria-expanded', 'true');
    expect(speechToggle).toHaveAttribute('aria-controls', 'review-board-content-board-speech');
    expect(document.querySelectorAll('#review-board-content-board-data')).toHaveLength(1);
    expect(document.querySelectorAll('#review-board-content-board-speech')).toHaveLength(1);
    expect(screen.getByRole('tab', { name: '综合' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '中心理解' })).toBeInTheDocument();
  });

  it('大板块可独立收起且再次展开后恢复原活动图片', async () => {
    const speechSection = section('section-speech', '中心理解');
    const speechBoard = board('board-speech', '言语', [speechSection]);
    mockLoadedImages(
      [
        reviewImage('data-one'),
        reviewImage('data-two'),
        reviewImage('speech-one', 'speech-one.png', speechSection.id),
      ],
      [dataBoard, speechBoard],
    );
    const user = userEvent.setup();
    render(<ReviewPage />);

    await screen.findByRole('img', { name: '错题图片 data-one.png' });
    await user.click(screen.getByRole('button', { name: '底部下一张资料/综合错题图片' }));
    expect(screen.getByRole('img', { name: '错题图片 data-two.png' }).closest('figure'))
      .toHaveAttribute('data-active', 'true');

    await user.click(screen.getByRole('button', { name: '收起板块 资料' }));

    const dataBoardElement = screen.getByRole('heading', { level: 2, name: '资料' }).closest('article');
    expect(dataBoardElement).not.toBeNull();
    expect(within(dataBoardElement as HTMLElement).getByText('2 张')).toBeInTheDocument();
    const dataToggle = within(dataBoardElement as HTMLElement).getByRole('button', {
      name: '展开板块 资料',
    });
    expect(dataToggle).toHaveAttribute('aria-expanded', 'false');
    expect(dataToggle).toHaveAttribute('aria-controls', 'review-board-content-board-data');
    const collapsedContent = document.getElementById('review-board-content-board-data');
    expect(collapsedContent).toBeInTheDocument();
    expect(collapsedContent).toHaveAttribute('hidden');
    expect(collapsedContent).toBeEmptyDOMElement();
    expect(screen.queryByRole('tab', { name: '综合' })).not.toBeInTheDocument();
    expect(screen.queryByRole('img', { name: '错题图片 data-two.png' })).not.toBeInTheDocument();

    expect(screen.getByRole('button', { name: '收起板块 言语' }))
      .toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('tab', { name: '中心理解' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: '错题图片 speech-one.png' })).toBeInTheDocument();

    await user.click(dataToggle);
    expect(screen.getByRole('button', { name: '收起板块 资料' }))
      .toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('img', { name: '错题图片 data-two.png' }).closest('figure'))
      .toHaveAttribute('data-active', 'true');
    expect(screen.getByRole('spinbutton', {
      name: '跳转到资料/综合错题图片页码，共2页',
    })).toHaveValue(2);
  });

  it('页码输入支持聚焦、Enter 跳转和失焦边界修正', async () => {
    mockLoadedImages();
    const user = userEvent.setup();
    render(<ReviewPage />);

    const pageInput = await screen.findByRole('spinbutton', {
      name: '跳转到资料/综合错题图片页码，共3页',
    });
    expect(pageInput).toHaveValue(1);
    await user.click(pageInput);
    expect(pageInput).toHaveFocus();

    await user.clear(pageInput);
    await user.type(pageInput, '2{Enter}');
    expect(pageInput).toHaveFocus();
    expect(screen.getByRole('img', { name: '错题图片 two.png' }).closest('figure'))
      .toHaveAttribute('data-active', 'true');

    await user.clear(pageInput);
    await user.type(pageInput, '99');
    fireEvent.blur(pageInput);
    expect(pageInput).toHaveValue(3);
    expect(screen.getByRole('img', { name: '错题图片 three.png' }).closest('figure'))
      .toHaveAttribute('data-active', 'true');

    await user.clear(pageInput);
    await user.type(pageInput, '0{Enter}');
    expect(pageInput).toHaveValue(1);
    expect(screen.getByRole('img', { name: '错题图片 one.png' }).closest('figure'))
      .toHaveAttribute('data-active', 'true');
  });

  it('活动图片和图片总数变化时同步页码输入', async () => {
    mockLoadedImages();
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 204 }));
    const user = userEvent.setup();
    render(<ReviewPage />);
    const pageInput = await screen.findByRole('spinbutton', {
      name: '跳转到资料/综合错题图片页码，共3页',
    });

    await user.click(screen.getByRole('button', { name: '底部下一张资料/综合错题图片' }));
    expect(pageInput).toHaveValue(2);
    await user.clear(pageInput);
    await user.type(pageInput, '3{Enter}');
    await user.click(screen.getByRole('button', { name: '删除资料/综合当前错题图片' }));

    const updatedPageInput = await screen.findByRole('spinbutton', {
      name: '跳转到资料/综合错题图片页码，共2页',
    });
    expect(updatedPageInput).toHaveValue(2);
    expect(screen.getByText('/ 2')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: '错题图片 two.png' }).closest('figure'))
      .toHaveAttribute('data-active', 'true');
  });

  it('文件选择上传到当前小板块并切到新图片', async () => {
    mockLoadedImages([]);
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ items: [reviewImage('chosen', '文件选择.webp')] }, 201),
    );
    const user = userEvent.setup();
    render(<ReviewPage />);
    await screen.findByText('拖入第一张错题');

    const file = new File(['webp'], '文件选择.webp', { type: 'image/webp' });
    await user.upload(screen.getByLabelText('选择资料/综合错题图片'), file);

    expect(await screen.findByRole('img', { name: '错题图片 文件选择.webp' })).toBeInTheDocument();
    const [path, init] = vi.mocked(fetch).mock.calls[1] as [string, RequestInit];
    expect(path).toBe('/api/review-images?sectionId=section-general');
    expect(init.method).toBe('POST');
    expect(init.body).toBeInstanceOf(FormData);
    expect((init.body as FormData).getAll('image')).toEqual([file]);
  });

  it('接收从微信或 QQ 拖入的图片并上传到对应舞台', async () => {
    mockLoadedImages([]);
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ items: [reviewImage('drop', '微信截图.png')] }, 201),
    );
    render(<ReviewPage />);
    const dropzone = await screen.findByRole('group', {
      name: '资料 / 综合 错题图片拖放与粘贴区域',
    });
    const file = new File(['png'], '微信截图.png', { type: 'image/png' });
    const dataTransfer = { files: [file], types: ['Files'], dropEffect: 'none' };

    fireEvent.dragEnter(dropzone, { dataTransfer });
    expect(dropzone).toHaveClass('is-drag-active');
    fireEvent.drop(dropzone, { dataTransfer });

    expect(await screen.findByRole('img', { name: '错题图片 微信截图.png' })).toBeInTheDocument();
    expect((vi.mocked(fetch).mock.calls[1][1]?.body as FormData).getAll('image')).toEqual([file]);
  });

  it('接收剪贴板图片、阻止默认粘贴并上传', async () => {
    mockLoadedImages([]);
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ items: [reviewImage('paste', 'QQ截图.jpg')] }, 201),
    );
    render(<ReviewPage />);
    const dropzone = await screen.findByRole('group', {
      name: '资料 / 综合 错题图片拖放与粘贴区域',
    });
    const file = new File(['jpeg'], 'QQ截图.jpg', { type: 'image/jpeg' });
    const paste = createEvent.paste(dropzone, {
      clipboardData: {
        files: [],
        items: [{ kind: 'file', type: file.type, getAsFile: () => file }],
      },
    });

    fireEvent(dropzone, paste);

    expect(paste.defaultPrevented).toBe(true);
    expect(await screen.findByRole('img', { name: '错题图片 QQ截图.jpg' })).toBeInTheDocument();
    expect((vi.mocked(fetch).mock.calls[1][1]?.body as FormData).getAll('image')).toEqual([file]);
  });

  it('侧边和底部箭头都可循环切换当前小板块卡片', async () => {
    mockLoadedImages();
    const user = userEvent.setup();
    render(<ReviewPage />);
    await screen.findByRole('img', { name: '错题图片 one.png' });

    await user.click(screen.getByRole('button', { name: '上一张资料/综合错题图片' }));
    expect(screen.getByRole('img', { name: '错题图片 three.png' }).closest('figure')).toHaveAttribute('data-active', 'true');

    await user.click(screen.getByRole('button', { name: '底部下一张资料/综合错题图片' }));
    expect(screen.getByRole('img', { name: '错题图片 one.png' }).closest('figure')).toHaveAttribute('data-active', 'true');
  });

  it('从图片区域横向拖动超过阈值后切换卡片并回到稳定位置', async () => {
    mockLoadedImages();
    render(<ReviewPage />);
    await screen.findByRole('img', { name: '错题图片 one.png' });
    const carousel = screen.getByLabelText('资料/综合错题图片轮播');
    const imageButton = screen.getByRole('button', { name: '放大查看 one.png' });
    mockCarouselGeometry(carousel);

    fireEvent(imageButton, new MouseEvent('pointerdown', { bubbles: true, button: 0, clientX: 220 }));
    fireEvent(carousel, new MouseEvent('pointermove', { bubbles: true, clientX: 120 }));
    expect(carousel).toHaveClass('is-dragging');
    fireEvent(carousel, new MouseEvent('pointerup', { bubbles: true, clientX: 120 }));

    expect(carousel).not.toHaveClass('is-dragging');
    expect(carousel).toHaveAttribute('data-gesture-state', 'settling');
    expect(screen.getByRole('img', { name: '错题图片 two.png' }).closest('figure')).toHaveAttribute('data-active', 'true');
    expect(screen.queryByRole('dialog', { name: '放大查看错题图片' })).not.toBeInTheDocument();
    expect(screen.getByRole('img', { name: '错题图片 two.png' })).toHaveAttribute('draggable', 'false');
  });

  it('为板块、舞台、工具栏和查看器标注白色玻璃层级且不把图片按钮当作按压控件', async () => {
    mockLoadedImages([reviewImage('one')]);
    const user = userEvent.setup();
    render(<ReviewPage />);

    const imageButton = await screen.findByRole('button', { name: '放大查看 one.png' });
    const board = screen.getByRole('heading', { level: 2, name: '资料' }).closest('article');
    const stage = screen.getByRole('group', { name: '资料 / 综合 错题图片拖放与粘贴区域' });
    const toolbar = screen.getByText('综合 · 1 张').closest('.review-board__toolbar');
    const addBoardInput = screen.getByLabelText('新大板块名称');
    const addBoardForm = addBoardInput.closest('form');
    const addBoardButton = screen.getByRole('button', { name: '新增大板块' });

    expect(board).toHaveClass('liquid-glass', 'liquid-glass--regular');
    expect(stage).toHaveClass('liquid-glass', 'liquid-glass--thin');
    expect(toolbar).toHaveClass('liquid-glass__nested');
    expect(addBoardForm).toHaveClass('liquid-glass', 'liquid-glass--thin');
    expect(addBoardInput).toHaveClass('liquid-glass__nested');
    expect(addBoardButton).toHaveClass('liquid-glass__nested', 'liquid-pressable');
    expect(stage).not.toHaveClass('liquid-pressable');
    expect(imageButton).not.toHaveClass('liquid-pressable');

    await user.click(imageButton);
    expect(screen.getByRole('dialog', { name: '放大查看错题图片' }))
      .toHaveClass('liquid-glass', 'liquid-glass--thick');
    expect(screen.getByRole('button', { name: '关闭放大查看' })).toHaveClass('liquid-pressable');
  });

  it('多图轮播中心卡按下不取消原生点击并可打开查看器', async () => {
    mockLoadedImages();
    render(<ReviewPage />);
    const imageButton = await screen.findByRole('button', { name: '放大查看 one.png' });
    const carousel = screen.getByLabelText('资料/综合错题图片轮播');
    mockCarouselGeometry(carousel);
    const pointerDown = createEvent.pointerDown(imageButton, {
      bubbles: true,
      button: 0,
      clientX: 220,
      pointerId: 1,
    });

    fireEvent(imageButton, pointerDown);
    expect(pointerDown.defaultPrevented).toBe(false);
    fireEvent.pointerUp(carousel, { pointerId: 1, clientX: 220 });
    fireEvent.click(imageButton);
    expect(screen.getByRole('dialog', { name: '放大查看错题图片' })).toBeInTheDocument();
  });

  it('按下后经过 10px 迟滞才进入一比一拖拽并暴露手势状态', async () => {
    document.documentElement.dataset.motion = 'reduced';
    mockLoadedImages();
    render(<ReviewPage />);
    const imageButton = await screen.findByRole('button', { name: '放大查看 one.png' });
    const carousel = screen.getByLabelText('资料/综合错题图片轮播');
    mockCarouselGeometry(carousel);

    expect(carousel).toHaveAttribute('data-gesture-state', 'idle');
    fireEvent.pointerDown(imageButton, { pointerId: 1, button: 0, clientX: 220 });
    expect(carousel).toHaveAttribute('data-gesture-state', 'pressed');
    fireEvent.pointerMove(carousel, { pointerId: 1, clientX: 212 });
    expect(carousel).toHaveAttribute('data-gesture-state', 'pressed');
    expect(carousel).toHaveStyle({ '--review-carousel-drag-x': '0px' });

    fireEvent.pointerMove(carousel, { pointerId: 1, clientX: 192 });
    expect(carousel).toHaveAttribute('data-gesture-state', 'dragging');
    expect(carousel).toHaveStyle({ '--review-carousel-drag-x': '-28px' });
    fireEvent.pointerCancel(carousel, { pointerId: 1, clientX: 192 });
    expect(carousel).toHaveAttribute('data-gesture-state', 'idle');
    expect(carousel).toHaveStyle({ '--review-carousel-drag-x': '0px' });
  });

  it('慢速轻拖回到原卡，短距离快甩按速度投影切换下一张', async () => {
    document.documentElement.dataset.motion = 'reduced';
    let now = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    mockLoadedImages();
    render(<ReviewPage />);
    const carousel = await screen.findByLabelText('资料/综合错题图片轮播');
    const firstButton = screen.getByRole('button', { name: '放大查看 one.png' });
    mockCarouselGeometry(carousel);

    fireEvent.pointerDown(firstButton, { pointerId: 1, button: 0, clientX: 220 });
    now = 500;
    fireEvent.pointerMove(carousel, { pointerId: 1, clientX: 200 });
    now = 600;
    fireEvent.pointerUp(carousel, { pointerId: 1, clientX: 200 });
    expect(screen.getByRole('img', { name: '错题图片 one.png' }).closest('figure'))
      .toHaveAttribute('data-active', 'true');
    expect(carousel).toHaveAttribute('data-gesture-state', 'idle');

    now = 1000;
    fireEvent.pointerDown(firstButton, { pointerId: 2, button: 0, clientX: 220 });
    now = 1010;
    fireEvent.pointerMove(carousel, { pointerId: 2, clientX: 200 });
    now = 1020;
    fireEvent.pointerUp(carousel, { pointerId: 2, clientX: 200 });
    expect(screen.getByRole('img', { name: '错题图片 two.png' }).closest('figure'))
      .toHaveAttribute('data-active', 'true');
  });

  it('越过边界时使用渐进阻力且回弹未结束也能重新抓取', async () => {
    let now = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    mockLoadedImages();
    render(<ReviewPage />);
    const imageButton = await screen.findByRole('button', { name: '放大查看 one.png' });
    const carousel = screen.getByLabelText('资料/综合错题图片轮播');
    mockCarouselGeometry(carousel);

    fireEvent.pointerDown(imageButton, { pointerId: 1, button: 0, clientX: 220 });
    now = 300;
    fireEvent.pointerMove(carousel, { pointerId: 1, clientX: -180 });
    const resisted = Number.parseFloat(
      carousel.style.getPropertyValue('--review-carousel-drag-x'),
    );
    expect(resisted).toBeLessThan(-240);
    expect(resisted).toBeGreaterThan(-400);

    now = 600;
    fireEvent.pointerUp(carousel, { pointerId: 1, clientX: -180 });
    expect(carousel).toHaveAttribute('data-gesture-state', 'settling');
    fireEvent.pointerDown(imageButton, { pointerId: 2, button: 0, clientX: 220 });
    expect(carousel).toHaveAttribute('data-gesture-state', 'pressed');
  });

  it('按实际响应式卡位做 FLIP 补偿并从回弹呈现值连续重抓', async () => {
    let now = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    mockLoadedImages();
    render(<ReviewPage />);
    const carousel = await screen.findByLabelText('资料/综合错题图片轮播');
    mockCarouselGeometry(carousel, 260);
    const firstButton = screen.getByRole('button', { name: '放大查看 one.png' });

    fireEvent.pointerDown(firstButton, { pointerId: 1, button: 0, clientX: 220 });
    now = 500;
    fireEvent.pointerMove(carousel, { pointerId: 1, clientX: 40 });
    now = 600;
    fireEvent.pointerUp(carousel, { pointerId: 1, clientX: 40 });

    const animation = motionHarness.animations.at(-1);
    expect(animation?.from).toBe(80);
    expect(animation?.to).toBe(0);
    expect(screen.getByRole('img', { name: '错题图片 two.png' }).closest('figure'))
      .toHaveAttribute('data-active', 'true');
    act(() => animation?.options.onUpdate?.(37));
    expect(carousel).toHaveStyle({ '--review-carousel-drag-x': '37px' });

    const secondButton = screen.getByRole('button', { name: '放大查看 two.png' });
    fireEvent.pointerDown(secondButton, { pointerId: 2, button: 0, clientX: 200 });
    expect(animation?.stopped).toBe(true);
    expect(carousel).toHaveStyle({ '--review-carousel-drag-x': '37px' });
    act(() => animation?.options.onUpdate?.(5));
    expect(carousel).toHaveStyle({ '--review-carousel-drag-x': '37px' });
    fireEvent.pointerMove(carousel, { pointerId: 2, clientX: 210 });
    expect(carousel).toHaveStyle({ '--review-carousel-drag-x': '47px' });
  });

  it('主指针失去捕获时取消并回位，随后可以重新开始拖拽', async () => {
    document.documentElement.dataset.motion = 'reduced';
    mockLoadedImages();
    render(<ReviewPage />);
    const carousel = await screen.findByLabelText('资料/综合错题图片轮播');
    mockCarouselGeometry(carousel);
    const imageButton = screen.getByRole('button', { name: '放大查看 one.png' });

    fireEvent.pointerDown(imageButton, { pointerId: 1, button: 0, clientX: 220 });
    fireEvent.pointerMove(carousel, { pointerId: 1, clientX: 180 });
    fireEvent(carousel, new TestPointerEvent('lostpointercapture', { bubbles: true, pointerId: 1 }));
    expect(carousel).toHaveAttribute('data-gesture-state', 'idle');
    expect(carousel).toHaveStyle({ '--review-carousel-drag-x': '0px' });

    fireEvent.pointerDown(imageButton, { pointerId: 2, button: 0, clientX: 220 });
    expect(carousel).toHaveAttribute('data-gesture-state', 'pressed');
  });

  it('Motion 抛错或不回调完成时也不会阻断切卡和后续操作', async () => {
    let now = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    mockLoadedImages();
    render(<ReviewPage />);
    const carousel = await screen.findByLabelText('资料/综合错题图片轮播');
    mockCarouselGeometry(carousel);
    const firstButton = screen.getByRole('button', { name: '放大查看 one.png' });

    motionHarness.throwNext = true;
    fireEvent.pointerDown(firstButton, { pointerId: 1, button: 0, clientX: 220 });
    now = 500;
    fireEvent.pointerMove(carousel, { pointerId: 1, clientX: 60 });
    now = 600;
    expect(() => fireEvent.pointerUp(carousel, { pointerId: 1, clientX: 60 })).not.toThrow();
    expect(screen.getByRole('img', { name: '错题图片 two.png' }).closest('figure'))
      .toHaveAttribute('data-active', 'true');
    expect(carousel).toHaveAttribute('data-gesture-state', 'idle');

    vi.useFakeTimers();
    const secondButton = screen.getByRole('button', { name: '放大查看 two.png' });
    fireEvent.pointerDown(secondButton, { pointerId: 2, button: 0, clientX: 220 });
    now = 1100;
    fireEvent.pointerMove(carousel, { pointerId: 2, clientX: 60 });
    now = 1200;
    fireEvent.pointerUp(carousel, { pointerId: 2, clientX: 60 });
    expect(carousel).toHaveAttribute('data-gesture-state', 'settling');
    const stalledAnimation = motionHarness.animations.at(-1);
    act(() => vi.advanceTimersByTime(1200));
    expect(carousel).toHaveAttribute('data-gesture-state', 'idle');
    expect(carousel).toHaveStyle({ '--review-carousel-drag-x': '0px' });
    expect(stalledAnimation?.stopped).toBe(true);
    act(() => stalledAnimation?.options.onUpdate?.(37));
    expect(carousel).toHaveStyle({ '--review-carousel-drag-x': '0px' });
  });

  it('忽略第二活动指针及其取消事件并保留主拖拽', async () => {
    mockLoadedImages();
    render(<ReviewPage />);
    const imageButton = await screen.findByRole('button', { name: '放大查看 one.png' });
    const carousel = screen.getByLabelText('资料/综合错题图片轮播');
    mockCarouselGeometry(carousel);

    fireEvent.pointerDown(imageButton, { pointerId: 1, isPrimary: true, button: 0, clientX: 220 });
    fireEvent.pointerDown(imageButton, { pointerId: 2, isPrimary: false, button: 0, clientX: 210 });
    fireEvent.pointerMove(carousel, { pointerId: 1, isPrimary: true, clientX: 120 });
    fireEvent.pointerCancel(carousel, { pointerId: 2, isPrimary: false, clientX: 210 });

    expect(carousel).toHaveClass('is-dragging');
    expect(carousel).toHaveStyle({ '--review-carousel-drag-x': '-100px' });
    fireEvent.pointerUp(carousel, { pointerId: 1, isPrimary: true, clientX: 120 });
    expect(screen.getByRole('img', { name: '错题图片 two.png' }).closest('figure')).toHaveAttribute('data-active', 'true');
  });

  it('键盘左右键只切换当前聚焦舞台', async () => {
    const speechSection = section('section-speech', '中心理解');
    const speechBoard = board('board-speech', '言语', [speechSection]);
    mockLoadedImages(
      [
        reviewImage('data-one'),
        reviewImage('data-two'),
        reviewImage('speech-one', 'speech-one.png', speechSection.id),
        reviewImage('speech-two', 'speech-two.png', speechSection.id),
      ],
      [dataBoard, speechBoard],
    );
    render(<ReviewPage />);
    await screen.findByRole('img', { name: '错题图片 data-one.png' });
    const speechStage = screen.getByRole('group', {
      name: '言语 / 中心理解 错题图片拖放与粘贴区域',
    });

    speechStage.focus();
    fireEvent.keyDown(speechStage, { key: 'ArrowRight' });

    expect(screen.getByRole('img', { name: '错题图片 data-one.png' }).closest('figure')).toHaveAttribute('data-active', 'true');
    expect(screen.getByRole('img', { name: '错题图片 speech-two.png' }).closest('figure')).toHaveAttribute('data-active', 'true');
  });

  it('删除当前卡片后移到同一小板块的相邻图片', async () => {
    mockLoadedImages();
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 204 }));
    const user = userEvent.setup();
    render(<ReviewPage />);
    await screen.findByRole('img', { name: '错题图片 one.png' });

    await user.click(screen.getByRole('button', { name: '删除资料/综合当前错题图片' }));

    await waitFor(() => expect(screen.queryByRole('img', { name: '错题图片 one.png' })).not.toBeInTheDocument());
    expect(fetch).toHaveBeenLastCalledWith('/api/review-images/one', expect.objectContaining({ method: 'DELETE' }));
    expect(screen.getByRole('img', { name: '错题图片 two.png' }).closest('figure')).toHaveAttribute('data-active', 'true');
  });

  it('删除请求完成前锁定当前图片并阻止重复提交', async () => {
    mockLoadedImages();
    let finishDelete: ((response: Response) => void) | undefined;
    vi.mocked(fetch).mockImplementationOnce(() => new Promise<Response>((resolve) => {
      finishDelete = resolve;
    }));
    render(<ReviewPage />);
    const deleteButton = await screen.findByRole('button', { name: '删除资料/综合当前错题图片' });

    fireEvent.click(deleteButton);
    fireEvent.click(deleteButton);

    expect(deleteButton).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: '底部下一张资料/综合错题图片' }));
    const nextDeleteButton = screen.getByRole('button', { name: '删除资料/综合当前错题图片' });
    expect(nextDeleteButton).toBeDisabled();
    fireEvent.click(nextDeleteButton);
    expect(vi.mocked(fetch).mock.calls.filter(([path, init]) => (
      String(path).startsWith('/api/review-images/') && init?.method === 'DELETE'
    ))).toHaveLength(1);
    finishDelete?.(new Response(null, { status: 204 }));
    await waitFor(() => expect(screen.queryByRole('img', { name: '错题图片 one.png' })).not.toBeInTheDocument());
  });

  it('删除与上传交错完成时基于最新图片集合移除且不覆盖新上传图片', async () => {
    mockLoadedImages([reviewImage('one'), reviewImage('two')]);
    let finishDelete: ((response: Response) => void) | undefined;
    vi.mocked(fetch).mockImplementation((input, init) => {
      const path = String(input);
      if (path === '/api/review-images/one' && init?.method === 'DELETE') {
        return new Promise<Response>((resolve) => {
          finishDelete = resolve;
        });
      }
      if (path === '/api/review-images?sectionId=section-general' && init?.method === 'POST') {
        return Promise.resolve(jsonResponse({
          items: [reviewImage('uploaded', '并发上传.png')],
        }, 201));
      }
      throw new Error(`未模拟的请求：${init?.method ?? 'GET'} ${path}`);
    });
    const user = userEvent.setup();
    render(<ReviewPage />);
    await screen.findByRole('img', { name: '错题图片 one.png' });

    fireEvent.click(screen.getByRole('button', { name: '删除资料/综合当前错题图片' }));
    await user.upload(
      screen.getByLabelText('选择资料/综合错题图片'),
      new File(['png'], '并发上传.png', { type: 'image/png' }),
    );
    expect(await screen.findByRole('img', { name: '错题图片 并发上传.png' })).toBeInTheDocument();
    finishDelete?.(new Response(null, { status: 204 }));

    await waitFor(() => expect(screen.queryByRole('img', { name: '错题图片 one.png' })).not.toBeInTheDocument());
    expect(screen.getByRole('img', { name: '错题图片 two.png' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: '错题图片 并发上传.png' }).closest('figure'))
      .toHaveAttribute('data-active', 'true');
  });

  it('点击任意卡片打开浅色查看器并限制缩放到 100%-300%', async () => {
    mockLoadedImages([reviewImage('one')]);
    const user = userEvent.setup();
    render(<ReviewPage />);
    const trigger = await screen.findByRole('button', { name: '放大查看 one.png' });
    await user.click(trigger);

    expect(screen.getByRole('dialog', { name: '放大查看错题图片' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '关闭放大查看' })).toHaveFocus();
    expect(screen.getByText('100%')).toBeInTheDocument();
    const viewerImage = screen.getByRole('img', { name: '放大后的错题图片 one.png' });
    vi.spyOn(viewerImage, 'getBoundingClientRect').mockReturnValue(
      DOMRect.fromRect({ width: 320, height: 240 }),
    );
    fireEvent.load(viewerImage);
    const zoomIn = screen.getByRole('button', { name: '放大图片' });
    await user.tab();
    expect(zoomIn).toHaveFocus();
    await user.click(zoomIn);
    expect(screen.getByText('150%')).toBeInTheDocument();
    expect(viewerImage).toHaveStyle({ width: '480px', height: '360px' });
    expect(viewerImage.style.transform).toBe('');
    expect(viewerImage.closest('.review-viewer__content')).toHaveStyle({
      '--review-viewer-image-width': '480px',
      '--review-viewer-image-height': '360px',
    });
    await user.click(zoomIn);
    await user.click(zoomIn);
    await user.click(zoomIn);
    expect(screen.getByText('300%')).toBeInTheDocument();
    expect(zoomIn).toBeDisabled();
    await user.click(screen.getByRole('button', { name: '恢复原始比例' }));
    expect(screen.getByText('100%')).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: '放大查看错题图片' })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('没有可见小板块时显示明确空态', async () => {
    mockLoadedImages([], [board('empty-board', '常识', [section('hidden', '科技', true)])]);
    render(<ReviewPage />);

    expect(await screen.findByRole('heading', { level: 2, name: '常识' })).toBeInTheDocument();
    expect(screen.getByText('暂无可见小板块')).toBeInTheDocument();
  });

  it('加载或上传失败时显示稳定错误提示', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ code: 'failed', message: 'detail' }, 500));
    const { unmount } = render(<ReviewPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('错题图片加载失败，请稍后重试');
    unmount();

    mockLoadedImages([]);
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ code: 'failed', message: 'detail' }, 500));
    const user = userEvent.setup();
    render(<ReviewPage />);
    await screen.findByText('拖入第一张错题');
    await user.upload(
      screen.getByLabelText('选择资料/综合错题图片'),
      new File(['png'], '失败.png', { type: 'image/png' }),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent('图片上传失败，请稍后重试');
  });
});
