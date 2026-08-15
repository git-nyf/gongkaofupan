// @vitest-environment jsdom

import { readFileSync } from 'node:fs';
import { createRef } from 'react';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ShenlunGrid } from '../../src/components/ShenlunGrid';
import { layoutShenlunText } from '../../src/shenlun/layout';

afterEach(cleanup);

describe('申论方格英数排版', () => {
  it('英数两字符共格时在格内保持左右横向排列', () => {
    const { container } = render(
      <ShenlunGrid
        annotations={[]}
        gridRef={createRef<HTMLDivElement>()}
        layout={layoutShenlunText('AB12', 200, { segmentWords: false })}
        marks={[]}
        selection={{ start: 0, end: 0 }}
        textLength={4}
        onFocusEditor={vi.fn()}
        onPadToCell={vi.fn()}
        onSelect={vi.fn()}
      />,
    );

    const firstCell = container.querySelector<HTMLElement>('[data-cell-index="0"]')!;
    const secondCell = container.querySelector<HTMLElement>('[data-cell-index="1"]')!;
    expect([...firstCell.querySelectorAll('.shenlun-cell__character')]
      .map((character) => character.textContent)).toEqual(['A', 'B']);
    expect([...secondCell.querySelectorAll('.shenlun-cell__character')]
      .map((character) => character.textContent)).toEqual(['1', '2']);

    const cellRule = readFileSync('src/styles/shenlun.css', 'utf8')
      .match(/\.shenlun-cell\s*\{([^}]*)\}/)?.[1];
    expect(cellRule).toMatch(/display:\s*flex/);
    expect(cellRule).toMatch(/flex-direction:\s*row/);
  });

  it('正文中编辑时只显示当前方格的一处光标', () => {
    const { container, rerender } = render(
      <ShenlunGrid
        annotations={[]}
        gridRef={createRef<HTMLDivElement>()}
        layout={layoutShenlunText('甲乙', 200)}
        marks={[]}
        selection={{ start: 0, end: 0 }}
        textLength={2}
        onFocusEditor={vi.fn()}
        onPadToCell={vi.fn()}
        onSelect={vi.fn()}
      />,
    );

    expect([...container.querySelectorAll<HTMLElement>('.shenlun-cell--caret')]
      .map((cell) => cell.dataset.cellIndex)).toEqual(['0']);

    rerender(
      <ShenlunGrid
        annotations={[]}
        gridRef={createRef<HTMLDivElement>()}
        layout={layoutShenlunText('甲乙', 200)}
        marks={[]}
        selection={{ start: 2, end: 2 }}
        textLength={2}
        onFocusEditor={vi.fn()}
        onPadToCell={vi.fn()}
        onSelect={vi.fn()}
      />,
    );

    expect([...container.querySelectorAll<HTMLElement>('.shenlun-cell--caret')]
      .map((cell) => cell.dataset.cellIndex)).toEqual(['2']);
  });
});
