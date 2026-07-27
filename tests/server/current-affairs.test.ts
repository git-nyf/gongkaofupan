import express from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createCurrentAffairsRouter } from '../../server/currentAffairs/routes';
import {
  createCurrentAffairsService,
  type CurrentAffairsResponse,
} from '../../server/currentAffairs/service';

const fixedNow = new Date('2026-07-20T12:00:00.000Z');

function xinhuaHtml(count = 8) {
  const validLinks = Array.from({ length: count }, (_, index) => `
    <article class="news-item">
      <a href="https://www.news.cn/politics/20260720/${String(index + 1).padStart(2, '0')}/c.html">
        <span>时政新闻标题第${index + 1}条：持续增进民生福祉</span>
      </a>
      <time>2026-07-20 ${String(8 + index).padStart(2, '0')}:30</time>
    </article>
  `).join('');

  return `
    <html><body>
      ${validLinks}
      <a href="http://www.news.cn/politics/insecure/c.html">非 HTTPS 链接应被过滤</a>
      <a href="https://example.com/politics/fake.html">站外链接应被过滤</a>
      <a href="https://www.news.cn/politics/empty.html">   </a>
      <a href="https://www.news.cn/politics/20260720/01/c.html">重复链接应被过滤</a>
      <a href="https://www.news.cn/zt/example/index.html">专题导航应被过滤</a>
    </body></html>
  `;
}

function articleListHtml(titles: string[]) {
  return titles.map((title, index) => `
    <article>
      <a href="https://www.news.cn/politics/20260720/${String(index + 101).padStart(3, '0')}/c.html">${title}</a>
      <time>2026-07-20 10:${String(index).padStart(2, '0')}</time>
    </article>
  `).join('');
}

function expectStableContract(result: CurrentAffairsResponse) {
  expect(result).toEqual({
    updatedAt: expect.any(String),
    source: { name: '新华网', url: 'https://www.news.cn/politics/' },
    items: expect.any(Array),
    isFallback: expect.any(Boolean),
  });
  expect(Number.isNaN(Date.parse(result.updatedAt))).toBe(false);
  expect(result.items.length).toBeGreaterThanOrEqual(6);
  expect(result.items.length).toBeLessThanOrEqual(12);
  for (const item of result.items) {
    expect(item).toEqual({
      id: expect.any(String),
      title: expect.any(String),
      url: expect.any(String),
      publishedAt: expect.any(String),
      kind: expect.stringMatching(/^(news|quote)$/),
    });
    expect(item.title.trim()).not.toBe('');
    expect(Number.isNaN(Date.parse(item.publishedAt))).toBe(false);
  }
}

