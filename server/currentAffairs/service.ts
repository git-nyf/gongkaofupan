import { createHash } from 'node:crypto';

const SOURCE_URL = 'https://www.news.cn/politics/';
const REQUEST_TIMEOUT_MS = 5_000;
const CACHE_TTL_MS = 10 * 60 * 1_000;
const MINIMUM_ITEM_COUNT = 6;
const MAXIMUM_ITEM_COUNT = 12;
const excludedSectionPattern = /\/(?:ent|fashion|food|life|photo|sports|travel|video)\//i;
const excludedTitlePattern = /明星|娱乐|影视|电影|电视剧|综艺|演唱会|网红|偶像|音乐节|票房|文娱|体育|赛事|比赛|足球|篮球|乒乓|世界杯|冠军|运动员|全运会|旅游|景区|美食|打卡|优惠|促销|购物|购票|彩票|时尚|游戏|猎奇|生活服务|养生|宠物|家居|高清图片|图片报道|摄影|图集|组图|镜头里的/;
const gongkaoTopicPattern = /中共中央|中央|国务院|全国人大|全国政协|最高人民法院|最高人民检察院|政府|党委|纪委|监察|部门|委员会|国家[\p{Script=Han}]{0,8}(?:局|署|院)|政策|法律|法规|条例|意见|规划|方案|办法|制度|改革|治理|监管|行政|执法|会议|发布会|报告|部署|决定|实施|经济|数据|统计|就业|社会保障|社保|医疗|教育|科技|创新|人工智能|产业|制造业|数字化|营商环境|消费|投资|财政|金融|税收|外贸|民生|公共服务|基层|群众|老百姓|乡村振兴|区域发展|区域协调|发展战略|生态|环境保护|环保|防汛|抗旱|应急|防灾|安全生产|国际|全球治理|联合国|中欧|外交|协定|合作组织|文明乡风|移风易俗/u;

const fallbackTitles = [
  '民生无小事，枝叶总关情。',
  '把群众的事当作自己的事，把群众的小事当作心头的大事。',
  '为民服务既要有态度，更要有解决问题的速度。',
  '脚下沾有多少泥土，心中就沉淀多少真情。',
  '调查研究要听真话、察实情，让公共决策回应真实需要。',
  '今天多掌握一个知识点，明天就多一分解决实际问题的底气。',
  '把每一次复盘都变成进步的起点，把每一道错题都变成能力的台阶。',
  '坚持从群众中来、到群众中去，在实践中增长才干。',
] as const;

type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

interface CurrentAffairsServiceDependencies {
  fetchImpl?: FetchLike;
  now?: () => Date;
}

export interface CurrentAffairsItem {
  id: string;
  title: string;
  url: string;
  publishedAt: string;
  kind: 'news' | 'quote';
}

export interface CurrentAffairsResponse {
  updatedAt: string;
  source: {
    name: '新华网';
    url: typeof SOURCE_URL;
  };
  items: CurrentAffairsItem[];
  isFallback: boolean;
}

interface CachedResponse {
  storedAt: number;
  value: CurrentAffairsResponse;
}

export function createCurrentAffairsService({
  fetchImpl = fetch,
  now = () => new Date(),
}: CurrentAffairsServiceDependencies = {}) {
  let cache: CachedResponse | undefined;

  async function getCurrentAffairs(): Promise<CurrentAffairsResponse> {
    const requestedAt = now();
    if (cache && requestedAt.getTime() - cache.storedAt < CACHE_TTL_MS) {
      return cache.value;
    }

    let value: CurrentAffairsResponse;
    try {
      const items = parseXinhuaPoliticsHtml(await fetchPoliticsPage(fetchImpl), requestedAt);
      if (items.length < MINIMUM_ITEM_COUNT) throw new Error('upstream_parse_error');

      value = createResponse(requestedAt, items, false);
    } catch {
      value = createFallbackResponse(requestedAt);
    }

    cache = { storedAt: requestedAt.getTime(), value };
    return value;
  }

  return { getCurrentAffairs };
}

export type CurrentAffairsService = ReturnType<typeof createCurrentAffairsService>;

