import { randomUUID } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import type Database from 'better-sqlite3';
import { createAnkiPackage } from './apkg';
import type { AnkiSourceCard } from './markdown';
import { selectOriginalCards, type OriginalCardSource } from './source';

const EXPORT_SCHEMA_VERSION = 1;
const SAFE_EXPORT_ID = /^[a-z0-9-]+$/;

export interface AnkiExportSummary {
  id: string;
  createdAt: string;
  count: number;
  apkgFileName: string;
  markdownFileName: string;
}

export interface AnkiExportCard {
  id: string;
  category: string;
  question: string;
  answer: string;
}

export interface AnkiExportDetail extends AnkiExportSummary {
  cards: AnkiExportCard[];
}

interface StoredAnkiExport extends AnkiExportDetail {
  schemaVersion: typeof EXPORT_SCHEMA_VERSION;
}

export interface AnkiLibraryExportDatabase {
  get(): Database.Database;
}

export interface AnkiLibraryExportServiceDependencies {
  database: AnkiLibraryExportDatabase;
  outputDirectory: string;
  now?: () => Date;
  id?: () => string;
}

export interface AnkiLibraryExportService {
  create(cardIds?: readonly string[]): Promise<
    | { status: 'created'; export: AnkiExportSummary }
    | { status: 'empty' }
  >;
  list(): AnkiExportSummary[];
  get(id: string): AnkiExportDetail | undefined;
  getApkgPath(id: string): string | undefined;
}

export function createAnkiLibraryExportService({
  database,
  outputDirectory,
  now = () => new Date(),
  id = () => randomUUID().replace(/-/g, '').slice(0, 8),
}: AnkiLibraryExportServiceDependencies): AnkiLibraryExportService {
  const exportDirectory = path.resolve(outputDirectory, 'exports');

  async function create(cardIds?: readonly string[]) {
    const generatedAt = now();
    const sources = selectOriginalCards(database.get(), {
      cardIds,
      randomize: false,
      now: () => generatedAt,
    });
    if (sources.length === 0) return { status: 'empty' as const };

    const exportId = id();
    if (!isSafeExportId(exportId)) throw new Error('Anki 导出编号不安全');

    const fileBase = `card-library-${localDateTimeLabel(generatedAt)}-${exportId}`;
    const apkgFileName = `${fileBase}.apkg`;
    const markdownFileName = `${fileBase}.md`;
    const metadataFileName = `${fileBase}.json`;
    const cards = sources.map(toExportCard);
    const summary: AnkiExportSummary = {
      id: exportId,
      createdAt: generatedAt.toISOString(),
      count: cards.length,
      apkgFileName,
      markdownFileName,
    };

    mkdirSync(exportDirectory, { recursive: true });
    const packageResult = await createAnkiPackage(sources.map(toAnkiSourceCard), {
      outputPath: path.join(exportDirectory, apkgFileName),
      deckName: '公考记忆卡::卡片库导出',
      now: generatedAt,
    });
    writeFileSync(path.join(exportDirectory, markdownFileName), packageResult.markdown, 'utf8');
    const metadata: StoredAnkiExport = {
      schemaVersion: EXPORT_SCHEMA_VERSION,
      ...summary,
      cards,
    };
    writeFileSync(
      path.join(exportDirectory, metadataFileName),
      `${JSON.stringify(metadata, null, 2)}\n`,
      'utf8',
    );

    return { status: 'created' as const, export: summary };
  }

  function list(): AnkiExportSummary[] {
    return readStoredExports(exportDirectory)
      .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
      .map(toSummary);
  }

  function get(exportId: string): AnkiExportDetail | undefined {
    if (!isSafeExportId(exportId)) return undefined;
    const stored = readStoredExports(exportDirectory).find((item) => item.id === exportId);
    if (!stored) return undefined;
    const { schemaVersion: _schemaVersion, ...detail } = stored;
    return detail;
  }

  function getApkgPath(exportId: string): string | undefined {
    if (!isSafeExportId(exportId)) return undefined;
    const detail = get(exportId);
    if (!detail || path.basename(detail.apkgFileName) !== detail.apkgFileName) return undefined;
    const apkgPath = path.join(exportDirectory, detail.apkgFileName);
    return existsSync(apkgPath) ? apkgPath : undefined;
  }

  return { create, list, get, getApkgPath };
}

function readStoredExports(exportDirectory: string): StoredAnkiExport[] {
  if (!existsSync(exportDirectory)) return [];
  return readdirSync(exportDirectory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .flatMap((entry) => {
      try {
        const value = JSON.parse(readFileSync(path.join(exportDirectory, entry.name), 'utf8')) as unknown;
        return isStoredAnkiExport(value) ? [value] : [];
      } catch {
        return [];
      }
    });
}

function isStoredAnkiExport(value: unknown): value is StoredAnkiExport {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  return item.schemaVersion === EXPORT_SCHEMA_VERSION
    && typeof item.id === 'string'
    && isSafeExportId(item.id)
    && typeof item.createdAt === 'string'
    && Number.isFinite(Date.parse(item.createdAt))
    && typeof item.count === 'number'
    && Number.isInteger(item.count)
    && item.count >= 0
    && isFileName(item.apkgFileName, '.apkg')
    && isFileName(item.markdownFileName, '.md')
    && Array.isArray(item.cards)
    && item.cards.length === item.count
    && item.cards.every(isAnkiExportCard);
}

function isAnkiExportCard(value: unknown): value is AnkiExportCard {
  if (!value || typeof value !== 'object') return false;
  const card = value as Record<string, unknown>;
  return typeof card.id === 'string'
    && typeof card.category === 'string'
    && typeof card.question === 'string'
    && typeof card.answer === 'string';
}

function isFileName(value: unknown, extension: string): value is string {
  return typeof value === 'string'
    && value.endsWith(extension)
    && path.basename(value) === value;
}

function isSafeExportId(value: string): boolean {
  return SAFE_EXPORT_ID.test(value);
}

function toSummary({
  id,
  createdAt,
  count,
  apkgFileName,
  markdownFileName,
}: StoredAnkiExport): AnkiExportSummary {
  return { id, createdAt, count, apkgFileName, markdownFileName };
}

function toExportCard(source: OriginalCardSource): AnkiExportCard {
  return {
    id: source.id,
    category: source.categories.map(({ name }) => name).filter(Boolean).join(' / ') || '未分类',
    question: source.quizQuestion,
    answer: source.rawInput,
  };
}

function toAnkiSourceCard(source: OriginalCardSource): AnkiSourceCard {
  return {
    id: source.id,
    categories: source.categories.map(({ name }) => name).filter(Boolean),
    rawContent: source.rawInput,
    question: source.quizQuestion,
    reviewHint: '请先独立回忆原始稿的核心观点、关键条件和易错点。',
    answer: source.rawInput,
  };
}

function localDateTimeLabel(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  const second = String(date.getSeconds()).padStart(2, '0');
  return `${year}${month}${day}-${hour}${minute}${second}`;
}
