import { access, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type {
  CoachCapabilityState,
  CoachMethodReference,
} from '../../shared/contracts';

export interface ZhangGongContext {
  module: 'verbal';
  questionType: '言语理解';
  methods: CoachMethodReference<'zhang_gong'>[];
  promptContext: string;
}

export interface ZhangGongAdapter {
  getStatus(): Promise<CoachCapabilityState>;
  load(question: string): Promise<ZhangGongContext>;
  isConfigured(): boolean;
}

export class ZhangGongError extends Error {
  constructor(
    public readonly code: 'not_configured' | 'unavailable',
    message: string,
  ) {
    super(message);
    this.name = 'ZhangGongError';
  }
}

export interface ZhangGongAdapterOptions {
  directory?: string;
}

const MAX_FILE_CONTENT = 16_000;
const MAX_PROMPT_CONTEXT = 28_000;

const REFERENCE_FILES = {
  fill: '02-选词填空SOP.md',
  sentence: '03-语句表达SOP.md',
  center: '01-中心理解SOP.md',
} as const;

function truncate(value: string, maxLength: number): string {
  return value.length > maxLength ? `${value.slice(0, maxLength)}…` : value;
}

function referenceFor(question: string): keyof typeof REFERENCE_FILES {
  if (/填空|成语|词语/.test(question)) return 'fill';
  if (/排序|衔接|下文|上下文|填入句子|语句/.test(question)) return 'sentence';
  return 'center';
}

function referenceName(fileName: string): string {
  return fileName.replace(/^\d+-/, '').replace(/\.md$/i, '');
}

function safeError(error: unknown): ZhangGongError {
  if (error instanceof ZhangGongError) return error;
  return new ZhangGongError('unavailable', '张弓方法源暂不可用');
}

export function createZhangGongAdapter(options: ZhangGongAdapterOptions): ZhangGongAdapter {
  const directory = options.directory
    ?? join(process.cwd(), 'local-tools', 'skills', 'zhang-gong-yanyu');
  const skillPath = directory ? join(directory, 'SKILL.md') : undefined;

  const getStatus = async (): Promise<CoachCapabilityState> => {
    if (!skillPath) return 'not_configured';
    try {
      await access(skillPath);
      return 'ready';
    } catch {
      return 'not_configured';
    }
  };

  const load = async (question: string): Promise<ZhangGongContext> => {
    if (!directory || !skillPath) throw new ZhangGongError('not_configured', '张弓方法源未配置');
    if (await getStatus() !== 'ready') {
      throw new ZhangGongError('not_configured', '张弓方法源未配置');
    }
    try {
      const skill = truncate(await readFile(skillPath, 'utf8'), MAX_FILE_CONTENT);
      const fileName = REFERENCE_FILES[referenceFor(question)];
      let reference: string;
      try {
        reference = await readFile(join(directory, 'references', fileName), 'utf8');
      } catch {
        reference = await readFile(join(directory, fileName), 'utf8');
      }
      reference = truncate(reference, MAX_FILE_CONTENT);
      const summary = reference.length > 320 ? `${reference.slice(0, 320)}…` : reference;
      return {
        module: 'verbal',
        questionType: '言语理解',
        methods: [{
          id: fileName,
          name: referenceName(fileName),
          source: 'zhang_gong',
          summary,
        }],
        promptContext: truncate(`${skill}\n\n${reference}`, MAX_PROMPT_CONTEXT),
      };
    } catch (error) {
      throw safeError(error);
    }
  };

  return {
    getStatus,
    load,
    isConfigured: () => Boolean(directory),
  };
}
