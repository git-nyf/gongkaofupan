import type Database from 'better-sqlite3';

export interface OriginalCardCategory {
  id: string;
  name: string;
  parentId: string | null;
}

export interface OriginalCardSource {
  id: string;
  rawInput: string;
  quizQuestion: string;
  categories: OriginalCardCategory[];
  createdAt: string;
}

export interface SelectRandomOriginalCardsOptions {
  limit?: number;
  random?: () => number;
  now?: () => Date;
}

export interface SelectOriginalCardsOptions extends SelectRandomOriginalCardsOptions {
  cardIds?: readonly string[];
  randomize?: boolean;
}

interface CardRow {
  id: string;
  raw_input: string;
  quiz_question: string;
  created_at: string;
  source_key: string;
}

interface CategoryRow {
  card_id: string;
  id: string;
  name: string;
  parent_id: string | null;
}

/**
 * 从卡片库抽取用于 Anki 转换的用户初始稿。
 * 同一份原始稿可能产生多个 AI 衍生卡片，因此只保留最新的一张代表卡片。
 */
export function selectRandomOriginalCards(
  database: Database.Database,
  options: SelectRandomOriginalCardsOptions = {},
): OriginalCardSource[] {
  return selectOriginalCards(database, {
    ...options,
    limit: options.limit ?? 10,
    randomize: true,
  });
}

/** 按时间倒序读取用于 Anki 转换的用户初始稿，可按卡片编号限定范围。 */
export function selectOriginalCards(
  database: Database.Database,
  options: SelectOriginalCardsOptions = {},
): OriginalCardSource[] {
  const limit = normalizeLimit(options.limit, Number.POSITIVE_INFINITY);
  if (limit === 0) return [];

  const now = options.now ?? (() => new Date());
  const random = options.random ?? Math.random;
  const cardIds = [...new Set(options.cardIds ?? [])];
  const cardIdFilter = cardIds.length > 0
    ? `AND cards.id IN (${cardIds.map(() => '?').join(', ')})`
    : '';
  const cardRows = database
    .prepare(`
      SELECT
        cards.id,
        cards.raw_input,
        (
          SELECT quiz_items.question
          FROM quiz_items
          WHERE quiz_items.card_id = cards.id
          ORDER BY quiz_items.rowid
          LIMIT 1
        ) AS quiz_question,
        cards.created_at,
        CASE
          WHEN TRIM(COALESCE(cards.raw_content_json, '')) <> ''
            AND json_valid(cards.raw_content_json)
          THEN CASE
            WHEN json_type(cards.raw_content_json) IN ('object', 'array')
            THEN 'json:' || json(cards.raw_content_json)
            WHEN TRIM(cards.raw_input) <> '' THEN 'text:' || TRIM(cards.raw_input)
            ELSE 'card:' || cards.id
          END
          WHEN TRIM(cards.raw_input) <> '' THEN 'text:' || TRIM(cards.raw_input)
          ELSE 'card:' || cards.id
        END AS source_key
      FROM cards
      WHERE cards.archived = 0
        AND cards.ai_status = 'ready'
        AND TRIM(cards.raw_input) <> ''
        AND EXISTS (
          SELECT 1
          FROM quiz_items
          WHERE quiz_items.card_id = cards.id
            AND TRIM(quiz_items.question) <> ''
        )
        AND cards.created_at <= ?
        ${cardIdFilter}
      ORDER BY cards.created_at DESC, cards.id DESC
    `)
    .all(now().toISOString(), ...cardIds) as CardRow[];

  const uniqueCards = new Map<string, OriginalCardSource>();
  for (const row of cardRows) {
    if (!uniqueCards.has(row.source_key)) {
      uniqueCards.set(row.source_key, {
        id: row.id,
        rawInput: row.raw_input,
        quizQuestion: row.quiz_question,
        categories: [],
        createdAt: row.created_at,
      });
    }
  }

  const sources = [...uniqueCards.values()];
  if (sources.length === 0) return [];

  const categoryRows = database
    .prepare(`
      SELECT
        card_categories.card_id,
        categories.id,
        categories.name,
        categories.parent_id
      FROM card_categories
      JOIN categories ON categories.id = card_categories.category_id
      WHERE card_categories.card_id IN (${sources.map(() => '?').join(', ')})
      ORDER BY card_categories.rowid
    `)
    .all(...sources.map((source) => source.id)) as CategoryRow[];
  const categoriesByCard = new Map<string, OriginalCardCategory[]>();
  for (const row of categoryRows) {
    const categories = categoriesByCard.get(row.card_id) ?? [];
    categories.push({ id: row.id, name: row.name, parentId: row.parent_id });
    categoriesByCard.set(row.card_id, categories);
  }
  for (const source of sources) {
    source.categories = categoriesByCard.get(source.id) ?? [];
  }

  if (options.randomize) shuffle(sources, random);
  return sources.slice(0, limit);
}

function normalizeLimit(value: number | undefined, defaultValue = 10): number {
  if (value === undefined) return defaultValue;
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.floor(value);
}

function shuffle<T>(items: T[], random: () => number): void {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const sample = random();
    const normalized = Number.isFinite(sample) ? Math.min(Math.max(sample, 0), 0.9999999999999999) : 0;
    const swapIndex = Math.floor(normalized * (index + 1));
    [items[index], items[swapIndex]] = [items[swapIndex], items[index]];
  }
}
