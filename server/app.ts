import express from 'express';
import type { ErrorRequestHandler } from 'express';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createCardRouter } from './cards/routes';
import type { CardService } from './cards/service';
import { createUploadRouter } from './uploads/routes';
import { createStudyRouter } from './study/routes';
import type { StudyService } from './study/service';

interface AppDependencies {
  cardService?: CardService;
  studyService?: StudyService;
  uploadsDirectory?: string;
}

export function createApp({ cardService, studyService, uploadsDirectory }: AppDependencies = {}) {
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
