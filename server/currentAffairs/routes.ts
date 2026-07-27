import express from 'express';
import type { CurrentAffairsService } from './service';

export function createCurrentAffairsRouter(service: CurrentAffairsService) {
  const router = express.Router();

  router.get('/api/current-affairs', async (_request, response) => {
    response.status(200).json(await service.getCurrentAffairs());
  });

  return router;
}
