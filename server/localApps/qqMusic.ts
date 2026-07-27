import { spawn, type ChildProcess } from 'node:child_process';
import { lstatSync } from 'node:fs';
import { win32 } from 'node:path';

type LaunchExecutable = (executablePath: string) => Promise<void>;
type SpawnProcess = (
  command: string,
  args: readonly string[],
  options: {
    detached: boolean;
    shell: boolean;
    stdio: 'ignore';
    windowsHide: boolean;
  },
) => ChildProcess;

export interface QqMusicService {
  isAvailable: (configuredPath: string) => boolean;
  open: (configuredPath: string) => Promise<void>;
}

export class QqMusicNotFoundError extends Error {}
export class QqMusicLaunchError extends Error {}

export function isAllowedQqMusicPath(value: string) {
  const path = value.trim();
  return (
    /^[a-z]:[\\/]/i.test(path)
    && !path.startsWith('\\\\')
    && win32.basename(path).toLowerCase() === 'qqmusic.exe'
  );
}

export function createProcessLauncher(spawnProcess: SpawnProcess = spawn) {
  return (executablePath: string) => new Promise<void>((resolve, reject) => {
    const child = spawnProcess(executablePath, [], {
      detached: true,
      shell: false,
      stdio: 'ignore',
      windowsHide: true,
    });
    child.once('spawn', () => {
      child.unref();
      resolve();
    });
    child.once('error', reject);
  });
}

export function createQqMusicService({
  env = process.env,
  launch = createProcessLauncher(),
}: {
  env?: NodeJS.ProcessEnv;
  launch?: LaunchExecutable;
} = {}): QqMusicService {
  const findExecutable = (configuredPath: string) => {
    const configured = configuredPath.trim();
    if (isUsableExecutable(configured)) return configured;
    return commonQqMusicPaths(env).find(isUsableExecutable);
  };

  return {
    isAvailable(configuredPath) {
      return findExecutable(configuredPath) !== undefined;
    },
    async open(configuredPath) {
      const executablePath = findExecutable(configuredPath);
      if (!executablePath) throw new QqMusicNotFoundError();
      try {
        await launch(executablePath);
      } catch {
        throw new QqMusicLaunchError();
      }
    },
  };
}

function commonQqMusicPaths(env: NodeJS.ProcessEnv) {
  const paths: string[] = [];
  for (const root of [env.ProgramFiles, env['ProgramFiles(x86)']]) {
    if (root) paths.push(win32.join(root, 'Tencent', 'QQMusic', 'QQMusic.exe'));
  }
  if (env.LOCALAPPDATA) {
    paths.push(win32.join(env.LOCALAPPDATA, 'Tencent', 'QQMusic', 'QQMusic.exe'));
    paths.push(win32.join(env.LOCALAPPDATA, 'Programs', 'QQMusic', 'QQMusic.exe'));
  }
  if (env.APPDATA) paths.push(win32.join(env.APPDATA, 'Tencent', 'QQMusic', 'QQMusic.exe'));
  return paths;
}

function isUsableExecutable(path: string) {
  if (!isAllowedQqMusicPath(path)) return false;
  try {
    const stat = lstatSync(path);
    return stat.isFile() && !stat.isSymbolicLink();
  } catch {
    return false;
  }
}
