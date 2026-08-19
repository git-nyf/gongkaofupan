import type {
  CoachMessageInput,
  CoachModule,
  CoachStatus,
  CoachTeacher,
} from '../../shared/contracts';
import { CardServiceError, type CardService } from '../cards/service';
import type { CoachAiProvider } from './deepseek';
import type { HuashengAdapter, HuashengContext } from './huasheng';
import type { WebSearchAdapter, WebSearchResult } from './webSearch';
import type { ZhangGongAdapter } from './zhangGong';

export type CoachServiceErrorCode =
  | 'route_uncertain'
  | 'provider_unavailable'
  | 'not_found'
  | 'ai_unavailable';

export class CoachServiceError extends Error {
  constructor(readonly code: CoachServiceErrorCode) {
    super(code);
    this.name = 'CoachServiceError';
  }
}

export interface CoachService {
  getStatus(): Promise<CoachStatus>;
  respond(input: CoachMessageInput): ReturnType<CoachAiProvider['respond']>;
}

export interface CoachServiceDependencies {
  cardService: CardService;
  aiProvider: CoachAiProvider;
  huasheng: HuashengAdapter;
  zhangGong: ZhangGongAdapter;
  webSearch: WebSearchAdapter;
}

const teacherByModule: Record<CoachModule, CoachTeacher> = {
  logic: 'huasheng13',
  data: 'huasheng13',
  quantity: 'huasheng13',
  verbal: 'zhang_gong',
};

const moduleNames: Record<CoachModule, string> = {
  logic: '判断推理',
  data: '资料分析',
  quantity: '数量关系',
  verbal: '言语理解',
};

export function createCoachService({
  cardService,
  aiProvider,
  huasheng,
  zhangGong,
  webSearch,
}: CoachServiceDependencies): CoachService {
  return {
    async getStatus() {
      const [huashengStatus, zhangGongStatus] = await Promise.all([
        safeAsyncStatus(() => huasheng.getStatus()),
        safeAsyncStatus(() => zhangGong.getStatus()),
      ]);
      return {
        deepseek: safeConfigured(aiProvider.isConfigured),
        huasheng: huashengStatus,
        zhangGong: zhangGongStatus,
        webSearch: safeSyncStatus(() => webSearch.getStatus()),
      };
    },

    async respond(input) {
      const originalQuestion = input.messages.find(({ role }) => role === 'user')!.content;
      const method = await loadMethodContext(input.mode, originalQuestion, huasheng, zhangGong);
      const teacher = teacherByModule[method.module];
      const cardContext = input.cardId
        ? readCardContext(cardService, input.cardId)
        : undefined;
      const search = input.includeWebSearch
        ? await searchSafely(webSearch, buildSearchQuery(method.module, method.methods.map(({ name }) => name), originalQuestion))
        : { status: 'disabled' as const, sources: [] };

      if (!safeIsConfigured(aiProvider.isConfigured)) {
        throw new CoachServiceError('ai_unavailable');
      }
      try {
        return await aiProvider.respond({
          resolvedModule: method.module,
          teacher,
          messages: input.messages,
          methodContext: method.promptContext,
          methods: method.methods,
          cardContext,
          search,
        });
      } catch {
        throw new CoachServiceError('ai_unavailable');
      }
    },
  };
}

async function loadMethodContext(
  mode: CoachMessageInput['mode'],
  question: string,
  huasheng: HuashengAdapter,
  zhangGong: ZhangGongAdapter,
) {
  if (mode === 'verbal') return loadZhangGong(zhangGong, question);
  if (mode !== 'auto') {
    if (!safeIsConfigured(huasheng.isConfigured)) throw new CoachServiceError('provider_unavailable');
    return loadHuasheng(huasheng, { mode, question });
  }

  if (!safeIsConfigured(huasheng.isConfigured)) throw new CoachServiceError('provider_unavailable');
  const routed = await loadHuasheng(huasheng, { mode: 'auto', question });
  if (routed.module !== 'verbal') return routed;
  return loadZhangGong(zhangGong, question);
}

async function loadHuasheng(
  huasheng: HuashengAdapter,
  input: Parameters<HuashengAdapter['load']>[0],
): Promise<HuashengContext> {
  try {
    return await huasheng.load(input);
  } catch (error) {
    if (readErrorCode(error) === 'route_uncertain') throw new CoachServiceError('route_uncertain');
    throw new CoachServiceError('provider_unavailable');
  }
}

async function loadZhangGong(zhangGong: ZhangGongAdapter, question: string) {
  if (!safeIsConfigured(zhangGong.isConfigured)) throw new CoachServiceError('provider_unavailable');
  try {
    return await zhangGong.load(question);
  } catch {
    throw new CoachServiceError('provider_unavailable');
  }
}

function readCardContext(cardService: CardService, cardId: string) {
  try {
    const card = cardService.get(cardId);
    return {
      rawInput: card.rawInput,
      categories: card.categories.map(({ name }) => name),
      tags: card.tags.map(({ name }) => name),
    };
  } catch (error) {
    if (error instanceof CardServiceError && error.code === 'not_found') {
      throw new CoachServiceError('not_found');
    }
    throw new CoachServiceError('not_found');
  }
}

function buildSearchQuery(module: CoachModule, methods: string[], question: string) {
  return `${moduleNames[module]} ${methods.join(' ')} ${question}`.trim().slice(0, 2_000);
}

async function searchSafely(webSearch: WebSearchAdapter, query: string): Promise<WebSearchResult> {
  try {
    return await webSearch.search(query);
  } catch {
    return { status: 'failed', sources: [] };
  }
}

function safeIsConfigured(check: () => boolean) {
  try {
    return check();
  } catch {
    return false;
  }
}

function safeConfigured(check: () => boolean): CoachStatus['deepseek'] {
  return safeIsConfigured(check) ? 'ready' : 'not_configured';
}

async function safeAsyncStatus(check: () => Promise<CoachStatus['huasheng']>) {
  try {
    return await check();
  } catch {
    return 'unavailable' as const;
  }
}

function safeSyncStatus(check: () => CoachStatus['webSearch']) {
  try {
    return check();
  } catch {
    return 'unavailable' as const;
  }
}

function readErrorCode(error: unknown) {
  return typeof error === 'object' && error !== null ? Reflect.get(error, 'code') : undefined;
}
