import {
  layoutShenlunText,
  SHENLUN_STRUCTURAL_BLANK,
  type ShenlunCell,
} from './layout';

export type ShenlunDecorationMarkType = 'bold' | 'underline' | 'strike';
export type ShenlunTextColor = 'ink' | 'red' | 'blue' | 'green';
export type ShenlunStoredTextColor = Exclude<ShenlunTextColor, 'ink'>;
export type ShenlunMarkType = ShenlunDecorationMarkType | 'color';

export const SHENLUN_TEXT_COLORS: ShenlunTextColor[] = ['ink', 'red', 'blue', 'green'];

export interface ShenlunMark {
  id: string;
  type: ShenlunMarkType;
  color?: ShenlunStoredTextColor;
  start: number;
  end: number;
}

export interface ShenlunSelection {
  start: number;
  end: number;
}

export interface ShenlunEditorSnapshot {
  text: string;
  marks: ShenlunMark[];
  selection: ShenlunSelection;
  pendingMarks: ShenlunDecorationMarkType[];
  pendingColor: ShenlunTextColor;
}

export interface ShenlunEditorState extends ShenlunEditorSnapshot {
  undoStack: ShenlunEditorSnapshot[];
  redoStack: ShenlunEditorSnapshot[];
}

export type ShenlunEditorOperation =
  | { type: 'select'; selection: ShenlunSelection }
  | { type: 'selectAll' }
  | { type: 'insert'; text: string }
  | { type: 'backspace' }
  | { type: 'delete' }
  | { type: 'padToCell'; cellIndex: number }
  | { type: 'toggleMark'; markType: ShenlunDecorationMarkType }
  | { type: 'setColor'; color: ShenlunTextColor }
  | { type: 'undo' }
  | { type: 'redo' };

interface ShenlunEditorInitialState {
  text?: string;
  marks?: ShenlunMark[];
  selection?: ShenlunSelection;
  pendingMarks?: ShenlunDecorationMarkType[];
  pendingColor?: ShenlunTextColor;
}

const DECORATION_MARK_TYPES: ShenlunDecorationMarkType[] = ['bold', 'underline', 'strike'];
const MARK_TYPES: ShenlunMarkType[] = [...DECORATION_MARK_TYPES, 'color'];
const STORED_TEXT_COLORS: ShenlunStoredTextColor[] = ['red', 'blue', 'green'];

export function createShenlunEditorState(
  initial: ShenlunEditorInitialState = {},
): ShenlunEditorState {
  const text = initial.text ?? '';
  const selection = clampSelection(
    initial.selection ?? { start: text.length, end: text.length },
    text.length,
  );

  return {
    text,
    marks: normalizeMarks(initial.marks ?? [], text.length),
    selection,
    pendingMarks: selection.start === selection.end
      ? normalizePendingMarks(initial.pendingMarks ?? [])
      : [],
    pendingColor: normalizeTextColor(initial.pendingColor),
    undoStack: [],
    redoStack: [],
  };
}

export function applyShenlunEditorOperation(
  state: ShenlunEditorState,
  operation: ShenlunEditorOperation,
): ShenlunEditorState {
  switch (operation.type) {
    case 'select':
      return select(state, operation.selection);
    case 'selectAll':
      return select(state, { start: 0, end: state.text.length });
    case 'insert':
      return replaceRange(
        state,
        state.selection.start,
        state.selection.end,
        operation.text,
        state.selection.start === state.selection.end,
      );
    case 'backspace':
      return deleteBackward(state);
    case 'delete':
      return deleteForward(state);
    case 'padToCell':
      return padToCell(state, operation.cellIndex);
    case 'toggleMark':
      return toggleMark(state, operation.markType);
    case 'setColor':
      return setColor(state, operation.color);
    case 'undo':
      return undo(state);
    case 'redo':
      return redo(state);
  }
}

function select(state: ShenlunEditorState, selection: ShenlunSelection): ShenlunEditorState {
  const nextSelection = clampSelection(selection, state.text.length);
  return {
    ...state,
    selection: nextSelection,
    pendingMarks: nextSelection.start === nextSelection.end ? state.pendingMarks : [],
  };
}

