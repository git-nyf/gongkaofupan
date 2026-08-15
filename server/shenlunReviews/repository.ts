import { randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';
import type {
  ShenlunAnnotation,
  ShenlunMark,
  ShenlunReview,
  ShenlunReviewStateUpdate,
  ShenlunReviewWriteInput,
  ShenlunTemplate,
} from './contracts';

export interface DatabaseProvider {
  get(): Database.Database;
}

interface ShenlunReviewRow {
  id: string;
  title: string;
  template: ShenlunTemplate;
  text: string;
  marks_json: string;
  notes: string;
  standard_answer: string;
  annotations_json: string;
  pinned: number;
  archived: number;
  created_at: string;
  updated_at: string;
}

export class ShenlunReviewRepository {
  constructor(private readonly database: DatabaseProvider) {}

  list(archived: boolean): ShenlunReview[] {
    const rows = this.database
      .get()
      .prepare(`
        SELECT
          id, title, template, text, marks_json, notes, standard_answer,
          annotations_json, pinned, archived, created_at, updated_at
        FROM shenlun_reviews
        WHERE archived = ?
        ORDER BY pinned DESC, updated_at DESC, id
      `)
      .all(archived ? 1 : 0) as ShenlunReviewRow[];
    return rows.map(toReview);
  }

  get(id: string): ShenlunReview | null {
    const row = this.database
      .get()
      .prepare(`
        SELECT
          id, title, template, text, marks_json, notes, standard_answer,
          annotations_json, pinned, archived, created_at, updated_at
        FROM shenlun_reviews
        WHERE id = ?
      `)
      .get(id) as ShenlunReviewRow | undefined;
    return row ? toReview(row) : null;
  }

  create(input: ShenlunReviewWriteInput, timestamp: string): string {
    const id = randomUUID();
    this.database
      .get()
      .prepare(`
        INSERT INTO shenlun_reviews (
          id, title, template, text, marks_json, notes, standard_answer,
          annotations_json, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        id,
        input.title,
        input.template,
        input.text,
        JSON.stringify(input.marks),
        input.notes,
        input.standardAnswer,
        JSON.stringify(input.annotations),
        timestamp,
        timestamp,
      );
    return id;
  }

  update(id: string, input: ShenlunReviewWriteInput, timestamp: string): boolean {
    const result = this.database
      .get()
      .prepare(`
        UPDATE shenlun_reviews
        SET
          title = ?, template = ?, text = ?, marks_json = ?, notes = ?,
          standard_answer = ?, annotations_json = ?, updated_at = ?
        WHERE id = ?
      `)
      .run(
        input.title,
        input.template,
        input.text,
        JSON.stringify(input.marks),
        input.notes,
        input.standardAnswer,
        JSON.stringify(input.annotations),
        timestamp,
        id,
      );
    return result.changes > 0;
  }

  updateState(id: string, state: ShenlunReviewStateUpdate, timestamp: string): boolean {
    const result = this.database
      .get()
      .prepare(`
        UPDATE shenlun_reviews
        SET
          pinned = COALESCE(?, pinned),
          archived = COALESCE(?, archived),
          updated_at = ?
        WHERE id = ?
      `)
      .run(
        state.pinned === undefined ? null : Number(state.pinned),
        state.archived === undefined ? null : Number(state.archived),
        timestamp,
        id,
      );
    return result.changes > 0;
  }
}

function toReview(row: ShenlunReviewRow): ShenlunReview {
  return {
    id: row.id,
    title: row.title,
    template: row.template,
    text: row.text,
    marks: JSON.parse(row.marks_json) as ShenlunMark[],
    notes: row.notes,
    standardAnswer: row.standard_answer,
    annotations: JSON.parse(row.annotations_json) as ShenlunAnnotation[],
    pinned: row.pinned === 1,
    archived: row.archived === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
