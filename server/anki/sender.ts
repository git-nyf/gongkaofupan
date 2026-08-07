import { spawn } from 'node:child_process';
import path from 'node:path';

const DEFAULT_COMMAND = 'cc-connect';
const DEFAULT_TIMEOUT_MS = 30_000;

export interface SendAnkiBundleInput {
  apkgPath: string;
  markdownPath: string;
  message?: string;
  command?: string;
  timeoutMs?: number;
}

export type SendAnkiBundleErrorCode =
  | 'INVALID_ARGUMENT'
  | 'COMMAND_NOT_FOUND'
  | 'COMMAND_FAILED'
  | 'TIMEOUT'
  | 'SPAWN_ERROR';

export interface SendAnkiBundleSuccess {
  ok: true;
  command: string;
  args: string[];
  stdout: string;
  stderr: string;
  exitCode: 0;
}

export interface SendAnkiBundleFailure {
  ok: false;
  code: SendAnkiBundleErrorCode;
  error: string;
  command: string;
  args: string[];
  stdout: string;
  stderr: string;
  exitCode?: number | null;
  signal?: NodeJS.Signals | null;
}

export type SendAnkiBundleResult = SendAnkiBundleSuccess | SendAnkiBundleFailure;

/** 通过 cc-connect 将 Anki 包和中间 Markdown 文档发送到当前会话。 */
export function sendAnkiBundle(input: SendAnkiBundleInput): Promise<SendAnkiBundleResult> {
  const command = typeof input?.command === 'string' && input.command.trim()
    ? input.command.trim()
    : DEFAULT_COMMAND;
  const args = createArguments(input);
  const validationError = validateInput(input);
  if (validationError) {
    return Promise.resolve({
      ok: false,
      code: 'INVALID_ARGUMENT',
      error: validationError,
      command,
      args,
      stdout: '',
      stderr: '',
    });
  }

  const timeoutMs = input?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  if (!Number.isFinite(timeoutMs) || timeoutMs < 0) {
    return Promise.resolve({
      ok: false,
      code: 'INVALID_ARGUMENT',
      error: 'timeoutMs 必须是大于等于 0 的有限数字',
      command,
      args,
      stdout: '',
      stderr: '',
    });
  }

  return runCommand(command, args, timeoutMs);
}

function createArguments(input: SendAnkiBundleInput): string[] {
  const args = [
    'send',
    '--file',
    toAbsolutePath(input?.apkgPath),
    '--file',
    toAbsolutePath(input?.markdownPath),
  ];
  const message = typeof input?.message === 'string' ? input.message.trim() : '';
  if (message) args.push('--message', message);
  return args;
}

function toAbsolutePath(value: string): string {
  return typeof value === 'string' && value.trim() ? path.resolve(value) : '';
}

function validateInput(input: SendAnkiBundleInput): string | null {
  if (!input || typeof input !== 'object') return '发送参数不能为空';
  if (typeof input.apkgPath !== 'string' || !input.apkgPath.trim() || !path.isAbsolute(input.apkgPath)) {
    return 'apkgPath 必须是绝对路径';
  }
  if (typeof input.markdownPath !== 'string' || !input.markdownPath.trim() || !path.isAbsolute(input.markdownPath)) {
    return 'markdownPath 必须是绝对路径';
  }
  if (input.command !== undefined && (typeof input.command !== 'string' || !input.command.trim())) {
    return 'command 不能为空';
  }
  return null;
}

function runCommand(
  command: string,
  args: string[],
  timeoutMs: number,
): Promise<SendAnkiBundleResult> {
  return new Promise((resolve) => {
    let child: ReturnType<typeof spawn>;
    try {
      child = spawn(command, args, {
        shell: false,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (error) {
      resolve(createFailure('SPAWN_ERROR', errorMessage(error), command, args));
      return;
    }

    let stdout = '';
    let stderr = '';
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const finish = (result: SendAnkiBundleResult) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      resolve(result);
    };

    child.stdout?.on('data', (chunk: Buffer | string) => {
      stdout += chunk.toString();
    });
    child.stderr?.on('data', (chunk: Buffer | string) => {
      stderr += chunk.toString();
    });
    child.once('error', (error: Error & { code?: string }) => {
      const code = error.code === 'ENOENT' ? 'COMMAND_NOT_FOUND' : 'SPAWN_ERROR';
      finish({
        ...createFailure(code, errorMessage(error), command, args),
        stdout,
        stderr,
      });
    });
    child.once('close', (exitCode: number | null, signal: NodeJS.Signals | null) => {
      if (exitCode === 0) {
        finish({
          ok: true,
          command,
          args,
          stdout,
          stderr,
          exitCode: 0,
        });
      } else {
        finish({
          ...createFailure(
            'COMMAND_FAILED',
            `cc-connect 退出状态 ${exitCode ?? '未知'}${signal ? `（信号 ${signal}）` : ''}`,
            command,
            args,
          ),
          stdout,
          stderr,
          exitCode,
          signal,
        });
      }
    });

    if (timeoutMs > 0) {
      timer = setTimeout(() => {
        if (settled) return;
        try {
          child.kill('SIGTERM');
        } catch {
          // 子进程已经退出时，超时结果仍然是最有用的状态。
        }
        finish({
          ...createFailure('TIMEOUT', `发送操作超过 ${timeoutMs} 毫秒`, command, args),
          stdout,
          stderr,
        });
      }, timeoutMs);
    }
  });
}

function createFailure(
  code: SendAnkiBundleErrorCode,
  error: string,
  command: string,
  args: string[],
): SendAnkiBundleFailure {
  return {
    ok: false,
    code,
    error,
    command,
    args,
    stdout: '',
    stderr: '',
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
