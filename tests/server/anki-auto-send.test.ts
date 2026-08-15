import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAnkiAutoSendService } from '../../server/anki/autoSend';
import { createTestDatabase } from '../helpers/testDatabase';

const LAST_SENT_KEY = 'anki_last_successful_send_at';

describe('Anki 启动自动发送', () => {
  const resources: Array<ReturnType<typeof createTestDatabase>> = [];

  afterEach(() => {
    resources.splice(0).forEach((resource) => resource.dispose());
  });

  it('最近 24 小时已有成功记录时跳过发送', async () => {
    const resource = createTestDatabase();
    resources.push(resource);
    const now = new Date(2026, 7, 8, 9, 30, 45);
    writeLastSent(resource, new Date(now.getTime() - 23 * 60 * 60 * 1000).toISOString());
    const generateAndSend = vi.fn();
    const service = createAnkiAutoSendService({
      database: resource.manager,
      dailyService: { generateAndSend },
      now: () => now,
    });

    await expect(service.check()).resolves.toEqual({
      status: 'skipped_recent',
      checkedAt: now.toISOString(),
    });
    expect(generateAndSend).not.toHaveBeenCalled();
  });

  it.each([
    ['没有记录', undefined],
    ['JSON 已损坏', '{invalid-json'],
    ['记录不是有效时间', JSON.stringify('invalid-date')],
    ['记录刚好达到 24 小时', JSON.stringify('2026-08-07T09:30:45.000')],
    ['记录时间在未来', JSON.stringify('2026-08-08T10:30:45.000')],
  ])('%s 时发送三张并只在成功后写入当前时间', async (_label, storedValue) => {
    const resource = createTestDatabase();
    resources.push(resource);
    const now = new Date(2026, 7, 8, 9, 30, 45);
    if (storedValue !== undefined) writeRawSetting(resource, storedValue);
    const generateAndSend = vi.fn().mockResolvedValue(generatedResult(true));
    const service = createAnkiAutoSendService({
      database: resource.manager,
      dailyService: { generateAndSend },
      now: () => now,
      id: () => 'a1b2c3d4',
    });

    await expect(service.check()).resolves.toEqual({
      status: 'sent',
      checkedAt: now.toISOString(),
    });
    expect(generateAndSend).toHaveBeenCalledWith(3, {
      filePrefix: 'auto-review-20260808-093045-a1b2c3d4',
    });
    expect(readRawSetting(resource)).toBe(JSON.stringify(now.toISOString()));
  });

  it('没有可发送卡片时返回 empty 且不写成功时间', async () => {
    const resource = createTestDatabase();
    resources.push(resource);
    const now = new Date(2026, 7, 8, 9, 30, 45);
    const generateAndSend = vi.fn().mockResolvedValue(emptyResult());
    const service = createAnkiAutoSendService({
      database: resource.manager,
      dailyService: { generateAndSend },
      now: () => now,
    });

    await expect(service.check()).resolves.toEqual({
      status: 'empty',
      checkedAt: now.toISOString(),
    });
    expect(readRawSetting(resource)).toBeUndefined();
  });

  it.each([
    ['发送器返回未发送', () => vi.fn().mockResolvedValue(generatedResult(false))],
    ['发送过程抛错', () => vi.fn().mockRejectedValue(new Error('send failed'))],
  ])('%s 时稳定返回 send_failed 且不写成功时间', async (_label, createGenerateAndSend) => {
    const resource = createTestDatabase();
    resources.push(resource);
    const now = new Date(2026, 7, 8, 9, 30, 45);
    const generateAndSend = createGenerateAndSend();
    const service = createAnkiAutoSendService({
      database: resource.manager,
      dailyService: { generateAndSend },
      now: () => now,
    });

    await expect(service.check()).resolves.toEqual({
      status: 'send_failed',
      checkedAt: now.toISOString(),
    });
    expect(generateAndSend).toHaveBeenCalledWith(3, {
      filePrefix: expect.stringMatching(/^auto-review-20260808-093045-[a-f0-9]{8}$/),
    });
    expect(readRawSetting(resource)).toBeUndefined();
  });

  it('同一秒内完成的连续检查使用不同短编号，避免覆盖前一次自动文件', async () => {
    const resource = createTestDatabase();
    resources.push(resource);
    const now = new Date(2026, 7, 8, 9, 30, 45);
    const ids = ['first001', 'second02'];
    const generateAndSend = vi.fn().mockResolvedValue(generatedResult(false));
    const service = createAnkiAutoSendService({
      database: resource.manager,
      dailyService: { generateAndSend },
      now: () => now,
      id: () => ids.shift()!,
    });

    await service.check();
    await service.check();

    expect(generateAndSend).toHaveBeenNthCalledWith(1, 3, {
      filePrefix: 'auto-review-20260808-093045-first001',
    });
    expect(generateAndSend).toHaveBeenNthCalledWith(2, 3, {
      filePrefix: 'auto-review-20260808-093045-second02',
    });
  });

  it('合并同一进程中的并发检查为同一个 Promise', async () => {
    const resource = createTestDatabase();
    resources.push(resource);
    const now = new Date(2026, 7, 8, 9, 30, 45);
    let finishSend!: (result: ReturnType<typeof generatedResult>) => void;
    const pendingSend = new Promise<ReturnType<typeof generatedResult>>((resolve) => {
      finishSend = resolve;
    });
    const generateAndSend = vi.fn().mockReturnValue(pendingSend);
    const service = createAnkiAutoSendService({
      database: resource.manager,
      dailyService: { generateAndSend },
      now: () => now,
    });

    const first = service.check();
    const second = service.check();

    expect(first).toBe(second);
    expect(generateAndSend).toHaveBeenCalledTimes(1);
    finishSend(generatedResult(true));
    await expect(Promise.all([first, second])).resolves.toEqual([
      { status: 'sent', checkedAt: now.toISOString() },
      { status: 'sent', checkedAt: now.toISOString() },
    ]);
    await expect(service.check()).resolves.toEqual({
      status: 'skipped_recent',
      checkedAt: now.toISOString(),
    });
    expect(generateAndSend).toHaveBeenCalledTimes(1);
  });

  it('数据库异常继续抛出给启动层处理', async () => {
    const generateAndSend = vi.fn();
    const service = createAnkiAutoSendService({
      database: {
        get() {
          throw new Error('database unavailable');
        },
      },
      dailyService: { generateAndSend },
    });

    await expect(service.check()).rejects.toThrow('database unavailable');
    expect(generateAndSend).not.toHaveBeenCalled();
  });
});

function generatedResult(sent: boolean) {
  return {
    status: 'generated' as const,
    count: 1,
    markdownPath: 'auto.md',
    apkgPath: 'auto.apkg',
    cardIds: ['card-1'],
    sent,
  };
}

function emptyResult() {
  return {
    status: 'empty' as const,
    count: 0,
    markdownPath: '',
    apkgPath: '',
    cardIds: [],
    sent: false,
  };
}

function writeLastSent(resource: ReturnType<typeof createTestDatabase>, value: string) {
  writeRawSetting(resource, JSON.stringify(value));
}

function writeRawSetting(resource: ReturnType<typeof createTestDatabase>, valueJson: string) {
  resource.db
    .prepare('INSERT INTO app_settings (key, value_json) VALUES (?, ?)')
    .run(LAST_SENT_KEY, valueJson);
}

function readRawSetting(resource: ReturnType<typeof createTestDatabase>) {
  const row = resource.db
    .prepare('SELECT value_json FROM app_settings WHERE key = ?')
    .get(LAST_SENT_KEY) as { value_json: string } | undefined;
  return row?.value_json;
}