function deleteBackward(state: ShenlunEditorState): ShenlunEditorState {
  const { start, end } = state.selection;
  if (start !== end) return replaceRange(state, start, end, '', false);
  if (start === 0) return state;
  return replaceRange(state, previousCharacterIndex(state.text, start), start, '', false);
}

function deleteForward(state: ShenlunEditorState): ShenlunEditorState {
  const { start, end } = state.selection;
  if (start !== end) return replaceRange(state, start, end, '', false);
  if (end === state.text.length) return state;
  return replaceRange(state, start, nextCharacterIndex(state.text, end), '', false);
}

function padToCell(state: ShenlunEditorState, requestedCellIndex: number): ShenlunEditorState {
  const cellIndex = Math.max(0, Math.floor(requestedCellIndex));
  const layout = layoutShenlunText(state.text, Math.max(200, cellIndex + 1));
  if (cellIndex < layout.endCellIndex) {
    const cells = layout.rows.flatMap((row) => row.cells);
    if (cells[cellIndex]) return state;
    let previousCellIndex = cellIndex - 1;
    while (previousCellIndex >= 0 && !cells[previousCellIndex]) previousCellIndex -= 1;
    const previousCell = previousCellIndex >= 0 ? cells[previousCellIndex] : null;
    const insertionIndex = previousCell ? cellSourceEnd(previousCell) : 0;
    const paddingCount = cellIndex - previousCellIndex - 1;
    if (paddingCount === 0) {
      return select(state, { start: insertionIndex, end: insertionIndex });
    }
    return replaceRange(
      { ...state, selection: { start: insertionIndex, end: insertionIndex } },
      insertionIndex,
      insertionIndex,
      SHENLUN_STRUCTURAL_BLANK.repeat(paddingCount),
      false,
    );
  }
  if (cellIndex === layout.endCellIndex) {
    return select(state, { start: state.text.length, end: state.text.length });
  }

  const padding = SHENLUN_STRUCTURAL_BLANK.repeat(cellIndex - layout.endCellIndex);
  const text = state.text + padding;
  return withHistory(state, {
    text,
    marks: state.marks,
    selection: { start: text.length, end: text.length },
    pendingMarks: state.pendingMarks,
    pendingColor: state.pendingColor,
  });
}

function cellSourceEnd(cell: ShenlunCell): number {
  const characters = Array.from(cell.text);
  const lastIndex = cell.sourceIndexes[cell.sourceIndexes.length - 1] ?? 0;
  return lastIndex + (characters[characters.length - 1]?.length ?? 1);
}

function toggleMark(state: ShenlunEditorState, markType: ShenlunDecorationMarkType): ShenlunEditorState {
  const { start, end } = state.selection;
  if (start === end) {
    const pendingMarks = state.pendingMarks.includes(markType)
      ? state.pendingMarks.filter((type) => type !== markType)
      : normalizePendingMarks([...state.pendingMarks, markType]);
    return { ...state, pendingMarks };
  }

  const marks = isRangeMarked(state.marks, markType, start, end)
    ? removeMarkRange(state.marks, markType, start, end)
    : normalizeMarks([
        ...state.marks,
        { id: nextMarkId(state.marks), type: markType, start, end },
      ], state.text.length);

  return withHistory(state, {
    text: state.text,
    marks,
    selection: state.selection,
    pendingMarks: [],
    pendingColor: state.pendingColor,
  });
}

function setColor(state: ShenlunEditorState, color: ShenlunTextColor): ShenlunEditorState {
  const nextColor = normalizeTextColor(color);
  const { start, end } = state.selection;
  if (start === end) return { ...state, pendingColor: nextColor };

  const marks = removeMarkRange(state.marks, 'color', start, end);
  if (nextColor !== 'ink') {
    marks.push({
      id: nextMarkId(marks),
      type: 'color',
      color: nextColor,
      start,
      end,
    });
  }

  return withHistory(state, {
    text: state.text,
    marks: normalizeMarks(marks, state.text.length),
    selection: state.selection,
    pendingMarks: [],
    pendingColor: nextColor,
  });
}

