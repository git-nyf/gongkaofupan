import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type Database from 'better-sqlite3';
import { createAnkiPackage } from './apkg';
import { selectOriginalCards, selectRandomOriginalCards, type OriginalCardSource } from './source';
import type { AnkiSourceCard } from './markdown';

export interface DailyAnkiDatabase {
  get(): Database.Database;
}

export interface DailyAnkiSendInput {
  apkgPath: string;
  markdownPath: string;
  message: string;
}

export interface DailyAnkiSendResult {
  ok: boolean;
  code?: string;
  error?: string;
  stderr?: string;
}

export type DailyAnkiSender = (input: DailyAnkiSendInput) => Promise<DailyAnkiSendResult>;

export interface DailyAnkiServiceDependencies {
  database: DailyAnkiDatabase;
  outputDirectory: string;
  sender?: DailyAnkiSender;
  now?: () => Date;
  random?: () => number;
}

export interface DailyAnkiResult {
  status: 'generated' | 'empty';
  count: number;
  markdownPath: string;
  apkgPath: string;
  cardIds: string[];
  sent: boolean;
  sendResult?: DailyAnkiSendResult;
}

export interface DailyAnkiGenerateOptions {
  filePrefix?: string;
  cardIds?: readonly string[];
}

export interface DailyAnkiService {
  generate(count?: number, options?: DailyAnkiGenerateOptions): Promise<DailyAnkiResult>;
  generateAndSend(count?: number, options?: DailyAnkiGenerateOptions): Promise<DailyAnkiResult>;
}

export function createDailyAnkiService({
  database,
  outputDirectory,
  sender,
  now = () => new Date(),
  random = Math.random,
}: DailyAnkiServiceDependencies): DailyAnkiService {
  const outputDir = path.resolve(outputDirectory);

  async function generate(
    count = 10,
    options: DailyAnkiGenerateOptions = {},
  ): Promise<DailyAnkiResult> {
    const generatedAt = now();
    const sources = options.cardIds
      ? selectOriginalCards(database.get(), {
        cardIds: options.cardIds,
        limit: count,
        now: () => generatedAt,
      })
      : selectRandomOriginalCards(database.get(), {
        limit: count,
        random,
        now: () => generatedAt,
      });
    if (sources.length === 0) {
      return {
        status: 'empty',
        count: 0,
        markdownPath: '',
        apkgPath: '',
        cardIds: [],
        sent: false,
      };
    }

    mkdirSync(outputDir, { recursive: true });
    const filePrefix = safeFilePrefix(options.filePrefix, generatedAt);
    const markdownPath = path.join(outputDir, `${filePrefix}.md`);
    const apkgPath = path.join(outputDir, `${filePrefix}.apkg`);
    const cards = sources.map(toAnkiSourceCard);
    const packageResult = await createAnkiPackage(cards, {
      outputPath: apkgPath,
      deckName: '公考记忆卡::每日初始稿复习',
      now: generatedAt,
    });
    writeFileSync(markdownPath, packageResult.markdown, 'utf8');

    return {
      status: 'generated',
      count: cards.length,
      markdownPath,
      apkgPath,
      cardIds: sources.map((source) => source.id),
      sent: false,
    };
  }

  async function generateAndSend(
    count = 10,
    options: DailyAnkiGenerateOptions = {},
  ): Promise<DailyAnkiResult> {
    const result = await generate(count, options);
    if (result.status === 'empty' || !sender) return result;

    const sendResult = await sender({
      apkgPath: result.apkgPath,
      markdownPath: result.markdownPath,
      message: `今日已生成 ${result.count} 张用户初始稿 Anki 复习卡。`,
    });
    return { ...result, sent: sendResult.ok, sendResult };
  }

  return { generate, generateAndSend };
}

function safeFilePrefix(filePrefix: string | undefined, generatedAt: Date): string {
  const dailyPrefix = `daily-review-${localDateLabel(generatedAt)}`;
  if (filePrefix === undefined) return dailyPrefix;

  const baseName = path.posix.basename(path.win32.basename(filePrefix.trim()));
  return baseName
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '') || dailyPrefix;
}

function localDateLabel(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function toAnkiSourceCard(source: OriginalCardSource): AnkiSourceCard {
  const categories = source.categories.map(({ name }) => name).filter(Boolean);
  return {
    id: source.id,
    categories,
    rawContent: source.rawInput,
    question: source.quizQuestion,
    reviewHint: '请先独立回忆原始稿的核心观点、关键条件和易错点。',
    answer: source.rawInput,
  };
}
