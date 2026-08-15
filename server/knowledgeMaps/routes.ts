import express from 'express';
import { z } from 'zod';
import { KnowledgeMapServiceError, type KnowledgeMapService } from './service';

const createNameSchema = z.object({ name: z.string().trim().max(40).optional() }).strict();
const nameSchema = z.object({ name: z.string().trim().min(1).max(40) }).strict();
const positionSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
  z: z.number().finite(),
});
const nodeLevelSchema = z.number().int().positive();
const nodeContentSchema = z.preprocess((value) => (value === null ? '' : value), z.string().optional());
const createNodeSchema = positionSchema.extend({
  cardId: z.string().trim().min(1).nullable().optional(),
  title: z.string().trim().optional(),
  content: nodeContentSchema,
  level: nodeLevelSchema.optional(),
}).strict().refine((input) => Boolean(input.cardId || input.title || input.content?.trim()));
const updateNodeSchema = z
  .object({
    x: z.number().finite().optional(),
    y: z.number().finite().optional(),
    z: z.number().finite().optional(),
    title: z.string().trim().optional(),
    content: z.string().optional(),
    level: nodeLevelSchema.optional(),
  })
  .strict()
  .refine((input) => Object.values(input).some((value) => value !== undefined));
const createEdgeSchema = z.object({
  sourceNodeId: z.string().trim().min(1),
  targetNodeId: z.string().trim().min(1),
  label: z.string().trim().max(40),
}).strict();
const updateEdgeSchema = z.object({
  label: z.string().trim().max(40),
}).strict();

export function createKnowledgeMapRouter(service: KnowledgeMapService) {
  const router = express.Router();

  router.get('/', (_request, response) => {
    response.status(200).json(service.listMaps());
  });

  router.post('/', (request, response) => {
    const parsed = createNameSchema.safeParse(request.body);
    if (!parsed.success) {
      sendInvalidRequest(response);
      return;
    }
    try {
      response.status(201).json(service.createMap(parsed.data.name ?? ''));
    } catch (error) {
      sendSafeError(response, error);
    }
  });

  router.get('/:mapId', (request, response) => {
    try {
      response.status(200).json(service.getMap(request.params.mapId));
    } catch (error) {
      sendSafeError(response, error);
    }
  });

  router.patch('/:mapId', (request, response) => {
    const parsed = nameSchema.safeParse(request.body);
    if (!parsed.success) {
      sendInvalidRequest(response);
      return;
    }
    try {
      response.status(200).json(service.renameMap(request.params.mapId, parsed.data.name));
    } catch (error) {
      sendSafeError(response, error);
    }
  });

  router.delete('/:mapId', (request, response) => {
    try {
      service.deleteMap(request.params.mapId);
      response.status(204).end();
    } catch (error) {
      sendSafeError(response, error);
    }
  });

  router.post('/:mapId/nodes', (request, response) => {
    const parsed = createNodeSchema.safeParse(request.body);
    if (!parsed.success) {
      sendInvalidRequest(response);
      return;
    }
    try {
      response.status(201).json(service.addNode(request.params.mapId, parsed.data));
    } catch (error) {
      sendSafeError(response, error);
    }
  });

  router.patch('/:mapId/nodes/:nodeId', (request, response) => {
    const parsed = updateNodeSchema.safeParse(request.body);
    if (!parsed.success) {
      sendInvalidRequest(response);
      return;
    }
    try {
      response.status(200).json(service.updateNode(request.params.mapId, request.params.nodeId, parsed.data));
    } catch (error) {
      sendSafeError(response, error);
    }
  });

  router.delete('/:mapId/nodes/:nodeId', (request, response) => {
    try {
      response.status(200).json(service.deleteNode(request.params.mapId, request.params.nodeId));
    } catch (error) {
      sendSafeError(response, error);
    }
  });

  router.post('/:mapId/edges', (request, response) => {
    const parsed = createEdgeSchema.safeParse(request.body);
    if (!parsed.success) {
      sendInvalidRequest(response);
      return;
    }
    try {
      response.status(201).json(service.addEdge(request.params.mapId, parsed.data));
    } catch (error) {
      sendSafeError(response, error);
    }
  });

  router.patch('/:mapId/edges/:edgeId', (request, response) => {
    const parsed = updateEdgeSchema.safeParse(request.body);
    if (!parsed.success) {
      sendInvalidRequest(response);
      return;
    }
    try {
      response.status(200).json(service.updateEdge(request.params.mapId, request.params.edgeId, parsed.data));
    } catch (error) {
      sendSafeError(response, error);
    }
  });

  router.delete('/:mapId/edges/:edgeId', (request, response) => {
    try {
      response.status(200).json(service.deleteEdge(request.params.mapId, request.params.edgeId));
    } catch (error) {
      sendSafeError(response, error);
    }
  });

  return router;
}

function sendInvalidRequest(response: express.Response) {
  response.status(400).json({ code: 'invalid_request', message: '请求参数不合规' });
}

function sendSafeError(response: express.Response, error: unknown) {
  if (error instanceof KnowledgeMapServiceError) {
    if (error.code === 'not_found') {
      response.status(404).json({ code: 'not_found', message: '图谱资源不存在' });
      return;
    }
    if (error.code === 'map_name_conflict') {
      response.status(409).json({ code: 'map_name_conflict', message: '图谱名称已存在' });
      return;
    }
    if (error.code === 'duplicate_node') {
      response.status(409).json({ code: 'duplicate_node', message: '卡片已在当前图谱中' });
      return;
    }
    if (error.code === 'duplicate_edge') {
      response.status(409).json({ code: 'duplicate_edge', message: '关系已存在' });
      return;
    }
    response.status(400).json({ code: error.code, message: '图谱操作不合规' });
    return;
  }
  response.status(500).json({ code: 'internal_error', message: '请求处理失败' });
}
