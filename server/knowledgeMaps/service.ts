import { CardRepository, CardRepositoryError } from '../cards/repository';
import type {
  KnowledgeMapCreateNodeInput,
  KnowledgeMapDetail,
  KnowledgeMapEdge,
  KnowledgeMapNode,
  KnowledgeMapSummary,
  KnowledgeMapUpdateNodeInput,
} from '../../shared/contracts';
import {
  KnowledgeMapRepository,
  KnowledgeMapRepositoryError,
  type KnowledgeMapNodeInsert,
  type KnowledgeMapNodeRecord,
  type KnowledgeMapNodeUpdate,
} from './repository';
import type Database from 'better-sqlite3';

interface DatabaseProvider {
  get(): Database.Database;
}

interface KnowledgeMapServiceDependencies {
  database: DatabaseProvider;
  now?: () => Date;
}

export interface KnowledgeMapService {
  listMaps(): KnowledgeMapSummary[];
  createMap(name: string): KnowledgeMapDetail;
  renameMap(mapId: string, name: string): KnowledgeMapDetail;
  deleteMap(mapId: string): void;
  getMap(mapId: string): KnowledgeMapDetail;
  addNode(mapId: string, input: KnowledgeMapCreateNodeInput): KnowledgeMapDetail;
  updateNode(mapId: string, nodeId: string, input: KnowledgeMapUpdateNodeInput): KnowledgeMapDetail;
  deleteNode(mapId: string, nodeId: string): KnowledgeMapDetail;
  addEdge(mapId: string, input: { sourceNodeId: string; targetNodeId: string; label: string }): KnowledgeMapDetail;
  updateEdge(mapId: string, edgeId: string, input: { label: string }): KnowledgeMapDetail;
  deleteEdge(mapId: string, edgeId: string): KnowledgeMapDetail;
}

export type KnowledgeMapServiceErrorCode =
  | 'duplicate_edge'
  | 'duplicate_node'
  | 'invalid_card'
  | 'invalid_edge'
  | 'invalid_level'
  | 'map_name_conflict'
  | 'not_found';

export class KnowledgeMapServiceError extends Error {
  constructor(readonly code: KnowledgeMapServiceErrorCode) {
    super(code);
    this.name = 'KnowledgeMapServiceError';
  }
}

export function createKnowledgeMapService({
  database,
  now = () => new Date(),
}: KnowledgeMapServiceDependencies): KnowledgeMapService {
  const repository = new KnowledgeMapRepository(database);
  const cards = new CardRepository(database);

  const detail = (mapId: string): KnowledgeMapDetail => toDetail(repository, cards, mapId);
  const timestamp = () => now().toISOString();

  return {
    listMaps() {
      return repository.listMaps();
    },

    createMap(name) {
      const mapName = name.trim() || nextDefaultMapName(repository.listMaps());
      try {
        const mapId = repository.createMap(mapName, timestamp());
        return detail(mapId);
      } catch (error) {
        throw mapError(error);
      }
    },

    renameMap(mapId, name) {
      try {
        repository.renameMap(mapId, name.trim(), timestamp());
        return detail(mapId);
      } catch (error) {
        throw mapError(error);
      }
    },

    deleteMap(mapId) {
      try {
        repository.deleteMap(mapId);
      } catch (error) {
        throw mapError(error);
      }
    },

    getMap(mapId) {
      try {
        return detail(mapId);
      } catch (error) {
        throw mapError(error);
      }
    },

    addNode(mapId, input) {
      try {
        repository.addNode(mapId, prepareCreateNodeInput(input), timestamp());
        return detail(mapId);
      } catch (error) {
        throw mapError(error);
      }
    },

    updateNode(mapId, nodeId, input) {
      try {
        repository.updateNode(mapId, nodeId, prepareUpdateNodeInput(input), timestamp());
        return detail(mapId);
      } catch (error) {
        throw mapError(error);
      }
    },

    deleteNode(mapId, nodeId) {
      try {
        repository.deleteNode(mapId, nodeId, timestamp());
        return detail(mapId);
      } catch (error) {
        throw mapError(error);
      }
    },

    addEdge(mapId, input) {
      try {
        repository.addEdge(
          mapId,
          input.sourceNodeId,
          input.targetNodeId,
          input.label.trim(),
          timestamp(),
        );
        return detail(mapId);
      } catch (error) {
        throw mapError(error);
      }
    },

    updateEdge(mapId, edgeId, input) {
      try {
        repository.updateEdgeLabel(mapId, edgeId, input.label.trim(), timestamp());
        return detail(mapId);
      } catch (error) {
        throw mapError(error);
      }
    },

    deleteEdge(mapId, edgeId) {
      try {
        repository.deleteEdge(mapId, edgeId, timestamp());
        return detail(mapId);
      } catch (error) {
        throw mapError(error);
      }
    },
  };
}

