import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import type {
  CoachCapabilityState,
  CoachMethodReference,
  CoachMode,
  CoachModule,
} from '../../shared/contracts';

export interface McpToolClient {
  listTools(): Promise<Array<{ name: string }>>;
  callTool(name: string, args: Record<string, unknown>): Promise<unknown>;
  close(): Promise<void>;
}

export interface HuashengContext {
  module: CoachModule;
  questionType: string;
  methods: CoachMethodReference<'huasheng13'>[];
  promptContext: string;
}

export interface HuashengLoadInput {
  mode: CoachMode;
  question: string;
}

export interface HuashengAdapter {
  getStatus(): Promise<CoachCapabilityState>;
  load(input: HuashengLoadInput): Promise<HuashengContext>;
  isConfigured(): boolean;
}

export interface HuashengAdapterOptions {
  url: string;
  clientFactory?: () => McpToolClient | Promise<McpToolClient>;
}

export class HuashengError extends Error {
  constructor(
    public readonly code: 'unavailable' | 'route_uncertain',
    message: string,
  ) {
    super(message);
    this.name = 'HuashengError';
  }
}

const ROUTE_TYPES = new Set([
  'logic_reasoning',
  'graphic_reasoning',
  'definition_judgement',
  'analogy_reasoning',
  'logic_analysis',
  'data_analysis',
  'quantity_relation',
  'verbal_reasoning',
]);

const MODULE_BY_TYPE: Record<string, CoachModule> = {
  logic_reasoning: 'logic',
  graphic_reasoning: 'logic',
  definition_judgement: 'logic',
  analogy_reasoning: 'logic',
  logic_analysis: 'logic',
  data_analysis: 'data',
  quantity_relation: 'quantity',
  verbal_reasoning: 'verbal',
};

const MAX_TOOL_FIELD = 8_000;
const MAX_PROMPT_CONTEXT = 24_000;

