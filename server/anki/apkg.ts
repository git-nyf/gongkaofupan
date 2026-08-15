import { createHash } from 'node:crypto';
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import archiver from 'archiver';
import Database from 'better-sqlite3';
import {
  createMarkdownReviewDocument,
  type AnkiSourceCard,
  type MarkdownReviewCard,
} from './markdown';

export interface AnkiPackageOptions {
  outputPath?: string;
  deckName?: string;
  now?: Date;
}

export interface AnkiPackageResult {
  buffer: Buffer;
  markdown: string;
  outputPath?: string;
}

const MODEL_ID = 1_701_000_000_001;
const DECK_ID = 1_701_000_000_002;

/** 从用户初始稿生成 Anki 可导入的 .apkg。 */
export async function createAnkiPackage(
  sourceCards: readonly AnkiSourceCard[],
  options: AnkiPackageOptions = {},
): Promise<AnkiPackageResult> {
  const document = createMarkdownReviewDocument(sourceCards);
  const collection = createCollectionDatabase(document.cards, options);
  try {
    const buffer = await zipCollection(collection);
    if (options.outputPath) {
      mkdirSync(path.dirname(options.outputPath), { recursive: true });
      writeFileSync(options.outputPath, buffer);
    }
    return { buffer, markdown: document.markdown, outputPath: options.outputPath };
  } finally {
    rmSync(collection.directory, { recursive: true, force: true });
  }
}

