import path from 'node:path';
import express from 'express';
import { z } from 'zod';
import type { DailyAnkiSendResult, DailyAnkiService } from './daily';
import type { AnkiLibraryExportService } from './libraryExports';

const requestSchema = z
  .object({
    count: z.number().int().min(1).max(10).default(10),
    send: z.boolean().default(false),
  })
  .strict();

const exportRequestSchema = z
  .object({
    cardIds: z.array(z.string().uuid()).max(500).optional(),
  })
  .strict();

const exportIdSchema = z.string().regex(/^[a-z0-9-]+$/);
const cardIdSchema = z.string().uuid();

export function createAnkiRouter(
  service: DailyAnkiService,
  libraryExportService?: AnkiLibraryExportService,
) {
  const router = express.Router();

  router.post('/api/anki/daily', async (request, response) => {
    const parsed = requestSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      response.status(400).json({ code: 'invalid_request', message: '每日 Anki 参数不合法' });
      return;
    }

    try {
      const result = parsed.data.send
        ? await service.generateAndSend(parsed.data.count)
        : await service.generate(parsed.data.count);
      response.status(200).json(result);
    } catch {
      response.status(500).json({ code: 'internal_error', message: '每日 Anki 卡组生成失败' });
    }
  });

  router.post('/api/anki/cards/:cardId/send', async (request, response) => {
    const parsed = cardIdSchema.safeParse(request.params.cardId);
    if (!parsed.success) {
      response.status(400).json({ code: 'invalid_request', message: '用户初始稿编号不合法' });
      return;
    }

    try {
      const result = await service.generateAndSend(1, {
        cardIds: [parsed.data],
        filePrefix: `card-review-${parsed.data.slice(0, 8)}-${Date.now()}`,
      });
      if (result.status === 'empty') {
        response.status(404).json({ code: 'not_found', message: '用户初始稿不可用' });
        return;
      }
      if (!result.sent) {
        response.status(502).json({
          code: 'send_failed',
          message: describeSendFailure(result.sendResult),
        });
        return;
      }
      response.status(200).json({ status: 'sent', count: result.count, cardId: parsed.data });
    } catch {
      response.status(502).json({ code: 'send_failed', message: 'Anki 卡片发送失败，请确认 cc-connect 已连接手机' });
    }
  });

  router.post('/api/anki/exports', async (request, response) => {
    const parsed = exportRequestSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      response.status(400).json({ code: 'invalid_request', message: 'Anki 导出参数不合法' });
      return;
    }
    if (!libraryExportService) {
      response.status(404).json({ code: 'not_found', message: 'Anki 导出服务不可用' });
      return;
    }

    try {
      const result = await libraryExportService.create(parsed.data.cardIds);
      response.status(result.status === 'created' ? 201 : 200).json(result);
    } catch {
      response.status(500).json({ code: 'internal_error', message: 'Anki 卡片库导出失败' });
    }
  });

  router.get('/api/anki/exports', (_request, response) => {
    if (!libraryExportService) {
      response.status(404).json({ code: 'not_found', message: 'Anki 导出服务不可用' });
      return;
    }

    try {
      response.status(200).json(libraryExportService.list());
    } catch {
      response.status(500).json({ code: 'internal_error', message: 'Anki 导出记录读取失败' });
    }
  });

  router.get('/api/anki/exports/:id/apkg', (request, response) => {
    const parsed = exportIdSchema.safeParse(request.params.id);
    const apkgPath = parsed.success ? libraryExportService?.getApkgPath(parsed.data) : undefined;
    if (!apkgPath) {
      response.status(404).json({ code: 'not_found', message: 'Anki 导出文件不存在' });
      return;
    }

    response.download(apkgPath, path.basename(apkgPath), (error) => {
      if (error && !response.headersSent) {
        response.status(404).json({ code: 'not_found', message: 'Anki 导出文件不存在' });
      }
    });
  });

  router.get('/api/anki/exports/:id', (request, response) => {
    const parsed = exportIdSchema.safeParse(request.params.id);
    const detail = parsed.success ? libraryExportService?.get(parsed.data) : undefined;
    if (!detail) {
      response.status(404).json({ code: 'not_found', message: 'Anki 导出记录不存在' });
      return;
    }

    response.status(200).json(detail);
  });

  return router;
}

function describeSendFailure(result: DailyAnkiSendResult | undefined): string {
  const diagnostics = `${result?.error ?? ''} ${result?.stderr ?? ''}`.toLowerCase();
  if (
    diagnostics.includes('expired context_token')
    || diagnostics.includes('user must send a new message')
  ) {
    return '微信会话已过期，请先给 cc-connect 机器人发送一条消息后重试';
  }
  return 'Anki 卡片发送失败，请确认 cc-connect 已连接手机';
}