function toDetail(
  repository: KnowledgeMapRepository,
  cards: CardRepository,
  mapId: string,
): KnowledgeMapDetail {
  const map = repository.getSummary(mapId);
  const nodes = repository.listNodes(mapId).map((node) => toNode(node, cards));
  const edges = repository.listEdges(mapId);
  return { map, nodes, edges };
}

function toNode(node: KnowledgeMapNodeRecord, cards: CardRepository): KnowledgeMapNode {
  return {
    id: node.id,
    mapId: node.map_id,
    cardId: node.card_id,
    title: node.title,
    content: node.content,
    level: node.level,
    x: node.x,
    y: node.y,
    z: node.z,
    createdAt: node.created_at,
    updatedAt: node.updated_at,
    card: node.card_id === null ? null : cards.getDetail(node.card_id),
  };
}

function prepareCreateNodeInput(input: KnowledgeMapCreateNodeInput): KnowledgeMapNodeInsert {
  const cardId = normalizeCardId(input.cardId);
  return {
    cardId,
    title: normalizeTitle(input.title),
    content: input.content ?? '',
    level: normalizeLevel(input.level ?? (cardId ? 2 : 1)),
    x: input.x,
    y: input.y,
    z: input.z,
  };
}

function prepareUpdateNodeInput(input: KnowledgeMapUpdateNodeInput): KnowledgeMapNodeUpdate {
  return {
    ...(input.title !== undefined ? { title: normalizeTitle(input.title) } : {}),
    ...(input.content !== undefined ? { content: input.content } : {}),
    ...(input.level !== undefined ? { level: normalizeLevel(input.level) } : {}),
    ...(input.x !== undefined ? { x: input.x } : {}),
    ...(input.y !== undefined ? { y: input.y } : {}),
    ...(input.z !== undefined ? { z: input.z } : {}),
  };
}

function normalizeCardId(cardId: string | null | undefined) {
  if (typeof cardId !== 'string') return null;
  const trimmed = cardId.trim();
  return trimmed ? trimmed : null;
}

function normalizeTitle(title: string | undefined) {
  return title?.trim() ?? '';
}

function normalizeLevel(level: number) {
  if (!Number.isInteger(level) || level < 1) throw new KnowledgeMapServiceError('invalid_level');
  return level;
}

function nextDefaultMapName(maps: KnowledgeMapSummary[]) {
  const existingNames = new Set(maps.map(({ name }) => name.trim().toLocaleLowerCase()));
  let index = maps.length + 1;
  while (existingNames.has(`知识图谱 ${index}`.toLocaleLowerCase())) {
    index += 1;
  }
  return `知识图谱 ${index}`;
}

function mapError(error: unknown, notFoundCode: KnowledgeMapServiceErrorCode = 'not_found') {
  if (error instanceof CardRepositoryError) {
    if (error.code === 'not_found') return new KnowledgeMapServiceError('invalid_card');
  }
  if (error instanceof KnowledgeMapRepositoryError) {
    if (error.code === 'not_found') return new KnowledgeMapServiceError(notFoundCode);
    return new KnowledgeMapServiceError(error.code);
  }
  return error;
}
