import { afterAll, beforeAll, describe, expect, expectTypeOf, it } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import type { UserConfig } from 'vite';
import request from 'supertest';
import { readConfig } from '../../server/config';
import { createApp } from '../../server/app';
import type { CoachResponse } from '../../shared/contracts';

const originalCwd = process.cwd();
const testRoot = mkdtempSync(resolve(tmpdir(), 'gongkao-static-test-'));
const clientDir = resolve(testRoot, 'dist/client');

type ViteConfigFactory = (env: NodeJS.ProcessEnv) => UserConfig;

async function loadViteConfigFactory() {
  const viteConfigModule = await import('../../vite.config');
  const factory = Reflect.get(viteConfigModule, 'createViteConfig');

  expect(factory).toBeTypeOf('function');
  return factory as ViteConfigFactory;
}

function findProxyContext(proxy: NonNullable<UserConfig['server']>['proxy'], path: string) {
  return Object.keys(proxy ?? {}).find((context) => new RegExp(context).test(path));
}

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

describe('JSON 请求体', () => {
  it('解析不超过 2MB 的正常 JSON', async () => {
    const app = createApp();
    app.post('/api/test-json', (request, response) => {
      response.json(request.body);
    });

    const response = await request(app)
      .post('/api/test-json')
      .send({ content: '正常内容' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ content: '正常内容' });
  });

  it('拒绝超过 2MB 的 JSON', async () => {
    const response = await request(createApp())
      .post('/api/missing')
      .send({ content: 'x'.repeat(2 * 1024 * 1024) });

    expect(response.status).toBe(413);
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
    const apiRootResponse = await request(app).get('/api');
    const apiResponse = await request(app).get('/api/missing');
    const uploadRootResponse = await request(app).get('/uploads');
    const uploadResponse = await request(app).get('/uploads/missing');

    expect(apiRootResponse.status).toBe(404);
    expect(apiResponse.status).toBe(404);
    expect(uploadRootResponse.status).toBe(404);
    expect(uploadResponse.status).toBe(404);
  });

  it('相似前缀仍按前端路由回退', async () => {
    const app = createApp();
    const apiaryResponse = await request(app).get('/apiary');
    const uploadsOldResponse = await request(app).get('/uploads-old');

    expect(apiaryResponse.status).toBe(200);
    expect(apiaryResponse.text).toContain('公考记忆卡');
    expect(uploadsOldResponse.status).toBe(200);
    expect(uploadsOldResponse.text).toContain('公考记忆卡');
  });

  it('大写 API 与上传地址不返回前端入口页面', async () => {
    const app = createApp();
    const apiResponse = await request(app).get('/API/missing');
    const uploadResponse = await request(app).get('/UPLOADS/missing');

    expect(apiResponse.status).toBe(404);
    expect(uploadResponse.status).toBe(404);
  });
});

describe('Vite 开发代理', () => {
  it('使用服务端配置端口生成 API 与上传代理目标', async () => {
    const createViteConfig = await loadViteConfigFactory();
    const proxy = createViteConfig({ PORT: '9123' }).server?.proxy;
    const apiContext = findProxyContext(proxy, '/api');
    const uploadContext = findProxyContext(proxy, '/uploads');

    expect(apiContext).toBeDefined();
    expect(uploadContext).toBeDefined();
    expect(proxy?.[apiContext!]).toBe('http://127.0.0.1:9123');
    expect(proxy?.[uploadContext!]).toBe('http://127.0.0.1:9123');
  });

  it('代理正则大小写不敏感且不匹配相似前缀', async () => {
    const createViteConfig = await loadViteConfigFactory();
    const proxy = createViteConfig({ PORT: '9123' }).server?.proxy;
    const apiContext = findProxyContext(proxy, '/api');
    const uploadContext = findProxyContext(proxy, '/uploads');

    expect(apiContext?.startsWith('^')).toBe(true);
    expect(uploadContext?.startsWith('^')).toBe(true);

    const apiPattern = new RegExp(apiContext!);
    const uploadPattern = new RegExp(uploadContext!);

    expect(apiPattern.test('/api')).toBe(true);
    expect(apiPattern.test('/api/cards')).toBe(true);
    expect(apiPattern.test('/API')).toBe(true);
    expect(apiPattern.test('/API/cards')).toBe(true);
    expect(apiPattern.test('/apiary')).toBe(false);
    expect(uploadPattern.test('/uploads')).toBe(true);
    expect(uploadPattern.test('/uploads/image.png')).toBe(true);
    expect(uploadPattern.test('/UPLOADS')).toBe(true);
    expect(uploadPattern.test('/UPLOADS/image.png')).toBe(true);
    expect(uploadPattern.test('/uploads-old')).toBe(false);
  });

  it('代理正则匹配带查询参数的根路径', async () => {
    const createViteConfig = await loadViteConfigFactory();
    const proxy = createViteConfig({ PORT: '9123' }).server?.proxy;
    const apiContext = findProxyContext(proxy, '/api');
    const uploadContext = findProxyContext(proxy, '/uploads');

    expect(new RegExp(apiContext!).test('/api?x=1')).toBe(true);
    expect(new RegExp(uploadContext!).test('/uploads?download=1')).toBe(true);
  });
});

