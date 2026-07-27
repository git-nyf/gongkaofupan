import { randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';
import type {
  AttachmentInput,
  BulkCardUpdateInput,
  CardDetail,
  CardFolderSummary,
  CardSearchInput,
  CardUpdateInput,
  CreateCardInput,
  Mastery,
  NormalizeCardInput,
  NormalizedCard,
  OriginalCardRewriteInput,
} from '../../shared/contracts';

export interface CardExportSheet {
  name: string;
  rows: string[][];
}

export interface RandomOriginalFilter {
  categoryIds: string[];
  createdFrom?: string;
  createdTo?: string;
}

export type CardRepositoryErrorCode =
  | 'folder_name_conflict'
  | 'folder_resource_not_found'
  | 'invalid_categories'
  | 'invalid_state'
  | 'not_found'
  | 'processing_conflict';

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
  mastery: Mastery;
  wrong_count: number;
  archived: number;
  created_at: string;
  updated_at: string;
}

interface CardFolderRow {
  id: string;
  name: string;
  original_count: number;
  card_ids_json: string;
  created_at: string;
  updated_at: string;
}

interface FolderCardCategoryRow {
  card_id: string;
  id: string;
  name: string;
  parent_id: string | null;
}

interface FolderCardTagRow {
  card_id: string;
  id: string;
  name: string;
  origin: 'user' | 'ai';
}

interface FolderCardAttachmentRow {
  card_id: string;
  id: string;
  stored_name: string;
  original_name: string;
  mime_type: string;
  byte_size: number;
}

