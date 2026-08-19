// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../../src/App';

beforeEach(() => {
  window.history.pushState({}, '', '/coach');
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          deepseek: 'not_configured',
          huasheng: 'not_configured',
          zhangGong: 'not_configured',
          webSearch: 'not_configured',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    ),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('AI 公考教练路由', () => {
  it('通过 /coach 打开教练页并高亮导航入口', async () => {
    render(<App />);

    expect(screen.getByRole('heading', { level: 1, name: 'AI 公考教练' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '教练' })).toHaveAttribute('href', '/coach');
    expect(screen.getByRole('link', { name: '教练' })).toHaveAttribute('aria-current', 'page');
    expect(await screen.findByText('DeepSeek')).toBeInTheDocument();
  });
});