export function parseXinhuaPoliticsHtml(html: string, fetchedAt: Date): CurrentAffairsItem[] {
  const items: CurrentAffairsItem[] = [];
  const seenUrls = new Set<string>();
  const anchorPattern = /<a\b([^>]*?)\bhref\s*=\s*(["'])(.*?)\2([^>]*)>([\s\S]*?)<\/a\s*>/gi;
  let match: RegExpExecArray | null;

  while ((match = anchorPattern.exec(html)) && items.length < MAXIMUM_ITEM_COUNT) {
    const url = readAllowedUrl(decodeHtmlEntities(match[3] ?? ''));
    if (!url || seenUrls.has(url)) continue;

    const attributes = `${match[1] ?? ''} ${match[4] ?? ''}`;
    const titleAttribute = attributes.match(/\btitle\s*=\s*(["'])(.*?)\1/i)?.[2] ?? '';
    const title = normalizeText(match[5] ?? '') || normalizeText(titleAttribute);
    if (!title || !isGongkaoRelevant(title, url)) continue;

    const nearbyHtml = html.slice(match.index, Math.min(html.length, anchorPattern.lastIndex + 240));
    seenUrls.add(url);
    items.push({
      id: `news-${createHash('sha256').update(url).digest('hex').slice(0, 16)}`,
      title,
      url,
      publishedAt: readPublishedAt(nearbyHtml, url, fetchedAt),
      kind: 'news',
    });
  }

  return items;
}

async function fetchPoliticsPage(fetchImpl: FetchLike) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetchImpl(SOURCE_URL, {
      signal: controller.signal,
      headers: {
        accept: 'text/html,application/xhtml+xml',
        'user-agent': 'GongkaoMemoryCard/0.1',
      },
    });
    if (!response.ok) throw new Error('upstream_response_error');
    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

function createResponse(
  updatedAt: Date,
  items: CurrentAffairsItem[],
  isFallback: boolean,
): CurrentAffairsResponse {
  return {
    updatedAt: updatedAt.toISOString(),
    source: { name: '新华网', url: SOURCE_URL },
    items,
    isFallback,
  };
}

function createFallbackResponse(updatedAt: Date) {
  return createResponse(
    updatedAt,
    fallbackTitles.map((title, index) => ({
      id: `quote-${index + 1}`,
      title,
      url: SOURCE_URL,
      publishedAt: updatedAt.toISOString(),
      kind: 'quote' as const,
    })),
    true,
  );
}

function readAllowedUrl(rawUrl: string) {
  try {
    const parsed = new URL(rawUrl.trim(), SOURCE_URL);
    if (parsed.protocol !== 'https:') return null;
    if (!isAllowedHost(parsed.hostname)) return null;
    if (!/(?:^|\/)c\.html$/i.test(parsed.pathname)) return null;
    parsed.hash = '';
    return parsed.toString();
  } catch {
    return null;
  }
}

function isAllowedHost(hostname: string) {
  const normalized = hostname.toLowerCase();
  return normalized === 'news.cn'
    || normalized.endsWith('.news.cn')
    || normalized === 'xinhuanet.com'
    || normalized.endsWith('.xinhuanet.com');
}

function isGongkaoRelevant(title: string, url: string) {
  const pathname = new URL(url).pathname;
  return !excludedSectionPattern.test(pathname)
    && !excludedTitlePattern.test(title)
    && gongkaoTopicPattern.test(title);
}

function readPublishedAt(context: string, url: string, fallback: Date) {
  const dateTime = context.match(
    /(20\d{2})[-/.年](\d{1,2})[-/.月](\d{1,2})日?(?:\s+|T)(\d{1,2}):(\d{2})(?::(\d{2}))?/,
  );
  if (dateTime) {
    return toIsoDate(
      Number(dateTime[1]),
      Number(dateTime[2]),
      Number(dateTime[3]),
      Number(dateTime[4]),
      Number(dateTime[5]),
      Number(dateTime[6] ?? 0),
      fallback,
    );
  }

  const urlDate = new URL(url).pathname.match(/\/(20\d{2})(\d{2})(\d{2})\//);
  if (urlDate) {
    return toIsoDate(
      Number(urlDate[1]),
      Number(urlDate[2]),
      Number(urlDate[3]),
      0,
      0,
      0,
      fallback,
    );
  }

  return fallback.toISOString();
}

function toIsoDate(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  fallback: Date,
) {
  const value = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  if (
    value.getUTCFullYear() !== year
    || value.getUTCMonth() !== month - 1
    || value.getUTCDate() !== day
    || value.getUTCHours() !== hour
    || value.getUTCMinutes() !== minute
    || value.getUTCSeconds() !== second
  ) {
    return fallback.toISOString();
  }
  return value.toISOString();
}

function normalizeText(value: string) {
  return decodeHtmlEntities(value.replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

function decodeHtmlEntities(value: string) {
  const namedEntities: Record<string, string> = {
    amp: '&',
    apos: "'",
    gt: '>',
    lt: '<',
    nbsp: ' ',
    quot: '"',
  };

  return value.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (entity, code: string) => {
    if (code.startsWith('#x') || code.startsWith('#X')) {
      return safeCodePoint(Number.parseInt(code.slice(2), 16), entity);
    }
    if (code.startsWith('#')) {
      return safeCodePoint(Number.parseInt(code.slice(1), 10), entity);
    }
    return namedEntities[code.toLowerCase()] ?? entity;
  });
}

function safeCodePoint(codePoint: number, fallback: string) {
  try {
    return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : fallback;
  } catch {
    return fallback;
  }
}
