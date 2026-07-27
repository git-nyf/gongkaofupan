// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import type { StudySessionResult } from '../../shared/contracts';
import { StudyPage } from '../../src/pages/StudyPage';

const motionMocks = vi.hoisted(() => ({
  animate: vi.fn(),
  stop: vi.fn(),
}));

vi.mock('motion', () => ({
  animate: motionMocks.animate,
}));

class TestPointerEvent extends MouseEvent {
  pointerId: number;

  constructor(type: string, init: PointerEventInit & { timeStamp?: number } = {}) {
    super(type, init);
    this.pointerId = init.pointerId ?? 1;
    if (init.timeStamp !== undefined) {
      Object.defineProperty(this, 'timeStamp', { value: init.timeStamp });
    }
  }
}

const session: StudySessionResult = {
  totalAvailable: 8,
  items: [{
    quizItemId: 'quiz-joystick',
    cardId: 'card-joystick',
    question: '纵向摇杆测试题',
    answer: '测试答案',
    rawInput: '纵向摇杆测试原始输入',
    normalizedStatement: '纵向摇杆测试知识点',
    analysis: '',
    mnemonic: '',
    extension: '',
    notes: '',
    wrongCount: 0,
    archived: false,
    categories: [],
    tags: [],
  }],
};

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function renderStudyPage() {
  return render(
    <MemoryRouter initialEntries={['/study?count=2&order=random']}>
      <StudyPage />
    </MemoryRouter>,
  );
}

function studySessionRequestCount() {
  return vi.mocked(fetch).mock.calls.filter(([input]) => (
    String(input) === '/api/study/sessions'
  )).length;
}

