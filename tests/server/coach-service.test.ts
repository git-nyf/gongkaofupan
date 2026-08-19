import { describe, expect, it, vi } from 'vitest';
import type { CardDetail, CoachResponse } from '../../shared/contracts';
import type { CoachAiProvider } from '../../server/coach/deepseek';
import type { HuashengAdapter } from '../../server/coach/huasheng';
import type { WebSearchAdapter } from '../../server/coach/webSearch';
import type { ZhangGongAdapter } from '../../server/coach/zhangGong';
import { CardServiceError, type CardService } from '../../server/cards/service';
import {
  CoachServiceError,
  createCoachService,
  type CoachServiceDependencies,
} from '../../server/coach/service';

const huashengContext = {
  module: 'quantity' as const,
  questionType: 'quantity_relation',
  methods: [{ id: 'q-1', name: '工程问题', source: 'huasheng13' as const, summary: '统一总量' }],
  promptContext: '花生方法上下文',
};

const zhangGongContext = {
  module: 'verbal' as const,
  questionType: '言语理解' as const,
  methods: [{ id: 'v-1', name: '中心理解', source: 'zhang_gong' as const, summary: '找重点' }],
  promptContext: '张弓方法上下文',
};

const quantityResponse: CoachResponse = {
  resolvedModule: 'quantity',
  teacher: 'huasheng13',
  questionType: '工程问题',
  answer: '选择 B。',
  steps: ['统一总量'],
  conclusion: '答案为 B。',
  pitfalls: [],
  followUps: [],
  trainingPlan: [],
  methodReferences: huashengContext.methods,
  sources: [],
  webSearchStatus: 'disabled',
};

function dependencies(overrides: Partial<CoachServiceDependencies> = {}) {
  const cardService = {
    get: vi.fn(() => {
      throw new CardServiceError('not_found');
    }),
  } as unknown as CardService;
  const aiProvider: CoachAiProvider = {
    isConfigured: vi.fn(() => true),
    respond: vi.fn(async () => quantityResponse),
  };
  const huasheng: HuashengAdapter = {
    isConfigured: vi.fn(() => true),
    getStatus: vi.fn<HuashengAdapter['getStatus']>(async () => 'ready'),
    load: vi.fn(async () => huashengContext),
  };
  const zhangGong: ZhangGongAdapter = {
    isConfigured: vi.fn(() => true),
    getStatus: vi.fn<ZhangGongAdapter['getStatus']>(async () => 'ready'),
    load: vi.fn(async () => zhangGongContext),
  };
  const webSearch: WebSearchAdapter = {
    isConfigured: vi.fn(() => true),
    getStatus: vi.fn<WebSearchAdapter['getStatus']>(() => 'ready'),
    search: vi.fn<WebSearchAdapter['search']>(async () => ({ status: 'ready', sources: [] })),
  };
  return {
    cardService,
    aiProvider,
    huasheng,
    zhangGong,
    webSearch,
    ...overrides,
  } satisfies CoachServiceDependencies;
}

const messages = [
  { role: 'user' as const, content: '原题：甲乙合作完成工程。' },
  { role: 'assistant' as const, content: '你想追问哪个步骤？' },
  { role: 'user' as const, content: '为什么要统一工作总量？' },
];

