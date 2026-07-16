import { z } from 'zod';

const quizItemSchema = z.object({
  direction: z.enum(['single', 'forward', 'reverse']),
  question: z.string().trim().min(1).max(10_000),
  answer: z.string().trim().min(1).max(10_000),
});

export const normalizedCardSchema = z
  .object({
    normalized_statement: z.string().trim().min(1).max(20_000),
    question_type: z.enum(['single', 'bidirectional', 'unstructured']),
    wrong_point: z.string().max(20_000),
    analysis: z.string().trim().min(1).max(20_000),
    mnemonic: z.string().max(20_000),
    extension: z.string().max(20_000),
    notes: z.string().max(20_000),
    tags: z.array(z.string().trim().min(1).max(40)).max(12),
    quiz_items: z.array(quizItemSchema).max(2),
  })
  .superRefine((value, context) => {
    if (
      value.question_type === 'single' &&
      (value.quiz_items.length !== 1 || value.quiz_items[0]?.direction !== 'single')
    ) {
      context.addIssue({
        code: 'custom',
        path: ['quiz_items'],
        message: '单向题必须恰好包含一个 single 题面',
      });
    }

    if (value.question_type === 'bidirectional') {
      const directions = new Set(value.quiz_items.map((item) => item.direction));
      if (
        value.quiz_items.length !== 2 ||
        !directions.has('forward') ||
        !directions.has('reverse')
      ) {
        context.addIssue({
          code: 'custom',
          path: ['quiz_items'],
          message: '双向题必须恰好包含 forward 和 reverse',
        });
      }
    }

    if (value.question_type === 'unstructured' && value.quiz_items.length !== 0) {
      context.addIssue({
        code: 'custom',
        path: ['quiz_items'],
        message: '待完善内容不得生成题面',
      });
    }
  });