function replaceRange(
  state: ShenlunEditorState,
  rawStart: number,
  rawEnd: number,
  insertedText: string,
  applyPendingMarks: boolean,
): ShenlunEditorState {
  const { start, end } = clampSelection({ start: rawStart, end: rawEnd }, state.text.length);
  if (start === end && insertedText.length === 0) return state;

  const text = state.text.slice(0, start) + insertedText + state.text.slice(end);
  let marks = transformMarksForReplacement(state.marks, start, end, insertedText.length);
  if (applyPendingMarks && insertedText.length > 0) {
    for (const type of state.pendingMarks) {
      marks.push({
        id: nextMarkId(marks),
        type,
        start,
        end: start + insertedText.length,
      });
    }
    if (state.pendingColor !== 'ink') {
      marks.push({
        id: nextMarkId(marks),
        type: 'color',
        color: state.pendingColor,
        start,
        end: start + insertedText.length,
      });
    }
  }
  marks = normalizeMarks(marks, text.length);
  const caret = start + insertedText.length;

  return withHistory(state, {
    text,
    marks,
    selection: { start: caret, end: caret },
    pendingMarks: state.pendingMarks,
    pendingColor: state.pendingColor,
  });
}

function transformMarksForReplacement(
  marks: ShenlunMark[],
  start: number,
  end: number,
  insertedLength: number,
): ShenlunMark[] {
  const delta = insertedLength - (end - start);
  const transformed: ShenlunMark[] = [];
  const usedIds = new Set(marks.map((mark) => mark.id));

  for (const mark of marks) {
    if (mark.end <= start) {
      transformed.push(mark);
      continue;
    }
    if (mark.start >= end) {
      transformed.push({ ...mark, start: mark.start + delta, end: mark.end + delta });
      continue;
    }

    if (mark.start < start) {
      transformed.push({ ...mark, end: start });
    }
    if (mark.end > end) {
      transformed.push({
        ...mark,
        id: mark.start < start ? uniqueMarkId(`${mark.id}-split`, usedIds) : mark.id,
        start: start + insertedLength,
        end: mark.end + delta,
      });
    }
  }

  return transformed;
}

function removeMarkRange(
  marks: ShenlunMark[],
  type: ShenlunMarkType,
  start: number,
  end: number,
): ShenlunMark[] {
  const result: ShenlunMark[] = [];
  const usedIds = new Set(marks.map((mark) => mark.id));

  for (const mark of marks) {
    if (mark.type !== type || mark.end <= start || mark.start >= end) {
      result.push(mark);
      continue;
    }
    if (mark.start < start) {
      result.push({ ...mark, end: start });
    }
    if (mark.end > end) {
      result.push({
        ...mark,
        id: mark.start < start ? uniqueMarkId(`${mark.id}-split`, usedIds) : mark.id,
        start: end,
      });
    }
  }

  return normalizeMarks(result, Number.MAX_SAFE_INTEGER);
}

function isRangeMarked(
  marks: ShenlunMark[],
  type: ShenlunDecorationMarkType,
  start: number,
  end: number,
): boolean {
  let coveredUntil = start;
  const ranges = marks
    .filter((mark) => mark.type === type && mark.end > start && mark.start < end)
    .sort((left, right) => left.start - right.start);

  for (const mark of ranges) {
    if (mark.start > coveredUntil) return false;
    coveredUntil = Math.max(coveredUntil, mark.end);
    if (coveredUntil >= end) return true;
  }
  return false;
}

function undo(state: ShenlunEditorState): ShenlunEditorState {
  const previous = state.undoStack[state.undoStack.length - 1];
  if (!previous) return state;
  return {
    ...copySnapshot(previous),
    undoStack: state.undoStack.slice(0, -1),
    redoStack: [...state.redoStack, snapshot(state)],
  };
}

function redo(state: ShenlunEditorState): ShenlunEditorState {
  const next = state.redoStack[state.redoStack.length - 1];
  if (!next) return state;
  return {
    ...copySnapshot(next),
    undoStack: [...state.undoStack, snapshot(state)],
    redoStack: state.redoStack.slice(0, -1),
  };
}

function withHistory(
  state: ShenlunEditorState,
  next: ShenlunEditorSnapshot,
): ShenlunEditorState {
  if (state.text === next.text && marksEqual(state.marks, next.marks)) return state;
  return {
    ...copySnapshot(next),
    undoStack: [...state.undoStack, snapshot(state)],
    redoStack: [],
  };
}

