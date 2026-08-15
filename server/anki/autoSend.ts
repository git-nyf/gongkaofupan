import { randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';
import type { DailyAnkiService } from './daily';

const LAST_SENT_KEY = 'anki_last_successful_send_at';
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

export type AutoSendStatus = 'sent' | 'skipped_recent' | 'empty' | 'send_failed';

export interface AnkiAutoSendDatabase {
  get(): Database.Database;
}

export interface AnkiAutoSendDependencies {
  database: AnkiAutoSendDatabase;
  dailyService: Pick<DailyAnkiService, 'generateAndSend'>;
  now?: () => Date;
  id?: () => string;
}

export interface AnkiAutoSendResult {
  status: AutoSendStatus;
  checkedAt: string;
}

export interface AnkiAutoSendService {
  check(): Promise<AnkiAutoSendResult>;
}

export function createAnkiAutoSendService({
  database,
  dailyService,
  now = () => new Date(),
  id = defaultShortId,
}: AnkiAutoSendDependencies): AnkiAutoSendService {
  let inFlight: Promise<AnkiAutoSendResult> | undefined;

  function check(): Promise<AnkiAutoSendResult> {
    if (inFlight) return inFlight;

    const pending = runCheck().finally(() => {
      if (inFlight === pending) inFlight = undefined;
    });
    inFlight = pending;
    return pending;
  }

  async function runCheck(): Promise<AnkiAutoSendResult> {
    const checkedAtDate = now();
    const checkedAt = checkedAtDate.toISOString();
    const lastSuccessfulSendAt = readLastSuccessfulSendAt(database.get());
    const age = lastSuccessfulSendAt === undefined
      ? undefined
      : checkedAtDate.getTime() - lastSuccessfulSendAt;
    if (
      age !== undefined
      && age >= 0
      && age < TWENTY_FOUR_HOURS_MS
    ) {
      return { status: 'skipped_recent', checkedAt };
    }

    let result: Awaited<ReturnType<DailyAnkiService['generateAndSend']>>;
    try {
      result = await dailyService.generateAndSend(3, {
        filePrefix: `auto-review-${localDateTimeLabel(checkedAtDate)}-${safeShortId(id())}`,
      });
    } catch {
      return { status: 'send_failed', checkedAt };
    }

    if (result.status === 'empty') return { status: 'empty', checkedAt };
    if (!result.sent) return { status: 'send_failed', checkedAt };

    writeLastSuccessfulSendAt(database.get(), checkedAt);
    return { status: 'sent', checkedAt };
  }

  return { check };
}

function defaultShortId(): string {
  return randomUUID().replace(/-/g, '').slice(0, 8);
}

function safeShortId(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9_-]+/g, '').slice(0, 8) || defaultShortId();
}

function readLastSuccessfulSendAt(database: Database.Database): number | undefined {
  const row = database
    .prepare('SELECT value_json FROM app_settings WHERE key = ?')
    .get(LAST_SENT_KEY) as { value_json: string } | undefined;
  if (!row) return undefined;

  try {
    const value: unknown = JSON.parse(row.value_json);
    if (typeof value !== 'string') return undefined;
    const timestamp = Date.parse(value);
    return Number.isNaN(timestamp) ? undefined : timestamp;
  } catch {
    return undefined;
  }
}

function writeLastSuccessfulSendAt(database: Database.Database, value: string) {
  database.prepare(`
    INSERT INTO app_settings (key, value_json) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json
  `).run(LAST_SENT_KEY, JSON.stringify(value));
}

function localDateTimeLabel(date: Date): string {
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  const second = String(date.getSeconds()).padStart(2, '0');
  return `${year}${month}${day}-${hour}${minute}${second}`;
}