describe('AI 公考教练服务', () => {
  it.each(['logic', 'data', 'quantity'] as const)('手动 %s 模式只加载花生方法', async (mode) => {
    const deps = dependencies();
    const service = createCoachService(deps);

    await service.respond({ mode, messages, includeWebSearch: false });

    expect(deps.huasheng.load).toHaveBeenCalledWith({
      mode,
      question: '原题：甲乙合作完成工程。',
    });
    expect(deps.zhangGong.load).not.toHaveBeenCalled();
  });

  it('手动言语模式只加载张弓方法', async () => {
    const deps = dependencies({
      aiProvider: {
        isConfigured: () => true,
        respond: vi.fn<CoachAiProvider['respond']>(async (input) => ({
          ...quantityResponse,
          resolvedModule: 'verbal' as const,
          teacher: 'zhang_gong' as const,
          methodReferences: input.methods as typeof zhangGongContext.methods,
        })),
      },
    });
    const service = createCoachService(deps);

    await service.respond({ mode: 'verbal', messages, includeWebSearch: false });

    expect(deps.huasheng.load).not.toHaveBeenCalled();
    expect(deps.zhangGong.load).toHaveBeenCalledWith('原题：甲乙合作完成工程。');
  });

  it('自动言语只用花生分类，随后只把张弓方法传给 AI', async () => {
    const huasheng = {
      ...dependencies().huasheng,
      load: vi.fn(async () => ({
        module: 'verbal' as const,
        questionType: 'verbal_reasoning',
        methods: [],
        promptContext: '',
      })),
    };
    const aiProvider = {
      isConfigured: () => true,
      respond: vi.fn<CoachAiProvider['respond']>(async () => ({
        ...quantityResponse,
        resolvedModule: 'verbal' as const,
        teacher: 'zhang_gong' as const,
        methodReferences: zhangGongContext.methods,
      })),
    };
    const deps = dependencies({ huasheng, aiProvider });
    const service = createCoachService(deps);

    await service.respond({ mode: 'auto', messages, includeWebSearch: false });

    expect(huasheng.load).toHaveBeenCalledWith({
      mode: 'auto',
      question: '原题：甲乙合作完成工程。',
    });
    expect(deps.zhangGong.load).toHaveBeenCalledWith('原题：甲乙合作完成工程。');
    expect(aiProvider.respond).toHaveBeenCalledWith(expect.objectContaining({
      resolvedModule: 'verbal',
      teacher: 'zhang_gong',
      methodContext: '张弓方法上下文',
      methods: zhangGongContext.methods,
      messages,
    }));
  });

  it('保留完整追问消息，但原题决定方法与联网查询', async () => {
    const deps = dependencies();
    const service = createCoachService(deps);

    await service.respond({ mode: 'quantity', messages, includeWebSearch: true });

    expect(deps.webSearch.search).toHaveBeenCalledWith(expect.stringContaining('原题：甲乙合作完成工程。'));
    expect(deps.webSearch.search).not.toHaveBeenCalledWith(expect.stringContaining('为什么要统一工作总量？'));
    expect(deps.aiProvider.respond).toHaveBeenCalledWith(expect.objectContaining({ messages }));
  });

  it('卡片上下文只传原文、板块和标签', async () => {
    const card = {
      rawInput: '用户自己的理解',
      categories: [{ id: 'c1', name: '数量关系', parentId: null }],
      tags: [{ id: 't1', name: '工程问题', origin: 'user' }],
      analysis: '不应发送的 AI 解析',
      notes: '不应发送的备注',
    } as CardDetail;
    const deps = dependencies({
      cardService: { get: vi.fn(() => card) } as unknown as CardService,
    });
    const service = createCoachService(deps);

    await service.respond({ mode: 'quantity', messages, cardId: 'card-1', includeWebSearch: false });

    expect(deps.aiProvider.respond).toHaveBeenCalledWith(expect.objectContaining({
      cardContext: {
        rawInput: '用户自己的理解',
        categories: ['数量关系'],
        tags: ['工程问题'],
      },
    }));
    expect(JSON.stringify(vi.mocked(deps.aiProvider.respond).mock.calls[0]?.[0])).not.toContain('不应发送');
  });

  it('联网搜索失败不阻断 AI 回答', async () => {
    const deps = dependencies({
      webSearch: {
        ...dependencies().webSearch,
        search: vi.fn<WebSearchAdapter['search']>(async () => { throw new Error('secret upstream body'); }),
      },
    });
    const service = createCoachService(deps);

    await expect(service.respond({ mode: 'quantity', messages, includeWebSearch: true }))
      .resolves.toEqual(quantityResponse);
    expect(deps.aiProvider.respond).toHaveBeenCalledWith(expect.objectContaining({
      search: { status: 'failed', sources: [] },
    }));
  });

  it('返回四项能力状态并将状态探测异常降级为不可用', async () => {
    const deps = dependencies({
      huasheng: {
        ...dependencies().huasheng,
        getStatus: vi.fn(async () => { throw new Error('secret'); }),
      },
    });
    const service = createCoachService(deps);

    await expect(service.getStatus()).resolves.toEqual({
      deepseek: 'ready',
      huasheng: 'unavailable',
      zhangGong: 'ready',
      webSearch: 'ready',
    });
  });

  it('统一映射自动路由不确定、方法源不可用、卡片不存在和 AI 失败', async () => {
    const cases: Array<[CoachServiceDependencies, string]> = [
      [dependencies({ huasheng: { ...dependencies().huasheng, load: vi.fn(async () => { throw Object.assign(new Error('secret'), { code: 'route_uncertain' }); }) } }), 'route_uncertain'],
      [dependencies({ huasheng: { ...dependencies().huasheng, load: vi.fn(async () => { throw Object.assign(new Error('secret'), { code: 'unavailable' }); }) } }), 'provider_unavailable'],
      [dependencies(), 'not_found'],
      [dependencies({ aiProvider: { isConfigured: () => true, respond: vi.fn(async () => { throw new Error('secret'); }) } }), 'ai_unavailable'],
    ];

    const inputs = [
      { mode: 'auto' as const, messages, includeWebSearch: false },
      { mode: 'quantity' as const, messages, includeWebSearch: false },
      { mode: 'quantity' as const, messages, cardId: 'missing', includeWebSearch: false },
      { mode: 'quantity' as const, messages, includeWebSearch: false },
    ];

    for (const [index, [deps, code]] of cases.entries()) {
      const error = await createCoachService(deps).respond(inputs[index]!).catch((caught) => caught);
      expect(error).toBeInstanceOf(CoachServiceError);
      expect(error).toMatchObject({ code });
      expect(String(error)).not.toContain('secret');
    }
  });
});