interface FolderCardQuizItemRow {
  card_id: string;
  id: string;
  direction: CardDetail['quizItems'][number]['direction'];
  question: string;
  answer: string;
  due_at: string;
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
            source_type, source_detail, manual_order,
            ai_status, ai_attempt_count, created_at, updated_at
          ) VALUES (
            ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
            (SELECT COALESCE(MAX(manual_order), 0) + 1 FROM cards),
            'processing', 1, ?, ?
          )
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
      const splitCardTitle =
        normalized.question_type === 'single' && normalized.quiz_items.length > 1
          ? titleForSingleQuizItem(normalized.quiz_items[0].question)
          : normalized.normalized_statement;
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
          splitCardTitle,
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
        const currentCardItems = normalized.question_type === 'single'
          ? normalized.quiz_items.slice(0, 1)
          : normalized.quiz_items;
        for (const item of currentCardItems) {
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

        if (normalized.question_type === 'single') {
          const extraItems = normalized.quiz_items.slice(1);
          const source = database
            .prepare(`
              SELECT
                entry_mode, raw_input, raw_content_json, template,
                wrong_point, analysis, mnemonic, extension, notes,
                source_type, source_detail, manual_order
              FROM cards
              WHERE id = ?
            `)
            .get(cardId) as {
            entry_mode: string;
            raw_input: string;
            raw_content_json: string | null;
            template: string;
            wrong_point: string;
            analysis: string;
            mnemonic: string;
            extension: string;
            notes: string;
            source_type: string;
            source_detail: string;
            manual_order: number;
          };
          const categories = database
            .prepare('SELECT category_id FROM card_categories WHERE card_id = ? ORDER BY rowid')
            .all(cardId) as Array<{ category_id: string }>;
          const userTags = database
            .prepare(`
              SELECT tags.name
              FROM card_tags
              JOIN tags ON tags.id = card_tags.tag_id
              WHERE card_tags.card_id = ? AND card_tags.origin = 'user'
              ORDER BY card_tags.rowid
            `)
            .all(cardId) as Array<{ name: string }>;
          const insertCard = database.prepare(`
            INSERT INTO cards (
              id, entry_mode, raw_input, raw_content_json, template,
              normalized_statement, wrong_point, analysis, mnemonic, extension, notes,
              source_type, source_detail, manual_order,
              ai_status, ai_error_code, ai_attempt_count, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ready', '', 1, ?, ?)
          `);
          const insertCategory = database.prepare(
            'INSERT INTO card_categories (card_id, category_id) VALUES (?, ?)',
          );

          for (const item of extraItems) {
            const extraCardId = randomUUID();
            insertCard.run(
              extraCardId,
              source.entry_mode,
              source.raw_input,
              source.raw_content_json,
              source.template,
              titleForSingleQuizItem(item.question),
              normalized.wrong_point || source.wrong_point,
              normalized.analysis || source.analysis,
              normalized.mnemonic || source.mnemonic,
              normalized.extension || source.extension,
              normalized.notes || source.notes,
              source.source_type,
              source.source_detail,
              source.manual_order,
              timestamp,
              timestamp,
            );
            for (const { category_id } of categories) insertCategory.run(extraCardId, category_id);
            for (const { name } of userTags) this.insertTag(database, extraCardId, name, 'user');
            for (const tagName of normalizeNames(normalized.tags)) {
              this.insertTag(database, extraCardId, tagName, 'ai');
            }
            insertQuizItem.run(
              randomUUID(),
              extraCardId,
              item.direction,
              item.question,
              item.answer,
              mastery,
              timestamp,
              timestamp,
            );
          }
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

  beginOriginalRewriteInTransaction(
    cardId: string,
    input: OriginalCardRewriteInput,
    timestamp: string,
  ): RetryWork {
    const database = this.database.get();
    return database.transaction((): RetryWork => {
      this.assertCategories(database, input.categoryIds);
      const sourceKey = originalSourceKeySql('cards');
      const cards = database
        .prepare(`
          WITH keyed_cards AS (
            SELECT cards.id, cards.entry_mode, cards.archived, cards.ai_status,
                   ${sourceKey} AS source_key
            FROM cards
          ),
          target AS (
            SELECT source_key, archived
            FROM keyed_cards
            WHERE id = ?
          )
          SELECT keyed_cards.id, keyed_cards.entry_mode,
                 keyed_cards.archived, keyed_cards.ai_status
          FROM keyed_cards
          JOIN target
            ON target.source_key = keyed_cards.source_key
            AND target.archived = keyed_cards.archived
          ORDER BY keyed_cards.id
        `)
        .all(cardId) as Array<{
        id: string;
        entry_mode: NormalizeCardInput['entry_mode'];
        archived: number;
        ai_status: CardDetail['aiStatus'];
      }>;

      if (cards.length === 0) throw new CardRepositoryError('not_found');
      const target = cards.find(({ id }) => id === cardId);
      if (!target) throw new CardRepositoryError('not_found');
      if (target.archived === 1) throw new CardRepositoryError('invalid_state');
      if (cards.some(({ ai_status }) => ai_status === 'processing')) {
        throw new CardRepositoryError('processing_conflict');
      }

      const cardIds = cards.map(({ id }) => id);
      const placeholders = cardIds.map(() => '?').join(', ');
      const attachments = database
        .prepare(`
          SELECT attachments.id
          FROM attachments
          JOIN cards ON cards.id = attachments.card_id
          WHERE attachments.card_id IN (${placeholders})
          ORDER BY
            CASE WHEN attachments.card_id = ? THEN 0 ELSE 1 END,
            cards.created_at,
            attachments.sort_order,
            attachments.id
        `)
        .all(...cardIds, cardId) as Array<{ id: string }>;
      const moveAttachment = database.prepare(
        'UPDATE attachments SET card_id = ?, sort_order = ? WHERE id = ?',
      );
      attachments.forEach(({ id }, index) => moveAttachment.run(cardId, index, id));

      const siblingIds = cardIds.filter((id) => id !== cardId);
      if (siblingIds.length > 0) {
        const siblingPlaceholders = siblingIds.map(() => '?').join(', ');
        database.prepare(`DELETE FROM cards WHERE id IN (${siblingPlaceholders})`).run(...siblingIds);
      }

      database.prepare('DELETE FROM quiz_items WHERE card_id = ?').run(cardId);
      database.prepare('DELETE FROM card_categories WHERE card_id = ?').run(cardId);
      database.prepare('DELETE FROM card_tags WHERE card_id = ?').run(cardId);

      database
        .prepare(`
          UPDATE cards SET
            raw_input = ?, raw_content_json = ?, template = ?,
            normalized_statement = '', wrong_point = ?, analysis = ?,
            mnemonic = ?, extension = ?, notes = ?,
            source_type = ?, source_detail = ?, rating = 1,
            mastery = 'unseen', wrong_count = 0,
            ai_status = 'processing', ai_attempt_count = ai_attempt_count + 1,
            ai_error_code = '', updated_at = ?
          WHERE id = ?
        `)
        .run(
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
          timestamp,
          cardId,
        );

      const insertCategory = database.prepare(
        'INSERT INTO card_categories (card_id, category_id) VALUES (?, ?)',
      );
      for (const categoryId of input.categoryIds) insertCategory.run(cardId, categoryId);
      for (const tagName of input.userTags) this.insertTag(database, cardId, tagName, 'user');

      return {
        normalizeInput: {
          entry_mode: target.entry_mode,
          raw_input: input.rawInput,
          selected_categories: [...input.categoryIds],
          template: input.template,
          existing_fields: {
            wrong_point: input.wrongPoint,
            analysis: input.analysis,
            mnemonic: input.mnemonic,
            extension: input.extension,
            notes: input.notes,
          },
        },
        mastery: 'unseen',
      };
    })();
  }

  countOriginalGroup(cardId: string): number {
    const sourceKey = originalSourceKeySql('cards');
    const result = this.database
      .get()
      .prepare(`
        WITH keyed_cards AS (
          SELECT cards.id, cards.archived, ${sourceKey} AS source_key
          FROM cards
        ),
        target AS (
          SELECT source_key, archived
          FROM keyed_cards
          WHERE id = ?
        )
        SELECT COUNT(*) AS count
        FROM keyed_cards
        JOIN target
          ON target.source_key = keyed_cards.source_key
          AND target.archived = keyed_cards.archived
      `)
      .get(cardId) as { count: number };
    return result.count;
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

  exportAllData(): CardExportSheet[] {
    const rows = this.database
      .get()
      .prepare(`
        WITH raw_cards AS (
          SELECT id, raw_input, created_at
          FROM cards
          WHERE trim(raw_input) <> ''
        ),
        category_rows AS (
          SELECT
            raw_cards.id,
            raw_cards.raw_input,
            raw_cards.created_at,
            CASE
              WHEN categories.parent_id IS NULL THEN categories.id
              WHEN parent_categories.id IS NOT NULL THEN parent_categories.id
            END AS section_id,
            CASE
              WHEN categories.parent_id IS NULL THEN categories.name
              WHEN parent_categories.id IS NOT NULL THEN parent_categories.name
            END AS section_name,
            CASE
              WHEN categories.parent_id IS NULL THEN categories.sort_order
              WHEN parent_categories.id IS NOT NULL THEN parent_categories.sort_order
            END AS section_sort_order
          FROM raw_cards
          JOIN card_categories ON card_categories.card_id = raw_cards.id
          JOIN categories ON categories.id = card_categories.category_id
          LEFT JOIN categories parent_categories
            ON parent_categories.id = categories.parent_id
            AND parent_categories.parent_id IS NULL
        ),
        categorized_rows AS (
          SELECT
            section_id,
            section_name,
            section_sort_order,
            raw_input,
            MIN(created_at) AS content_created_at,
            MIN(id) AS content_id
          FROM category_rows
          WHERE section_id IS NOT NULL
          GROUP BY section_id, section_name, section_sort_order, raw_input
        ),
        raw_inputs AS (
          SELECT
            raw_input,
            MIN(created_at) AS content_created_at,
            MIN(id) AS content_id
          FROM raw_cards
          GROUP BY raw_input
        ),
        export_rows AS (
          SELECT
            section_id,
            section_name,
            section_sort_order,
            raw_input,
            content_created_at,
            content_id
          FROM categorized_rows
          UNION ALL
          SELECT
            NULL AS section_id,
            '未分类' AS section_name,
            NULL AS section_sort_order,
            raw_inputs.raw_input,
            raw_inputs.content_created_at,
            raw_inputs.content_id
          FROM raw_inputs
          WHERE NOT EXISTS (
            SELECT 1
            FROM categorized_rows
            WHERE categorized_rows.raw_input = raw_inputs.raw_input
          )
        )
        SELECT section_id, section_name, raw_input
        FROM export_rows
        ORDER BY
          CASE WHEN section_id IS NULL THEN 1 ELSE 0 END,
          section_sort_order,
          section_name,
          content_created_at,
          content_id
      `)
      .all() as Array<{ section_id: string | null; section_name: string; raw_input: string }>;

    const sheets: CardExportSheet[] = [];
    let currentSectionId: string | null | undefined;
    for (const row of rows) {
      if (row.section_id !== currentSectionId) {
        sheets.push({ name: row.section_name, rows: [['用户原始内容']] });
        currentSectionId = row.section_id;
      }
      sheets.at(-1)?.rows.push([row.raw_input]);
    }

    return sheets.length > 0 ? sheets : [{ name: '未分类', rows: [['用户原始内容']] }];
  }

  listFolders(): CardFolderSummary[] {
    const sourceKey = originalSourceKeySql('cards');
    const rows = this.database
      .get()
      .prepare(`
        WITH keyed_cards AS (
          SELECT cards.id, ${sourceKey} AS source_key
          FROM cards
        )
        SELECT
          card_folders.id,
          card_folders.name,
          COUNT(DISTINCT keyed_cards.source_key) AS original_count,
          (
            SELECT json_group_array(ordered_items.card_id)
            FROM (
              SELECT card_folder_items.card_id
              FROM card_folder_items
              JOIN cards
                ON cards.id = card_folder_items.card_id
              WHERE card_folder_items.folder_id = card_folders.id
              ORDER BY card_folder_items.created_at, card_folder_items.card_id
            ) AS ordered_items
          ) AS card_ids_json,
          card_folders.created_at,
          card_folders.updated_at
        FROM card_folders
        LEFT JOIN card_folder_items
          ON card_folder_items.folder_id = card_folders.id
        LEFT JOIN keyed_cards
          ON keyed_cards.id = card_folder_items.card_id
        GROUP BY card_folders.id
        ORDER BY card_folders.created_at, card_folders.id
      `)
      .all() as CardFolderRow[];
    return rows.map(toCardFolderSummary);
  }

  getFolderSummary(folderId: string): CardFolderSummary {
    const sourceKey = originalSourceKeySql('cards');
    const row = this.database
      .get()
      .prepare(`
        WITH keyed_cards AS (
          SELECT cards.id, ${sourceKey} AS source_key
          FROM cards
        )
        SELECT
          card_folders.id,
          card_folders.name,
          COUNT(DISTINCT keyed_cards.source_key) AS original_count,
          (
            SELECT json_group_array(ordered_items.card_id)
            FROM (
              SELECT card_folder_items.card_id
              FROM card_folder_items
              JOIN cards
                ON cards.id = card_folder_items.card_id
              WHERE card_folder_items.folder_id = card_folders.id
              ORDER BY card_folder_items.created_at, card_folder_items.card_id
            ) AS ordered_items
          ) AS card_ids_json,
          card_folders.created_at,
          card_folders.updated_at
        FROM card_folders
        LEFT JOIN card_folder_items
          ON card_folder_items.folder_id = card_folders.id
        LEFT JOIN keyed_cards
          ON keyed_cards.id = card_folder_items.card_id
        WHERE card_folders.id = ?
        GROUP BY card_folders.id
      `)
      .get(folderId) as CardFolderRow | undefined;
    if (!row) throw new CardRepositoryError('folder_resource_not_found');
    return toCardFolderSummary(row);
  }

  createFolderInTransaction(name: string, timestamp: string): string {
    const database = this.database.get();
    return database.transaction(() => {
      const duplicate = database
        .prepare('SELECT 1 FROM card_folders WHERE name = ?')
        .get(name);
      if (duplicate) throw new CardRepositoryError('folder_name_conflict');

      const folderId = randomUUID();
      database
        .prepare(`
          INSERT INTO card_folders (id, name, created_at, updated_at)
          VALUES (?, ?, ?, ?)
        `)
        .run(folderId, name, timestamp, timestamp);
      return folderId;
    })();
  }

  deleteFolderInTransaction(folderId: string) {
    const result = this.database
      .get()
      .prepare('DELETE FROM card_folders WHERE id = ?')
      .run(folderId);
    if (result.changes === 0) throw new CardRepositoryError('folder_resource_not_found');
  }

  addCardsToFolderInTransaction(folderId: string, cardIds: string[], timestamp: string) {
    const database = this.database.get();
    database.transaction(() => {
      const folder = database.prepare('SELECT 1 FROM card_folders WHERE id = ?').get(folderId);
      if (!folder) throw new CardRepositoryError('folder_resource_not_found');

      const placeholders = cardIds.map(() => '?').join(', ');
      const existingCards = database
        .prepare(`SELECT COUNT(*) AS count FROM cards WHERE id IN (${placeholders})`)
        .get(...cardIds) as { count: number };
      if (existingCards.count !== cardIds.length) {
        throw new CardRepositoryError('folder_resource_not_found');
      }

      const insertItem = database.prepare(`
        INSERT OR IGNORE INTO card_folder_items (folder_id, card_id, created_at)
        VALUES (?, ?, ?)
      `);
      let insertedItems = 0;
      for (const cardId of cardIds) {
        insertedItems += insertItem.run(folderId, cardId, timestamp).changes;
      }
      if (insertedItems > 0) {
        database
          .prepare('UPDATE card_folders SET updated_at = ? WHERE id = ?')
          .run(timestamp, folderId);
      }
    })();
  }

  removeCardsFromFolderInTransaction(folderId: string, cardIds: string[], timestamp: string) {
    const database = this.database.get();
    database.transaction(() => {
      const folder = database.prepare('SELECT 1 FROM card_folders WHERE id = ?').get(folderId);
      if (!folder) throw new CardRepositoryError('folder_resource_not_found');

      const placeholders = cardIds.map(() => '?').join(', ');
      const result = database
        .prepare(`DELETE FROM card_folder_items WHERE folder_id = ? AND card_id IN (${placeholders})`)
        .run(folderId, ...cardIds);
      if (result.changes > 0) {
        database
          .prepare('UPDATE card_folders SET updated_at = ? WHERE id = ?')
          .run(timestamp, folderId);
      }
    })();
  }

  getFolderCardIds(folderId: string): string[] {
    const sourceKey = originalSourceKeySql('cards');
    return (
      this.database
        .get()
        .prepare(`
          WITH keyed_cards AS (
            SELECT
              cards.id,
              cards.manual_order,
              cards.created_at,
              ${sourceKey} AS source_key
            FROM cards
          ),
          folder_sources AS (
            SELECT DISTINCT keyed_cards.source_key
            FROM card_folder_items
            JOIN keyed_cards
              ON keyed_cards.id = card_folder_items.card_id
            WHERE card_folder_items.folder_id = ?
          ),
          folder_cards AS (
            SELECT keyed_cards.*
            FROM keyed_cards
            JOIN folder_sources USING (source_key)
          ),
          ranked_groups AS (
            SELECT
              source_key,
              manual_order AS group_manual_order,
              created_at AS group_created_at,
              id AS group_card_id,
              ROW_NUMBER() OVER (
                PARTITION BY source_key
                ORDER BY ${manualOrderSortSql('manual_order', 'created_at', 'id')}
              ) AS source_rank
            FROM folder_cards
          ),
          ordered_groups AS (
            SELECT
              source_key,
              ROW_NUMBER() OVER (
                ORDER BY ${manualOrderSortSql(
                  'group_manual_order',
                  'group_created_at',
                  'group_card_id',
                )}
              ) AS group_order
            FROM ranked_groups
            WHERE source_rank = 1
          )
          SELECT folder_cards.id
          FROM ordered_groups
          JOIN folder_cards USING (source_key)
          ORDER BY
            ordered_groups.group_order,
            ${manualOrderSortSql(
              'folder_cards.manual_order',
              'folder_cards.created_at',
              'folder_cards.id',
            )}
        `)
        .all(folderId) as Array<{ id: string }>
    ).map(({ id }) => id);
  }

  getFolderDetails(cardIds: string[]): CardDetail[] {
    if (cardIds.length === 0) return [];
    const database = this.database.get();
    const placeholders = cardIds.map(() => '?').join(', ');
    const cards = database
      .prepare(`SELECT * FROM cards WHERE id IN (${placeholders})`)
      .all(...cardIds) as CardRow[];
    if (cards.length !== cardIds.length) {
      throw new CardRepositoryError('folder_resource_not_found');
    }

    const categories = database
      .prepare(`
        SELECT card_categories.card_id, categories.id, categories.name, categories.parent_id
        FROM card_categories
        JOIN categories ON categories.id = card_categories.category_id
        WHERE card_categories.card_id IN (${placeholders})
        ORDER BY card_categories.rowid
      `)
      .all(...cardIds) as FolderCardCategoryRow[];
    const tags = database
      .prepare(`
        SELECT card_tags.card_id, tags.id, tags.name, card_tags.origin
        FROM card_tags
        JOIN tags ON tags.id = card_tags.tag_id
        WHERE card_tags.card_id IN (${placeholders})
        ORDER BY tags.name
      `)
      .all(...cardIds) as FolderCardTagRow[];
    const attachments = database
      .prepare(`
        SELECT card_id, id, stored_name, original_name, mime_type, byte_size
        FROM attachments
        WHERE card_id IN (${placeholders})
        ORDER BY sort_order, id
      `)
      .all(...cardIds) as FolderCardAttachmentRow[];
    const quizItems = database
      .prepare(`
        SELECT card_id, id, direction, question, answer, due_at
        FROM quiz_items
        WHERE card_id IN (${placeholders})
        ORDER BY rowid
      `)
      .all(...cardIds) as FolderCardQuizItemRow[];

    const cardsById = new Map(cards.map((card) => [card.id, card]));
    const categoriesByCardId = groupFolderRows(categories);
    const tagsByCardId = groupFolderRows(tags);
    const attachmentsByCardId = groupFolderRows(attachments);
    const quizItemsByCardId = groupFolderRows(quizItems);

    return cardIds.map((cardId) => {
      const card = cardsById.get(cardId);
      if (!card) throw new CardRepositoryError('folder_resource_not_found');
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
        wrongCount: card.wrong_count,
        archived: card.archived === 1,
        createdAt: card.created_at,
        updatedAt: card.updated_at,
        categories: (categoriesByCardId.get(cardId) ?? []).map(({ id, name, parent_id }) => ({
          id,
          name,
          parentId: parent_id,
        })),
        tags: (tagsByCardId.get(cardId) ?? []).map(({ id, name, origin }) => ({
          id,
          name,
          origin,
        })),
        attachments: (attachmentsByCardId.get(cardId) ?? []).map(
          ({ id, stored_name, original_name, mime_type, byte_size }) => ({
            id,
            url: `/uploads/${encodeURIComponent(stored_name)}`,
            originalName: original_name,
            mimeType: mime_type,
            byteSize: byte_size,
          }),
        ),
        quizItems: (quizItemsByCardId.get(cardId) ?? []).map(
          ({ id, direction, question, answer, due_at }) => ({
            id,
            direction,
            question,
            answer,
            dueAt: due_at,
          }),
        ),
      };
    });
  }

  search(input: CardSearchInput) {
    const filters = ['cards.archived = ?'];
    const parameters: unknown[] = [input.archived ? 1 : 0];

    if (input.query) {
      const textColumns = [
        'cards.raw_input',
        'cards.normalized_statement',
        'cards.wrong_point',
        'cards.analysis',
        'cards.mnemonic',
        'cards.extension',
        'cards.notes',
      ];
      const searchTerms = input.query.trim().split(/\s+/u).filter(Boolean);
      for (const term of searchTerms) {
        const textFilters = textColumns.map(
          (column) => `instr(lower(COALESCE(${column}, '')), lower(?)) > 0`,
        );
        for (let index = 0; index < textColumns.length; index += 1) {
          parameters.push(term);
        }
        textFilters.push(`
          EXISTS (
            SELECT 1
            FROM quiz_items search_quiz_items
            WHERE search_quiz_items.card_id = cards.id
              AND (
                instr(lower(search_quiz_items.question), lower(?)) > 0
                OR instr(lower(search_quiz_items.answer), lower(?)) > 0
              )
          )
        `);
        parameters.push(term, term);
        textFilters.push(`
          EXISTS (
            SELECT 1
            FROM card_tags search_card_tags
            JOIN tags search_tags ON search_tags.id = search_card_tags.tag_id
            WHERE search_card_tags.card_id = cards.id
              AND instr(lower(search_tags.name), lower(?)) > 0
          )
        `);
        parameters.push(term);
        filters.push(`(${textFilters.join(' OR ')})`);
      }
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
    if (input.contentVersion === 'original') {
      const sourceKey = originalSourceKeySql('cards');
      const filteredCards = `
        SELECT cards.id, cards.manual_order, cards.created_at, ${sourceKey} AS source_key
        FROM cards
        WHERE ${where}
      `;
      const total = (
        database
          .prepare(`
            WITH filtered_cards AS (${filteredCards})
            SELECT COUNT(DISTINCT source_key) AS total
            FROM filtered_cards
          `)
          .get(...parameters) as { total: number }
      ).total;
      const ids = (
        database
          .prepare(`
            WITH filtered_cards AS (${filteredCards}),
            ranked_groups AS (
              SELECT
                source_key,
                manual_order AS group_manual_order,
                created_at AS group_created_at,
                id AS group_card_id,
                ROW_NUMBER() OVER (
                  PARTITION BY source_key
                  ORDER BY ${manualOrderSortSql('manual_order', 'created_at', 'id')}
                ) AS source_rank
              FROM filtered_cards
            ),
            paged_groups AS (
              SELECT
                source_key,
                ROW_NUMBER() OVER (
                  ORDER BY ${manualOrderSortSql(
                    'group_manual_order',
                    'group_created_at',
                    'group_card_id',
                  )}
                ) AS page_order
              FROM ranked_groups
              WHERE source_rank = 1
              ORDER BY ${manualOrderSortSql(
                'group_manual_order',
                'group_created_at',
                'group_card_id',
              )}
              LIMIT ? OFFSET ?
            )
            SELECT filtered_cards.id
            FROM paged_groups
            JOIN filtered_cards USING (source_key)
            ORDER BY
              paged_groups.page_order,
              ${manualOrderSortSql(
                'filtered_cards.manual_order',
                'filtered_cards.created_at',
                'filtered_cards.id',
              )}
          `)
          .all(...parameters, input.pageSize, (input.page - 1) * input.pageSize) as Array<{ id: string }>
      ).map(({ id }) => id);

      return { ids, total };
    }

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
          ORDER BY ${manualOrderSortSql(
            'cards.manual_order',
            'cards.created_at',
            'cards.id',
          )}
          LIMIT ? OFFSET ?
        `)
        .all(...parameters, input.pageSize, (input.page - 1) * input.pageSize) as Array<{ id: string }>
    ).map(({ id }) => id);

    return { ids, total };
  }

  randomOriginalId(input: RandomOriginalFilter): string | null {
    const sourceKey = originalSourceKeySql('cards');
    const { where, parameters } = randomOriginalScopeSql(input);
    const card = this.database
      .get()
      .prepare(`
        WITH eligible_cards AS (
          SELECT cards.id, cards.created_at, cards.manual_order,
                 ${sourceKey} AS source_key
          FROM cards
          WHERE ${where}
        ),
        ranked_sources AS (
          SELECT
            id,
            ROW_NUMBER() OVER (
              PARTITION BY source_key
              ORDER BY created_at DESC, manual_order DESC, id DESC
            ) AS source_rank
          FROM eligible_cards
        )
        SELECT id
        FROM ranked_sources
        WHERE source_rank = 1
        ORDER BY RANDOM()
        LIMIT 1
      `)
      .get(...parameters) as { id: string } | undefined;
    return card?.id ?? null;
  }

  countRandomOriginalSources(input: RandomOriginalFilter): number {
    const sourceKey = originalSourceKeySql('cards');
    const { where, parameters } = randomOriginalScopeSql(input);
    const result = this.database
      .get()
      .prepare(`
        SELECT COUNT(DISTINCT ${sourceKey}) AS total
        FROM cards
        WHERE ${where}
      `)
      .get(...parameters) as { total: number };
    return result.total;
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
      if (current.ai_status === 'processing' && hasAiRelatedUpdate(input)) {
        throw new CardRepositoryError('processing_conflict');
      }
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
      if (input.quizItems !== undefined) {
        this.updateQuizItems(database, cardId, input.quizItems);
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
      if (input.archived !== undefined) {
        assignments.push('archived = ?');
        parameters.push(input.archived ? 1 : 0);
      }
      if (input.position !== undefined) {
        const manualOrder = (
          input.position === 'top'
            ? database.prepare(`
                SELECT CASE WHEN MAX(manual_order) > 0 THEN MAX(manual_order) ELSE 0 END + 1 AS value
                FROM cards
              `)
            : database.prepare(`
                SELECT CASE WHEN MIN(manual_order) < 0 THEN MIN(manual_order) ELSE 0 END - 1 AS value
                FROM cards
              `)
        ).get() as { value: number };
        assignments.push('manual_order = ?');
        parameters.push(manualOrder.value);
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
      const card = database
        .prepare('SELECT archived FROM cards WHERE id = ?')
        .get(cardId) as { archived: number } | undefined;
      if (!card) throw new CardRepositoryError('not_found');
      if (card.archived !== 1) throw new CardRepositoryError('invalid_state');
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

  private updateQuizItems(
    database: Database.Database,
    cardId: string,
    quizItems: NonNullable<CardUpdateInput['quizItems']>,
  ) {
    const ids = quizItems.map(({ id }) => id);
    if (new Set(ids).size !== ids.length) throw new CardRepositoryError('invalid_categories');
    if (ids.length === 0) return;

    const placeholders = ids.map(() => '?').join(', ');
    const existingIds = (
      database
        .prepare(`SELECT id FROM quiz_items WHERE card_id = ? AND id IN (${placeholders})`)
        .all(cardId, ...ids) as Array<{ id: string }>
    ).map(({ id }) => id);
    if (existingIds.length !== ids.length) throw new CardRepositoryError('invalid_categories');

    const updateQuizItem = database.prepare(`
      UPDATE quiz_items
      SET question = ?, answer = ?
      WHERE card_id = ? AND id = ?
    `);
    for (const item of quizItems) {
      updateQuizItem.run(item.question, item.answer, cardId, item.id);
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

function toCardFolderSummary(row: CardFolderRow): CardFolderSummary {
  return {
    id: row.id,
    name: row.name,
    originalCount: row.original_count,
    cardIds: JSON.parse(row.card_ids_json) as string[],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function groupFolderRows<T extends { card_id: string }>(rows: T[]): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  for (const row of rows) {
    const group = grouped.get(row.card_id);
    if (group) group.push(row);
    else grouped.set(row.card_id, [row]);
  }
  return grouped;
}

function titleForSingleQuizItem(question: string) {
  const normalizedQuestion = question.replace(/\s+/g, ' ').trim();
  return normalizedQuestion;
}

function originalSourceKeySql(alias: string) {
  return `
    CASE
      WHEN TRIM(COALESCE(${alias}.raw_content_json, '')) <> ''
        AND json_valid(${alias}.raw_content_json)
      THEN CASE
        WHEN json_type(${alias}.raw_content_json) IN ('object', 'array')
        THEN 'json:' || json(${alias}.raw_content_json)
        WHEN TRIM(${alias}.raw_input) <> '' THEN 'text:' || TRIM(${alias}.raw_input)
        ELSE 'card:' || ${alias}.id
      END
      WHEN TRIM(${alias}.raw_input) <> '' THEN 'text:' || TRIM(${alias}.raw_input)
      ELSE 'card:' || ${alias}.id
    END
  `;
}

function randomOriginalScopeSql(input: RandomOriginalFilter) {
  const filters = ["cards.archived = 0", "TRIM(cards.raw_input) <> ''"];
  const parameters: string[] = [];
  if (input.categoryIds.length > 0) {
    const placeholders = input.categoryIds.map(() => '?').join(', ');
    filters.push(`
      EXISTS (
        SELECT 1
        FROM card_categories random_categories
        JOIN categories random_category_catalog
          ON random_category_catalog.id = random_categories.category_id
        WHERE random_categories.card_id = cards.id
          AND (
            random_categories.category_id IN (${placeholders})
            OR random_category_catalog.parent_id IN (${placeholders})
          )
      )
    `);
    parameters.push(...input.categoryIds, ...input.categoryIds);
  }
  if (input.createdFrom !== undefined) {
    filters.push('cards.created_at >= ?');
    parameters.push(input.createdFrom);
  }
  if (input.createdTo !== undefined) {
    filters.push('cards.created_at <= ?');
    parameters.push(input.createdTo);
  }
  return { where: filters.join(' AND '), parameters };
}

function manualOrderSortSql(manualOrder: string, createdAt: string, id: string) {
  return `
    ${manualOrder} DESC,
    ${createdAt} DESC,
    ${id} DESC
  `;
}

function hasAiRelatedUpdate(input: CardUpdateInput) {
  const fields: Array<keyof CardUpdateInput> = [
    'rawInput',
    'rawContentJson',
    'normalizedStatement',
    'wrongPoint',
    'analysis',
    'mnemonic',
    'extension',
    'notes',
    'categoryIds',
    'template',
    'quizItems',
  ];
  return fields.some((field) => input[field] !== undefined);
}
