// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from '../../src/App';

describe('应用首页', () => {
  it('显示产品名称公考记忆卡', () => {
    render(<App />);

    expect(screen.getByText('公考记忆卡')).toBeInTheDocument();
  });
});
