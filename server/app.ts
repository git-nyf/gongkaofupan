import express, { type Router } from 'express';
import type { ErrorRequestHandler } from 'express';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createCardRouter } from './cards/routes';
import type { CardService } from './cards/service';
import { createUploadRouter } from './uploads/routes';
import { createStudyRouter } from './study/routes';
import type { StudyService } from './study/service';
import { createAnalyticsRouter } from './analytics/routes';
import type { AnalyticsService } from './analytics/service';
import { createSettingsRouter, type SettingsRouterDependencies } from './settings/routes';
import { createBackupRouter } from './backups/routes';
import type { BackupService } from './backups/service';
import { createLocalAppsRouter, type LocalAppsRouterDependencies } from './localApps/routes';
import { createCurrentAffairsRouter } from './currentAffairs/routes';
import type { CurrentAffairsService } from './currentAffairs/service';
import { createReviewImageRouter, type ReviewImageService } from './reviewImages';
import { createKnowledgeMapRouter } from './knowledgeMaps/routes';
import type { KnowledgeMapService } from './knowledgeMaps/service';
import { createShenlunReviewRouter, type ShenlunReviewService } from './shenlunReviews';
import { createCoachRouter, type CoachService } from './coach';

interface AppDependencies {
  cardService?: CardService;
  studyService?: StudyService;
  analyticsService?: AnalyticsService;
  settings?: SettingsRouterDependencies;
  uploadsDirectory?: string;
  backupService?: BackupService;
  localApps?: LocalAppsRouterDependencies;
  currentAffairsService?: CurrentAffairsService;
  reviewImageService?: ReviewImageService;
  knowledgeMapService?: KnowledgeMapService;
  shenlunReviewService?: ShenlunReviewService;
  ankiRouter?: Router;
  coachService?: CoachService;
}

export function createApp({
  cardService,
  studyService,
  analyticsService,
  settings,
  uploadsDirectory,
  backupService,
  localApps,
  currentAffairsService,
  reviewImageService,
  knowledgeMapService,
  shenlunReviewService,
  ankiRouter,
  coachService,
}: AppDependencies = {}) {
  const app = express();

  app.use(express.json({ limit: '2mb' }));

  app.get('/api/health', (_request, response) => {
    response.status(200).json({ status: 'ok' });
  });

  if (cardService) {
    if (uploadsDirectory) {
      app.use(createUploadRouter(cardService, uploadsDirectory));
    }
    app.use('/api/cards', createCardRouter(cardService));
  }

  if (studyService) {
    app.use(createStudyRouter(studyService));
  }

  if (analyticsService) {
    app.use(createAnalyticsRouter(analyticsService));
  }

  if (settings) {
    app.use(createSettingsRouter(settings));
  }

  if (backupService) {
    app.use(createBackupRouter(backupService));
  }

  if (localApps) {
    app.use(createLocalAppsRouter(localApps));
  }

  if (currentAffairsService) {
    app.use(createCurrentAffairsRouter(currentAffairsService));
  }

  if (reviewImageService) {
    app.use(createReviewImageRouter(reviewImageService));
  }

  if (knowledgeMapService) {
    app.use('/api/knowledge-maps', createKnowledgeMapRouter(knowledgeMapService));
  }

  if (shenlunReviewService) {
    app.use('/api/shenlun-reviews', createShenlunReviewRouter(shenlunReviewService));
  }

  if (ankiRouter) {
    app.use(ankiRouter);
  }

  if (coachService) {
    app.use('/api/coach', createCoachRouter(coachService));
  }

  const clientDir = resolve(process.cwd(), 'dist/client');
  if (existsSync(clientDir)) {
    const serveClient = express.static(clientDir);
    const isReservedPath = (path: string) => {
      const normalizedPath = path.toLowerCase();

      return (
        normalizedPath === '/api' ||
        normalizedPath.startsWith('/api/') ||
        normalizedPath === '/uploads' ||
        normalizedPath.startsWith('/uploads/')
      );
    };

    app.use((request, response, next) => {
      if (isReservedPath(request.path)) {
        next();
        return;
      }

      serveClient(request, response, next);
    });

    app.get('*', (request, response, next) => {
      if (isReservedPath(request.path)) {
        next();
        return;
      }

      response.sendFile(resolve(clientDir, 'index.html'));
    });
  }

  const safeErrorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
    const status =
      typeof error === 'object' && error !== null && Reflect.get(error, 'status') === 413 ? 413 : 400;
    response.status(status).json({ code: 'invalid_request', message: '请求参数不合法' });
  };
  app.use(safeErrorHandler);

  return app;
}
