import 'dotenv/config';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { createApp } from './app';
import { createDeepSeekProvider, hasConfiguredDeepSeekApiKey } from './ai/deepseek';
import { createAnalyticsService } from './analytics/service';
import { createCardService } from './cards/service';
import { readConfig } from './config';
import { createDatabaseManager } from './db/database';
import { migrate } from './db/migrations';
import { createStudyService } from './study/service';
import { createBackupService } from './backups/service';
import { createQqMusicService } from './localApps/qqMusic';
import { createCurrentAffairsService } from './currentAffairs/service';
import { createReviewImageService } from './reviewImages';

const config = readConfig();
mkdirSync(config.dataDir, { recursive: true });
const uploadsDirectory = resolve(config.dataDir, 'uploads');
mkdirSync(uploadsDirectory, { recursive: true });
const databaseManager = createDatabaseManager(resolve(config.dataDir, 'gongkao.db'));
migrate(databaseManager.get());
const cardService = createCardService({
  database: databaseManager,
  aiProvider: createDeepSeekProvider({
    apiKey: config.deepseek.apiKey,
    baseUrl: config.deepseek.baseUrl,
  }),
  uploadsDirectory,
});
cardService.recoverStaleProcessing(new Date());
const studyService = createStudyService({ database: databaseManager });
const analyticsService = createAnalyticsService({ database: databaseManager });
const backupService = createBackupService({
  database: databaseManager,
  dataDirectory: config.dataDir,
  uploadsDirectory,
});
const qqMusicService = createQqMusicService();
const currentAffairsService = createCurrentAffairsService();
const reviewImageService = createReviewImageService({
  directory: resolve(config.dataDir, 'review-images'),
});
const app = createApp({
  cardService,
  studyService,
  analyticsService,
  settings: {
    database: databaseManager,
    deepseekApiKey: config.deepseek.apiKey,
    isQqMusicAvailable: qqMusicService.isAvailable,
  },
  uploadsDirectory,
  backupService,
  localApps: { database: databaseManager, qqMusicService },
  currentAffairsService,
  reviewImageService,
});

app.listen(config.port, '127.0.0.1', () => {
  console.log(`Server listening on http://127.0.0.1:${config.port}`);
  if (hasConfiguredDeepSeekApiKey(config.deepseek.apiKey)) {
    void cardService.retryPendingBatch(20).catch(() => {
      console.error('启动后的待整理卡片重试失败');
    });
  }
});