async function zipCollection(collection: CollectionDatabase): Promise<Buffer> {
  const archive = archiver('zip', { zlib: { level: 9 } });
  const chunks: Buffer[] = [];
  const result = new Promise<Buffer>((resolve, reject) => {
    archive.on('data', (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
    archive.on('error', reject);
    archive.on('end', () => resolve(Buffer.concat(chunks)));
  });

  archive.append(readFileSync(collection.filePath), { name: 'collection.anki2', store: true });
  // Anki expects a media index even when the deck has no attachments.
  archive.append(Buffer.from('{}', 'utf8'), { name: 'media', store: true });
  await archive.finalize();
  return result;
}

interface CollectionDatabase {
  directory: string;
  filePath: string;
}

function createCollectionDatabase(
  cards: readonly MarkdownReviewCard[],
  options: AnkiPackageOptions,
): CollectionDatabase {
  const directory = mkdtempSync(path.join(tmpdir(), 'gongkao-anki-'));
  const filePath = path.join(directory, 'collection.anki2');
  const database = new Database(filePath);
  const nowSeconds = Math.floor((options.now ?? new Date()).getTime() / 1000);
  const deckName = options.deckName?.trim() || '公考记忆卡::每日复习';

  try {
    database.pragma('journal_mode = DELETE');
    createSchema(database);
    const model = createModel(nowSeconds, DECK_ID);
    const deck = createDeck(nowSeconds, deckName);
    const conf = createDeckConfig(nowSeconds);
    database
      .prepare('INSERT INTO col (id, crt, mod, scm, ver, dty, usn, ls, conf, models, decks, dconf, tags) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(
        1,
        nowSeconds,
        nowSeconds,
        nowSeconds,
        11,
        0,
        -1,
        0,
        JSON.stringify(createCollectionConfig()),
        JSON.stringify({ [MODEL_ID]: model }),
        JSON.stringify({ [DECK_ID]: deck }),
        JSON.stringify({ 1: conf }),
        '{}',
      );

    const insertNote = database.prepare('INSERT INTO notes (id, guid, mid, mod, usn, tags, flds, sfld, csum, flags, data) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    const insertCard = database.prepare('INSERT INTO cards (id, nid, did, ord, mod, usn, type, queue, due, ivl, factor, reps, lapses, left, odue, odid, flags, data) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    const usedNoteIds = new Set<number>();
    const usedCardIds = new Set<number>();
    const insertAll = database.transaction(() => {
      cards.forEach((card, index) => {
        const noteId = uniqueStableId(`note:${card.stableId}`, usedNoteIds);
        const cardId = uniqueStableId(`card:${card.stableId}`, usedCardIds);
        const fields = [
          htmlText(card.question),
          htmlText(card.category),
          htmlText(card.reviewHint),
          htmlText(card.answer),
        ];
        const front = fields[0];
        insertNote.run(
          noteId,
          stableGuid(card.stableId),
          MODEL_ID,
          nowSeconds,
          -1,
          '',
          fields.join('\x1f'),
          card.question,
          checksum(front),
          0,
          JSON.stringify({ sourceId: card.stableId, category: card.category }),
        );
        insertCard.run(
          cardId,
          noteId,
          DECK_ID,
          0,
          nowSeconds,
          -1,
          0,
          0,
          index + 1,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          '',
        );
      });
    });
    insertAll();
    database.close();
    return { directory, filePath };
  } catch (error) {
    database.close();
    rmSync(directory, { recursive: true, force: true });
    throw error;
  }
}

function createSchema(database: Database.Database) {
  database.exec(`
    CREATE TABLE col (
      id integer primary key, crt integer not null, mod integer not null,
      scm integer not null, ver integer not null, dty integer not null,
      usn integer not null, ls integer not null, conf text not null,
      models text not null, decks text not null, dconf text not null, tags text not null
    );
    CREATE TABLE notes (
      id integer primary key, guid text not null, mid integer not null,
      mod integer not null, usn integer not null, tags text not null,
      flds text not null, sfld integer not null, csum integer not null,
      flags integer not null, data text not null
    );
    CREATE TABLE cards (
      id integer primary key, nid integer not null, did integer not null,
      ord integer not null, mod integer not null, usn integer not null,
      type integer not null, queue integer not null, due integer not null,
      ivl integer not null, factor integer not null, reps integer not null,
      lapses integer not null, left integer not null, odue integer not null,
      odid integer not null, flags integer not null, data text not null
    );
    CREATE TABLE revlog (
      id integer primary key, cid integer not null, usn integer not null,
      ease integer not null, ivl integer not null, lastIvl integer not null,
      factor integer not null, time integer not null, type integer not null
    );
    CREATE TABLE graves (usn integer not null, oid integer not null, type integer not null);
    CREATE INDEX ix_notes_usn ON notes (usn);
    CREATE INDEX ix_cards_usn ON cards (usn);
    CREATE INDEX ix_cards_nid ON cards (nid);
    CREATE INDEX ix_cards_sched ON cards (did, queue, due);
    CREATE INDEX ix_notes_csum ON notes (csum);
    CREATE UNIQUE INDEX ix_notes_guid ON notes (guid);
    CREATE INDEX ix_revlog_usn ON revlog (usn);
    CREATE INDEX ix_revlog_cid ON revlog (cid);
  `);
}

function createModel(mod: number, deckId: number) {
  return {
    id: MODEL_ID,
    name: '公考记忆卡',
    type: 0,
    mod,
    usn: -1,
    sortf: 0,
    did: deckId,
    tmpls: [{
      name: '问答卡',
      ord: 0,
      qfmt: '<div class="category">{{分类}}</div><div class="question">{{问题}}</div>',
      afmt: '{{FrontSide}}<hr id="answer"><div class="hint">{{复习提示}}</div><div class="answer">{{答案}}</div>',
      bqfmt: '',
      bafmt: '',
      did: null,
    }],
    flds: [
      { name: '问题', ord: 0, sticky: false, rtl: false, font: 'Arial', size: 22, media: [] },
      { name: '分类', ord: 1, sticky: false, rtl: false, font: 'Arial', size: 16, media: [] },
      { name: '复习提示', ord: 2, sticky: false, rtl: false, font: 'Arial', size: 18, media: [] },
      { name: '答案', ord: 3, sticky: false, rtl: false, font: 'Arial', size: 20, media: [] },
    ],
    css: '.card { font-family: Arial; font-size: 22px; text-align: left; color: #222; background: #fff; } .category { color: #b64d3c; font-size: 16px; margin-bottom: 12px; } .hint { color: #777; font-size: 18px; margin: 12px 0; } .answer { font-size: 22px; }',
    latexPre: '',
    latexPost: '',
    latexsvg: false,
    req: [],
  };
}

function createDeck(mod: number, name: string) {
  return {
    id: DECK_ID,
    name,
    desc: '由公考记忆卡每日用户初始稿生成',
    dyn: 0,
    collapsed: false,
    browserCollapsed: false,
    extendNew: 10,
    extendRev: 50,
    conf: 1,
    mod,
    usn: -1,
    collapsed2: false,
    lrnToday: [0, 0],
    revToday: [0, 0],
    newToday: [0, 0],
    timeToday: [0, 0],
  };
}

function createDeckConfig(mod: number) {
  return {
    id: 1,
    name: '默认配置',
    mod,
    usn: -1,
    maxTaken: 60,
    autoplay: true,
    replayq: true,
    timer: 0,
    dyn: false,
    new: {
      bury: false,
      delays: [1, 10],
      perDay: 20,
      ints: [1, 4, 0],
      initialFactor: 2500,
      order: 1,
    },
    rev: {
      bury: false,
      ease4: 1.3,
      hardFactor: 1.2,
      ivlFct: 1,
      maxIvl: 36_500,
      perDay: 200,
    },
    lapse: {
      delays: [10],
      leechAction: 1,
      leechFails: 8,
      minInt: 1,
      mult: 0,
    },
  };
}

function createCollectionConfig() {
  return {
    nextPos: 1,
    estTimes: true,
    activeDecks: [DECK_ID],
    sortType: 'noteFld',
    sortBackwards: false,
    curDeck: DECK_ID,
    newSpread: 0,
    dayOffset: 0,
    creationOffset: 0,
    timeLim: 0,
  };
}

function htmlText(value: string) {
  return escapeHtml(value).replace(/\r?\n/g, '<br>');
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function stableGuid(stableId: string) {
  return createHash('sha256').update(`gongkao:${stableId}`).digest('hex').slice(0, 20);
}

function checksum(front: string) {
  return Number.parseInt(createHash('sha1').update(front).digest('hex').slice(0, 8), 16);
}

function uniqueStableId(value: string, used: Set<number>) {
  let id = stableNumericId(value);
  while (used.has(id)) id += 1;
  used.add(id);
  return id;
}

function stableNumericId(value: string) {
  const hex = createHash('sha256').update(`gongkao:${value}`).digest('hex').slice(0, 12);
  return Number.parseInt(hex, 16) || 1;
}
