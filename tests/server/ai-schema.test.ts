import { describe, expect, it } from 'vitest';
import { normalizedCardSchema } from '../../server/ai/schema';

const baseCard = {
  normalized_statement: 'A 对应 B',
  question_type: 'single' as const,
  wrong_point: '',
  analysis: 'A 对应 B',
  mnemonic: '',
  extension: '',
  notes: '',
  tags: ['对应关系'],
  quiz_items: [{ direction: 'single' as const, question: 'A 对应什么？', answer: 'B' }],
};

describe('AI 结构校验', () => {
  it('接受“广陵=扬州”的双向题', () => {
    const value = normalizedCardSchema.parse({
      ...baseCard,
      normalized_statement: '广陵=扬州',
      question_type: 'bidirectional',
      analysis: '广陵=扬州',
      quiz_items: [
        { direction: 'forward', question: '广陵=？', answer: '扬州' },
        { direction: 'reverse', question: '扬州=？', answer: '广陵' },
      ],
    });

    expect(value.quiz_items.map((item) => item.direction)).toEqual(['forward', 'reverse']);
  });

  it('接受“广陵，扬州”的 unstructured 结果', () => {
    const value = normalizedCardSchema.parse({
      ...baseCard,
      normalized_statement: '广陵，扬州',
      question_type: 'unstructured',
      analysis: '广陵，扬州',
      tags: [],
      quiz_items: [],
    });

    expect(value.question_type).toBe('unstructured');
  });

  it('题型明确时为缺少 direction 的题面补齐方向', () => {
    const single = normalizedCardSchema.parse({
      ...baseCard,
      quiz_items: [{ question: 'A 对应什么？', answer: 'B' }],
    });
    const bidirectional = normalizedCardSchema.parse({
      ...baseCard,
      question_type: 'bidirectional',
      quiz_items: [
        { question: 'A 对应什么？', answer: 'B' },
        { question: 'B 对应什么？', answer: 'A' },
      ],
    });

    expect(single.quiz_items.map((item) => item.direction)).toEqual(['single']);
    expect(bidirectional.quiz_items.map((item) => item.direction)).toEqual(['forward', 'reverse']);
  });

  it.each([
    {
      name: 'single 使用 forward',
      value: { ...baseCard, quiz_items: [{ direction: 'forward', question: 'A？', answer: 'B' }] },
    },
    {
      name: 'bidirectional 只有 forward',
      value: {
        ...baseCard,
        question_type: 'bidirectional',
        quiz_items: [{ direction: 'forward', question: 'A？', answer: 'B' }],
      },
    },
    {
      name: 'bidirectional 混入 single',
      value: {
        ...baseCard,
        question_type: 'bidirectional',
        quiz_items: [
          { direction: 'forward', question: 'A？', answer: 'B' },
          { direction: 'single', question: 'B？', answer: 'A' },
        ],
      },
    },
  ])('拒绝错误方向或数量：$name', ({ value }) => {
    expect(() => normalizedCardSchema.parse(value)).toThrow();
  });

  it('单向多问题会保留多个题面供后续拆成多张卡片', () => {
    const value = normalizedCardSchema.parse({
      ...baseCard,
      quiz_items: [
        { direction: 'single', question: '5% 对应多少？', answer: '1.215' },
        { direction: 'single', question: '10% 对应多少？', answer: '1.46' },
        { direction: 'single', question: '15% 对应多少？', answer: '1.75' },
      ],
    });

    expect(value.quiz_items).toEqual([
      { direction: 'single', question: '5% 对应多少？', answer: '1.215' },
      { direction: 'single', question: '10% 对应多少？', answer: '1.46' },
      { direction: 'single', question: '15% 对应多少？', answer: '1.75' },
    ]);
  });

  it('题面直接包含答案时会替换为空位', () => {
    const value = normalizedCardSchema.parse({
      ...baseCard,
      quiz_items: [
        { direction: 'single', question: '2025 年增长率为 -3.2% 吗？', answer: '-3.2%' },
      ],
    });

    expect(value.quiz_items[0]?.question).toBe('2025 年增长率为 ____ 吗？');
    expect(value.quiz_items[0]?.question).not.toContain('-3.2%');
  });

  it('题面泄露公式或别称答案时也会替换为空位', () => {
    const formula = normalizedCardSchema.parse({
      ...baseCard,
      quiz_items: [
        { direction: 'single', question: '基期=现期/(1+r) 是哪个公式？', answer: '现期/(1+r)' },
      ],
    });
    const alias = normalizedCardSchema.parse({
      ...baseCard,
      quiz_items: [
        { direction: 'single', question: '广州的别称是穗吗？', answer: '穗' },
      ],
    });

    expect(formula.quiz_items[0]?.question).toBe('基期=____ 是哪个公式？');
    expect(alias.quiz_items[0]?.question).toBe('广州的别称是____吗？');
  });

  it('unstructured 多余题面会裁剪为空数组', () => {
    const value = normalizedCardSchema.parse({
      ...baseCard,
      question_type: 'unstructured',
    });

    expect(value.quiz_items).toEqual([]);
  });

  it.each([
    { field: 'question' as const, length: 10_000, accepted: true },
    { field: 'question' as const, length: 10_001, accepted: false },
    { field: 'answer' as const, length: 10_000, accepted: true },
    { field: 'answer' as const, length: 10_001, accepted: false },
  ])('$field 为 $length 字时按上限校验', ({ field, length, accepted }) => {
    const parse = () =>
      normalizedCardSchema.parse({
        ...baseCard,
        quiz_items: [
          { ...baseCard.quiz_items[0], [field]: (field === 'question' ? '题' : '答').repeat(length) },
        ],
      });

    if (accepted) {
      expect(parse().quiz_items[0]?.[field]).toHaveLength(length);
    } else {
      expect(parse).toThrow();
    }
  });

  it.each(['normalized_statement', 'wrong_point', 'analysis', 'mnemonic', 'extension', 'notes'] as const)(
    '拒绝超过 20000 字的规范字段：%s',
    (field) => {
      expect(() => normalizedCardSchema.parse({ ...baseCard, [field]: '字'.repeat(20_001) })).toThrow();
    },
  );

  it('拒绝超过 40 字或总数超过 12 的标签', () => {
    expect(() => normalizedCardSchema.parse({ ...baseCard, tags: ['标'.repeat(41)] })).toThrow();
    expect(() =>
      normalizedCardSchema.parse({
        ...baseCard,
        tags: Array.from({ length: 13 }, (_, index) => `标签${index}`),
      }),
    ).toThrow();
  });

  it.each([
    { field: 'normalized_statement', value: '   ' },
    { field: 'analysis', value: '   ' },
  ])('拒绝 trim 后为空的必填规范字段：$field', ({ field, value }) => {
    expect(() => normalizedCardSchema.parse({ ...baseCard, [field]: value })).toThrow();
  });

  it('拒绝 trim 后为空的题面、答案和标签', () => {
    expect(() =>
      normalizedCardSchema.parse({
        ...baseCard,
        quiz_items: [{ direction: 'single', question: '   ', answer: 'B' }],
      }),
    ).toThrow();
    expect(() =>
      normalizedCardSchema.parse({
        ...baseCard,
        quiz_items: [{ direction: 'single', question: 'A？', answer: '   ' }],
      }),
    ).toThrow();
    expect(() => normalizedCardSchema.parse({ ...baseCard, tags: ['   '] })).toThrow();
  });
});
