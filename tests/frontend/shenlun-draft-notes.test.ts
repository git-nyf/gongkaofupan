// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest';
import {
  createEmptyShenlunDraft,
  readShenlunDraft,
  reconcileAnnotations,
  shenlunDraftStorageKey,
  writeShenlunDraft,
} from '../../src/shenlun/draft';
import { parseShenlunNotes } from '../../src/shenlun/notes';
import { SHENLUN_STRUCTURAL_BLANK } from '../../src/shenlun/layout';

const validAnnotation = {
  id: 'annotation-1',
  start: 2,
  end: 6,
  quote: '基层治理',
  body: '补充治理主体',
  createdAt: '2026-08-08T00:00:00.000Z',
  detached: false,
};

const validDraft = {
  version: 2 as const,
  template: 800,
  title: '依法行政复盘',
  titleTouched: true,
  text: '依法行政',
  standardAnswer: '坚持依法履职。',
  marks: [{ id: 'mark-1', type: 'bold' as const, start: 0, end: 2 }],
  notes: '复盘备注',
  annotations: [validAnnotation],
  reviewId: 'review-1',
};

describe('申论草稿', () => {
  beforeEach(() => window.localStorage.clear());

  it('使用固定存储键并创建默认 400 字空草稿', () => {
    expect(shenlunDraftStorageKey).toBe('gongkao-shenlun-draft-v1');
    expect(createEmptyShenlunDraft()).toEqual({
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
  });

  it.each([200, 400, 800, 1000] as const)('读写合法的 %i 字草稿', (template) => {
    const draft = {
      ...validDraft,
      template,
      marks: [
        ...validDraft.marks,
        { id: 'mark-color', type: 'color' as const, color: 'red' as const, start: 2, end: 4 },
      ],
    };

    writeShenlunDraft(draft);

    expect(JSON.parse(window.localStorage.getItem(shenlunDraftStorageKey) ?? '')).toEqual(draft);
    expect(readShenlunDraft()).toEqual(draft);
  });

  it.each([
    ['缺少数据', null],
    ['损坏 JSON', '{broken'],
    ['错误版本', JSON.stringify({ ...validDraft, version: 3 })],
    ['错误模板', JSON.stringify({ ...validDraft, template: 600 })],
    ['非字符串正文', JSON.stringify({ ...validDraft, text: null })],
    ['非字符串备注', JSON.stringify({ ...validDraft, notes: [] })],
    ['非字符串标题', JSON.stringify({ ...validDraft, title: null })],
    ['非字符串标准答案', JSON.stringify({ ...validDraft, standardAnswer: null })],
    ['非数组格式', JSON.stringify({ ...validDraft, marks: {} })],
    ['格式类型非法', JSON.stringify({ ...validDraft, marks: [{ ...validDraft.marks[0], type: 'italic' }] })],
    ['格式范围越过正文', JSON.stringify({ ...validDraft, marks: [{ ...validDraft.marks[0], end: 20 }] })],
    ['复盘编号非字符串', JSON.stringify({ ...validDraft, reviewId: 1 })],
    ['非数组批注', JSON.stringify({ ...validDraft, annotations: {} })],
    ['批注 id 非字符串', JSON.stringify({ ...validDraft, annotations: [{ ...validAnnotation, id: 1 }] })],
    ['批注 start 非整数', JSON.stringify({ ...validDraft, annotations: [{ ...validAnnotation, start: 1.5 }] })],
    ['批注 end 非整数', JSON.stringify({ ...validDraft, annotations: [{ ...validAnnotation, end: '6' }] })],
    ['批注 quote 非字符串', JSON.stringify({ ...validDraft, annotations: [{ ...validAnnotation, quote: null }] })],
    ['批注 body 非字符串', JSON.stringify({ ...validDraft, annotations: [{ ...validAnnotation, body: null }] })],
    ['批注 createdAt 非字符串', JSON.stringify({ ...validDraft, annotations: [{ ...validAnnotation, createdAt: 0 }] })],
    ['批注 detached 非布尔值', JSON.stringify({ ...validDraft, annotations: [{ ...validAnnotation, detached: 'false' }] })],
  ])('在%s时回退到新空草稿', (_caseName, storedValue) => {
    if (storedValue !== null) {
      window.localStorage.setItem(shenlunDraftStorageKey, storedValue);
    }

    expect(readShenlunDraft()).toEqual(createEmptyShenlunDraft());
  });

  it('读取版本 1 草稿时迁移新增字段并保留正文、备注和批注', () => {
    const legacyDraft = {
      version: 1,
      template: 800,
      text: '依法行政',
      notes: '复盘备注',
      annotations: [validAnnotation],
    };
    window.localStorage.setItem(shenlunDraftStorageKey, JSON.stringify(legacyDraft));

    expect(readShenlunDraft()).toEqual({
      ...legacyDraft,
      version: 2,
      title: '',
      titleTouched: false,
      standardAnswer: '',
      marks: [],
    });
  });

  it('引用在新正文中唯一出现时更新位置并恢复连接', () => {
    const [annotation] = reconcileAnnotations('开头推进基层治理提质', [
      { ...validAnnotation, start: 0, end: 0, detached: true },
    ]);

    expect(annotation).toMatchObject({ start: 4, end: 8, detached: false });
  });

  it.each([
    ['重复', '基层治理与基层治理', '基层治理'],
    ['缺失', '没有原文', '基层治理'],
    ['为空', '任意正文', ''],
  ])('引用%s时标记批注失联', (_caseName, text, quote) => {
    const [annotation] = reconcileAnnotations(text, [{ ...validAnnotation, quote }]);

    expect(annotation).toMatchObject({
      start: validAnnotation.start,
      end: validAnnotation.end,
      detached: true,
    });
  });

  it('原区间仍匹配时保留重复词语和跨结构空位批注', () => {
    const duplicate = reconcileAnnotations('治理治理。', [{
      ...validAnnotation,
      start: 2,
      end: 4,
      quote: '治理',
    }]);
    const structural = reconcileAnnotations(`甲${SHENLUN_STRUCTURAL_BLANK}乙。`, [{
      ...validAnnotation,
      start: 0,
      end: 3,
      quote: '甲乙',
    }]);

    expect(duplicate[0]).toMatchObject({ start: 2, end: 4, detached: false });
    expect(structural[0]).toMatchObject({ start: 0, end: 3, detached: false });
  });
});

describe('申论备注解析', () => {
  it('解析带前后文本且 ID 合法的复盘内部链接', () => {
    expect(parseShenlunNotes('前文[资料题](/review#review-item-image_2-OK)后文')).toEqual([
      { type: 'text', text: '前文' },
      { type: 'link', text: '资料题', href: '/review#review-item-image_2-OK' },
      { type: 'text', text: '后文' },
    ]);
  });

  it.each([
    '[外站](https://example.com)',
    '[非法 ID](/review#review-item-image.2)',
    '<img src=x onerror=alert(1)>',
  ])('将非白名单内容原样保留为文本：%s', (notes) => {
    expect(parseShenlunNotes(notes)).toEqual([{ type: 'text', text: notes }]);
  });
});
