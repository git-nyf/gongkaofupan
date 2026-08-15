// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import App from '../../src/App';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it('申论复盘编辑地址继续显示申论编辑页', () => {
  window.history.pushState({}, '', '/shenlun/review-1');
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));

  render(<App />);

  expect(screen.getByRole('heading', { level: 1, name: '申论' })).toBeInTheDocument();
});