describe('应用配置', () => {
  it('读取默认配置并限制 DeepSeek 模型', () => {
    expect(readConfig({})).toEqual({
      host: '127.0.0.1',
      port: 8787,
      dataDir: resolve(testRoot, 'data'),
      deepseek: {
        baseUrl: 'https://api.deepseek.com',
        model: 'deepseek-v4-flash',
        apiKey: '',
      },
      anki: {
        outputDirectory: resolve(testRoot, 'output/anki'),
        ccConnectCommand: 'cc-connect',
        ccConnectDataDirectory: undefined,
      },
      coach: {
        huashengMcpUrl: 'http://127.0.0.1:8000/sse',
        zhangGongSkillDirectory: undefined,
        tavilyApiKey: '',
      },
    });

    expect(() => readConfig({ DEEPSEEK_MODEL: 'other-model' })).toThrow();
  });

  it('支持通过 HOST 配置服务监听地址', () => {
    expect(readConfig({ HOST: '0.0.0.0' }).host).toBe('0.0.0.0');
  });

  it('读取 cc-connect 数据目录配置', () => {
    expect(readConfig({ CC_CONNECT_DATA_DIR: 'D:\\cc-connect\\cc-connect-data' }).anki.ccConnectDataDirectory)
      .toBe(resolve('D:\\cc-connect\\cc-connect-data'));
  });

  it('读取 AI 公考教练显式配置', () => {
    expect(readConfig({
      HUASHENG_MCP_URL: 'https://coach.example.com/sse',
      ZHANG_GONG_SKILL_DIR: './skills/zhang-gong',
      TAVILY_API_KEY: 'test-tavily-key',
    }).coach).toEqual({
      huashengMcpUrl: 'https://coach.example.com/sse',
      zhangGongSkillDirectory: resolve(testRoot, 'skills/zhang-gong'),
      tavilyApiKey: 'test-tavily-key',
    });
  });

  it('限制花生 MCP 为 HTTP 传输并规范化教练配置空白', () => {
    for (const huashengMcpUrl of [
      'ftp://coach.example.com/sse',
      'file:///tmp/coach',
      'mailto:test@example.com',
    ]) {
      expect(() => readConfig({ HUASHENG_MCP_URL: huashengMcpUrl })).toThrow();
    }

    expect(readConfig({
      HUASHENG_MCP_URL: '  https://coach.example.com/sse  ',
      ZHANG_GONG_SKILL_DIR: '   ',
      TAVILY_API_KEY: '  test-key  ',
    }).coach).toEqual({
      huashengMcpUrl: 'https://coach.example.com/sse',
      zhangGongSkillDirectory: undefined,
      tavilyApiKey: 'test-key',
    });
  });

  it('在共享契约中锁定模块与老师来源', () => {
    type VerbalResponse = Extract<CoachResponse, { resolvedModule: 'verbal' }>;
    type NonVerbalResponse = Exclude<CoachResponse, { resolvedModule: 'verbal' }>;

    expectTypeOf<VerbalResponse['teacher']>().toEqualTypeOf<'zhang_gong'>();
    expectTypeOf<VerbalResponse['methodReferences'][number]['source']>()
      .toEqualTypeOf<'zhang_gong'>();
    expectTypeOf<NonVerbalResponse['teacher']>().toEqualTypeOf<'huasheng13'>();
    expectTypeOf<NonVerbalResponse['methodReferences'][number]['source']>()
      .toEqualTypeOf<'huasheng13'>();
  });
});
