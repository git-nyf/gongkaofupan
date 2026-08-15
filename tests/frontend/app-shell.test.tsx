// @vitest-environment jsdom

import { readFileSync } from 'node:fs';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import App from '../../src/App';
import { api, ApiError, apiForm } from '../../src/api/client';
import { AppShell } from '../../src/components/AppShell';
import { StatusNotice } from '../../src/components/StatusNotice';
import { diyThemeStorageKey } from '../../src/theme/diyTheme';

const appShellSource = readFileSync('src/components/AppShell.tsx', 'utf8');
const appShellGlassCss = readFileSync('src/styles/app-shell-glass.css', 'utf8');

const navigationRoutes = [
  { label: '总览', path: '/', heading: '总览' },
  { label: '录入', path: '/entry', heading: '录入' },
  { label: '背诵', path: '/study', heading: '背诵' },
  { label: '卡片库', path: '/cards', heading: '卡片库' },
  { label: '复盘', path: '/review', heading: '错题积累' },
  { label: '申论', path: '/shenlun', heading: '申论' },
  { label: '图谱', path: '/graphs', heading: '球状知识图谱' },
  { label: '设置', path: '/settings', heading: '设置' },
] as const;

const pageRoutes = navigationRoutes.filter(({ path }) => path !== '/graphs');

