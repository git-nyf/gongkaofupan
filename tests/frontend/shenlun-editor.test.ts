import { describe, expect, it } from 'vitest';
import {
  applyShenlunEditorOperation,
  createShenlunEditorState,
  type ShenlunEditorState,
} from '../../src/shenlun/editor';
import { SHENLUN_STRUCTURAL_BLANK } from '../../src/shenlun/layout';

function apply(
  state: ShenlunEditorState,
  ...operations: Parameters<typeof applyShenlunEditorOperation>[1][]
) {
  return operations.reduce(applyShenlunEditorOperation, state);
}

describe('申论纯文本编辑核心', () => {
  it('在折叠光标插入文本并把光标移到插入内容之后', () => {
    const state = createShenlunEditorState({ text: '甲乙', selection: { start: 1, end: 1 } });

    const next = applyShenlunEditorOperation(state, { type: 'insert', text: '治理' });

    expect(next.text).toBe('甲治理乙');
    expect(next.selection).toEqual({ start: 3, end: 3 });
  });

  it('输入或粘贴文本时替换当前选区并顺延后文', () => {
    const state = createShenlunEditorState({ text: '提高基层能力', selection: { start: 2, end: 4 } });

    const next = applyShenlunEditorOperation(state, { type: 'insert', text: '治理' });

    expect(next.text).toBe('提高治理能力');
    expect(next.selection).toEqual({ start: 4, end: 4 });
  });

  it('退格与删除键优先删除选区，否则分别删除光标前后一个完整字符', () => {
    const selected = createShenlunEditorState({ text: '甲乙丙', selection: { start: 1, end: 3 } });
    expect(applyShenlunEditorOperation(selected, { type: 'backspace' }).text).toBe('甲');
    expect(applyShenlunEditorOperation(selected, { type: 'delete' }).text).toBe('甲');

    const caret = createShenlunEditorState({ text: '甲😀乙', selection: { start: 3, end: 3 } });
    const backward = applyShenlunEditorOperation(caret, { type: 'backspace' });
    const forward = applyShenlunEditorOperation(caret, { type: 'delete' });
    expect(backward.text).toBe('甲乙');
    expect(backward.selection).toEqual({ start: 1, end: 1 });
    expect(forward.text).toBe('甲😀');
  });

  it('全选操作只更新选区，随后可一次删除全部正文', () => {
    const state = createShenlunEditorState({ text: '申论正文' });

    const selected = applyShenlunEditorOperation(state, { type: 'selectAll' });
    const cleared = applyShenlunEditorOperation(selected, { type: 'delete' });

    expect(selected.selection).toEqual({ start: 0, end: 4 });
    expect(selected.undoStack).toEqual([]);
    expect(cleared.text).toBe('');
    expect(cleared.selection).toEqual({ start: 0, end: 0 });
  });

  it('点击正文之后的目标格时用结构空位补齐并把光标放到目标格', () => {
    const state = createShenlunEditorState({ text: 'AB' });

    const padded = applyShenlunEditorOperation(state, { type: 'padToCell', cellIndex: 4 });
    const typed = applyShenlunEditorOperation(padded, { type: 'insert', text: '甲' });

    expect(padded.text).toBe(`AB${SHENLUN_STRUCTURAL_BLANK.repeat(3)}`);
    expect(padded.selection).toEqual({ start: 5, end: 5 });
    expect(typed.text).toBe(`AB${SHENLUN_STRUCTURAL_BLANK.repeat(3)}甲`);
  });

  it('点击正文末尾紧邻空白格时把光标移动到正文末尾', () => {
    const state = createShenlunEditorState({
      text: '甲乙',
      selection: { start: 0, end: 0 },
    });

    const next = applyShenlunEditorOperation(state, { type: 'padToCell', cellIndex: 2 });

    expect(next.text).toBe('甲乙');
    expect(next.selection).toEqual({ start: 2, end: 2 });
    expect(next.undoStack).toEqual([]);
  });

  it('正文逐格排满后点击末尾空白格继续输入', () => {
    const text = `${'甲'.repeat(23)}不可或缺`;
    const state = createShenlunEditorState({ text });

    const positioned = applyShenlunEditorOperation(state, { type: 'padToCell', cellIndex: 27 });
    const typed = applyShenlunEditorOperation(positioned, { type: 'insert', text: '乙' });

    expect(positioned.selection).toEqual({ start: 27, end: 27 });
    expect(typed.text).toBe(`${text}乙`);
  });

  it('补齐显式换行后的目标格时按实际方格位置计算', () => {
    const state = createShenlunEditorState({ text: '甲\n' });

    const padded = applyShenlunEditorOperation(state, { type: 'padToCell', cellIndex: 27 });

    expect(padded.text).toBe(`甲\n${SHENLUN_STRUCTURAL_BLANK.repeat(2)}`);
  });

  it('正文和格式变更支持撤销、重做，产生新变更后清空重做栈', () => {
    const initial = createShenlunEditorState({ text: '甲', selection: { start: 1, end: 1 } });
    const inserted = applyShenlunEditorOperation(initial, { type: 'insert', text: '乙' });
    const undone = applyShenlunEditorOperation(inserted, { type: 'undo' });
    const redone = applyShenlunEditorOperation(undone, { type: 'redo' });
    const divergent = apply(undone, { type: 'insert', text: '丙' }, { type: 'redo' });

    expect(inserted.undoStack).toHaveLength(1);
    expect(undone.text).toBe('甲');
    expect(redone.text).toBe('甲乙');
    expect(divergent.text).toBe('甲丙');
    expect(divergent.redoStack).toEqual([]);
  });
});

