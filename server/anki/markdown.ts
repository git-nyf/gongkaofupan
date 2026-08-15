export interface AnkiSourceCard {
  id: string;
  category?: string;
  categories?: readonly (string | { name: string })[];
  rawContent?: string;
  rawInput?: string;
  question?: string;
  reviewHint?: string;
  answer?: string;
}

export interface MarkdownReviewCard {
  stableId: string;
  category: string;
  rawContent: string;
  question: string;
  reviewHint: string;
  answer: string;
}

export interface MarkdownReviewDocument {
  markdown: string;
  cards: MarkdownReviewCard[];
}

const DEFAULT_REVIEW_HINT = '回忆原始内容的核心概念、关键条件和常见陷阱。';

/** 将用户初始稿整理为可追溯的中文 Markdown 中间文档。 */
export function createMarkdownReviewDocument(
  sourceCards: readonly AnkiSourceCard[],
): MarkdownReviewDocument {
  const cards = sourceCards.map((source) => normalizeSourceCard(source));
  const sections = cards.map((card, index) => [
    `## ${index + 1}. ${card.category}`,
    `- 稳定编号：\`${escapeInlineCode(card.stableId)}\``,
    `- 分类：${card.category}`,
    '',
    '### 原始内容',
    card.rawContent,
    '',
    '### 复习问题',
    card.question,
    '',
    '### 复习提示：',
    card.reviewHint,
    '',
    '### 答案：',
    card.answer,
  ].join('\n'));

  const markdown = [
    '# 公考记忆卡复习卡',
    '',
    `> 本次共 ${cards.length} 张，内容来源于用户初始稿。`,
    '',
    ...sections,
    '',
  ].join('\n');

  return { markdown, cards };
}

export function renderReviewCardsMarkdown(sourceCards: readonly AnkiSourceCard[]): string {
  return createMarkdownReviewDocument(sourceCards).markdown;
}

function normalizeSourceCard(source: AnkiSourceCard): MarkdownReviewCard {
  const stableId = source.id.trim();
  if (!stableId) throw new Error('Anki 卡片缺少稳定编号');

  const sourceContent = source.rawContent ?? source.rawInput ?? '';
  const rawContent = sourceContent.trim();
  if (!rawContent) throw new Error(`Anki 卡片 ${stableId} 缺少原始内容`);

  const categories = (source.categories ?? [])
    .map((category) => typeof category === 'string' ? category : category.name)
    .map((category) => category.trim())
    .filter(Boolean);
  const category = source.category?.trim() || categories.join(' / ') || '未分类';
  const reviewHint = source.reviewHint?.trim() || DEFAULT_REVIEW_HINT;
  const answer = source.answer?.trim() || rawContent;
  const question = source.question?.trim() || `请完整回忆：${firstMeaningfulLine(rawContent)}`;

  return { stableId, category, rawContent, question, reviewHint, answer };
}

function firstMeaningfulLine(value: string) {
  const line = value.split(/\r?\n/).map((item) => item.trim()).find(Boolean) ?? value;
  return line.length > 80 ? `${line.slice(0, 80)}…` : line;
}

function escapeInlineCode(value: string) {
  return value.replace(/`/g, "'");
}
