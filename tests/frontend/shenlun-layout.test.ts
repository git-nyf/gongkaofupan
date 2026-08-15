import { describe, expect, it } from 'vitest';
import {
  SHENLUN_COLUMNS,
  SHENLUN_STRUCTURAL_BLANK,
  SHENLUN_TEMPLATES,
  layoutShenlunText,
  rowsForTemplate,
  shenlunVisibleText,
} from '../../src/shenlun/layout';
import type {
  ShenlunCell,
  ShenlunLayout,
  ShenlunMarker,
  ShenlunRow,
  ShenlunTemplate,
} from '../../src/shenlun/layout';

const assertExportedTypes = (
  _template: ShenlunTemplate,
  _cell: ShenlunCell,
  _row: ShenlunRow,
  _marker: ShenlunMarker,
  _layout: ShenlunLayout,
) => undefined;

describe('申论答题纸排版', () => {
  it.each([
    [200, 8],
    [400, 16],
    [800, 32],
    [1000, 40],
  ] as const)('%i 字模板生成 %i 行、每行固定 25 格', (template, rowCount) => {
    expect(SHENLUN_COLUMNS).toBe(25);
    expect(SHENLUN_TEMPLATES).toEqual([200, 400, 800, 1000]);
    expect(rowsForTemplate(template)).toBe(rowCount);

    const result = layoutShenlunText('', template);
    expect(result.rows).toHaveLength(rowCount);
    expect(result.rows.every((row) => row.cells.length === SHENLUN_COLUMNS)).toBe(true);
    expect(result.usedCells).toBe(0);
    expect(result.usedCharacters).toBe(0);
    expect(result.overflowCells).toBe(0);
    expect(result.overflowCharacters).toBe(0);
    expect(result.markers).toEqual([]);
  });

  it('汉字、全角符号各占一格，连续英数按原顺序两个字符合一格', () => {
    const result = layoutShenlunText('甲，AB12cd3!乙', 200, { segmentWords: false });
    const occupied = result.rows[0].cells.filter(
      (cell): cell is ShenlunCell => cell !== null,
    );

    expect(occupied.map((cell) => cell.text)).toEqual([
      '甲',
      '，',
      'AB',
      '12',
      'cd',
      '3',
      '!',
      '乙',
    ]);
    expect(occupied[2].sourceIndexes).toEqual([2, 3]);
    expect(occupied[3].sourceIndexes).toEqual([4, 5]);
    expect(result.usedCells).toBe(8);
  });

  it('连续两个标点符号按原顺序共用一格', () => {
    const result = layoutShenlunText('甲。”乙！？丙', 200);
    const occupied = result.rows[0].cells.filter(
      (cell): cell is ShenlunCell => cell !== null,
    );

    expect(occupied.map((cell) => cell.text)).toEqual(['甲', '。”', '乙', '！？', '丙']);
    expect(occupied[1].sourceIndexes).toEqual([1, 2]);
    expect(occupied[3].sourceIndexes).toEqual([4, 5]);
    expect(result.usedCells).toBe(5);
    expect(result.usedCharacters).toBe(7);
  });

  it('仅在显式启用中文分词时让不超过 25 格的词整体换行', () => {
    const result = layoutShenlunText(`${'甲'.repeat(23)}不可或缺`, 200, {
      segmentWords: true,
    });

    expect(result.rows[0].cells.filter(Boolean)).toHaveLength(23);
    expect(result.rows[1].cells.slice(0, 4).map((cell) => cell?.text)).toEqual([
      '不',
      '可',
      '或',
      '缺',
    ]);
  });

  it('默认逐格排满行尾，不因中文分词留下空白列', () => {
    const result = layoutShenlunText(`${'甲'.repeat(23)}不可或缺`, 200);

    expect(result.rows[0].cells.filter(Boolean)).toHaveLength(25);
    expect(result.rows[0].cells.slice(23, 25).map((cell) => cell?.text)).toEqual([
      '不',
      '可',
    ]);
    expect(result.rows[1].cells.slice(0, 2).map((cell) => cell?.text)).toEqual([
      '或',
      '缺',
    ]);
  });

  it('Intl.Segmenter 不可用时自动回退到字符级布局', () => {
    const descriptor = Object.getOwnPropertyDescriptor(Intl, 'Segmenter');
    Object.defineProperty(Intl, 'Segmenter', {
      configurable: true,
      value: undefined,
    });

    try {
      const result = layoutShenlunText(`${'甲'.repeat(23)}不可或缺`, 200, {
        segmentWords: true,
      });
      expect(result.rows[0].cells.filter(Boolean)).toHaveLength(25);
      expect(result.rows[1].cells.slice(0, 2).map((cell) => cell?.text)).toEqual([
        '或',
        '缺',
      ]);
    } finally {
      if (descriptor) {
        Object.defineProperty(Intl, 'Segmenter', descriptor);
      }
    }
  });

  it('行末闭合标点与前一文字共格并释放最后一格继续排字', () => {
    const result = layoutShenlunText(`${'甲'.repeat(24)}，乙`, 200, {
      segmentWords: false,
    });

    expect(result.rows[0].cells.filter(Boolean)).toHaveLength(25);
    expect(result.rows[0].cells[23]?.text).toBe('甲，');
    expect(result.rows[0].cells[24]?.text).toBe('乙');
    expect(result.rows[1].cells.every((cell) => cell === null)).toBe(true);
  });

  it('不让中文开标点单独落在行末', () => {
    const result = layoutShenlunText(`${'甲'.repeat(24)}“乙`, 200, {
      segmentWords: false,
    });

    expect(result.rows[0].cells.filter(Boolean)).toHaveLength(24);
    expect(result.rows[1].cells.slice(0, 2).map((cell) => cell?.text)).toEqual([
      '“',
      '乙',
    ]);
  });

  it('普通空格占一格并计字，制表符和回车仍不计数', () => {
    const result = layoutShenlunText('甲 乙\r\n\t丙', 200, {
      segmentWords: false,
    });

    expect(result.usedCells).toBe(4);
    expect(result.usedCharacters).toBe(4);
    expect(result.rows[0].cells.slice(0, 3).map((cell) => cell?.text)).toEqual([
      '甲',
      ' ',
      '乙',
    ]);
    expect(result.rows[0].cells[1]?.sourceIndexes).toEqual([1]);
    expect(result.rows[0].forcedBreak).toBe(true);
    expect(result.rows[1].cells[0]?.text).toBe('丙');
  });

  it('普通空格计入模板超限，结构空位仍不计字', () => {
    const text = `甲 ${SHENLUN_STRUCTURAL_BLANK}乙`;
    const result = layoutShenlunText(text, 2, { segmentWords: false });

    expect(result.rows[0].cells.slice(0, 4).map((cell) => cell?.text)).toEqual([
      '甲',
      ' ',
      '',
      '乙',
    ]);
    expect(result.usedCells).toBe(4);
    expect(result.usedCharacters).toBe(3);
    expect(result.overflowCells).toBe(1);
    expect(result.overflowCharacters).toBe(1);
    expect(result.rows[0].cells[3]?.overflow).toBe(true);
    expect(result.rows[0].cells[2]?.overflow).toBe(false);
  });

  it('结构空位显示为空格且独占一格，但不计字数、超限和标题预览', () => {
    const text = `甲${SHENLUN_STRUCTURAL_BLANK.repeat(2)}乙`;
    const result = layoutShenlunText(text, 2, { segmentWords: false });

    expect(result.rows[0].cells.slice(0, 4).map((cell) => cell?.text)).toEqual([
      '甲',
      '',
      '',
      '乙',
    ]);
    expect(result.rows[0].cells.slice(1, 3).map((cell) => cell?.sourceIndexes)).toEqual([[1], [2]]);
    expect(result.usedCells).toBe(4);
    expect(result.usedCharacters).toBe(2);
    expect(result.overflowCells).toBe(0);
    expect(result.overflowCharacters).toBe(0);
    expect(shenlunVisibleText(text)).toBe('甲乙');
  });

  it('返回正文末尾对应的下一个方格索引', () => {
    expect(layoutShenlunText('AB', 200, { segmentWords: false }).endCellIndex).toBe(1);
    expect(layoutShenlunText('甲\n', 200, { segmentWords: false }).endCellIndex).toBe(25);
  });

  it('保留原文换行，不把换行后的闭合标点移回上一行', () => {
    const result = layoutShenlunText('甲\n，', 200, { segmentWords: false });

    expect(result.rows[0].cells[0]?.text).toBe('甲');
    expect(result.rows[0].forcedBreak).toBe(true);
    expect(result.rows[1].cells[0]?.text).toBe('，');
  });

  it('只为已经达到的每 200 个实际占格生成标记', () => {
    const before = layoutShenlunText('甲'.repeat(199), 400, {
      segmentWords: false,
    });
    const reached = layoutShenlunText('甲'.repeat(400), 400, {
      segmentWords: false,
    });

    expect(before.markers).toEqual([]);
    expect(reached.markers).toEqual([
      { count: 200, rowIndex: 7 },
      { count: 400, rowIndex: 15 },
    ]);
  });

  it('英数字符两字符一格时，字数和超限仍按实际字符计数', () => {
    const result = layoutShenlunText('A'.repeat(201), 200, { segmentWords: false });

    expect(result.usedCells).toBe(101);
    expect(result.usedCharacters).toBe(201);
    expect(result.overflowCells).toBe(1);
    expect(result.overflowCharacters).toBe(1);
    expect(result.markers).toEqual([{ count: 200, rowIndex: 3 }]);
  });

  it('超出 200 格模板后追加警示行并只标记两个超限占用格', () => {
    const result = layoutShenlunText('甲'.repeat(202), 200, {
      segmentWords: false,
    });

    expect(result.rows).toHaveLength(9);
    expect(result.rows.every((row) => row.cells.length === SHENLUN_COLUMNS)).toBe(true);
    expect(result.usedCells).toBe(202);
    expect(result.overflowCells).toBe(2);
    expect(result.rows.slice(0, 8).flatMap((row) => row.cells).every(
      (cell) => !cell?.overflow,
    )).toBe(true);
    expect(result.rows[8].cells.slice(0, 2).every((cell) => cell?.overflow)).toBe(true);
    expect(result.rows[8].cells.slice(2).every((cell) => cell === null)).toBe(true);
  });

  it('导出页面依赖的稳定类型', () => {
    const layout = layoutShenlunText('甲', 200, { segmentWords: false });
    const cell = layout.rows[0].cells[0];

    expect(cell).not.toBeNull();
    assertExportedTypes(200, cell!, layout.rows[0], { count: 200, rowIndex: 7 }, layout);
  });
});
