import express from 'express';
import type { AnalyticsService } from './service';

export function createAnalyticsRouter(service: AnalyticsService) {
  const router = express.Router();

  router.get('/api/dashboard', (_request, response) => {
    try {
      response.status(200).json(service.dashboard());
    } catch {
      response.status(500).json({ code: 'internal_error', message: '统计读取失败' });
    }
  });

  router.get('/api/review-summary', (_request, response) => {
    try {
      response.status(200).json(service.reviewSummary());
    } catch {
      response.status(500).json({ code: 'internal_error', message: '统计读取失败' });
    }
  });

  return router;
}