describe('总览实时权威资讯', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('从新华网时政页面筛选 6 至 12 条合法 HTTPS 新闻并去重', async () => {
    const fetchImpl = vi.fn(async () => new Response(xinhuaHtml(), { status: 200 }));
    const service = createCurrentAffairsService({
      fetchImpl,
      now: () => new Date(fixedNow),
    });

    const result = await service.getCurrentAffairs();

    expectStableContract(result);
    expect(result.isFallback).toBe(false);
    expect(result.items).toHaveLength(8);
    expect(result.items[0]).toMatchObject({
      title: '时政新闻标题第1条：持续增进民生福祉',
      url: 'https://www.news.cn/politics/20260720/01/c.html',
      publishedAt: '2026-07-20T08:30:00.000Z',
      kind: 'news',
    });
    expect(result.items.every(({ url }) => {
      const parsed = new URL(url);
      return parsed.protocol === 'https:'
        && (parsed.hostname === 'news.cn' || parsed.hostname.endsWith('.news.cn'));
    })).toBe(true);
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://www.news.cn/politics/',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it('十分钟内复用内存缓存，缓存到期后重新抓取', async () => {
    let currentTime = fixedNow.getTime();
    const fetchImpl = vi.fn(async () => new Response(xinhuaHtml(), { status: 200 }));
    const service = createCurrentAffairsService({
      fetchImpl,
      now: () => new Date(currentTime),
    });

    const first = await service.getCurrentAffairs();
    currentTime += 9 * 60 * 1000;
    const cached = await service.getCurrentAffairs();
    currentTime += 61 * 1000;
    const refreshed = await service.getCurrentAffairs();

    expect(cached).toBe(first);
    expect(refreshed).not.toBe(first);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('只保留命中公考主题的中央政策、经济民生和国际关系新闻', async () => {
    const relevantTitles = [
      '国务院常务会议研究促进就业政策',
      '中央发布乡村振兴五年规划',
      '教育部介绍教育改革最新进展',
      '全国生态环境保护工作会议召开',
      '一季度经济数据发布释放产业新动能',
      '中欧关系与全球治理论坛举行',
      '区域协调发展战略取得新成效',
      '防汛抗旱应急响应持续推进',
    ];
    const service = createCurrentAffairsService({
      fetchImpl: vi.fn(async () => new Response(articleListHtml(relevantTitles), { status: 200 })),
      now: () => new Date(fixedNow),
    });

    const result = await service.getCurrentAffairs();

    expect(result.isFallback).toBe(false);
    expect(result.items.map(({ title }) => title)).toEqual(relevantTitles);
  });

  it('即使命中主题词也排除娱乐体育、旅游促销和纯图片摄影内容', async () => {
    const relevantTitles = [
      '国务院部署民生保障重点工作',
      '新条例推动基层社会治理提质增效',
      '国家统计局发布最新经济数据',
      '科技创新政策支持先进制造业发展',
      '就业和社会保障公共服务持续完善',
      '中国与联合国加强全球发展合作',
    ];
    const unrelatedHtml = [
      '<a href="https://www.news.cn/ent/20260720/a/c.html">明星综艺节目带动消费增长</a>',
      '<a href="https://www.news.cn/sports/20260720/b/c.html">体育赛事助力区域发展</a>',
      '<a href="https://www.news.cn/travel/20260720/c/c.html">旅游美食优惠促销释放消费活力</a>',
      '<a href="https://www.news.cn/photo/20260720/d/c.html">高清图片：科技产业园摄影作品</a>',
      '<a href="https://www.news.cn/life/20260720/e/c.html">猎奇生活服务：今天怎样快速购票</a>',
    ].join('');
    const service = createCurrentAffairsService({
      fetchImpl: vi.fn(async () => new Response(
        `${articleListHtml(relevantTitles)}${unrelatedHtml}`,
        { status: 200 },
      )),
      now: () => new Date(fixedNow),
    });

    const result = await service.getCurrentAffairs();

    expect(result.isFallback).toBe(false);
    expect(result.items.map(({ title }) => title)).toEqual(relevantTitles);
  });

  it('相关内容过滤后不足六条时整体回退，不用无关新闻凑数', async () => {
    const relevantTitles = [
      '国务院研究新的就业政策',
      '经济数据展现产业发展韧性',
      '医疗保障公共服务继续完善',
      '生态环境治理取得新进展',
      '乡村振兴规划进入实施阶段',
    ];
    const unrelatedHtml = [
      '<a href="https://www.news.cn/ent/20260720/f/c.html">热播电视剧明星见面会举行</a>',
      '<a href="https://www.news.cn/sports/20260720/g/c.html">足球比赛决出年度冠军</a>',
      '<a href="https://www.news.cn/travel/20260720/h/c.html">景区推出美食打卡优惠</a>',
    ].join('');
    const service = createCurrentAffairsService({
      fetchImpl: vi.fn(async () => new Response(
        `${articleListHtml(relevantTitles)}${unrelatedHtml}`,
        { status: 200 },
      )),
      now: () => new Date(fixedNow),
    });

    const result = await service.getCurrentAffairs();

    expect(result.isFallback).toBe(true);
    expect(result.items).toHaveLength(8);
    expect(result.items.every(({ kind }) => kind === 'quote')).toBe(true);
    expect(result.items.some(({ title }) => title.includes('电视剧'))).toBe(false);
  });

  it.each([
    ['网络错误', vi.fn(async () => { throw new Error('network unavailable'); })],
    ['非成功响应', vi.fn(async () => new Response('upstream error', { status: 503 }))],
    ['页面不足六条合法新闻', vi.fn(async () => new Response(xinhuaHtml(2), { status: 200 }))],
  ])('%s 时返回至少六条内置中文文案且不抛出异常', async (_name, fetchImpl) => {
    const service = createCurrentAffairsService({
      fetchImpl,
      now: () => new Date(fixedNow),
    });

    const result = await service.getCurrentAffairs();

    expectStableContract(result);
    expect(result.isFallback).toBe(true);
    expect(result.items.every(({ kind }) => kind === 'quote')).toBe(true);
    expect(result.items.every(({ title }) => /[\u4e00-\u9fff]/.test(title))).toBe(true);
  });

  it('五秒后中止未完成的新华网请求并返回回退内容', async () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn((_input: string | URL | Request, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(new DOMException('Aborted', 'AbortError'));
        });
      }));
    const service = createCurrentAffairsService({
      fetchImpl,
      now: () => new Date(fixedNow),
    });

    const pending = service.getCurrentAffairs();
    await vi.advanceTimersByTimeAsync(4_999);
    expect(fetchImpl.mock.calls[0]?.[1]?.signal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    const result = await pending;

    expect(fetchImpl.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
    expect(result.isFallback).toBe(true);
    expect(result.items).toHaveLength(8);
  });

  it('收到响应头但正文读取超时也会在五秒后中止', async () => {
    vi.useFakeTimers();
    let requestSignal: AbortSignal | undefined;
    const fetchImpl = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      requestSignal = init?.signal ?? undefined;
      return {
        ok: true,
        text: () => new Promise<string>((_resolve, reject) => {
          requestSignal?.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'));
          });
        }),
      } as Response;
    });
    const service = createCurrentAffairsService({
      fetchImpl,
      now: () => new Date(fixedNow),
    });

    const pending = service.getCurrentAffairs();
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(5_000);

    expect(requestSignal?.aborted).toBe(true);
    expect((await pending).isFallback).toBe(true);
  });

  it('GET /api/current-affairs 始终返回固定响应契约', async () => {
    const service = createCurrentAffairsService({
      fetchImpl: vi.fn(async () => { throw new Error('offline'); }),
      now: () => new Date(fixedNow),
    });
    const app = express();
    app.use(createCurrentAffairsRouter(service));

    const response = await request(app).get('/api/current-affairs');

    expect(response.status).toBe(200);
    expectStableContract(response.body as CurrentAffairsResponse);
    expect(response.body.source).toEqual({
      name: '新华网',
      url: 'https://www.news.cn/politics/',
    });
    expect(response.body.isFallback).toBe(true);
  });
});
