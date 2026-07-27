// @vitest-environment jsdom

import { cleanup, createEvent, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EntryPage } from '../../src/pages/EntryPage';

beforeEach(() => {
  Object.defineProperty(Range.prototype, 'getBoundingClientRect', {
    configurable: true,
    value: () => new DOMRect(),
  });
  Object.defineProperty(Range.prototype, 'getClientRects', {
    configurable: true,
    value: () => [],
  });
  Object.defineProperty(document, 'elementFromPoint', {
    configurable: true,
    value: () => null,
  });
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('录入图片拖放与粘贴', () => {
  it('接收从外部程序拖入的支持图片并呈现拖入状态', () => {
    render(<EntryPage />);
    const dropzone = screen.getByRole('group', { name: '图片拖放与粘贴区域' });
    const image = new File(['png'], '微信截图.png', { type: 'image/png' });
    const dataTransfer = { files: [image], types: ['Files'] };

    fireEvent.dragEnter(dropzone, { dataTransfer });
    expect(dropzone).toHaveClass('is-drag-active');

    fireEvent.drop(dropzone, { dataTransfer });
    expect(dropzone).not.toHaveClass('is-drag-active');
    expect(screen.getByText('微信截图.png')).toBeInTheDocument();
  });

  it('接收剪贴板中的支持图片并阻止图片的默认粘贴', () => {
    render(<EntryPage />);
    const dropzone = screen.getByRole('group', { name: '图片拖放与粘贴区域' });
    const image = new File(['webp'], 'QQ截图.webp', { type: 'image/webp' });
    const paste = createEvent.paste(dropzone, {
      clipboardData: {
        files: [],
        items: [{ kind: 'file', type: image.type, getAsFile: () => image }],
      },
    });

    fireEvent(dropzone, paste);

    expect(paste.defaultPrevented).toBe(true);
    expect(screen.getByText('QQ截图.webp')).toBeInTheDocument();
  });

  it('不接管不含图片的普通粘贴且不加入附件', () => {
    render(<EntryPage />);
    const dropzone = screen.getByRole('group', { name: '图片拖放与粘贴区域' });
    const paste = createEvent.paste(dropzone, {
      clipboardData: {
        files: [],
        items: [{ kind: 'string', type: 'text/plain', getAsFile: () => null }],
      },
    });

    fireEvent(dropzone, paste);

    expect(paste.defaultPrevented).toBe(false);
    expect(screen.queryByRole('list', { name: '待上传图片' })).not.toBeInTheDocument();
  });
});
