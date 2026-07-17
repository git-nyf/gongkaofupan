import { randomUUID } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import express from 'express';
import multer from 'multer';
import type { AttachmentInput, CreateCardInput } from '../../shared/contracts';
import { createCardSchema } from '../cards/routes';
import { CardServiceError, type CardService } from '../cards/service';

const maxFileSize = 10 * 1024 * 1024;
const extensionByMime = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
} as const;
const mimeByExtension = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
} as const;
const storedNamePattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(?:png|jpg|webp)$/i;

class InvalidImageTypeError extends Error {}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxFileSize },
  fileFilter(_request, file, callback) {
    if (isAllowedImageMime(file.mimetype)) callback(null, true);
    else callback(new InvalidImageTypeError());
  },
});

interface PreparedFile {
  metadata: AttachmentInput;
  buffer: Buffer;
  filePath: string;
}

export function createUploadRouter(cardService: CardService, uploadsDirectory: string) {
  const router = express.Router();
  const directory = resolve(uploadsDirectory);

  router.post('/api/cards', (request, response, next) => {
    if (!request.is('multipart/form-data')) {
      next();
      return;
    }
    upload.any()(request, response, (error) => {
      if (error) {
        sendUploadError(response, error);
        return;
      }
      void createMultipartCard(request, response, cardService, directory);
    });
  });

  router.post('/api/cards/:id/attachments', (request, response) => {
    upload.any()(request, response, (error) => {
      if (error) {
        sendUploadError(response, error);
        return;
      }
      void addAttachments(request, response, cardService, directory);
    });
  });

  router.delete('/api/cards/:cardId/attachments/:attachmentId', async (request, response) => {
    try {
      await cardService.deleteAttachment(request.params.cardId, request.params.attachmentId);
      response.status(204).end();
    } catch (error) {
      sendServiceError(response, error);
    }
  });

  router.get('/uploads/:storedName', async (request, response) => {
    const { storedName } = request.params;
    const filePath = safeStoredPath(directory, storedName);
    if (!filePath) {
      sendNotFound(response);
      return;
    }
    try {
      const content = await readFile(filePath);
      const mimeType = mimeByExtension[extname(storedName).toLowerCase() as keyof typeof mimeByExtension];
      response.status(200).type(mimeType).send(content);
    } catch (error) {
      if (isMissingFileError(error)) sendNotFound(response);
      else sendInternalError(response);
    }
  });

  return router;
}

async function createMultipartCard(
  request: express.Request,
  response: express.Response,
  cardService: CardService,
  directory: string,
) {
  if (
    Object.keys(request.body).length !== 1 ||
    typeof request.body.payload !== 'string'
  ) {
    sendInvalidRequest(response);
    return;
  }

  let payload: unknown;
  try {
    payload = JSON.parse(request.body.payload);
  } catch {
    sendInvalidRequest(response);
    return;
  }
  const parsed = createCardSchema.safeParse(payload);
  const files = uploadedFiles(request);
  if (!parsed.success || !files || !areValidImages(files)) {
    sendInvalidRequest(response);
    return;
  }
  const prepared = prepareFiles(files, directory);
  if (!prepared) {
    sendInternalError(response);
    return;
  }

  if (!(await writePreparedFiles(prepared, directory))) {
    sendInternalError(response);
    return;
  }
  try {
    const input: CreateCardInput = {
      ...parsed.data,
      attachments: prepared.map(({ metadata }) => metadata),
    };
    response.status(201).json(await cardService.create(input));
  } catch (error) {
    const cleaned = await cleanupFiles(prepared.map(({ filePath }) => filePath));
    if (cleaned) sendServiceError(response, error);
    else sendInternalError(response);
  }
}

