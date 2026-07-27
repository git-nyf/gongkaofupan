import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../../server/app';
import { createTestDatabase } from '../helpers/testDatabase';

type TestDatabase = ReturnType<typeof createTestDatabase>;

describe('非敏感设置接口', () => {
  const databases: TestDatabase[] = [];

  afterEach(() => {
    databases.splice(0).forEach((database) => database.dispose());
  });

  function setup(apiKey = '') {
    const database = createTestDatabase();
    databases.push(database);
    const settings = {
      database: database.manager,
      deepseekApiKey: apiKey,
      isQqMusicAvailable: (path: string) => path === 'C:\\Apps\\QQMusic.exe',
    };
    return { database, settings, app: createApp({ settings }) };
  }

  it('返回默认背诵偏好和仅表示密钥非空的配置状态', async () => {
    const configured = setup('  sk-test  ');
    const missing = setup('   ');

    const configuredResponse = await request(configured.app).get('/api/settings');
    const missingResponse = await request(missing.app).get('/api/settings');

    expect(configuredResponse.status).toBe(200);
    expect(configuredResponse.body).toEqual({
      defaultSessionSize: 20,
      defaultOrder: 'random',
      dueFirst: true,
      defaultFocusMinutes: 25,
      qqMusicPath: '',
      qqMusicAvailable: false,
      deepseekConfigured: true,
    });
    expect(missingResponse.body.deepseekConfigured).toBe(false);
    expect(JSON.stringify(configuredResponse.body)).not.toMatch(/DEEPSEEK_API_KEY|sk-/i);
  });

  it('PATCH 只更新明确提供的字段并持久化到现有键值表', async () => {
    const { database, settings, app } = setup('local-key');

    const first = await request(app)
      .patch('/api/settings')
      .send({
        defaultSessionSize: 30,
        defaultFocusMinutes: 45,
        qqMusicPath: 'C:\\Apps\\QQMusic.exe',
      });
    const second = await request(app)
      .patch('/api/settings')
      .send({ defaultOrder: 'fixed', dueFirst: false });
    const reloaded = await request(createApp({ settings })).get('/api/settings');

    expect(first.body).toEqual({
      defaultSessionSize: 30,
      defaultOrder: 'random',
      dueFirst: true,
      defaultFocusMinutes: 45,
      qqMusicPath: 'C:\\Apps\\QQMusic.exe',
      qqMusicAvailable: true,
      deepseekConfigured: true,
    });
    expect(second.body).toEqual({
      defaultSessionSize: 30,
      defaultOrder: 'fixed',
      dueFirst: false,
      defaultFocusMinutes: 45,
      qqMusicPath: 'C:\\Apps\\QQMusic.exe',
      qqMusicAvailable: true,
      deepseekConfigured: true,
    });
    expect(reloaded.body).toEqual(second.body);
    expect(
      database.db.prepare('SELECT key, value_json FROM app_settings ORDER BY key').all(),
    ).toEqual([
      { key: 'defaultFocusMinutes', value_json: '45' },
      { key: 'defaultOrder', value_json: '"fixed"' },
      { key: 'defaultSessionSize', value_json: '30' },
      { key: 'dueFirst', value_json: 'false' },
      { key: 'qqMusicPath', value_json: '"C:\\\\Apps\\\\QQMusic.exe"' },
    ]);
  });

  it('严格拒绝空补丁、未知字段和非法值且不写入密钥', async () => {
    const { database, app } = setup('private-local-key');
    const invalidBodies = [
      {},
      { defaultSessionSize: 0 },
      { defaultSessionSize: 101 },
      { defaultSessionSize: 1.5 },
      { defaultOrder: 'sql-random' },
      { dueFirst: 'true' },
      { defaultFocusMinutes: 10 },
      { defaultFocusMinutes: 60 },
      { qqMusicPath: 'QQMusic.exe' },
      { qqMusicPath: '\\\\server\\share\\QQMusic.exe' },
      { qqMusicPath: 'C:\\Apps\\notepad.exe' },
      { DEEPSEEK_API_KEY: 'sk-test' },
      { defaultSessionSize: 10, extra: true },
    ];

    for (const body of invalidBodies) {
      const response = await request(app).patch('/api/settings').send(body);
      expect(response.status).toBe(400);
      expect(response.body).toEqual({ code: 'invalid_request', message: expect.any(String) });
      expect(JSON.stringify(response.body)).not.toMatch(/private-local-key|sk-test|SQL/i);
    }
    expect(database.db.prepare('SELECT * FROM app_settings').all()).toEqual([]);
  });

  it.each([
    ['非法枚举', '"sql-random"'],
    ['损坏 JSON', '{broken'],
  ])('完整响应读取遇到%s时回滚本次设置修改', async (_caseName, corruptValue) => {
    const { database, app } = setup();
    database.db
      .prepare('INSERT INTO app_settings (key, value_json) VALUES (?, ?)')
      .run('dueFirst', 'true');
    database.db
      .prepare('INSERT INTO app_settings (key, value_json) VALUES (?, ?)')
      .run('defaultOrder', corruptValue);

    const response = await request(app).patch('/api/settings').send({ dueFirst: false });

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ code: 'internal_error', message: expect.any(String) });
    expect(
      database.db.prepare("SELECT value_json FROM app_settings WHERE key = 'dueFirst'").get(),
    ).toEqual({ value_json: 'true' });
  });

  it('未装配设置依赖时接口不存在', async () => {
    expect((await request(createApp()).get('/api/settings')).status).toBe(404);
    expect((await request(createApp()).patch('/api/settings').send({ dueFirst: false })).status).toBe(
      404,
    );
  });
});
