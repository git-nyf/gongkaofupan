import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import request from 'supertest';
import { readConfig } from '../../server/config';
import { createApp } from '../../server/app';

const originalCwd = process.cwd();
const testRoot = resolve(originalCwd, '.tmp/static-test');
const clientDir = resolve(testRoot, 'dist/client');

beforeAll(() => {
  mkdirSync(clientDir, { recursive: true });
  writeFileSync(resolve(clientDir, 'index.html'), '<h1>公考记忆卡</h1>');
  process.chdir(testRoot);
});

afterAll(() => {
  process.chdir(originalCwd);
  rmSync(testRoot, { recursive: true, force: true });
});

describe('健康检查接口', () => {
  it('GET /api/health 返回服务正常状态', async () => {
    const response = await request(createApp()).get('/api/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
  });
});

describe('生产前端静态服务', () => {
  it('前端路由返回构建后的入口页面', async () => {
    const response = await request(createApp()).get('/cards/1');

    expect(response.status).toBe(200);
    expect(response.text).toContain('公考记忆卡');
  });

  it('未知 API 与上传地址不返回前端入口页面', async () => {
    const app = createApp();
    const apiResponse = await request(app).get('/api/missing');
    const uploadResponse = await request(app).get('/uploads/missing');

    expect(apiResponse.status).toBe(404);
    expect(uploadResponse.status).toBe(404);
  });
});

describe('应用配置', () => {
  it('读取默认配置并限制 DeepSeek 模型', () => {
    expect(readConfig({})).toEqual({
      port: 8787,
      dataDir: './data',
      deepseek: {
        baseUrl: 'https://api.deepseek.com',
        model: 'v4-flash',
        apiKey: '',
      },
    });

    expect(() => readConfig({ DEEPSEEK_MODEL: 'other-model' })).toThrow();
  });
});