beforeEach(() => {
  window.localStorage.clear();
  window.history.pushState({}, '', '/');
  document.documentElement.removeAttribute('style');
  document.documentElement.removeAttribute('data-motion');
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('桌面工作台', () => {
  it('提供固定入口及正确链接', () => {
    render(<App />);

    for (const route of navigationRoutes) {
      expect(screen.getByRole('link', { name: route.label })).toHaveAttribute(
        'href',
        route.path,
      );
    }
  });

  it('把图谱入口放在设置前', () => {
    const { container } = render(<App />);

    const labels = [...container.querySelectorAll<HTMLElement>('.app-shell__nav-link')]
      .map((link) => link.getAttribute('aria-label'));

    expect(labels).toEqual(navigationRoutes.map(({ label }) => label));
  });

  it.each(pageRoutes)('在 $path 显示$heading页面', ({ heading, path }) => {
    window.history.pushState({}, '', path);

    render(<App />);

    expect(screen.getByRole('heading', { level: 1, name: heading })).toBeInTheDocument();
  });

  it('标记当前入口为激活状态', () => {
    window.history.pushState({}, '', '/cards');

    render(<App />);

    expect(screen.getByRole('link', { name: '卡片库' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('link', { name: '总览' })).not.toHaveAttribute('aria-current');
  });

  it('折叠侧栏时隐藏可见文字但保留导航可访问名称', async () => {
    const user = userEvent.setup();
    const { container } = render(<App />);

    const collapseButton = screen.getByRole('button', { name: '折叠侧栏' });
    const sidebar = container.querySelector('.app-shell__sidebar');
    expect(collapseButton).toHaveAttribute('title', '折叠侧栏');
    expect(collapseButton).toHaveAttribute('aria-expanded', 'true');
    expect(collapseButton).toHaveAttribute('aria-controls', 'app-sidebar');
    expect(sidebar).toHaveAttribute('id', 'app-sidebar');

    await user.click(collapseButton);

    expect(container.querySelector('.app-shell')).toHaveClass('app-shell--collapsed');
    const expandButton = screen.getByRole('button', { name: '展开侧栏' });
    expect(expandButton).toHaveAttribute('title', '展开侧栏');
    expect(expandButton).toHaveAttribute('aria-expanded', 'false');
    expect(expandButton).toHaveFocus();
    expect(container.querySelector('.app-shell__brand-copy')).not.toBeInTheDocument();
    for (const route of navigationRoutes) {
      const link = screen.getByRole('link', { name: route.label });
      expect(link.querySelector('.app-shell__nav-label')).not.toBeInTheDocument();
    }
  });

  it('展示为人民服务品牌与国徽，并在侧栏折叠后仅保留国徽', async () => {
    const user = userEvent.setup();
    const { container } = render(<App />);
    const brand = screen.getByRole('link', { name: '为人民服务 · 公考记忆卡' });
    const emblem = screen.getByRole('img', { name: '中华人民共和国国徽' });

    expect(brand).toHaveAttribute('href', '/');
    expect(emblem).toHaveAttribute('src', '/diy/国徽.jpg');
    expect(emblem).toHaveClass('app-shell__brand-emblem');
    expect(container.querySelector('.app-shell__brand-motto')).toHaveTextContent('为人民服务');
    expect(container.querySelector('.app-shell__brand-product')).toHaveTextContent('公考记忆卡');

    await user.click(screen.getByRole('button', { name: '折叠侧栏' }));

    expect(screen.getByRole('img', { name: '中华人民共和国国徽' })).toHaveAttribute(
      'src',
      '/diy/国徽.jpg',
    );
    expect(container.querySelector('.app-shell__brand-copy')).not.toBeInTheDocument();
    expect(container.querySelector('.app-shell__brand-motto')).not.toBeInTheDocument();
    expect(container.querySelector('.app-shell__brand-product')).not.toBeInTheDocument();
  });

  it('从本地 DIY 主题恢复导航栏和右侧背景', () => {
    window.localStorage.setItem(
      diyThemeStorageKey,
      JSON.stringify({ sidebarImage: 'guohui', mainImage: 'kaiguo-dadian', mainFade: 92 }),
    );

    render(<App />);

    expect(document.documentElement.style.getPropertyValue('--diy-sidebar-background-image')).toContain(
      '/diy/%E5%9B%BD%E5%BE%BD.jpg',
    );
    expect(document.documentElement.style.getPropertyValue('--diy-main-background-image')).toContain(
      '/diy/%E5%BC%80%E5%9B%BD%E5%A4%A7%E5%85%B8.jpg',
    );
    expect(document.documentElement.style.getPropertyValue('--diy-main-overlay-alpha')).toBe('0.92');
  });

  it('从本地体验设置恢复全站减弱动效', () => {
    window.localStorage.setItem(
      'gongkao-experience-v1',
      JSON.stringify({ version: 1, motionLevel: 'reduced' }),
    );

    render(<App />);

    expect(document.documentElement).toHaveAttribute('data-motion', 'reduced');
  });

  it('在浏览器绘制前恢复主题和动效设置', () => {
    expect(appShellSource).toMatch(
      /useLayoutEffect\(\(\) => \{\s*applyDiyTheme\(readDiyTheme\(\)\);\s*applyMotionLevel\(readMotionLevel\(\)\);/,
    );
  });

  it('用分层玻璃材质组织侧栏、内容区和即时按压控件', () => {
    const { container } = render(<App />);

    expect(container.querySelector('.app-shell__sidebar')).toHaveClass(
      'liquid-glass',
      'liquid-glass--dark',
    );
    expect(container.querySelector('.app-shell__main')).toHaveClass(
      'liquid-glass',
      'liquid-glass--regular',
    );
    expect(screen.getByRole('link', { name: '为人民服务 · 公考记忆卡' })).toHaveClass(
      'liquid-pressable',
    );
    expect(screen.getByRole('link', { name: '总览' })).toHaveClass(
      'app-shell__nav-link--active',
      'liquid-glass__nested',
      'liquid-pressable',
    );
    expect(screen.getByRole('button', { name: '折叠侧栏' })).toHaveClass(
      'liquid-glass__nested',
      'liquid-pressable',
    );
  });

  it('用单一指针委托合并高光更新，并在卸载时取消待执行帧', () => {
    let frameCallback: FrameRequestCallback | undefined;
    const requestFrame = vi
      .fn<(callback: FrameRequestCallback) => number>()
      .mockImplementation((callback) => {
        frameCallback = callback;
        return 37;
      });
    const cancelFrame = vi.fn();
    vi.stubGlobal('requestAnimationFrame', requestFrame);
    vi.stubGlobal('cancelAnimationFrame', cancelFrame);
    const addEventListener = vi.spyOn(document, 'addEventListener');
    const removeEventListener = vi.spyOn(document, 'removeEventListener');

    const { container, unmount } = render(
      <MemoryRouter>
        <AppShell>
          <div>页面内容</div>
        </AppShell>
      </MemoryRouter>,
    );
    const sidebar = container.querySelector<HTMLElement>('.app-shell__sidebar');
    const navLink = screen.getByRole('link', { name: '总览' });
    expect(sidebar).not.toBeNull();
    vi.spyOn(sidebar!, 'getBoundingClientRect').mockReturnValue({
      bottom: 220,
      height: 200,
      left: 10,
      right: 110,
      top: 20,
      width: 100,
      x: 10,
      y: 20,
      toJSON: () => ({}),
    });

    fireEvent(
      navLink,
      new MouseEvent('pointermove', { bubbles: true, clientX: 30, clientY: 60 }),
    );
    fireEvent(
      navLink,
      new MouseEvent('pointermove', { bubbles: true, clientX: 90, clientY: 100 }),
    );

    expect(addEventListener.mock.calls.filter(([type]) => type === 'pointermove')).toHaveLength(1);
    expect(requestFrame).toHaveBeenCalledTimes(1);
    frameCallback?.(0);
    expect(sidebar).toHaveStyle({
      '--glass-pointer-x': '80%',
      '--glass-pointer-y': '40%',
    });

    fireEvent(
      navLink,
      new MouseEvent('pointermove', { bubbles: true, clientX: 50, clientY: 70 }),
    );
    unmount();

    expect(cancelFrame).toHaveBeenCalledWith(37);
    expect(removeEventListener.mock.calls.filter(([type]) => type === 'pointermove')).toHaveLength(1);
  });

  it('降透明度和能力回退保留 DIY 图层，高对比提供明确分界', () => {
    const reducedStart = appShellGlassCss.indexOf(
      '@media (prefers-reduced-transparency: reduce)',
    );
    const contrastStart = appShellGlassCss.indexOf('@media (prefers-contrast: more)');
    const fallbackStart = appShellGlassCss.indexOf('@supports not');
    expect(reducedStart).toBeGreaterThan(-1);
    expect(contrastStart).toBeGreaterThan(reducedStart);
    expect(fallbackStart).toBeGreaterThan(contrastStart);

    const reducedTransparency = appShellGlassCss.slice(reducedStart, contrastStart);
    const highContrast = appShellGlassCss.slice(contrastStart, fallbackStart);
    const unsupportedBackdropFilter = appShellGlassCss.slice(fallbackStart);

    expect(reducedTransparency).not.toMatch(/\bbackground\s*:/);
    expect(unsupportedBackdropFilter).not.toMatch(/\bbackground\s*:/);
    expect(reducedTransparency).toContain('background-color: var(--glass-solid-dark)');
    expect(reducedTransparency).toContain('background-color: var(--glass-solid)');
    expect(unsupportedBackdropFilter).toContain('background-color: var(--glass-solid-dark)');
    expect(unsupportedBackdropFilter).toContain('background-color: var(--glass-solid)');
    expect(highContrast).toMatch(
      /\.app-shell__sidebar\.liquid-glass\s*\{[^}]*border-right:\s*2px solid/,
    );
    expect(highContrast).toMatch(
      /\.app-shell__main\.liquid-glass\s*\{[^}]*border:\s*1px solid/,
    );
  });

  it('设置页可选择、保存和恢复默认 DIY 主题', async () => {
    window.history.pushState({}, '', '/settings');
    const user = userEvent.setup();
    render(<App />);

    expect(screen.getByRole('heading', { name: '设置' })).toBeInTheDocument();
    expect(screen.getAllByRole('radio', { name: '人民英雄' })).toHaveLength(2);
    expect(screen.getAllByRole('radio', { name: '国徽' })).toHaveLength(2);
    expect(screen.getAllByRole('radio', { name: '开国大典' })).toHaveLength(2);

    await user.click(screen.getAllByRole('radio', { name: '人民英雄' })[0]);
    await user.click(screen.getAllByRole('radio', { name: '开国大典' })[1]);
    fireEvent.change(screen.getByRole('slider', { name: /^右侧背景淡化强度/ }), {
      target: { value: '90' },
    });

    expect(document.documentElement.style.getPropertyValue('--diy-sidebar-background-image')).toContain(
      '/diy/%E4%BA%BA%E6%B0%91%E8%8B%B1%E9%9B%84.jpg',
    );
    expect(document.documentElement.style.getPropertyValue('--diy-main-background-image')).toContain(
      '/diy/%E5%BC%80%E5%9B%BD%E5%A4%A7%E5%85%B8.jpg',
    );

    await user.click(screen.getByRole('button', { name: '保存主题' }));
    expect(screen.getByRole('status')).toHaveTextContent('DIY 主题已保存');
    expect(JSON.parse(window.localStorage.getItem(diyThemeStorageKey) ?? '{}')).toMatchObject({
      sidebarImage: 'renmin-yingxiong',
      mainImage: 'kaiguo-dadian',
    });

    await user.click(screen.getByRole('button', { name: '恢复默认' }));
    expect(screen.getByRole('status')).toHaveTextContent('已恢复默认主题');
    expect(window.localStorage.getItem(diyThemeStorageKey)).toBeNull();
    expect(document.documentElement.style.getPropertyValue('--diy-sidebar-background-image')).toBe('none');
    expect(document.documentElement.style.getPropertyValue('--diy-main-background-image')).toBe('none');
  });
});

describe('统一状态提示', () => {
  it('为四种状态提供稳定的语义区域', () => {
    const { rerender } = render(<StatusNotice state="loading" message="正在加载" />);

    expect(screen.getByRole('status')).toHaveAttribute('data-state', 'loading');
    expect(screen.getByRole('status')).toHaveClass('status-notice');

    rerender(<StatusNotice state="empty" message="暂无数据" />);
    expect(screen.getByRole('status')).toHaveAttribute('data-state', 'empty');

    rerender(<StatusNotice state="success" message="保存成功" />);
    expect(screen.getByRole('status')).toHaveAttribute('data-state', 'success');

    rerender(<StatusNotice state="error" message="加载失败" />);
    expect(screen.getByRole('alert')).toHaveAttribute('data-state', 'error');
  });
});

describe('统一 API 客户端', () => {
  it('保留 Headers 实例中的请求头并补充 JSON 类型', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      api<{ ok: boolean }>('/api/example', {
        headers: new Headers({ Authorization: 'Bearer local' }),
      }),
    ).resolves.toEqual({ ok: true });

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const headers = init.headers as Headers;
    expect(headers).toBeInstanceOf(Headers);
    expect(headers.get('Authorization')).toBe('Bearer local');
    expect(headers.get('Content-Type')).toBe('application/json');
  });

  it('尊重调用方提供的 JSON 内容类型', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await api('/api/example', {
      headers: new Headers({ 'Content-Type': 'application/merge-patch+json' }),
    });

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(new Headers(init.headers).get('Content-Type')).toBe(
      'application/merge-patch+json',
    );
  });

  it('上传 FormData 时不手动设置 Content-Type', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ stored: true }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const formData = new FormData();
    formData.set('payload', '{}');

    await apiForm('/api/cards', formData);

    expect(fetchMock).toHaveBeenCalledWith('/api/cards', {
      method: 'POST',
      body: formData,
    });
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(init.headers).toBeUndefined();
  });

  it('JSON 与表单请求收到 204 时不解析空响应体', async () => {
    const jsonResponse = new Response(null, { status: 204 });
    const formResponse = new Response(null, { status: 204 });
    const jsonSpy = vi.spyOn(jsonResponse, 'json');
    const formSpy = vi.spyOn(formResponse, 'json');
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse)
      .mockResolvedValueOnce(formResponse);
    vi.stubGlobal('fetch', fetchMock);

    await expect(api<void>('/api/example')).resolves.toBeUndefined();
    await expect(apiForm<void>('/api/example', new FormData())).resolves.toBeUndefined();
    expect(jsonSpy).not.toHaveBeenCalled();
    expect(formSpy).not.toHaveBeenCalled();
  });

  it('用 ApiError 暴露脱敏接口错误', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ code: 'invalid_request', message: '请求无效' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const error = await api('/api/example').catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      name: 'ApiError',
      status: 400,
      code: 'invalid_request',
      message: '请求无效',
    });
  });
});