describe('申论格式区间', () => {
  it('有选区时添加或移除对应格式', () => {
    const selected = createShenlunEditorState({ text: '基层治理', selection: { start: 0, end: 4 } });

    const marked = applyShenlunEditorOperation(selected, { type: 'toggleMark', markType: 'bold' });
    const unmarked = applyShenlunEditorOperation(marked, { type: 'toggleMark', markType: 'bold' });

    expect(marked.marks).toEqual([
      expect.objectContaining({ type: 'bold', start: 0, end: 4 }),
    ]);
    expect(unmarked.marks).toEqual([]);
  });

  it('移除部分格式时裁剪并拆分原区间', () => {
    const state = createShenlunEditorState({
      text: '基层治理提质',
      marks: [{ id: 'bold-1', type: 'bold', start: 0, end: 6 }],
      selection: { start: 2, end: 4 },
    });

    const next = applyShenlunEditorOperation(state, { type: 'toggleMark', markType: 'bold' });

    expect(next.marks.map(({ type, start, end }) => ({ type, start, end }))).toEqual([
      { type: 'bold', start: 0, end: 2 },
      { type: 'bold', start: 4, end: 6 },
    ]);
  });

  it('折叠光标切换待输入格式，插入内容后只格式化新文字', () => {
    const state = createShenlunEditorState({ text: '甲乙', selection: { start: 1, end: 1 } });

    const pending = applyShenlunEditorOperation(state, { type: 'toggleMark', markType: 'underline' });
    const inserted = applyShenlunEditorOperation(pending, { type: 'insert', text: '治理' });

    expect(pending.pendingMarks).toEqual(['underline']);
    expect(inserted.marks).toEqual([
      expect.objectContaining({ type: 'underline', start: 1, end: 3 }),
    ]);
  });

  it('替换选区时裁剪相交格式并平移后方格式', () => {
    const state = createShenlunEditorState({
      text: '甲乙丙丁戊己',
      marks: [
        { id: 'bold-1', type: 'bold', start: 0, end: 3 },
        { id: 'strike-1', type: 'strike', start: 4, end: 6 },
      ],
      selection: { start: 1, end: 4 },
    });

    const next = applyShenlunEditorOperation(state, { type: 'insert', text: '新内容' });

    expect(next.text).toBe('甲新内容戊己');
    expect(next.marks.map(({ id, type, start, end }) => ({ id, type, start, end }))).toEqual([
      { id: 'bold-1', type: 'bold', start: 0, end: 1 },
      { id: 'strike-1', type: 'strike', start: 4, end: 6 },
    ]);
  });

  it('文字颜色覆盖选区内旧颜色并保留两侧颜色区间', () => {
    const state = createShenlunEditorState({
      text: '甲乙丙丁',
      marks: [{ id: 'color-1', type: 'color', color: 'red', start: 0, end: 4 }],
      selection: { start: 1, end: 3 },
    });

    const next = applyShenlunEditorOperation(state, { type: 'setColor', color: 'blue' });

    expect(next.marks.map(({ type, color, start, end }) => ({ type, color, start, end }))).toEqual([
      { type: 'color', color: 'red', start: 0, end: 1 },
      { type: 'color', color: 'blue', start: 1, end: 3 },
      { type: 'color', color: 'red', start: 3, end: 4 },
    ]);
  });

  it('折叠光标设置的颜色应用到后续输入并支持撤销', () => {
    const state = createShenlunEditorState({ text: '甲', selection: { start: 1, end: 1 } });
    const colored = applyShenlunEditorOperation(state, { type: 'setColor', color: 'green' });
    const inserted = applyShenlunEditorOperation(colored, { type: 'insert', text: '乙丙' });
    const undone = applyShenlunEditorOperation(inserted, { type: 'undo' });

    expect(colored.pendingColor).toBe('green');
    expect(inserted.marks).toEqual([
      expect.objectContaining({ type: 'color', color: 'green', start: 1, end: 3 }),
    ]);
    expect(undone.text).toBe('甲');
  });
});
