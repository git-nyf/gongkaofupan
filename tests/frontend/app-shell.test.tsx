// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../../src/App';
import { api, ApiError, apiForm } from '../../src/api/client';
import { StatusNotice } from '../../src/components/StatusNotice';

const routes = [
  { label: '总览', path: '/' },
  { label: '录入', path: '/entry' },
  { label: '背诵', path: '/study' },
  { label: '卡片库', path: '/cards' },
  { label: '复盘', path: '/review' },
  { label: '设置', path: '/settings' },
] as const;

beforeEach(() => {
  window.history.pushState({}, '', '/');
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('桌面工作台', () => {
  it('提供六个固定入口及正确链接', () => {
    render(<App />);

    for (const route of routes) {
      expect(screen.getByRole('link', { name: route.label })).toHaveAttribute(
        'href',
        route.path,
      );
    }
  });

  it.each(routes)('在 $path 显示$label页面', ({ label, path }) => {
    window.history.pushState({}, '', path);

    render(<App />);

    expect(screen.getByRole('heading', { level: 1, name: label })).toBeInTheDocument();
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
    expect(collapseButton).toHaveAttribute('title', '折叠侧栏');

    await user.click(collapseButton);

    expect(container.querySelector('.app-shell')).toHaveClass('app-shell--collapsed');
    expect(screen.getByRole('button', { name: '展开侧栏' })).toHaveAttribute(
      'title',
      '展开侧栏',
    );
    expect(container.querySelector('.app-shell__brand-text')).not.toBeInTheDocument();
    for (const route of routes) {
      const link = screen.getByRole('link', { name: route.label });
      expect(link.querySelector('.app-shell__nav-label')).not.toBeInTheDocument();
    }
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
