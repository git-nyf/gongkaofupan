import type { createDatabaseManager } from '../db/database';

type DatabaseManager = Pick<ReturnType<typeof createDatabaseManager>, 'get'>;

interface AnalyticsServiceDependencies {
  database: DatabaseManager;
  now?: () => Date;
}

export interface WeaknessItem {
  categoryId: string;
  categoryName: string;
  score: number;
  cardCount: number;
}

export interface FrequentMistakeItem {
  cardId: string;
  title: string;
  wrongCount: number;
  lastWrongAt: string;
}

interface CountRow {
  count: number;
}

interface WeaknessRow {
  category_id: string;
  category_name: string;
  score: number;
  card_count: number;
}

interface FrequentMistakeRow {
  card_id: string;
  title: string;
  wrong_count: number;
  last_wrong_at: string;
}

export function createAnalyticsService({
  database,
  now = () => new Date(),
}: AnalyticsServiceDependencies) {
  function weakness(): WeaknessItem[] {
    const rows = database
      .get()
      .prepare(`
        SELECT
          category.id AS category_id,
          category.name AS category_name,
          SUM(CASE review.rating WHEN 'again' THEN 2 WHEN 'hard' THEN 1 ELSE 0 END) AS score,
          COUNT(DISTINCT review.card_id) AS card_count
        FROM review_logs review
        INNER JOIN cards card ON card.id = review.card_id
        INNER JOIN card_categories relation ON relation.card_id = review.card_id
        INNER JOIN categories category ON category.id = relation.category_id
        WHERE card.archived = 0
          AND category.parent_id IS NULL
          AND review.rating IN ('again', 'hard')
        GROUP BY category.id, category.name
        ORDER BY score DESC, category.name ASC, category.id ASC
      `)
      .all() as WeaknessRow[];

    return rows.map((row) => ({
      categoryId: row.category_id,
      categoryName: row.category_name,
      score: row.score,
      cardCount: row.card_count,
    }));
  }

  function dashboard() {
    const current = now();
    const start = new Date(current);
    start.setHours(0, 0, 0, 0);
    const next = new Date(start);
    next.setDate(next.getDate() + 1);
    const startIso = start.toISOString();
    const nextIso = next.toISOString();
    const connection = database.get();

    const dueToday = connection
      .prepare(`
        SELECT COUNT(DISTINCT card.id) AS count
        FROM cards card
        INNER JOIN quiz_items quiz ON quiz.card_id = card.id
        WHERE card.archived = 0
          AND card.ai_status = 'ready'
          AND quiz.due_at < ?
      `)
      .get(nextIso) as CountRow;
    const addedToday = connection
      .prepare('SELECT COUNT(*) AS count FROM cards WHERE created_at >= ? AND created_at < ?')
      .get(startIso, nextIso) as CountRow;
    const conquestPending = connection
      .prepare(`
        SELECT COUNT(*) AS count
        FROM cards
        WHERE archived = 0
          AND ai_status = 'ready'
          AND mastery IN ('again', 'hard')
      `)
      .get() as CountRow;

    return {
      dueToday: dueToday.count,
      addedToday: addedToday.count,
      conquestPending: conquestPending.count,
      weakness: weakness(),
    };
  }

  function reviewSummary() {
    const rows = database
      .get()
      .prepare(`
        SELECT
          card.id AS card_id,
          CASE
            WHEN TRIM(card.normalized_statement) <> '' THEN card.normalized_statement
            ELSE card.raw_input
          END AS title,
          COUNT(*) AS wrong_count,
          MAX(review.reviewed_at) AS last_wrong_at
        FROM review_logs review
        INNER JOIN cards card ON card.id = review.card_id
        WHERE card.archived = 0 AND review.rating = 'again'
        GROUP BY card.id, card.normalized_statement, card.raw_input
        ORDER BY wrong_count DESC, last_wrong_at DESC, card.id ASC
      `)
      .all() as FrequentMistakeRow[];

    return {
      weakness: weakness(),
      frequentMistakes: rows.map((row) => ({
        cardId: row.card_id,
        title: row.title,
        wrongCount: row.wrong_count,
        lastWrongAt: row.last_wrong_at,
      })),
    };
  }

  return { dashboard, reviewSummary };
}

export type AnalyticsService = ReturnType<typeof createAnalyticsService>;
