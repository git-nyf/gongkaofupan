import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { unlink } from 'node:fs/promises';
import express from 'express';
import multer from 'multer';
import { BackupServiceError, type BackupService } from './service';

const maximumBackupSize = 512 * 1024 * 1024;
const acceptedMimeTypes = new Set([
  'application/zip',
  'application/x-zip-compressed',
  'application/octet-stream',
]);

const upload = multer({
  storage: multer.diskStorage({
    destination: tmpdir(),
    filename: (_request, _file, callback) => callback(null, `gongkao-restore-${randomUUID()}.zip`),
  }),
  limits: { fileSize: maximumBackupSize, files: 1, fields: 0, parts: 2 },
  fileFilter: (_request, file, callback) => {
    const accepted =
      acceptedMimeTypes.has(file.mimetype) && path.extname(file.originalname).toLowerCase() === '.zip';
    if (accepted) callback(null, true);
    else callback(new InvalidBackupUploadError());
  },
});

class InvalidBackupUploadError extends Error {}

const invalidMulterCodes = new Set([
  'LIMIT_PART_COUNT',
  'LIMIT_FILE_COUNT',
  'LIMIT_FIELD_KEY',
  'LIMIT_FIELD_VALUE',
  'LIMIT_FIELD_COUNT',
  'LIMIT_UNEXPECTED_FILE',
  'LIMIT_FIELD_NESTING',
  'MISSING_FIELD_NAME',
]);

export function mapBackupUploadError(error: unknown) {
  if (error instanceof InvalidBackupUploadError) {
    return {
      status: 400,
      body: { code: 'invalid_request', message: '恢复请求不合法' },
    };
  }
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return {
        status: 413,
        body: { code: 'file_too_large', message: '备份文件不能超过 512MB' },
      };
    }
    if (invalidMulterCodes.has(error.code)) {
      return {
        status: 400,
        body: { code: 'invalid_request', message: '恢复请求不合法' },
      };
    }
  }
  return {
    status: 500,
    body: { code: 'internal_error', message: '备份恢复处理失败' },
  };
}

export function createBackupRouter(service: BackupService) {
  const router = express.Router();

  router.post('/api/backups', async (_request, response) => {
    try {
      const backup = await service.createBackup();
      response.download(backup.filePath, backup.fileName, (error) => {
        if (error && !response.headersSent) sendInternalError(response);
      });
    } catch {
      sendInternalError(response);
    }
  });

  router.post('/api/restores', (request, response) => {
    if (!request.is('multipart/form-data')) {
      sendInvalidRequest(response);
      return;
    }
    upload.single('backup')(request, response, (error) => {
      if (error) {
        sendUploadError(response, error);
        return;
      }
      void restoreUploadedBackup(request, response, service);
    });
  });

  return router;
}

async function restoreUploadedBackup(
  request: express.Request,
  response: express.Response,
  service: BackupService,
) {
  const uploadedPath = request.file?.path;
  if (!uploadedPath) {
    sendInvalidRequest(response);
    return;
  }

  try {
    response.status(200).json(await service.restoreBackup(uploadedPath));
  } catch (error) {
    if (error instanceof BackupServiceError && error.code === 'invalid_backup') {
      response.status(400).json({ code: 'invalid_backup', message: '备份文件无效' });
    } else {
      sendInternalError(response);
    }
  } finally {
    await unlink(uploadedPath).catch(() => undefined);
  }
}

function sendUploadError(response: express.Response, error: unknown) {
  const mapped = mapBackupUploadError(error);
  response.status(mapped.status).json(mapped.body);
}

function sendInvalidRequest(response: express.Response) {
  response.status(400).json({ code: 'invalid_request', message: '恢复请求不合法' });
}

function sendInternalError(response: express.Response) {
  response.status(500).json({ code: 'internal_error', message: '备份恢复处理失败' });
}
