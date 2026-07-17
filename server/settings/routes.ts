import express from 'express';
import { z } from 'zod';
import type { createDatabaseManager } from '../db/database';

type DatabaseManager = Pick<ReturnType<typeof createDatabaseManager>, 'get'>;

export interface SettingsRouterDependencies {
  database: DatabaseManager;
  deepseekApiKey: string;
}

const defaultSettings = {
  defaultSessionSize: 20,
  defaultOrder: 'random' as const,
  dueFirst: true,
};

const settingSchemas = {
  defaultSessionSize: z.number().int().min(1).max(100),
  defaultOrder: z.enum(['fixed', 'random']),
  dueFirst: z.boolean(),
};

const patchSchema = z
  .object(settingSchemas)
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0);

type Settings = {
  defaultSessionSize: number;
  defaultOrder: 'fixed' | 'random';
  dueFirst: boolean;
};

interface SettingRow {
  key: keyof Settings;
  value_json: string;
}

export function createSettingsRouter({ database, deepseekApiKey }: SettingsRouterDependencies) {
  const router = express.Router();

  router.get('/api/settings', (_request, response) => {
    try {
      response.status(200).json(readResponse(database, deepseekApiKey));
    } catch {
      response.status(500).json({ code: 'internal_error', message: '设置读取失败' });
    }
  });

  router.patch('/api/settings', (request, response) => {
    const parsed = patchSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({ code: 'invalid_request', message: '请求参数不合法' });
      return;
    }

    try {
      const update = database.get().transaction(() => {
        const write = database.get().prepare(`
          INSERT INTO app_settings (key, value_json) VALUES (?, ?)
          ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json
        `);
        for (const [key, value] of Object.entries(parsed.data)) {
          write.run(key, JSON.stringify(value));
        }
        return readResponse(database, deepseekApiKey);
      });
      response.status(200).json(update());
    } catch {
      response.status(500).json({ code: 'internal_error', message: '设置保存失败' });
    }
  });

  return router;
}

function readResponse(database: DatabaseManager, deepseekApiKey: string) {
  const rows = database
    .get()
    .prepare(`
      SELECT key, value_json
      FROM app_settings
      WHERE key IN ('defaultSessionSize', 'defaultOrder', 'dueFirst')
    `)
    .all() as SettingRow[];
  const settings: Settings = { ...defaultSettings };

  for (const row of rows) {
    const parsed = settingSchemas[row.key].parse(JSON.parse(row.value_json));
    Object.assign(settings, { [row.key]: parsed });
  }

  return {
    ...settings,
    deepseekConfigured: deepseekApiKey.trim().length > 0,
  };
}
