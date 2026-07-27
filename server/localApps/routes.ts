import express from 'express';
import type { createDatabaseManager } from '../db/database';
import {
  QqMusicNotFoundError,
  type QqMusicService,
} from './qqMusic';

type DatabaseManager = Pick<ReturnType<typeof createDatabaseManager>, 'get'>;

export interface LocalAppsRouterDependencies {
  database: DatabaseManager;
  qqMusicService: QqMusicService;
}

export function createLocalAppsRouter({ database, qqMusicService }: LocalAppsRouterDependencies) {
  const router = express.Router();

  router.post('/api/local-apps/qq-music/open', async (request, response) => {
    if (!isSafeLocalRequest(request)) {
      response.status(400).json({ code: 'invalid_request', message: '请求参数不合法' });
      return;
    }

    try {
      await qqMusicService.open(readConfiguredPath(database));
      response.status(200).json({ opened: true });
    } catch (error) {
      if (error instanceof QqMusicNotFoundError) {
        response.status(404).json({
          code: 'qq_music_not_found',
          message: '请在设置中填写 QQMusic.exe 路径',
        });
        return;
      }
      response.status(500).json({
        code: 'qq_music_launch_failed',
        message: 'QQ 音乐启动失败，请检查配置后重试',
      });
    }
  });

  return router;
}

function isSafeLocalRequest(request: express.Request) {
  if (!request.is('application/json')) return false;
  if (Object.keys(request.body ?? {}).length > 0) return false;
  if (Object.keys(request.query).length > 0) return false;
  if (request.get('sec-fetch-site') === 'cross-site') return false;

  const origin = request.get('origin');
  if (!origin) return true;
  try {
    return new URL(origin).origin === `${request.protocol}://${request.get('host')}`;
  } catch {
    return false;
  }
}

function readConfiguredPath(database: DatabaseManager) {
  const row = database
    .get()
    .prepare("SELECT value_json FROM app_settings WHERE key = 'qqMusicPath'")
    .get() as { value_json: string } | undefined;
  if (!row) return '';
  const value: unknown = JSON.parse(row.value_json);
  return typeof value === 'string' ? value : '';
}
