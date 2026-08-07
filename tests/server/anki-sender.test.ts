import { afterEach, describe, expect, it, vi } from 'vitest';
import path from 'node:path';

const { spawnMock } = vi.hoisted(() => ({
  spawnMock: vi.fn(),
}));

vi.mock('node:child_process', () => ({
  spawn: spawnMock,
}));

import { sendAnkiBundle } from '../../server/anki/sender';

interface FakeChild {
  stdout: { on: (event: string, listener: (...args: any[]) => void) => void };
  stderr: { on: (event: string, listener: (...args: any[]) => void) => void };
  once: (event: string, listener: (...args: any[]) => void) => void;
  kill: ReturnType<typeof vi.fn>;
  emit: (event: string, ...args: unknown[]) => void;
}

function createFakeChild(): FakeChild {
  const listeners = new Map<string, (...args: any[]) => void>();
  const child: FakeChild = {
    stdout: { on: (_event, _listener) => undefined },
    stderr: { on: (_event, _listener) => undefined },
    once: (event, listener) => listeners.set(event, listener),
    kill: vi.fn(),
    emit: (event, ...args) => listeners.get(event)?.(...args),
  };
  child.stdout = {
    on: (event, listener) => {
      if (event === 'data') listeners.set('stdout:data', listener);
    },
  };
  child.stderr = {
    on: (event, listener) => {
      if (event === 'data') listeners.set('stderr:data', listener);
    },
  };
  return child;
}

afterEach(() => {
  spawnMock.mockReset();
  vi.useRealTimers();
});

describe('Anki cc-connect 发送适配器', () => {
  const apkgPath = path.resolve('output', 'daily.apkg');
  const markdownPath = path.resolve('output', 'daily.md');

  it('校验路径并以非 shell 参数发送两个附件和可选消息', async () => {
    const child = createFakeChild();
    spawnMock.mockImplementation(() => child);
    const promise = sendAnkiBundle({
      apkgPath,
      markdownPath,
      message: '今日复习卡已生成',
    });
    queueMicrotask(() => child.emit('close', 0, null));

    const result = await promise;

    expect(spawnMock).toHaveBeenCalledWith(
      'cc-connect',
      ['send', '--file', apkgPath, '--file', markdownPath, '--message', '今日复习卡已生成'],
      expect.objectContaining({ shell: false }),
    );
    expect(result).toMatchObject({ ok: true, exitCode: 0 });
  });

  it('命令以非零状态退出时返回结构化错误', async () => {
    const child = createFakeChild();
    spawnMock.mockImplementation(() => child);
    const promise = sendAnkiBundle({ apkgPath, markdownPath });
    queueMicrotask(() => {
      child.emit('stderr:data', Buffer.from('发送失败'));
      child.emit('close', 2, null);
    });

    await expect(promise).resolves.toMatchObject({
      ok: false,
      code: 'COMMAND_FAILED',
      exitCode: 2,
      stderr: '发送失败',
    });
  });

  it('命令不存在时返回 COMMAND_NOT_FOUND 且不抛出异常', async () => {
    const child = createFakeChild();
    spawnMock.mockImplementation(() => child);
    const promise = sendAnkiBundle({ command: 'missing-cc-connect', apkgPath, markdownPath });
    queueMicrotask(() => child.emit('error', Object.assign(new Error('not found'), { code: 'ENOENT' })));

    await expect(promise).resolves.toMatchObject({
      ok: false,
      code: 'COMMAND_NOT_FOUND',
    });
  });

  it('超时后终止子进程并返回 TIMEOUT', async () => {
    vi.useFakeTimers();
    const child = createFakeChild();
    spawnMock.mockImplementation(() => child);
    const promise = sendAnkiBundle({ apkgPath, markdownPath, timeoutMs: 20 });

    await vi.advanceTimersByTimeAsync(20);

    await expect(promise).resolves.toMatchObject({ ok: false, code: 'TIMEOUT' });
    expect(child.kill).toHaveBeenCalledWith('SIGTERM');
  });

  it('拒绝相对路径并且不启动命令', async () => {
    const result = await sendAnkiBundle({ apkgPath: 'daily.apkg', markdownPath });

    expect(result).toMatchObject({ ok: false, code: 'INVALID_ARGUMENT' });
    expect(spawnMock).not.toHaveBeenCalled();
  });

  it('收到无效参数时返回结构化错误而不是抛出异常', async () => {
    const result = await sendAnkiBundle(null as unknown as Parameters<typeof sendAnkiBundle>[0]);

    expect(result).toMatchObject({ ok: false, code: 'INVALID_ARGUMENT' });
    expect(spawnMock).not.toHaveBeenCalled();
  });
});
