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
import { createKnowledgeMapService } from './knowledgeMaps/service';
import { createDailyAnkiService } from './anki/daily';
import { createAnkiRouter } from './anki/routes';
import { sendAnkiBundle } from './anki/sender';
import { createAnkiLibraryExportService } from './anki/libraryExports';
import { createAnkiAutoSendService } from './anki/autoSend';
import { createShenlunReviewService } from './shenlunReviews';
import { createCoachDeepSeekProvider } from './coach/deepseek';
import { createHuashengAdapter } from './coach/huasheng';
import { createWebSearchAdapter } from './coach/webSearch';
import { createZhangGongAdapter } from './coach/zhangGong';
import { createCoachService } from './coach';

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
const knowledgeMapService = createKnowledgeMapService({ database: databaseManager });
const dailyAnkiService = createDailyAnkiService({
  database: databaseManager,
  outputDirectory: config.anki.outputDirectory,
  sender: (input) => sendAnkiBundle({
    ...input,
    command: config.anki.ccConnectCommand,
    dataDirectory: config.anki.ccConnectDataDirectory,
  }),
});
const ankiLibraryExportService = createAnkiLibraryExportService({
  database: databaseManager,
  outputDirectory: config.anki.outputDirectory,
});
const ankiAutoSendService = createAnkiAutoSendService({
  database: databaseManager,
  dailyService: dailyAnkiService,
});
const shenlunReviewService = createShenlunReviewService({ database: databaseManager });
const coachService = createCoachService({
  cardService,
  aiProvider: createCoachDeepSeekProvider({
    apiKey: config.deepseek.apiKey,
    baseUrl: config.deepseek.baseUrl,
    model: config.deepseek.model,
  }),
  huasheng: createHuashengAdapter({ url: config.coach.huashengMcpUrl }),
  zhangGong: createZhangGongAdapter({ directory: config.coach.zhangGongSkillDirectory }),
  webSearch: createWebSearchAdapter({ apiKey: config.coach.tavilyApiKey }),
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
  knowledgeMapService,
  shenlunReviewService,
  coachService,
  ankiRouter: createAnkiRouter(dailyAnkiService, ankiLibraryExportService),
});

app.listen(config.port, config.host, () => {
  console.log(`Server listening on http://${config.host}:${config.port}`);
  if (hasConfiguredDeepSeekApiKey(config.deepseek.apiKey)) {
    void cardService.retryPendingBatch(20).catch(() => {
      console.error('启动后的待整理卡片重试失败');
    });
  }
  void ankiAutoSendService.check().then((result) => {
    if (result.status === 'send_failed') {
      console.error('启动后的 Anki 自动发送未完成');
    }
  }).catch(() => {
    console.error('启动后的 Anki 自动发送检查失败');
  });
});