beforeEach(() => {
  motionMocks.animate.mockReset();
  motionMocks.stop.mockReset();
  motionMocks.animate.mockReturnValue({ stop: motionMocks.stop });
  window.localStorage.clear();
  delete document.documentElement.dataset.motion;
  window.history.pushState({}, '', '/study?count=2&order=random');
  vi.stubGlobal('PointerEvent', TestPointerEvent);
  vi.stubGlobal('fetch', vi.fn(async (input) => {
    if (String(input) === '/api/study/sessions') return jsonResponse(session);
    if (String(input).startsWith('/api/cards/random-original/count')) {
      return jsonResponse({ totalAvailable: 8 });
    }
    throw new Error(`unexpected request: ${String(input)}`);
  }));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('背诵抽题纵向摇杆', () => {
  it('按下即反馈，越过 10px 迟滞后向下 1:1 跟手并在上边界保持原位', async () => {
    renderStudyPage();
    expect(await screen.findByRole('heading', { name: '开始本轮背诵' })).toBeInTheDocument();
    const joystick = screen.getByRole('button', { name: '下拉摇杆随机抽取题数' });
    expect(joystick.querySelector('.study-joystick__hand')).not.toBeNull();
    expect(joystick).toHaveAttribute('data-gesture-state', 'idle');

    joystick.setPointerCapture = vi.fn();
    joystick.releasePointerCapture = vi.fn();
    joystick.hasPointerCapture = vi.fn(() => true);

    fireEvent.pointerDown(joystick, { pointerId: 7, clientY: 10 });
    expect(joystick).toHaveAttribute('data-gesture-state', 'pressed');
    expect(joystick.setPointerCapture).toHaveBeenCalledWith(7);
    fireEvent.pointerDown(joystick, { pointerId: 8, clientY: 0 });
    fireEvent.pointerMove(joystick, { pointerId: 7, clientY: 19 });
    expect(joystick.style.getPropertyValue('--joystick-pull-y')).toBe('0px');
    expect(joystick).toHaveAttribute('data-gesture-state', 'pressed');
    fireEvent.pointerMove(joystick, { pointerId: 7, clientY: 35 });
    expect(joystick.style.getPropertyValue('--joystick-pull-y')).toBe('25px');
    expect(joystick).toHaveClass('is-dragging');
    expect(joystick).toHaveAttribute('data-gesture-state', 'dragging');
    fireEvent.pointerMove(joystick, { pointerId: 7, clientY: 0 });
    expect(joystick.style.getPropertyValue('--joystick-pull-y')).toBe('0px');
  });

  it('释放时把最近纵向速度交给弹簧，回弹过程可重新抓取中断', async () => {
    renderStudyPage();
    expect(await screen.findByRole('heading', { name: '开始本轮背诵' })).toBeInTheDocument();
    const joystick = screen.getByRole('button', { name: '下拉摇杆随机抽取题数' });
    joystick.setPointerCapture = vi.fn();
    joystick.releasePointerCapture = vi.fn();
    joystick.hasPointerCapture = vi.fn(() => true);

    fireEvent(joystick, new TestPointerEvent('pointerdown', {
      bubbles: true,
      clientY: 10,
      pointerId: 7,
      timeStamp: 1,
    }));
    fireEvent(joystick, new TestPointerEvent('pointermove', {
      bubbles: true,
      clientY: 35,
      pointerId: 7,
      timeStamp: 20,
    }));
    fireEvent(joystick, new TestPointerEvent('pointerup', {
      bubbles: true,
      clientY: 35,
      pointerId: 7,
      timeStamp: 40,
    }));
    expect(motionMocks.animate).toHaveBeenCalledTimes(1);
    const [from, to, options] = motionMocks.animate.mock.calls[0] as unknown as [
      number,
      number,
      { velocity: number; onUpdate: (value: number) => void; onComplete: () => void },
    ];
    expect(from).toBe(25);
    expect(to).toBe(0);
    expect(options.velocity).toBeGreaterThan(0);
    expect(joystick).toHaveAttribute('data-gesture-state', 'returning');
    expect(joystick).not.toHaveClass('is-dragging');
    expect(studySessionRequestCount()).toBe(1);

    act(() => options.onUpdate(14));
    expect(joystick.style.getPropertyValue('--joystick-pull-y')).toBe('14px');
    fireEvent.pointerDown(joystick, { pointerId: 9, clientY: 50 });
    expect(motionMocks.stop).toHaveBeenCalledTimes(1);
    expect(joystick).toHaveAttribute('data-gesture-state', 'pressed');
    expect(joystick.style.getPropertyValue('--joystick-pull-y')).toBe('14px');
    fireEvent.pointerMove(joystick, { pointerId: 9, clientY: 62 });
    expect(joystick.style.getPropertyValue('--joystick-pull-y')).toBe('26px');
  });

  it('超出下边界时使用橡皮筋阻力，取消手势会从当前位置回弹且不抽题', async () => {
    renderStudyPage();
    expect(await screen.findByRole('heading', { name: '开始本轮背诵' })).toBeInTheDocument();
    const joystick = screen.getByRole('button', { name: '下拉摇杆随机抽取题数' });

    fireEvent.pointerDown(joystick, { pointerId: 9, clientY: 10 });
    fireEvent.pointerMove(joystick, { pointerId: 9, clientY: 70 });
    const resistedPull = Number.parseFloat(joystick.style.getPropertyValue('--joystick-pull-y'));
    expect(resistedPull).toBeGreaterThan(42);
    expect(resistedPull).toBeLessThan(60);

    fireEvent.lostPointerCapture(joystick, { pointerId: 9 });
    expect(motionMocks.animate).toHaveBeenCalledTimes(1);
    expect(motionMocks.animate.mock.calls[0]?.[0]).toBe(resistedPull);
    expect(joystick).toHaveAttribute('data-gesture-state', 'returning');
    expect(joystick).not.toHaveClass('is-dragging');
    expect(studySessionRequestCount()).toBe(1);

    const options = motionMocks.animate.mock.calls[0]?.[2] as {
      onUpdate: (value: number) => void;
      onComplete: () => void;
    };
    act(() => {
      options.onUpdate(0);
      options.onComplete();
    });
    expect(joystick.style.getPropertyValue('--joystick-pull-y')).toBe('0px');
    expect(joystick).toHaveAttribute('data-gesture-state', 'idle');

    fireEvent.keyDown(joystick, { key: ' ', code: 'Space' });
    expect(joystick.style.getPropertyValue('--joystick-pull-y')).toBe('42px');
    fireEvent.keyDown(joystick, { key: 'Escape', code: 'Escape' });
    expect(joystick.style.getPropertyValue('--joystick-pull-y')).toBe('0px');
    fireEvent.keyUp(joystick, { key: ' ', code: 'Space' });
    expect(studySessionRequestCount()).toBe(1);
  });

  it('下拉越过阈值后只更新题数并回弹，主动开始后才请求题目', async () => {
    renderStudyPage();
    expect(await screen.findByRole('heading', { name: '开始本轮背诵' })).toBeInTheDocument();
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    vi.useFakeTimers();
    const joystick = screen.getByRole('button', { name: '下拉摇杆随机抽取题数' });

    fireEvent.pointerDown(joystick, { pointerId: 8, clientY: 10 });
    fireEvent.pointerMove(joystick, { pointerId: 8, clientY: 40 });
    fireEvent.pointerUp(joystick, { pointerId: 8, clientY: 40 });

    expect(joystick).not.toBeDisabled();
    expect(motionMocks.animate).toHaveBeenCalledTimes(1);
    expect(studySessionRequestCount()).toBe(1);
    fireEvent.click(joystick);
    expect(studySessionRequestCount()).toBe(1);
    act(() => vi.advanceTimersByTime(58));
    expect(screen.getByRole('heading', { name: '开始本轮背诵' })).toBeInTheDocument();
    expect(joystick).toHaveAttribute('data-gesture-state', 'rolling');
    expect(screen.queryByText('纵向摇杆测试题')).not.toBeInTheDocument();
    await act(async () => {
      vi.advanceTimersByTime(242);
      await Promise.resolve();
    });
    expect(screen.getByRole('heading', { name: '开始本轮背诵' })).toBeInTheDocument();
    expect(screen.getByText('已抽取 5 题')).toBeInTheDocument();
    expect(screen.queryByText('纵向摇杆测试题')).not.toBeInTheDocument();

    vi.useRealTimers();
    fireEvent.click(screen.getByRole('button', { name: '开始背诵' }));
    expect(await screen.findByText('纵向摇杆测试题')).toBeInTheDocument();
    expect(studySessionRequestCount()).toBe(2);
  });

  it('弹簧引擎同步异常时立即回位并完成抽号但不自动进入题目', async () => {
    motionMocks.animate.mockImplementationOnce(() => {
      throw new Error('animation unavailable');
    });
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    renderStudyPage();
    expect(await screen.findByRole('heading', { name: '开始本轮背诵' })).toBeInTheDocument();
    const joystick = screen.getByRole('button', { name: '下拉摇杆随机抽取题数' });

    fireEvent.pointerDown(joystick, { pointerId: 8, clientY: 10 });
    fireEvent.pointerMove(joystick, { pointerId: 8, clientY: 40 });
    expect(() => {
      fireEvent.pointerUp(joystick, { pointerId: 8, clientY: 40 });
    }).not.toThrow();

    expect(studySessionRequestCount()).toBe(1);
    expect(await screen.findByText('已抽取 5 题')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '开始本轮背诵' })).toBeInTheDocument();
    expect(screen.queryByText('纵向摇杆测试题')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '开始背诵' }));
    expect(await screen.findByText('纵向摇杆测试题')).toBeInTheDocument();
    expect(studySessionRequestCount()).toBe(2);
  });

  it('弹簧引擎同步异常且未越阈值时同步回位且不抽题', async () => {
    motionMocks.animate.mockImplementationOnce(() => {
      throw new Error('animation unavailable');
    });
    renderStudyPage();
    expect(await screen.findByRole('heading', { name: '开始本轮背诵' })).toBeInTheDocument();
    const joystick = screen.getByRole('button', { name: '下拉摇杆随机抽取题数' });

    fireEvent.pointerDown(joystick, { pointerId: 8, clientY: 10 });
    fireEvent.pointerMove(joystick, { pointerId: 8, clientY: 35 });
    fireEvent.pointerUp(joystick, { pointerId: 8, clientY: 35 });

    expect(joystick.style.getPropertyValue('--joystick-pull-y')).toBe('0px');
    expect(joystick).toHaveAttribute('data-gesture-state', 'idle');
    expect(studySessionRequestCount()).toBe(1);
  });

  it('减少动态效果时越过阈值会立即回位并直接得到抽题结果', async () => {
    window.localStorage.setItem(
      'gongkao-experience-v1',
      JSON.stringify({ version: 1, motionLevel: 'reduced' }),
    );
    document.documentElement.dataset.motion = 'reduced';
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    renderStudyPage();
    expect(await screen.findByRole('heading', { name: '开始本轮背诵' })).toBeInTheDocument();
    const joystick = screen.getByRole('button', { name: '下拉摇杆随机抽取题数' });

    fireEvent.pointerDown(joystick, { pointerId: 8, clientY: 10 });
    fireEvent.pointerMove(joystick, { pointerId: 8, clientY: 40 });
    fireEvent.pointerUp(joystick, { pointerId: 8, clientY: 40 });

    expect(motionMocks.animate).not.toHaveBeenCalled();
    expect(studySessionRequestCount()).toBe(1);
    expect(screen.getByText('已抽取 5 题')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '开始本轮背诵' })).toBeInTheDocument();
    expect(screen.queryByText('纵向摇杆测试题')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '开始背诵' }));
    expect(await screen.findByText('纵向摇杆测试题')).toBeInTheDocument();
    expect(studySessionRequestCount()).toBe(2);
  });
});
