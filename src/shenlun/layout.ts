export const SHENLUN_COLUMNS = 25;
export const SHENLUN_STRUCTURAL_BLANK = '\uE000';
export const SHENLUN_TEMPLATES = [200, 400, 800, 1000] as const;
export type ShenlunTemplate = (typeof SHENLUN_TEMPLATES)[number];

export interface ShenlunCell {
  text: string;
  sourceIndexes: number[];
  overflow: boolean;
}

export interface ShenlunRow {
  cells: Array<ShenlunCell | null>;
  forcedBreak: boolean;
}

export interface ShenlunMarker {
  count: number;
  rowIndex: number;
}

export interface ShenlunLayout {
  rows: ShenlunRow[];
  endCellIndex: number;
  usedCells: number;
  usedCharacters: number;
  overflowCells: number;
  overflowCharacters: number;
  markers: ShenlunMarker[];
}

interface SourceCharacter {
  text: string;
  sourceIndex: number;
}

interface LayoutUnit {
  cells: ShenlunCell[];
}

interface WorkingRow {
  cells: ShenlunCell[];
  forcedBreak: boolean;
}

interface TextPart {
  text: string;
  startIndex: number;
  breakAfter: boolean;
}

const CLOSING_PUNCTUATION = new Set('，。；：！？、）】》〉」』〕〗〙〛”’'.split(''));
const OPENING_PUNCTUATION = new Set('（【《〈「『〔〖〘〚“‘'.split(''));

export function rowsForTemplate(template: ShenlunTemplate | number): number {
  return Math.ceil(template / SHENLUN_COLUMNS);
}

export function shenlunVisibleText(text: string): string {
  return text.split(SHENLUN_STRUCTURAL_BLANK).join('');
}

export function layoutShenlunText(
  text: string,
  template: ShenlunTemplate | number,
  options: { segmentWords?: boolean } = {},
): ShenlunLayout {
  const rows: WorkingRow[] = [{ cells: [], forcedBreak: false }];
  const segmentWords = options.segmentWords === true;
  const segmenter = segmentWords ? createSegmenter() : null;

  for (const part of splitTextParts(text)) {
    const units = unitsForPart(part, segmentWords, segmenter);
    for (const unit of units) {
      placeUnit(rows, unit);
    }

    if (part.breakAfter) {
      rows[rows.length - 1].forcedBreak = true;
      rows.push({ cells: [], forcedBreak: false });
    }
  }

  const lastContentRow = rows[rows.length - 1];
  const endCellIndex = (rows.length - 1) * SHENLUN_COLUMNS + lastContentRow.cells.length;

  while (rows.length < rowsForTemplate(template)) {
    rows.push({ cells: [], forcedBreak: false });
  }

  let usedCells = 0;
  let usedCharacters = 0;
  let overflowCells = 0;
  let overflowCharacters = 0;
  const markers: ShenlunMarker[] = [];
  let nextMarker = 200;
  for (const [rowIndex, row] of rows.entries()) {
    for (const cell of row.cells) {
      usedCells += 1;
      const previousCharacters = usedCharacters;
      const characterCount = cell.text.length === 0 ? 0 : cell.sourceIndexes.length;
      usedCharacters += characterCount;
      cell.overflow = characterCount > 0 && usedCharacters > template;
      if (cell.overflow) {
        overflowCells += 1;
        overflowCharacters += Math.max(0, usedCharacters - Math.max(template, previousCharacters));
      }
      while (previousCharacters < nextMarker && usedCharacters >= nextMarker) {
        markers.push({ count: nextMarker, rowIndex });
        nextMarker += 200;
      }
    }
  }

  return {
    rows: rows.map((row) => ({
      cells: padCells(row.cells),
      forcedBreak: row.forcedBreak,
    })),
    endCellIndex,
    usedCells,
    usedCharacters,
    overflowCells,
    overflowCharacters,
    markers,
  };
}

function createSegmenter(): Intl.Segmenter | null {
  if (typeof Intl.Segmenter !== 'function') {
    return null;
  }

  try {
    return new Intl.Segmenter('zh', { granularity: 'word' });
  } catch {
    return null;
  }
}

function splitTextParts(text: string): TextPart[] {
  const parts: TextPart[] = [];
  let lineStart = 0;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character !== '\n' && character !== '\r') {
      continue;
    }

    parts.push({
      text: text.slice(lineStart, index),
      startIndex: lineStart,
      breakAfter: true,
    });
    if (character === '\r' && text[index + 1] === '\n') {
      index += 1;
    }
    lineStart = index + 1;
  }

  parts.push({
    text: text.slice(lineStart),
    startIndex: lineStart,
    breakAfter: false,
  });
  return parts;
}

function unitsForPart(
  part: TextPart,
  segmentWords: boolean,
  segmenter: Intl.Segmenter | null,
): LayoutUnit[] {
  if (!segmentWords || !segmenter) {
    return cellsToUnits(createCells(part.text, part.startIndex));
  }

  try {
    const segments: Array<{ text: string; startIndex: number }> = [];
    for (const segment of segmenter.segment(part.text)) {
      const previous = segments[segments.length - 1];
      const adjacent = previous
        && previous.startIndex + previous.text.length === segment.index + part.startIndex;
      const mergeAdjacentSegments = adjacent && (
        (isAsciiAlphaNumericText(previous.text) && isAsciiAlphaNumericText(segment.segment))
        || (isPunctuationText(previous.text) && isPunctuationText(segment.segment))
      );
      if (mergeAdjacentSegments) {
        previous.text += segment.segment;
      } else {
        segments.push({
          text: segment.segment,
          startIndex: part.startIndex + segment.index,
        });
      }
    }
    return segments.flatMap((segment) => {
      const cells = createCells(segment.text, segment.startIndex);
      return cells.length > 0 ? [{ cells }] : [];
    });
  } catch {
    return cellsToUnits(createCells(part.text, part.startIndex));
  }
}

