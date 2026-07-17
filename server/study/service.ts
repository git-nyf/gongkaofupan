import { randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';
import type {
  Mastery,
  QuizItemSchedulingState,
  ReviewInput,
  ReviewResult,
  StudyItem,
  StudySessionInput,
  StudySessionResult,
} from '../../shared/contracts';
import { masteryRank, scheduleNext } from './scheduler';

interface DatabaseProvider {
  get(): Database.Database;
}

interface StudyServiceDependencies {
  database: DatabaseProvider;
  now?: () => Date;
  random?: () => number;
}

interface CandidateRow {
  quiz_item_id: string;
  card_id: string;
  question: string;
  answer: string;
  due_at: string;
  normalized_statement: string;
  analysis: string;
  mnemonic: string;
  extension: string;
  notes: string;
  rating: number;
  mastery: Mastery;
  archived: number;
}

interface ReviewRow {
  id: string;
  card_id: string;
  due_at: string;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  learning_steps: number;
  reps: number;
  lapses: number;
  state: number;
  last_review_at: string | null;
}

export interface StudyService {
  createSession(input: StudySessionInput): StudySessionResult;
  review(input: ReviewInput): ReviewResult;
}

export class StudyServiceError extends Error {
  constructor(readonly code: 'not_found') {
    super(code);
    this.name = 'StudyServiceError';
  }
}

export function createStudyService({
  database,
  now = () => new Date(),
  random = Math.random,
}: StudyServiceDependencies): StudyService {
  return {
    createSession(input) {
      const candidates = findCandidates(database.get(), input);
      const selected = selectCandidates(candidates, input, now().toISOString(), random);
      return { items: toStudyItems(database.get(), selected) };
    },

    review(input) {
      const reviewedAt = now();
      const reviewedAtIso = reviewedAt.toISOString();
      const connection = database.get();

      return connection.transaction(() => {
        const item = connection
          .prepare(`
            SELECT
              id, card_id, due_at, stability, difficulty, elapsed_days,
              scheduled_days, learning_steps, reps, lapses, state, last_review_at
            FROM quiz_items
            WHERE id = ?
          `)
          .get(input.quizItemId) as ReviewRow | undefined;
        if (!item) throw new StudyServiceError('not_found');

        const schedulingState: QuizItemSchedulingState = {
          dueAt: item.due_at,
          stability: item.stability,
          difficulty: item.difficulty,
          elapsedDays: item.elapsed_days,
          scheduledDays: item.scheduled_days,
          learningSteps: item.learning_steps,
          reps: item.reps,
          lapses: item.lapses,
          state: item.state,
          lastReviewAt: item.last_review_at,
        };
        const scheduled = scheduleNext(schedulingState, input.rating, reviewedAt);
        const nextDueAt = scheduled.card.due.toISOString();

        connection
          .prepare(`
            UPDATE quiz_items SET
              due_at = ?,
              stability = ?,
              difficulty = ?,
              elapsed_days = ?,
              scheduled_days = ?,
              learning_steps = ?,
              reps = ?,
              lapses = ?,
              state = ?,
              last_review_at = ?,
              mastery = ?
            WHERE id = ?
          `)
          .run(
            nextDueAt,
            scheduled.card.stability,
            scheduled.card.difficulty,
            scheduled.card.elapsed_days,
            scheduled.card.scheduled_days,
            item.learning_steps,
            scheduled.card.reps,
            scheduled.card.lapses,
            scheduled.card.state,
            scheduled.card.last_review?.toISOString() ?? reviewedAtIso,
            input.rating,
            item.id,
          );

        connection
          .prepare(`
            INSERT INTO review_logs (
              id, quiz_item_id, card_id, rating,
              previous_due_at, next_due_at, reviewed_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
          `)
          .run(
            randomUUID(),
            item.id,
            item.card_id,
            input.rating,
            item.due_at,
            nextDueAt,
            reviewedAtIso,
          );

        if (input.rating === 'again') {
          connection
            .prepare('UPDATE cards SET wrong_count = wrong_count + 1 WHERE id = ?')
            .run(item.card_id);
        }

        const quizMasteries = connection
          .prepare('SELECT mastery FROM quiz_items WHERE card_id = ?')
          .all(item.card_id) as Array<{ mastery: Mastery }>;
        const cardMastery = quizMasteries.reduce(
          (weakest, current) =>
            masteryRank[current.mastery] < masteryRank[weakest] ? current.mastery : weakest,
          'good' as Mastery,
        );
        connection
          .prepare('UPDATE cards SET mastery = ?, updated_at = ? WHERE id = ?')
          .run(cardMastery, reviewedAtIso, item.card_id);
        const card = connection
          .prepare('SELECT wrong_count FROM cards WHERE id = ?')
          .get(item.card_id) as { wrong_count: number };

        return {
          quizItemId: item.id,
          cardId: item.card_id,
          rating: input.rating,
          nextDueAt,
          quizMastery: input.rating,
          cardMastery,
          wrongCount: card.wrong_count,
        };
      })();
    },
  };
}

function findCandidates(database: Database.Database, input: StudySessionInput): CandidateRow[] {
  const filters = ["cards.archived = 0", "cards.ai_status = 'ready'"];
  const parameters: unknown[] = [];
  addRelationFilter(filters, parameters, 'card_categories', 'category_id', input.categoryIds);
  addDirectFilter(filters, parameters, 'cards.id', input.cardIds);
  addRelationFilter(filters, parameters, 'card_tags', 'tag_id', input.tagIds);
  if (input.rating !== undefined) {
    filters.push('cards.rating = ?');
    parameters.push(input.rating);
  }
  if (input.mastery !== undefined) {
    filters.push('cards.mastery = ?');
    parameters.push(input.mastery);
  }
  if (input.createdFrom !== undefined) {
    filters.push('cards.created_at >= ?');
    parameters.push(input.createdFrom);
  }
  if (input.createdTo !== undefined) {
    filters.push('cards.created_at <= ?');
    parameters.push(input.createdTo);
  }

  return database
    .prepare(`
      SELECT
        quiz_items.id AS quiz_item_id,
        cards.id AS card_id,
        quiz_items.question,
        quiz_items.answer,
        quiz_items.due_at,
        cards.normalized_statement,
        cards.analysis,
        cards.mnemonic,
        cards.extension,
        cards.notes,
        cards.rating,
        cards.mastery,
        cards.archived
      FROM cards
      INNER JOIN quiz_items ON quiz_items.card_id = cards.id
      WHERE ${filters.join(' AND ')}
      ORDER BY cards.created_at ASC, quiz_items.created_at ASC, quiz_items.id ASC
    `)
    .all(...parameters) as CandidateRow[];
}

function addDirectFilter(
  filters: string[],
  parameters: unknown[],
  column: string,
  values: string[],
) {
  if (values.length === 0) return;
  filters.push(`${column} IN (${values.map(() => '?').join(', ')})`);
  parameters.push(...values);
}

function addRelationFilter(
  filters: string[],
  parameters: unknown[],
  table: 'card_categories' | 'card_tags',
  column: 'category_id' | 'tag_id',
  values: string[],
) {
  if (values.length === 0) return;
  filters.push(`
    EXISTS (
      SELECT 1 FROM ${table}
      WHERE ${table}.card_id = cards.id
        AND ${table}.${column} IN (${values.map(() => '?').join(', ')})
    )
  `);
  parameters.push(...values);
}

function selectCandidates(
  candidates: CandidateRow[],
  input: StudySessionInput,
  nowIso: string,
  random: () => number,
): CandidateRow[] {
  if (!input.dueFirst) {
    const ordered = input.order === 'random' ? shuffle(candidates, random) : candidates;
    return ordered.slice(0, input.count);
  }

  const due = candidates.filter((item) => item.due_at <= nowIso).slice(0, input.count);
  if (due.length === input.count) return due;
  const nonDue = candidates.filter((item) => item.due_at > nowIso);
  const fill = input.order === 'random' ? shuffle(nonDue, random) : nonDue;
  return [...due, ...fill.slice(0, input.count - due.length)];
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[target]] = [shuffled[target], shuffled[index]];
  }
  return shuffled;
}

