import { z } from 'zod';

const quizItemSchema = z.object({
  direction: z.enum(['single', 'forward', 'reverse']),
  question: z.string().trim().min(1).max(10_000),
  answer: z.string().trim().min(1).max(10_000),
});

export const normalizedCardSchema = z.preprocess(
  inferQuizDirections,
  z.object({
    normalized_statement: z.string().trim().min(1).max(20_000),
    question_type: z.enum(['single', 'bidirectional', 'unstructured']),
    wrong_point: z.string().max(20_000).default(''),
    analysis: z.string().trim().min(1).max(20_000),
    mnemonic: z.string().max(20_000).default(''),
    extension: z.string().max(20_000).default(''),
    notes: z.string().max(20_000).default(''),
    tags: z.array(z.string().trim().min(1).max(40)).max(12).default([]),
    quiz_items: z.array(quizItemSchema).max(12),
  })
  .superRefine((value, context) => {
    if (
      value.question_type === 'single' &&
      (value.quiz_items.length < 1 || value.quiz_items.some((item) => item.direction !== 'single'))
    ) {
      context.addIssue({
        code: 'custom',
        path: ['quiz_items'],
        message: '单向题必须至少包含一个 single 题面且方向只能为 single',
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
  }),
);

function inferQuizDirections(value: unknown) {
  if (typeof value !== 'object' || value === null) return value;
  const record = value as Record<string, unknown>;
  if (!Array.isArray(record.quiz_items)) return value;

  const questionType = record.question_type;
  const limit = questionType === 'unstructured' ? 0 : questionType === 'bidirectional' ? 2 : 12;
  const quizItems = record.quiz_items.slice(0, limit).map((item, index) => {
    if (typeof item !== 'object' || item === null) return item;
    const next = { ...(item as Record<string, unknown>) };
    if (Reflect.get(next, 'direction') === undefined && questionType === 'single') {
      next.direction = 'single';
    }
    if (questionType === 'bidirectional') {
      next.direction = Reflect.get(next, 'direction') ?? (index === 0 ? 'forward' : 'reverse');
    }
    next.question = hideAnswerInQuestion(next.question, next.answer);
    return next;
  });

  return { ...record, quiz_items: quizItems };
}

function hideAnswerInQuestion(question: unknown, answer: unknown) {
  if (typeof question !== 'string' || typeof answer !== 'string') return question;
  const trimmedAnswer = answer.trim();
  if (!trimmedAnswer) return question;

  const escaped = trimmedAnswer.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const hidden = question.replace(new RegExp(escaped, 'gi'), '____');
  return hidden === question ? question : hidden;
}
