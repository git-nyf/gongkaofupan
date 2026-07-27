import { EventEmitter } from 'node:events';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { ChildProcess } from 'node:child_process';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../server/app';
import {
  createProcessLauncher,
  createQqMusicService,
  isAllowedQqMusicPath,
} from '../../server/localApps/qqMusic';
import { createTestDatabase } from '../helpers/testDatabase';

type TestDatabase = ReturnType<typeof createTestDatabase>;

describe('受控 QQ 音乐入口', () => {
  const databases: TestDatabase[] = [];

  afterEach(() => {
    databases.splice(0).forEach((database) => database.dispose());
  });

  function setup(options: { configured?: boolean; launch?: (path: string) => Promise<void> } = {}) {
    const database = createTestDatabase();
    databases.push(database);
    const executablePath = resolve(database.directory, 'QQMusic.exe');
    if (options.configured !== false) {
      writeFileSync(executablePath, 'test executable placeholder');
      database.db
        .prepare('INSERT INTO app_settings (key, value_json) VALUES (?, ?)')
        .run('qqMusicPath', JSON.stringify(executablePath));
    }
    const launch = options.launch ?? vi.fn().mockResolvedValue(undefined);
    const qqMusicService = createQqMusicService({
      env: {},
      launch,
    });
    const app = createApp({
      localApps: { database: database.manager, qqMusicService },
    });
    return { app, database, executablePath, launch };
  }

  it('只允许本机盘符绝对路径且文件名必须为 QQMusic.exe', () => {
    expect(isAllowedQqMusicPath('C:\\Program Files\\Tencent\\QQMusic\\QQMusic.exe')).toBe(true);
    expect(isAllowedQqMusicPath('d:/Apps/QQMusic.exe')).toBe(true);
    expect(isAllowedQqMusicPath('D:\\QQ音乐\\QQMusic\\QQMusic.exe')).toBe(true);
    expect(isAllowedQqMusicPath('QQMusic.exe')).toBe(false);
    expect(isAllowedQqMusicPath('C:QQMusic.exe')).toBe(false);
    expect(isAllowedQqMusicPath('\\\\server\\share\\QQMusic.exe')).toBe(false);
    expect(isAllowedQqMusicPath('C:\\Apps\\notepad.exe')).toBe(false);
    expect(isAllowedQqMusicPath('C:\\Apps\\QQMusic.exe --flag')).toBe(false);
  });

  it('默认启动器固定使用零参数、隐藏窗口且禁用 shell', async () => {
    const child = Object.assign(new EventEmitter(), { unref: vi.fn() }) as unknown as ChildProcess;
    const spawnProcess = vi.fn(() => {
      queueMicrotask(() => child.emit('spawn'));
      return child;
    });
    const launch = createProcessLauncher(spawnProcess as never);

    await launch('C:\\Apps\\QQMusic.exe');

    expect(spawnProcess).toHaveBeenCalledWith('C:\\Apps\\QQMusic.exe', [], {
      detached: true,
      shell: false,
      stdio: 'ignore',
      windowsHide: true,
    });
    expect(child.unref).toHaveBeenCalledTimes(1);
  });

  it('优先使用有效配置路径，并可在常见安装目录中受控检测', async () => {
    const database = createTestDatabase();
    databases.push(database);
    const commonDirectory = resolve(database.directory, 'Tencent', 'QQMusic');
    mkdirSync(commonDirectory, { recursive: true });
    const commonPath = resolve(commonDirectory, 'QQMusic.exe');
    writeFileSync(commonPath, 'test executable placeholder');
    const launch = vi.fn().mockResolvedValue(undefined);
    const service = createQqMusicService({
      env: { ProgramFiles: database.directory },
      launch,
    });

    expect(service.isAvailable('')).toBe(true);
    await service.open('');
    expect(launch).toHaveBeenCalledWith(commonPath);
  });

  it('目录即使命名为 QQMusic.exe 也不能作为可执行文件', () => {
    const database = createTestDatabase();
    databases.push(database);
    const directoryPath = resolve(database.directory, 'QQMusic.exe');
    mkdirSync(directoryPath);
    const service = createQqMusicService({ env: {}, launch: vi.fn() });

    expect(service.isAvailable(directoryPath)).toBe(false);
  });

  it('固定 POST 端点只读取服务端配置并以零请求参数启动', async () => {
    const { app, executablePath, launch } = setup();

    const response = await request(app)
      .post('/api/local-apps/qq-music/open')
      .set('Content-Type', 'application/json')
      .send({});

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ opened: true });
    expect(launch).toHaveBeenCalledWith(executablePath);
  });

  it('允许请求主机完全一致的本机 Origin，未装配依赖时端点不存在', async () => {
    const { app, launch } = setup();
    const response = await request(app)
      .post('/api/local-apps/qq-music/open')
      .set('Host', '127.0.0.1:8787')
      .set('Origin', 'http://127.0.0.1:8787')
      .set('Content-Type', 'application/json')
      .send({});

    expect(response.status).toBe(200);
    expect(launch).toHaveBeenCalledTimes(1);
    expect(
      (await request(createApp())
        .post('/api/local-apps/qq-music/open')
        .set('Content-Type', 'application/json')
        .send({})).status,
    ).toBe(404);
  });

  it('拒绝请求体参数、查询参数和跨站来源', async () => {
    const { app, launch } = setup();
    const withBody = await request(app)
      .post('/api/local-apps/qq-music/open')
      .set('Content-Type', 'application/json')
      .send({ path: 'C:\\Apps\\QQMusic.exe' });
    const withQuery = await request(app)
      .post('/api/local-apps/qq-music/open?path=C%3A%5CApps%5CQQMusic.exe')
      .set('Content-Type', 'application/json')
      .send({});
    const crossSite = await request(app)
      .post('/api/local-apps/qq-music/open')
      .set('Content-Type', 'application/json')
      .set('Sec-Fetch-Site', 'cross-site')
      .send({});
    const foreignOrigin = await request(app)
      .post('/api/local-apps/qq-music/open')
      .set('Content-Type', 'application/json')
      .set('Origin', 'https://example.com')
      .send({});

    for (const response of [withBody, withQuery, crossSite, foreignOrigin]) {
      expect(response.status).toBe(400);
      expect(response.body).toEqual({ code: 'invalid_request', message: '请求参数不合法' });
    }
    expect(launch).not.toHaveBeenCalled();
  });

  it('未检测到程序和启动失败时返回稳定提示且不泄露路径或异常', async () => {
    const missing = setup({ configured: false });
    const failed = setup({ launch: vi.fn().mockRejectedValue(new Error('private process detail')) });
    const missingResponse = await request(missing.app)
      .post('/api/local-apps/qq-music/open')
      .set('Content-Type', 'application/json')
      .send({});
    const failedResponse = await request(failed.app)
      .post('/api/local-apps/qq-music/open')
      .set('Content-Type', 'application/json')
      .send({});

    expect(missingResponse.status).toBe(404);
    expect(missingResponse.body).toEqual({
      code: 'qq_music_not_found',
      message: '请在设置中填写 QQMusic.exe 路径',
    });
    expect(failedResponse.status).toBe(500);
    expect(failedResponse.body).toEqual({
      code: 'qq_music_launch_failed',
      message: 'QQ 音乐启动失败，请检查配置后重试',
    });
    expect(JSON.stringify(failedResponse.body)).not.toMatch(/private process detail|QQMusic\.exe/i);
  });
});