function toStudyItems(database: Database.Database, rows: CandidateRow[]): StudyItem[] {
  const metadata = new Map<
    string,
    Pick<StudyItem, 'categories' | 'tags'>
  >();

  return rows.map((row) => {
    let cardMetadata = metadata.get(row.card_id);
    if (!cardMetadata) {
      const categories = database
        .prepare(`
          SELECT categories.id, categories.name, categories.parent_id
          FROM card_categories
          JOIN categories ON categories.id = card_categories.category_id
          WHERE card_categories.card_id = ?
          ORDER BY card_categories.rowid
        `)
        .all(row.card_id) as Array<{ id: string; name: string; parent_id: string | null }>;
      const tags = database
        .prepare(`
          SELECT tags.id, tags.name, card_tags.origin
          FROM card_tags
          JOIN tags ON tags.id = card_tags.tag_id
          WHERE card_tags.card_id = ?
          ORDER BY tags.name
        `)
        .all(row.card_id) as StudyItem['tags'];
      cardMetadata = {
        categories: categories.map(({ id, name, parent_id }) => ({
          id,
          name,
          parentId: parent_id,
        })),
        tags,
      };
      metadata.set(row.card_id, cardMetadata);
    }

    return {
      quizItemId: row.quiz_item_id,
      cardId: row.card_id,
      question: row.question,
      answer: row.answer,
      normalizedStatement: row.normalized_statement,
      analysis: row.analysis,
      mnemonic: row.mnemonic,
      extension: row.extension,
      notes: row.notes,
      rating: row.rating,
      mastery: row.mastery,
      archived: row.archived === 1,
      categories: cardMetadata.categories,
      tags: cardMetadata.tags,
    };
  });
}
