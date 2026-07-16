import express from 'express';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

export function createApp() {
  const app = express();

  app.use(express.json({ limit: '2mb' }));

  app.get('/api/health', (_request, response) => {
    response.status(200).json({ status: 'ok' });
  });

  const clientDir = resolve(process.cwd(), 'dist/client');
  if (existsSync(clientDir)) {
    const serveClient = express.static(clientDir);
    const isReservedPath = (path: string) =>
      path === '/api' ||
      path.startsWith('/api/') ||
      path === '/uploads' ||
      path.startsWith('/uploads/');

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

  return app;
}