async function addAttachments(
  request: express.Request,
  response: express.Response,
  cardService: CardService,
  directory: string,
) {
  const files = uploadedFiles(request);
  if (
    Object.keys(request.body).length !== 0 ||
    !files ||
    files.length === 0 ||
    !areValidImages(files)
  ) {
    sendInvalidRequest(response);
    return;
  }
  const prepared = prepareFiles(files, directory);
  if (!prepared) {
    sendInternalError(response);
    return;
  }

  if (!(await writePreparedFiles(prepared, directory))) {
    sendInternalError(response);
    return;
  }
  try {
    response.status(201).json(
      cardService.addAttachments(
        request.params.id,
        prepared.map(({ metadata }) => metadata),
      ),
    );
  } catch (error) {
    const cleaned = await cleanupFiles(prepared.map(({ filePath }) => filePath));
    if (cleaned) sendServiceError(response, error);
    else sendInternalError(response);
  }
}

function uploadedFiles(request: express.Request): Express.Multer.File[] | undefined {
  return Array.isArray(request.files) ? request.files : undefined;
}

function areValidImages(files: Express.Multer.File[]) {
  return files.every(
    (file) =>
      isAllowedImageMime(file.mimetype) &&
      file.size <= maxFileSize &&
      Buffer.isBuffer(file.buffer),
  );
}

export function isAllowedImageMime(
  mimeType: string,
): mimeType is keyof typeof extensionByMime {
  return Object.hasOwn(extensionByMime, mimeType);
}

function prepareFiles(files: Express.Multer.File[], directory: string): PreparedFile[] | undefined {
  const prepared: PreparedFile[] = [];
  for (const file of files) {
    const extension = extensionByMime[file.mimetype as keyof typeof extensionByMime];
    const storedName = `${randomUUID()}${extension}`;
    const filePath = safeStoredPath(directory, storedName);
    if (!filePath) return undefined;
    prepared.push({
      metadata: {
        id: randomUUID(),
        storedName,
        originalName: file.originalname,
        mimeType: file.mimetype,
        byteSize: file.size,
      },
      buffer: file.buffer,
      filePath,
    });
  }
  return prepared;
}

async function writePreparedFiles(prepared: PreparedFile[], directory: string) {
  try {
    await mkdir(directory, { recursive: true });
    for (const file of prepared) await writeFile(file.filePath, file.buffer, { flag: 'wx' });
    return true;
  } catch {
    await cleanupFiles(prepared.map(({ filePath }) => filePath));
    return false;
  }
}

async function cleanupFiles(filePaths: string[]) {
  let cleaned = true;
  for (const filePath of filePaths) {
    try {
      await unlink(filePath);
    } catch (error) {
      if (!isMissingFileError(error)) cleaned = false;
    }
  }
  return cleaned;
}

function safeStoredPath(directory: string, storedName: string) {
  if (!storedNamePattern.test(storedName)) return undefined;
  const filePath = resolve(directory, storedName);
  return filePath.startsWith(`${directory}${sep}`) ? filePath : undefined;
}

function isMissingFileError(error: unknown) {
  return typeof error === 'object' && error !== null && Reflect.get(error, 'code') === 'ENOENT';
}

function sendUploadError(response: express.Response, error: unknown) {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      response.status(413).json({ code: 'file_too_large', message: '单张图片不能超过 10MB' });
      return;
    }
    sendInvalidRequest(response);
    return;
  }
  if (error instanceof InvalidImageTypeError) {
    sendInvalidRequest(response);
    return;
  }
  sendInternalError(response);
}

function sendServiceError(response: express.Response, error: unknown) {
  if (error instanceof CardServiceError) {
    if (error.code === 'not_found') {
      sendNotFound(response);
      return;
    }
    if (error.code === 'invalid_state') {
      response.status(409).json({ code: 'invalid_state', message: '当前卡片状态不可操作' });
      return;
    }
    sendInvalidRequest(response);
    return;
  }
  sendInternalError(response);
}

function sendInvalidRequest(response: express.Response) {
  response.status(400).json({ code: 'invalid_request', message: '上传请求不合法' });
}

function sendNotFound(response: express.Response) {
  response.status(404).json({ code: 'not_found', message: '文件或附件不存在' });
}

function sendInternalError(response: express.Response) {
  response.status(500).json({ code: 'internal_error', message: '上传处理失败' });
}
