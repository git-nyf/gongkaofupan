import { SHENLUN_STRUCTURAL_BLANK, shenlunVisibleText, type ShenlunTemplate } from './layout';
import type { ShenlunMark } from './editor';

export const shenlunDraftStorageKey = 'gongkao-shenlun-draft-v1';

export interface ShenlunAnnotation {
  id: string;
  start: number;
  end: number;
  quote: string;
  body: string;
  createdAt: string;
  detached: boolean;
}

export interface ShenlunDraft {
  version: 2;
  template: ShenlunTemplate;
  title: string;
  titleTouched?: boolean;
  text: string;
  standardAnswer: string;
  marks: ShenlunMark[];
  notes: string;
  annotations: ShenlunAnnotation[];
  reviewId?: string;
}

export const createEmptyShenlunDraft = (): ShenlunDraft => ({
  version: 2,
  template: 400,
  title: '',
  titleTouched: false,
  text: '',
  standardAnswer: '',
  marks: [],
  notes: '',
  annotations: [],
});

function isTemplate(value: unknown): value is ShenlunTemplate {
  return value === 200 || value === 400 || value === 800 || value === 1000;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isAnnotation(value: unknown): value is ShenlunAnnotation {
  if (!isRecord(value)) return false;

  const { start, end } = value;

  return (
    typeof value.id === 'string' &&
    typeof start === 'number' &&
    typeof end === 'number' &&
    Number.isInteger(start) &&
    Number.isInteger(end) &&
    start >= 0 &&
    end >= start &&
    typeof value.quote === 'string' &&
    typeof value.body === 'string' &&
    typeof value.createdAt === 'string' &&
    typeof value.detached === 'boolean'
  );
}

function isMark(value: unknown, textLength: number): value is ShenlunMark {
  if (!isRecord(value)) return false;

  const { start, end } = value;
  const validDecoration = (
    (value.type === 'bold' || value.type === 'underline' || value.type === 'strike')
    && value.color === undefined
  );
  const validColor = (
    value.type === 'color'
    && (value.color === 'red' || value.color === 'blue' || value.color === 'green')
  );
  return (
    typeof value.id === 'string' &&
    (validDecoration || validColor) &&
    typeof start === 'number' &&
    typeof end === 'number' &&
    Number.isInteger(start) &&
    Number.isInteger(end) &&
    start >= 0 &&
    end > start &&
    end <= textLength
  );
}

function isVersionOneDraft(value: unknown): value is {
  version: 1;
  template: ShenlunTemplate;
  text: string;
  notes: string;
  annotations: ShenlunAnnotation[];
} {
  return (
    isRecord(value) &&
    value.version === 1 &&
    isTemplate(value.template) &&
    typeof value.text === 'string' &&
    typeof value.notes === 'string' &&
    Array.isArray(value.annotations) &&
    value.annotations.every(isAnnotation)
  );
}

function isDraft(value: unknown): value is ShenlunDraft {
  if (!isRecord(value) || typeof value.text !== 'string') return false;

  const textLength = value.text.length;
  return (
    value.version === 2 &&
    isTemplate(value.template) &&
    typeof value.title === 'string' &&
    (value.titleTouched === undefined || typeof value.titleTouched === 'boolean') &&
    typeof value.standardAnswer === 'string' &&
    Array.isArray(value.marks) &&
    value.marks.every((mark) => isMark(mark, textLength)) &&
    typeof value.notes === 'string' &&
    Array.isArray(value.annotations) &&
    value.annotations.every(isAnnotation) &&
    (value.reviewId === undefined || typeof value.reviewId === 'string')
  );
}

export function readShenlunDraft(): ShenlunDraft {
  const emptyDraft = createEmptyShenlunDraft();

  try {
    const raw = window.localStorage.getItem(shenlunDraftStorageKey);
    if (!raw) return emptyDraft;

    const parsed: unknown = JSON.parse(raw);
    if (isDraft(parsed)) return { ...parsed, titleTouched: parsed.titleTouched ?? false };
    if (isVersionOneDraft(parsed)) {
      return {
        ...parsed,
        version: 2,
        title: '',
        titleTouched: false,
        standardAnswer: '',
        marks: [],
      };
    }
    return emptyDraft;
  } catch {
    return emptyDraft;
  }
}

export function writeShenlunDraft(draft: ShenlunDraft): void {
  window.localStorage.setItem(shenlunDraftStorageKey, JSON.stringify(draft));
}

export function reconcileAnnotations(
  text: string,
  annotations: ShenlunAnnotation[],
): ShenlunAnnotation[] {
  return annotations.map((annotation) => {
    if (!annotation.quote) {
      return { ...annotation, detached: true };
    }

    if (shenlunVisibleText(text.slice(annotation.start, annotation.end)) === annotation.quote) {
      return { ...annotation, detached: false };
    }

    const matches = findVisibleQuoteRanges(text, annotation.quote);
    if (matches.length !== 1) {
      return { ...annotation, detached: true };
    }

    return {
      ...annotation,
      ...matches[0],
      detached: false,
    };
  });
}

function findVisibleQuoteRanges(text: string, quote: string): Array<{ start: number; end: number }> {
  let visible = '';
  let rawOffset = 0;
  const startByVisibleOffset = new Map<number, number>();
  const endByVisibleOffset = new Map<number, number>();

  for (const character of Array.from(text)) {
    const rawStart = rawOffset;
    rawOffset += character.length;
    if (character === SHENLUN_STRUCTURAL_BLANK) continue;
    const visibleStart = visible.length;
    visible += character;
    startByVisibleOffset.set(visibleStart, rawStart);
    endByVisibleOffset.set(visible.length, rawOffset);
  }

  const matches: Array<{ start: number; end: number }> = [];
  let cursor = 0;
  while (cursor <= visible.length - quote.length) {
    const index = visible.indexOf(quote, cursor);
    if (index < 0) break;
    const start = startByVisibleOffset.get(index);
    const end = endByVisibleOffset.get(index + quote.length);
    if (start !== undefined && end !== undefined) matches.push({ start, end });
    cursor = index + Math.max(1, quote.length);
  }
  return matches;
}