function snapshot(state: ShenlunEditorSnapshot): ShenlunEditorSnapshot {
  return copySnapshot(state);
}

function copySnapshot(state: ShenlunEditorSnapshot): ShenlunEditorSnapshot {
  return {
    text: state.text,
    marks: state.marks.map((mark) => ({ ...mark })),
    selection: { ...state.selection },
    pendingMarks: [...state.pendingMarks],
    pendingColor: state.pendingColor,
  };
}

function clampSelection(selection: ShenlunSelection, textLength: number): ShenlunSelection {
  const first = Math.max(0, Math.min(textLength, Math.floor(selection.start)));
  const second = Math.max(0, Math.min(textLength, Math.floor(selection.end)));
  return first <= second
    ? { start: first, end: second }
    : { start: second, end: first };
}

function normalizeMarks(marks: ShenlunMark[], textLength: number): ShenlunMark[] {
  const valid = marks
    .filter((mark) => (
      MARK_TYPES.includes(mark.type)
      && (mark.type !== 'color' || Boolean(mark.color && STORED_TEXT_COLORS.includes(mark.color)))
    ))
    .map((mark) => ({
      id: mark.id,
      type: mark.type,
      ...(mark.type === 'color' ? { color: mark.color } : {}),
      start: Math.max(0, Math.min(textLength, Math.floor(mark.start))),
      end: Math.max(0, Math.min(textLength, Math.floor(mark.end))),
    }))
    .filter((mark) => mark.start < mark.end)
    .sort((left, right) => (
      left.type.localeCompare(right.type)
      || (left.color ?? '').localeCompare(right.color ?? '')
      || left.start - right.start
      || left.end - right.end
    ));
  const normalized: ShenlunMark[] = [];

  for (const mark of valid) {
    const previous = normalized[normalized.length - 1];
    if (previous?.type === mark.type && previous.color === mark.color && mark.start <= previous.end) {
      previous.end = Math.max(previous.end, mark.end);
    } else {
      normalized.push({ ...mark });
    }
  }

  return normalized.sort((left, right) => (
    left.start - right.start
    || left.end - right.end
    || left.type.localeCompare(right.type)
    || (left.color ?? '').localeCompare(right.color ?? '')
  ));
}

function normalizePendingMarks(types: ShenlunDecorationMarkType[]): ShenlunDecorationMarkType[] {
  return DECORATION_MARK_TYPES.filter((type) => types.includes(type));
}

function normalizeTextColor(color: ShenlunTextColor | undefined): ShenlunTextColor {
  return color && SHENLUN_TEXT_COLORS.includes(color) ? color : 'ink';
}

function nextMarkId(marks: ShenlunMark[]): string {
  const ids = new Set(marks.map((mark) => mark.id));
  let index = 1;
  while (ids.has(`mark-${index}`)) index += 1;
  return `mark-${index}`;
}

function uniqueMarkId(base: string, usedIds: Set<string>): string {
  let id = base;
  let suffix = 2;
  while (usedIds.has(id)) {
    id = `${base}-${suffix}`;
    suffix += 1;
  }
  usedIds.add(id);
  return id;
}

function marksEqual(left: ShenlunMark[], right: ShenlunMark[]): boolean {
  return left.length === right.length && left.every((mark, index) => (
    mark.id === right[index].id
    && mark.type === right[index].type
    && mark.color === right[index].color
    && mark.start === right[index].start
    && mark.end === right[index].end
  ));
}

function previousCharacterIndex(text: string, index: number): number {
  const previous = index - 1;
  const code = text.charCodeAt(previous);
  return code >= 0xDC00 && code <= 0xDFFF && previous > 0
    && text.charCodeAt(previous - 1) >= 0xD800 && text.charCodeAt(previous - 1) <= 0xDBFF
    ? previous - 1
    : previous;
}

function nextCharacterIndex(text: string, index: number): number {
  const code = text.charCodeAt(index);
  return code >= 0xD800 && code <= 0xDBFF
    && index + 1 < text.length
    && text.charCodeAt(index + 1) >= 0xDC00 && text.charCodeAt(index + 1) <= 0xDFFF
    ? index + 2
    : index + 1;
}