function truncate(value: string, maxLength: number): string {
  return value.length > maxLength ? `${value.slice(0, maxLength)}…` : value;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function parseToolResult(value: unknown): unknown {
  const record = asRecord(value);
  if (!record) return value;
  if (record.structuredContent !== undefined) return parseToolResult(record.structuredContent);
  if (Array.isArray(record.content)) {
    const text = record.content
      .filter((item): item is Record<string, unknown> => asRecord(item) !== undefined)
      .map((item) => typeof item.text === 'string' ? item.text : '')
      .filter(Boolean)
      .join('\n');
    if (text) {
      try {
        return JSON.parse(text);
      } catch {
        return text;
      }
    }
  }
  return value;
}

function textOf(value: unknown): string {
  const parsed = parseToolResult(value);
  if (typeof parsed === 'string') return parsed;
  try {
    return JSON.stringify(parsed);
  } catch {
    return '';
  }
}

function routeType(value: unknown): string | undefined {
  const parsed = parseToolResult(value);
  const record = asRecord(parsed);
  const candidate = record?.question_type ?? record?.questionType ?? record?.type ?? record?.classification;
  if (typeof candidate === 'string' && ROUTE_TYPES.has(candidate)) return candidate;
  if (typeof parsed === 'string' && ROUTE_TYPES.has(parsed)) return parsed;
  return undefined;
}

function methodResults(value: unknown): Array<Record<string, unknown>> {
  const parsed = parseToolResult(value);
  const record = asRecord(parsed);
  const results = Array.isArray(parsed)
    ? parsed
    : record?.results ?? record?.methods ?? record?.items;
  return Array.isArray(results)
    ? results.map(asRecord).filter((item): item is Record<string, unknown> => item !== undefined)
    : [];
}

function methodReference(value: unknown, fallbackId = 'method'): CoachMethodReference<'huasheng13'> | undefined {
  const parsed = parseToolResult(value);
  const record = asRecord(parsed);
  if (!record) return undefined;
  const id = record.id ?? record.method_id ?? record.methodId ?? fallbackId;
  const name = record.name ?? record.title ?? record.method_name ?? id;
  const summary = record.summary ?? record.description ?? record.content ?? '';
  if (typeof id !== 'string' || typeof name !== 'string') return undefined;
  return {
    id,
    name,
    source: 'huasheng13',
    summary: truncate(typeof summary === 'string' ? summary : textOf(summary), MAX_TOOL_FIELD),
  };
}

function createProductionClient(url: string): () => Promise<McpToolClient> {
  return async () => {
    const client = new Client({ name: 'gongkao-coach', version: '0.1.0' }, { capabilities: {} });
    const transport = new SSEClientTransport(new URL(url));
    await client.connect(transport);
    return {
      listTools: async () => (await client.listTools()).tools.map(({ name }) => ({ name })),
      callTool: async (name, args) => client.callTool({ name, arguments: args }),
      close: async () => client.close(),
    };
  };
}

function safeUnavailable(error: unknown): HuashengError {
  if (error instanceof HuashengError) return error;
  return new HuashengError('unavailable', '花生方法源暂不可用');
}

export function createHuashengAdapter(options: HuashengAdapterOptions): HuashengAdapter {
  const clientFactory = options.clientFactory ?? createProductionClient(options.url);
  let lastStatus: CoachCapabilityState = options.url ? 'ready' : 'not_configured';

  const call = async (client: McpToolClient, name: string, args: Record<string, unknown>) => {
    try {
      const result = await client.callTool(name, args);
      if (asRecord(result)?.isError === true) throw new Error('MCP tool returned an error');
      return result;
    } catch (error) {
      throw safeUnavailable(error);
    }
  };

  const load = async ({ mode, question }: HuashengLoadInput): Promise<HuashengContext> => {
    if (!options.url) throw new HuashengError('unavailable', '花生方法源未配置');
    let client: McpToolClient | undefined;
    try {
      client = await clientFactory();
      let questionType: string | undefined;
      if (mode === 'auto') {
        questionType = routeType(await call(client, 'route_xingce_question', { question }));
        if (!questionType) throw new HuashengError('route_uncertain', '题型无法确定');
      } else {
        questionType = {
          logic: 'logic_reasoning',
          data: 'data_analysis',
          quantity: 'quantity_relation',
          verbal: 'verbal_reasoning',
        }[mode];
      }

      const module = MODULE_BY_TYPE[questionType];
      if (!module) throw new HuashengError('route_uncertain', '题型无法确定');
      if (module === 'verbal') {
        lastStatus = 'ready';
        return { module, questionType, methods: [], promptContext: '' };
      }

      const scaffoldName = module === 'quantity' ? 'get_quantity_relation_scaffold' : undefined;
      const scaffold = scaffoldName ? await call(client, scaffoldName, { question }) : undefined;
      const methodResponse = scaffoldName ? undefined : await call(client, 'search_methods', { query: question });
      const candidates = methodResults(methodResponse).slice(0, 3);
      const methods: CoachMethodReference<'huasheng13'>[] = [];
      let promptParts: string[] = [];

      const solverName = scaffoldName ? undefined : {
        logic: 'solve_logic_reasoning',
        data: 'solve_data_analysis',
        quantity: 'get_quantity_relation_scaffold',
      }[module];
      if (solverName) {
        const solved = await call(client, solverName, { question });
        promptParts.push(truncate(textOf(solved), MAX_TOOL_FIELD));
      }
      if (scaffold) promptParts.push(truncate(textOf(scaffold), MAX_TOOL_FIELD));
      if (scaffoldName) {
        const card = await call(client, 'get_method_card', { query: question, module });
        const cardReference = methodReference(card);
        if (cardReference) {
          methods.push(cardReference);
          promptParts.push(cardReference.summary);
        }
      }
      if (candidates.length > 0) {
        const first = methodReference(candidates[0]);
        if (first) {
          methods.push(first);
          const card = await call(client, 'get_method_card', {
            id: first.id,
            method_id: first.id,
          });
          const cardReference = methodReference(card, first.id);
          if (cardReference) {
            methods[0] = cardReference;
            promptParts.push(cardReference.summary);
          }
        }
        methods.push(...candidates.slice(1).map((item, index) => methodReference(item, `method-${index + 2}`)).filter(
          (item): item is CoachMethodReference<'huasheng13'> => item !== undefined,
        ));
      }
      lastStatus = 'ready';
      return {
        module,
        questionType,
        methods,
        promptContext: truncate(promptParts.join('\n\n'), MAX_PROMPT_CONTEXT),
      };
    } catch (error) {
      const safeError = safeUnavailable(error);
      lastStatus = safeError.code === 'route_uncertain' ? 'unavailable' : 'unavailable';
      throw safeError;
    } finally {
      if (client) await client.close().catch(() => undefined);
    }
  };

  return {
    load,
    isConfigured: () => Boolean(options.url),
    getStatus: async () => {
      if (!options.url) return 'not_configured';
      if (lastStatus === 'unavailable') return lastStatus;
      try {
        const client = await clientFactory();
        try {
          await client.listTools();
          lastStatus = 'ready';
        } finally {
          await client.close().catch(() => undefined);
        }
      } catch {
        lastStatus = 'unavailable';
      }
      return lastStatus;
    },
  };
}
