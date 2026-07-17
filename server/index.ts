import 'dotenv/config';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { createApp } from './app';
import { createDeepSeekProvider } from './ai/deepseek';
import { createCardService } from './cards/service';
import { readConfig } from './config';
import { createDatabaseManager } from './db/database';
import { migrate } from './db/migrations';

const config = readConfig();
mkdirSync(config.dataDir, { recursive: true });
const databaseManager = createDatabaseManager(resolve(config.dataDir, 'gongkao.db'));
migrate(databaseManager.get());
const cardService = createCardService({
  database: databaseManager,
  aiProvider: createDeepSeekProvider({
    apiKey: config.deepseek.apiKey,
    baseUrl: config.deepseek.baseUrl,
  }),
});
cardService.recoverStaleProcessing(new Date());
const app = createApp({ cardService });

app.listen(config.port, '127.0.0.1', () => {
  console.log(`Server listening on http://127.0.0.1:${config.port}`);
  void cardService.retryPendingBatch(20).catch(() => {
    console.error('启动后的待整理卡片重试失败');
  });
});
