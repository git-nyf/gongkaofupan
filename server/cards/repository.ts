import { randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';
import type {
  AttachmentInput,
  BulkCardUpdateInput,
  CardDetail,
  CardSearchInput,
  CardUpdateInput,
  CreateCardInput,
  Mastery,
  NormalizeCardInput,
  NormalizedCard,
} from '../../shared/contracts';

export type CardRepositoryErrorCode = 'invalid_categories' | 'invalid_state' | 'not_found';

export class CardRepositoryError extends Error {
  constructor(readonly code: CardRepositoryErrorCode) {
    super(code);
    this.name = 'CardRepositoryError';
  }
}

export interface DatabaseProvider {
  get(): Database.Database;
}

interface CardRow {
  id: string;
  entry_mode: CardDetail['entryMode'];
  raw_input: string;
  raw_content_json: string | null;
  template: string;
  normalized_statement: string;
  wrong_point: string;
  analysis: string;
  mnemonic: string;
  extension: string;
  notes: string;
  ai_status: CardDetail['aiStatus'];
  source_type: string;
  source_detail: string;
  rating: number;
  mastery: CardDetail['mastery'];
  wrong_count: number;
  archived: number;
  created_at: string;
  updated_at: string;
}

export interface RetryWork {
  normalizeInput: NormalizeCardInput;
  mastery: Mastery;
}

export interface CardUpdateResult {
  shouldRetryAi: boolean;
}

export class CardRepository {
  constructor(private readonly database: DatabaseProvider) {}

  insertRawCardInTransaction(input: CreateCardInput, timestamp: string) {
    const database = this.database.get();
    return database.transaction(() => {
      this.assertCategories(database, input.categoryIds);
      const cardId = randomUUID();
      database
        .prepare(`
          INSERT INTO cards (
            id, entry_mode, raw_input, raw_content_json, template,
            wrong_point, analysis, mnemonic, extension, notes,
            source_type, source_detail, rating, mastery,
            ai_status, ai_attempt_count, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'processing', 1, ?, ?)
        `)
        .run(
          cardId,
          input.entryMode,
          input.rawInput,
          input.rawContentJson,
          input.template,
          input.wrongPoint,
          input.analysis,
          input.mnemonic,
          input.extension,
          input.notes,
          input.sourceType,
          input.sourceDetail,
          input.rating,
          input.initialMastery,
          timestamp,
          timestamp,
        );

      const insertCategory = database.prepare(
        'INSERT INTO card_categories (card_id, category_id) VALUES (?, ?)',
      );
      for (const categoryId of input.categoryIds) {
        insertCategory.run(cardId, categoryId);
      }

      for (const tagName of input.userTags) {
        this.insertTag(database, cardId, tagName, 'user');
      }

      const insertAttachment = database.prepare(`
        INSERT INTO attachments (
          id, card_id, stored_name, original_name, mime_type, byte_size, sort_order, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      input.attachments.forEach((attachment, index) => {
        insertAttachment.run(
          attachment.id,
          cardId,
          attachment.storedName,
          attachment.originalName,
          attachment.mimeType,
          attachment.byteSize,
          index,
          timestamp,
        );
      });

      return cardId;
    })();
  }

  completeInTransaction(
    cardId: string,
    normalized: NormalizedCard,
    status: 'ready' | 'needs_input',
    mastery: Mastery,
    timestamp: string,
  ) {
    const database = this.database.get();
    database.transaction(() => {
      database
        .prepare(`
          UPDATE cards SET
            normalized_statement = ?,
            wrong_point = CASE WHEN ? <> '' THEN ? ELSE wrong_point END,
            analysis = CASE WHEN ? <> '' THEN ? ELSE analysis END,
            mnemonic = CASE WHEN ? <> '' THEN ? ELSE mnemonic END,
            extension = CASE WHEN ? <> '' THEN ? ELSE extension END,
            notes = CASE WHEN ? <> '' THEN ? ELSE notes END,
            ai_status = ?,
            ai_error_code = '',
            updated_at = ?
          WHERE id = ?
        `)
        .run(
          normalized.normalized_statement,
          normalized.wrong_point,
          normalized.wrong_point,
          normalized.analysis,
          normalized.analysis,
          normalized.mnemonic,
          normalized.mnemonic,
          normalized.extension,
          normalized.extension,
          normalized.notes,
          normalized.notes,
          status,
          timestamp,
          cardId,
        );

      database.prepare("DELETE FROM card_tags WHERE card_id = ? AND origin = 'ai'").run(cardId);
      for (const tagName of normalizeNames(normalized.tags)) {
        this.insertTag(database, cardId, tagName, 'ai');
      }

      database.prepare('DELETE FROM quiz_items WHERE card_id = ?').run(cardId);
      if (status === 'ready') {
        const insertQuizItem = database.prepare(`
          INSERT INTO quiz_items (
            id, card_id, direction, question, answer, mastery, due_at, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        for (const item of normalized.quiz_items) {
          insertQuizItem.run(
            randomUUID(),
            cardId,
            item.direction,
            item.question,
            item.answer,
            mastery,
            timestamp,
            timestamp,
          );
        }
      }
    })();
  }

  markPendingInCompensationTransaction(cardId: string, errorCode: string, timestamp: string) {
    this.database
      .get()
      .transaction(() => {
        this.database
          .get()
          .prepare(`
            UPDATE cards
            SET ai_status = 'pending', ai_error_code = ?, updated_at = ?
            WHERE id = ?
          `)
          .run(errorCode, timestamp, cardId);
      })();
  }

  beginRetryInTransaction(cardId: string, timestamp: string): RetryWork {
    const database = this.database.get();
    return database.transaction(() => {
      const card = database
        .prepare(`
          SELECT
            id, entry_mode, raw_input, template,
            wrong_point, analysis, mnemonic, extension, notes,
            mastery, ai_status
          FROM cards
          WHERE id = ?
        `)
        .get(cardId) as
        | {
            id: string;
            entry_mode: NormalizeCardInput['entry_mode'];
            raw_input: string;
            template: string;
            wrong_point: string;
            analysis: string;
            mnemonic: string;
            extension: string;
            notes: string;
            mastery: Mastery;
            ai_status: string;
          }
        | undefined;

      if (!card) throw new CardRepositoryError('not_found');
      if (card.ai_status !== 'pending' && card.ai_status !== 'needs_input') {
        throw new CardRepositoryError('invalid_state');
      }

      database
        .prepare(`
          UPDATE cards
          SET ai_status = 'processing', ai_attempt_count = ai_attempt_count + 1,
              ai_error_code = '', updated_at = ?
          WHERE id = ?
        `)
        .run(timestamp, cardId);

      const categories = database
        .prepare(`
          SELECT category_id
          FROM card_categories
          WHERE card_id = ?
          ORDER BY rowid
        `)
        .all(cardId) as Array<{ category_id: string }>;

      return {
        normalizeInput: {
          entry_mode: card.entry_mode,
          raw_input: card.raw_input,
          selected_categories: categories.map(({ category_id }) => category_id),
          template: card.template,
          existing_fields: {
            wrong_point: card.wrong_point,
            analysis: card.analysis,
            mnemonic: card.mnemonic,
            extension: card.extension,
            notes: card.notes,
          },
        },
        mastery: card.mastery,
      };
    })();
  }

  recoverStaleProcessing(now: Date) {
    const threshold = new Date(now.getTime() - 5 * 60 * 1000).toISOString();
    return this.database
      .get()
      .prepare(`
        UPDATE cards
        SET ai_status = 'pending', ai_error_code = 'stale_processing', updated_at = ?
        WHERE ai_status = 'processing' AND updated_at <= ?
      `)
      .run(now.toISOString(), threshold).changes;
  }

  listPendingIds(limit: number) {
    return (
      this.database
        .get()
        .prepare(`
          SELECT id
          FROM cards
          WHERE ai_status = 'pending'
          ORDER BY created_at, id
          LIMIT ?
        `)
        .all(limit) as Array<{ id: string }>
    ).map(({ id }) => id);
  }

  search(input: CardSearchInput) {
    const filters = ['cards.archived = ?'];
    const parameters: unknown[] = [input.archived ? 1 : 0];

    if (input.query) {
      const textColumns = [
        'cards.raw_input',
        'cards.normalized_statement',
        'cards.analysis',
        'cards.mnemonic',
        'cards.extension',
        'cards.notes',
      ];
      const textFilters = textColumns.map(
        (column) => `instr(lower(COALESCE(${column}, '')), lower(?)) > 0`,
      );
      for (let index = 0; index < textColumns.length; index += 1) {
        parameters.push(input.query);
      }
      textFilters.push(`
        EXISTS (
          SELECT 1
          FROM card_tags search_card_tags
          JOIN tags search_tags ON search_tags.id = search_card_tags.tag_id
          WHERE search_card_tags.card_id = cards.id
            AND instr(lower(search_tags.name), lower(?)) > 0
        )
      `);
      parameters.push(input.query);
      filters.push(`(${textFilters.join(' OR ')})`);
    }

    if (input.categoryIds.length > 0) {
      const placeholders = input.categoryIds.map(() => '?').join(', ');
      filters.push(`
        EXISTS (
          SELECT 1
          FROM card_categories search_categories
          WHERE search_categories.card_id = cards.id
            AND search_categories.category_id IN (${placeholders})
        )
      `);
      parameters.push(...input.categoryIds);
    }
    if (input.tagIds.length > 0) {
      const placeholders = input.tagIds.map(() => '?').join(', ');
      filters.push(`
        EXISTS (
          SELECT 1
          FROM card_tags search_tags
          WHERE search_tags.card_id = cards.id
            AND search_tags.tag_id IN (${placeholders})
        )
      `);
      parameters.push(...input.tagIds);
    }
    if (input.rating !== undefined) {
      filters.push('cards.rating = ?');
      parameters.push(input.rating);
    }
    if (input.mastery !== undefined) {
      filters.push('cards.mastery = ?');
      parameters.push(input.mastery);
    }
    if (input.aiStatus !== undefined) {
      filters.push('cards.ai_status = ?');
      parameters.push(input.aiStatus);
    }
    if (input.createdFrom !== undefined) {
      filters.push('cards.created_at >= ?');
      parameters.push(input.createdFrom);
    }
    if (input.createdTo !== undefined) {
      filters.push('cards.created_at <= ?');
      parameters.push(input.createdTo);
    }

    const database = this.database.get();
    const where = filters.join(' AND ');
    const total = (
      database.prepare(`SELECT COUNT(*) AS total FROM cards WHERE ${where}`).get(...parameters) as {
        total: number;
      }
    ).total;
    const ids = (
      database
        .prepare(`
          SELECT cards.id
          FROM cards
          WHERE ${where}
          ORDER BY cards.created_at DESC, cards.id DESC
          LIMIT ? OFFSET ?
        `)
        .all(...parameters, input.pageSize, (input.page - 1) * input.pageSize) as Array<{ id: string }>
    ).map(({ id }) => id);

    return { ids, total };
  }

  updateInTransaction(
    cardId: string,
    input: CardUpdateInput,
    timestamp: string,
  ): CardUpdateResult {
    const database = this.database.get();
    return database.transaction(() => {
      const current = database
        .prepare('SELECT raw_input, ai_status FROM cards WHERE id = ?')
        .get(cardId) as { raw_input: string; ai_status: CardDetail['aiStatus'] } | undefined;
      if (!current) throw new CardRepositoryError('not_found');
      if (input.categoryIds !== undefined) this.assertCategories(database, input.categoryIds);

      const assignments: string[] = [];
      const parameters: unknown[] = [];
      const addAssignment = (column: string, value: unknown) => {
        assignments.push(`${column} = ?`);
        parameters.push(value);
      };
      if (input.rawInput !== undefined) addAssignment('raw_input', input.rawInput);
      if (input.rawContentJson !== undefined) addAssignment('raw_content_json', input.rawContentJson);
      if (input.normalizedStatement !== undefined) {
        addAssignment('normalized_statement', input.normalizedStatement);
      }
      if (input.wrongPoint !== undefined) addAssignment('wrong_point', input.wrongPoint);
      if (input.analysis !== undefined) addAssignment('analysis', input.analysis);
      if (input.mnemonic !== undefined) addAssignment('mnemonic', input.mnemonic);
      if (input.extension !== undefined) addAssignment('extension', input.extension);
      if (input.notes !== undefined) addAssignment('notes', input.notes);
      if (input.template !== undefined) addAssignment('template', input.template);
      if (input.sourceType !== undefined) addAssignment('source_type', input.sourceType);
      if (input.sourceDetail !== undefined) addAssignment('source_detail', input.sourceDetail);
      if (input.rating !== undefined) addAssignment('rating', input.rating);
      if (input.mastery !== undefined) addAssignment('mastery', input.mastery);
      if (input.archived !== undefined) addAssignment('archived', input.archived ? 1 : 0);
      addAssignment('updated_at', timestamp);
      database
        .prepare(`UPDATE cards SET ${assignments.join(', ')} WHERE id = ?`)
        .run(...parameters, cardId);

      if (input.categoryIds !== undefined) {
        database.prepare('DELETE FROM card_categories WHERE card_id = ?').run(cardId);
        const insertCategory = database.prepare(
          'INSERT INTO card_categories (card_id, category_id) VALUES (?, ?)',
        );
        for (const categoryId of input.categoryIds) insertCategory.run(cardId, categoryId);
      }
      if (input.userTags !== undefined) {
        database.prepare("DELETE FROM card_tags WHERE card_id = ? AND origin = 'user'").run(cardId);
        for (const tagName of input.userTags) this.insertTag(database, cardId, tagName, 'user');
      }

      return {
        shouldRetryAi:
          current.ai_status === 'needs_input' &&
          input.rawInput !== undefined &&
          input.rawInput !== current.raw_input,
      };
    })();
  }

  bulkUpdateInTransaction(
    ids: string[],
    input: BulkCardUpdateInput,
    timestamp: string,
  ): number {
    if (ids.length === 0) return 0;
    const database = this.database.get();
    return database.transaction(() => {
      const placeholders = ids.map(() => '?').join(', ');
      const existingIds = (
        database.prepare(`SELECT id FROM cards WHERE id IN (${placeholders})`).all(...ids) as Array<{
          id: string;
        }>
      ).map(({ id }) => id);
      if (existingIds.length === 0) return 0;

      const existingPlaceholders = existingIds.map(() => '?').join(', ');
      const assignments = ['updated_at = ?'];
      const parameters: unknown[] = [timestamp];
      if (input.rating !== undefined) {
        assignments.push('rating = ?');
        parameters.push(input.rating);
      }
      if (input.archived !== undefined) {
        assignments.push('archived = ?');
        parameters.push(input.archived ? 1 : 0);
      }
      database
        .prepare(`UPDATE cards SET ${assignments.join(', ')} WHERE id IN (${existingPlaceholders})`)
        .run(...parameters, ...existingIds);

      if (input.tags !== undefined) {
        for (const cardId of existingIds) {
          for (const tagName of input.tags) this.insertTag(database, cardId, tagName, 'user');
        }
      }
      return existingIds.length;
    })();
  }

  addAttachmentsInTransaction(cardId: string, attachments: AttachmentInput[], timestamp: string) {
    const database = this.database.get();
    database.transaction(() => {
      const card = database.prepare('SELECT id FROM cards WHERE id = ?').get(cardId);
      if (!card) throw new CardRepositoryError('not_found');
      const startOrder = (
        database
          .prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order FROM attachments WHERE card_id = ?')
          .get(cardId) as { next_order: number }
      ).next_order;
      const insertAttachment = database.prepare(`
        INSERT INTO attachments (
          id, card_id, stored_name, original_name, mime_type, byte_size, sort_order, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      attachments.forEach((attachment, index) => {
        insertAttachment.run(
          attachment.id,
          cardId,
          attachment.storedName,
          attachment.originalName,
          attachment.mimeType,
          attachment.byteSize,
          startOrder + index,
          timestamp,
        );
      });
      database.prepare('UPDATE cards SET updated_at = ? WHERE id = ?').run(timestamp, cardId);
    })();
  }

  deleteAttachmentInTransaction(cardId: string, attachmentId: string): string {
    const database = this.database.get();
    return database.transaction(() => {
      const attachment = database
        .prepare('SELECT stored_name FROM attachments WHERE id = ? AND card_id = ?')
        .get(attachmentId, cardId) as { stored_name: string } | undefined;
      if (!attachment) throw new CardRepositoryError('not_found');
      database.prepare('DELETE FROM attachments WHERE id = ? AND card_id = ?').run(attachmentId, cardId);
      return attachment.stored_name;
    })();
  }

  deleteInTransaction(cardId: string): string[] {
    const database = this.database.get();
    return database.transaction(() => {
      const card = database.prepare('SELECT id FROM cards WHERE id = ?').get(cardId);
      if (!card) throw new CardRepositoryError('not_found');
      const storedNames = (
        database.prepare('SELECT stored_name FROM attachments WHERE card_id = ?').all(cardId) as Array<{
          stored_name: string;
        }>
      ).map(({ stored_name }) => stored_name);
      database.prepare('DELETE FROM cards WHERE id = ?').run(cardId);
      return storedNames;
    })();
  }

  getDetail(cardId: string): CardDetail {
    const database = this.database.get();
    const card = database.prepare('SELECT * FROM cards WHERE id = ?').get(cardId) as CardRow | undefined;
    if (!card) throw new CardRepositoryError('not_found');

    const categories = database
      .prepare(`
        SELECT categories.id, categories.name, categories.parent_id
        FROM card_categories
        JOIN categories ON categories.id = card_categories.category_id
        WHERE card_categories.card_id = ?
        ORDER BY card_categories.rowid
      `)
      .all(cardId) as Array<{ id: string; name: string; parent_id: string | null }>;
    const tags = database
      .prepare(`
        SELECT tags.id, tags.name, card_tags.origin
        FROM card_tags
        JOIN tags ON tags.id = card_tags.tag_id
        WHERE card_tags.card_id = ?
        ORDER BY tags.name
      `)
      .all(cardId) as Array<{ id: string; name: string; origin: 'user' | 'ai' }>;
    const attachments = database
      .prepare(`
        SELECT id, stored_name, original_name, mime_type, byte_size
        FROM attachments
        WHERE card_id = ?
        ORDER BY sort_order, id
      `)
      .all(cardId) as Array<{
      id: string;
      stored_name: string;
      original_name: string;
      mime_type: string;
      byte_size: number;
    }>;
    const quizItems = database
      .prepare(`
        SELECT id, direction, question, answer, due_at
        FROM quiz_items
        WHERE card_id = ?
        ORDER BY rowid
      `)
      .all(cardId) as Array<{
      id: string;
      direction: CardDetail['quizItems'][number]['direction'];
      question: string;
      answer: string;
      due_at: string;
    }>;

    return {
      id: card.id,
      entryMode: card.entry_mode,
      rawInput: card.raw_input,
      rawContentJson: card.raw_content_json,
      template: card.template,
      normalizedStatement: card.normalized_statement,
      wrongPoint: card.wrong_point,
      analysis: card.analysis,
      mnemonic: card.mnemonic,
      extension: card.extension,
      notes: card.notes,
      aiStatus: card.ai_status,
      sourceType: card.source_type,
      sourceDetail: card.source_detail,
      rating: card.rating,
      mastery: card.mastery,
      wrongCount: card.wrong_count,
      archived: card.archived === 1,
      createdAt: card.created_at,
      updatedAt: card.updated_at,
      categories: categories.map(({ id, name, parent_id }) => ({ id, name, parentId: parent_id })),
      tags,
      attachments: attachments.map(({ id, stored_name, original_name, mime_type, byte_size }) => ({
        id,
        url: `/uploads/${encodeURIComponent(stored_name)}`,
        originalName: original_name,
        mimeType: mime_type,
        byteSize: byte_size,
      })),
      quizItems: quizItems.map(({ id, direction, question, answer, due_at }) => ({
        id,
        direction,
        question,
        answer,
        dueAt: due_at,
      })),
    };
  }

  private assertCategories(database: Database.Database, categoryIds: string[]) {
    if (categoryIds.length === 0) throw new CardRepositoryError('invalid_categories');
    const placeholders = categoryIds.map(() => '?').join(', ');
    const categories = database
      .prepare(`SELECT id, parent_id FROM categories WHERE id IN (${placeholders})`)
      .all(...categoryIds) as Array<{ id: string; parent_id: string | null }>;
    if (
      categories.length !== categoryIds.length ||
      !categories.some(({ parent_id }) => parent_id === null) ||
      !categories.some(({ parent_id }) => parent_id !== null)
    ) {
      throw new CardRepositoryError('invalid_categories');
    }
  }

  private insertTag(
    database: Database.Database,
    cardId: string,
    tagName: string,
    origin: 'user' | 'ai',
  ) {
    database
      .prepare('INSERT OR IGNORE INTO tags (id, name) VALUES (?, ?)')
      .run(randomUUID(), tagName);
    const tag = database.prepare('SELECT id FROM tags WHERE name = ?').get(tagName) as { id: string };
    database
      .prepare(`
        INSERT INTO card_tags (card_id, tag_id, origin) VALUES (?, ?, ?)
        ON CONFLICT(card_id, tag_id) DO UPDATE SET
          origin = CASE WHEN excluded.origin = 'user' THEN 'user' ELSE card_tags.origin END
      `)
      .run(cardId, tag.id, origin);
  }
}

function normalizeNames(names: string[]) {
  return [...new Set(names.map((name) => name.trim()).filter(Boolean))];
}
