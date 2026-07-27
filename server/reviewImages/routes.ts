import express from 'express';
import multer from 'multer';
import {
  hasMatchingImageSignature,
  isReviewImageId,
  isReviewImageMimeType,
  ReviewImageServiceError,
  reviewImageMaximumBytes,
  reviewImageMaximumCount,
  type ReviewImageService,
} from './service';

class InvalidReviewImageTypeError extends Error {}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: reviewImageMaximumBytes,
    files: reviewImageMaximumCount,
    fields: 0,
    parts: reviewImageMaximumCount + 1,
  },
  fileFilter(_request, file, callback) {
    if (isReviewImageMimeType(file.mimetype)) callback(null, true);
    else callback(new InvalidReviewImageTypeError());
  },
});

export function createReviewImageRouter(service: ReviewImageService) {
  const router = express.Router();

  router.get('/api/review-images', async (_request, response) => {
    try {
      response.status(200).json(await service.list());
    } catch {
      sendInternalError(response);
    }
  });

  router.post('/api/review-boards', async (request, response) => {
    if (!hasOnlyProperty(request.body, 'name') || typeof request.body.name !== 'string') {
      sendInvalidRequest(response);
      return;
    }
    try {
      response.status(201).json({ board: await service.createBoard(request.body.name) });
    } catch (error) {
      sendServiceError(response, error);
    }
  });

  router.put('/api/review-boards/order', async (request, response) => {
    if (!hasOnlyIdArray(request.body)) {
      sendInvalidRequest(response);
      return;
    }
    try {
      response.status(200).json({ boards: await service.setBoardOrder(request.body.ids) });
    } catch (error) {
      sendServiceError(response, error);
    }
  });

  router.patch('/api/review-boards/:id', async (request, response) => {
    if (
      !isReviewImageId(request.params.id) ||
      !hasOnlyProperty(request.body, 'hidden') ||
      typeof request.body.hidden !== 'boolean'
    ) {
      sendInvalidRequest(response);
      return;
    }
    try {
      response.status(200).json({
        board: await service.setBoardHidden(request.params.id, request.body.hidden),
      });
    } catch (error) {
      sendServiceError(response, error);
    }
  });

  router.put('/api/review-boards/:boardId/sections/order', async (request, response) => {
    if (!isReviewImageId(request.params.boardId) || !hasOnlyIdArray(request.body)) {
      sendInvalidRequest(response);
      return;
    }
    try {
      response.status(200).json({
        board: await service.setSectionOrder(request.params.boardId, request.body.ids),
      });
    } catch (error) {
      sendServiceError(response, error);
    }
  });

  router.post('/api/review-boards/:boardId/sections', async (request, response) => {
    if (
      !isReviewImageId(request.params.boardId) ||
      !hasOnlyProperty(request.body, 'name') ||
      typeof request.body.name !== 'string'
    ) {
      sendInvalidRequest(response);
      return;
    }
    try {
      response.status(201).json({
        section: await service.createSection(request.params.boardId, request.body.name),
      });
    } catch (error) {
      sendServiceError(response, error);
    }
  });

  router.patch('/api/review-sections/:id', async (request, response) => {
    if (
      !isReviewImageId(request.params.id) ||
      !hasOnlyProperty(request.body, 'hidden') ||
      typeof request.body.hidden !== 'boolean'
    ) {
      sendInvalidRequest(response);
      return;
    }
    try {
      response.status(200).json({
        section: await service.setSectionHidden(request.params.id, request.body.hidden),
      });
    } catch (error) {
      sendServiceError(response, error);
    }
  });

  router.post('/api/review-images', (request, response) => {
    const sectionId = request.query.sectionId;
    if (
      !request.is('multipart/form-data') ||
      typeof sectionId !== 'string' ||
      !isReviewImageId(sectionId)
    ) {
      sendInvalidRequest(response);
      return;
    }
    upload.array('image', reviewImageMaximumCount)(request, response, (error) => {
      if (error) {
        sendUploadError(response, error);
        return;
      }
      void addImages(request, response, service, sectionId);
    });
  });

  router.delete('/api/review-images/:id', async (request, response) => {
    if (!isReviewImageId(request.params.id)) {
      sendInvalidRequest(response);
      return;
    }
    try {
      await service.delete(request.params.id);
      response.status(204).end();
    } catch (error) {
      sendServiceError(response, error);
    }
  });

  router.get('/api/review-images/:id/content', async (request, response) => {
    if (!isReviewImageId(request.params.id)) {
      sendInvalidRequest(response);
      return;
    }
    try {
      const file = await service.read(request.params.id);
      if (!file) {
        sendNotFound(response);
        return;
      }
      response
        .status(200)
        .type(file.mimeType)
        .set('Cache-Control', 'private, max-age=31536000, immutable')
        .send(file.content);
    } catch {
      sendInternalError(response);
    }
  });

  return router;
}

async function addImages(
  request: express.Request,
  response: express.Response,
  service: ReviewImageService,
  sectionId: string,
) {
  const files = Array.isArray(request.files) ? request.files : [];
  if (
    files.length === 0 ||
    Object.keys(request.body).length !== 0 ||
    !files.every(
      (file) =>
        isReviewImageMimeType(file.mimetype) &&
        Buffer.isBuffer(file.buffer) &&
        hasMatchingImageSignature(file.mimetype, file.buffer),
    )
  ) {
    sendInvalidRequest(response);
    return;
  }

  try {
    const items = await service.add(
      files.map((file) => ({
        originalName: normalizeOriginalName(file.originalname),
        mimeType: file.mimetype,
        buffer: file.buffer,
      })),
      sectionId,
    );
    response.status(201).json({ items });
  } catch (error) {
    sendServiceError(response, error);
  }
}

function normalizeOriginalName(value: string) {
  if ([...value].some((character) => character.codePointAt(0)! > 255)) return value;
  const decoded = Buffer.from(value, 'latin1').toString('utf8');
  return decoded.includes('\uFFFD') ? value : decoded;
}

function hasOnlyProperty(value: unknown, property: string): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    Object.keys(value).length === 1 &&
    Object.hasOwn(value, property)
  );
}

function hasOnlyIdArray(value: unknown): value is { ids: string[] } {
  return (
    hasOnlyProperty(value, 'ids') &&
    Array.isArray(value.ids) &&
    value.ids.every((id) => typeof id === 'string' && isReviewImageId(id))
  );
}

function sendUploadError(response: express.Response, error: unknown) {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      response.status(413).json({
        code: 'file_too_large',
        message: '单张图片不能超过 10MB',
      });
      return;
    }
    sendInvalidRequest(response);
    return;
  }
  if (error instanceof InvalidReviewImageTypeError) {
    sendInvalidRequest(response);
    return;
  }
  sendInternalError(response);
}

function sendServiceError(response: express.Response, error: unknown) {
  if (error instanceof ReviewImageServiceError) {
    if (error.code === 'not_found') {
      sendNotFound(response);
      return;
    }
    if (error.code === 'conflict') {
      response.status(409).json({ code: 'conflict', message: '同级分类名称已存在' });
      return;
    }
    sendInvalidRequest(response);
    return;
  }
  sendInternalError(response);
}

function sendInvalidRequest(response: express.Response) {
  response.status(400).json({ code: 'invalid_request', message: '图片请求不合法' });
}

function sendNotFound(response: express.Response) {
  response.status(404).json({ code: 'not_found', message: '图片不存在' });
}

function sendInternalError(response: express.Response) {
  response.status(500).json({ code: 'internal_error', message: '图片处理失败' });
}