function cellsToUnits(cells: ShenlunCell[]): LayoutUnit[] {
  return cells.map((cell) => ({ cells: [cell] }));
}

function createCells(text: string, startIndex: number): ShenlunCell[] {
  const characters: SourceCharacter[] = [];
  let sourceIndex = startIndex;
  for (const character of Array.from(text)) {
    characters.push({ text: character, sourceIndex });
    sourceIndex += character.length;
  }

  const cells: ShenlunCell[] = [];
  let alphaNumericRun: SourceCharacter[] = [];
  let punctuationRun: SourceCharacter[] = [];
  const flushAlphaNumericRun = () => {
    for (let index = 0; index < alphaNumericRun.length; index += 2) {
      const pair = alphaNumericRun.slice(index, index + 2);
      cells.push({
        text: pair.map((character) => character.text).join(''),
        sourceIndexes: pair.map((character) => character.sourceIndex),
        overflow: false,
      });
    }
    alphaNumericRun = [];
  };
  const flushPunctuationRun = () => {
    for (let index = 0; index < punctuationRun.length; index += 2) {
      const pair = punctuationRun.slice(index, index + 2);
      cells.push({
        text: pair.map((character) => character.text).join(''),
        sourceIndexes: pair.map((character) => character.sourceIndex),
        overflow: false,
      });
    }
    punctuationRun = [];
  };

  for (const character of characters) {
    if (character.text === SHENLUN_STRUCTURAL_BLANK) {
      flushAlphaNumericRun();
      flushPunctuationRun();
      cells.push({
        text: '',
        sourceIndexes: [character.sourceIndex],
        overflow: false,
      });
      continue;
    }

    if (isAsciiAlphaNumeric(character.text)) {
      flushPunctuationRun();
      alphaNumericRun.push(character);
      continue;
    }

    flushAlphaNumericRun();
    if (/\s/u.test(character.text) && character.text !== ' ') {
      flushPunctuationRun();
      continue;
    }
    if (isPunctuation(character.text)) {
      punctuationRun.push(character);
      continue;
    }
    flushPunctuationRun();
    cells.push({
      text: character.text,
      sourceIndexes: [character.sourceIndex],
      overflow: false,
    });
  }
  flushAlphaNumericRun();
  flushPunctuationRun();
  return cells;
}

function isAsciiAlphaNumeric(character: string): boolean {
  return /^[A-Za-z0-9]$/u.test(character);
}

function isAsciiAlphaNumericText(text: string): boolean {
  const characters = Array.from(text);
  return characters.length > 0 && characters.every((character) => isAsciiAlphaNumeric(character));
}

function isPunctuation(character: string): boolean {
  return /^\p{P}$/u.test(character);
}

function isPunctuationText(text: string): boolean {
  const characters = Array.from(text);
  return characters.length > 0 && characters.every((character) => isPunctuation(character));
}

function placeUnit(rows: WorkingRow[], unit: LayoutUnit): void {
  if (unit.cells.length === 0) {
    return;
  }

  const current = rows[rows.length - 1];
  if (
    unit.cells.length <= SHENLUN_COLUMNS
    && current.cells.length > 0
    && current.cells.length + unit.cells.length > SHENLUN_COLUMNS
    && !isClosingPunctuationCell(unit.cells[0])
  ) {
    rows.push({ cells: [], forcedBreak: false });
  }

  for (const cell of unit.cells) {
    placeCell(rows, cell);
  }
}

function placeCell(rows: WorkingRow[], cell: ShenlunCell): void {
  let current = rows[rows.length - 1];
  if (isClosingPunctuationCell(cell) && current.cells.length >= SHENLUN_COLUMNS - 1) {
    mergeCells(current.cells[current.cells.length - 1], cell);
    return;
  }

  if (current.cells.length >= SHENLUN_COLUMNS) {
    rows.push({ cells: [], forcedBreak: false });
    current = rows[rows.length - 1];
  }

  if (isOpeningPunctuationCell(cell) && current.cells.length === SHENLUN_COLUMNS - 1) {
    rows.push({ cells: [], forcedBreak: false });
    current = rows[rows.length - 1];
  }

  if (isClosingPunctuationCell(cell) && current.cells.length === 0) {
    const previous = rows[rows.length - 2];
    if (previous && previous.cells.length > 0 && !previous.forcedBreak) {
      mergeCells(previous.cells[previous.cells.length - 1], cell);
      return;
    }
  }

  current.cells.push(cell);
}

function isClosingPunctuationCell(cell: ShenlunCell): boolean {
  const characters = Array.from(cell.text);
  return characters.length > 0 && characters.every((character) => CLOSING_PUNCTUATION.has(character));
}

function isOpeningPunctuationCell(cell: ShenlunCell): boolean {
  const characters = Array.from(cell.text);
  return characters.length > 0 && characters.every((character) => OPENING_PUNCTUATION.has(character));
}

function mergeCells(target: ShenlunCell, source: ShenlunCell): void {
  target.text += source.text;
  target.sourceIndexes.push(...source.sourceIndexes);
}

function padCells(cells: ShenlunCell[]): Array<ShenlunCell | null> {
  return [
    ...cells,
    ...Array.from({ length: SHENLUN_COLUMNS - cells.length }, () => null),
  ];
}
