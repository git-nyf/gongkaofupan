// @vitest-environment jsdom

import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RichTextEditor } from '../../src/components/RichTextEditor';

beforeEach(() => {
  Object.defineProperty(Range.prototype, 'getBoundingClientRect', {
    configurable: true,
    value: () => new DOMRect(),
  });
  Object.defineProperty(Range.prototype, 'getClientRects', {
    configurable: true,
    value: () => [],
  });
});

afterEach(() => {
  cleanup();
});

describe('富文本编辑器液态玻璃交互', () => {
  it('为每一个格式工具按钮显式提供即时按压反馈', () => {
    render(
      <RichTextEditor
        hint="请输入内容"
        onChange={vi.fn()}
        onTarget={vi.fn()}
        value='{"type":"doc","content":[{"type":"paragraph"}]}'
      />,
    );

    const toolbar = screen.getByRole('toolbar', { name: '原始内容格式' });
    const buttons = within(toolbar).getAllByRole('button');

    expect(buttons).toHaveLength(5);
    expect(within(toolbar).getByRole('button', { name: '加粗' })).toBeInTheDocument();
    expect(within(toolbar).getByRole('button', { name: '文字颜色 朱红' })).toBeInTheDocument();
    expect(within(toolbar).getByRole('button', { name: '文字颜色 炭灰' })).toBeInTheDocument();
    expect(within(toolbar).getByRole('button', { name: '文字颜色 深绿' })).toBeInTheDocument();
    expect(within(toolbar).getByRole('button', { name: '插入公式文本' })).toBeInTheDocument();
    for (const button of buttons) {
      expect(button).toHaveClass('liquid-pressable');
    }
  });
});
