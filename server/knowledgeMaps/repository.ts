import { randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';
import type { KnowledgeMapEdge, KnowledgeMapSummary } from '../../shared/contracts';

interface DatabaseProvider {
  get(): Database.Database;
}

interface KnowledgeMapSummaryRow {
  id: string;
  name: string;
  node_count: number;
  edge_count: number;
  created_at: string;
  updated_at: string;
}

interface KnowledgeMapNodeRow {
  id: string;
  map_id: string;
  card_id: string | null;
  title: string;
  content: string;
  level: number;
  x: number;
  y: number;
  z: number;
  created_at: string;
  updated_at: string;
}

interface KnowledgeMapEdgeRow {
  id: string;
  map_id: string;
  source_node_id: string;
  target_node_id: string;
  label: string;
  created_at: string;
  updated_at: string;
}

export type KnowledgeMapRepositoryErrorCode =
  | 'duplicate_edge'
  | 'duplicate_node'
  | 'invalid_card'
  | 'invalid_edge'
  | 'map_name_conflict'
  | 'not_found';

export class KnowledgeMapRepositoryError extends Error {
  constructor(readonly code: KnowledgeMapRepositoryErrorCode) {
    super(code);
    this.name = 'KnowledgeMapRepositoryError';
  }
}

export interface KnowledgeMapNodeInsert {
  cardId: string | null;
  title: string;
  content: string;
  level: number;
  x: number;
  y: number;
  z: number;
}

export interface KnowledgeMapNodeUpdate {
  title?: string;
  content?: string;
  level?: number;
  x?: number;
  y?: number;
  z?: number;
}

export class KnowledgeMapRepository {
  constructor(private readonly database: DatabaseProvider) {}

  listMaps(): KnowledgeMapSummary[] {
    return (
      this.database
        .get()
        .prepare(summarySql(''))
        .all() as KnowledgeMapSummaryRow[]
    ).map(toSummary);
  }

  getSummary(mapId: string): KnowledgeMapSummary {
    const row = this.database
      .get()
      .prepare(summarySql('WHERE knowledge_maps.id = ?'))
      .get(mapId) as KnowledgeMapSummaryRow | undefined;
    if (!row) throw new KnowledgeMapRepositoryError('not_found');
    return toSummary(row);
  }

  createMap(name: string, timestamp: string): string {
    const id = randomUUID();
    try {
      this.database
        .get()
        .prepare('INSERT INTO knowledge_maps (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)')
        .run(id, name, timestamp, timestamp);
      return id;
    } catch (error) {
      if (isSqliteConstraint(error)) throw new KnowledgeMapRepositoryError('map_name_conflict');
      throw error;
    }
  }

  renameMap(mapId: string, name: string, timestamp: string) {
    try {
      const result = this.database
        .get()
        .prepare('UPDATE knowledge_maps SET name = ?, updated_at = ? WHERE id = ?')
        .run(name, timestamp, mapId);
      if (result.changes === 0) throw new KnowledgeMapRepositoryError('not_found');
    } catch (error) {
      if (error instanceof KnowledgeMapRepositoryError) throw error;
      if (isSqliteConstraint(error)) throw new KnowledgeMapRepositoryError('map_name_conflict');
      throw error;
    }
  }

  deleteMap(mapId: string) {
    const result = this.database
      .get()
      .prepare('DELETE FROM knowledge_maps WHERE id = ?')
      .run(mapId);
    if (result.changes === 0) throw new KnowledgeMapRepositoryError('not_found');
  }

  listNodes(mapId: string): KnowledgeMapNodeRow[] {
    return this.database
      .get()
      .prepare(`
        SELECT id, map_id, card_id, title, content, level, x, y, z, created_at, updated_at
        FROM knowledge_map_nodes
        WHERE map_id = ?
        ORDER BY created_at, id
      `)
      .all(mapId) as KnowledgeMapNodeRow[];
  }

  listEdges(mapId: string): KnowledgeMapEdge[] {
    return (
      this.database
        .get()
        .prepare(`
          SELECT id, map_id, source_node_id, target_node_id, label, created_at, updated_at
          FROM knowledge_map_edges
          WHERE map_id = ?
          ORDER BY created_at, id
        `)
        .all(mapId) as KnowledgeMapEdgeRow[]
    ).map(toEdge);
  }

  addNode(mapId: string, input: KnowledgeMapNodeInsert, timestamp: string) {
    const database = this.database.get();
    return database.transaction(() => {
      assertMapExists(database, mapId);
      if (input.cardId !== null) assertCardExists(database, input.cardId);
      const id = randomUUID();
      try {
        database
          .prepare(`
            INSERT INTO knowledge_map_nodes (
              id, map_id, card_id, title, content, level, x, y, z, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `)
          .run(
            id,
            mapId,
            input.cardId,
            input.title,
            input.content,
            input.level,
            input.x,
            input.y,
            input.z,
            timestamp,
            timestamp,
          );
        touchMap(database, mapId, timestamp);
        return id;
      } catch (error) {
        if (isSqliteConstraint(error)) throw new KnowledgeMapRepositoryError('duplicate_node');
        throw error;
      }
    })();
  }

  updateNode(mapId: string, nodeId: string, input: KnowledgeMapNodeUpdate, timestamp: string) {
    const database = this.database.get();
    database.transaction(() => {
      const assignments: string[] = [];
      const parameters: Array<string | number> = [];
      if (input.title !== undefined) {
        assignments.push('title = ?');
        parameters.push(input.title);
      }
      if (input.content !== undefined) {
        assignments.push('content = ?');
        parameters.push(input.content);
      }
      if (input.level !== undefined) {
        assignments.push('level = ?');
        parameters.push(input.level);
      }
      if (input.x !== undefined) {
        assignments.push('x = ?');
        parameters.push(input.x);
      }
      if (input.y !== undefined) {
        assignments.push('y = ?');
        parameters.push(input.y);
      }
      if (input.z !== undefined) {
        assignments.push('z = ?');
        parameters.push(input.z);
      }
      assignments.push('updated_at = ?');
      parameters.push(timestamp);

      const result = database
        .prepare(`
          UPDATE knowledge_map_nodes
          SET ${assignments.join(', ')}
          WHERE id = ? AND map_id = ?
        `)
        .run(...parameters, nodeId, mapId);
      if (result.changes === 0) throw new KnowledgeMapRepositoryError('not_found');
      touchMap(database, mapId, timestamp);
    })();
  }

  deleteNode(mapId: string, nodeId: string, timestamp: string) {
    const database = this.database.get();
    database.transaction(() => {
      const result = database
        .prepare('DELETE FROM knowledge_map_nodes WHERE id = ? AND map_id = ?')
        .run(nodeId, mapId);
      if (result.changes === 0) throw new KnowledgeMapRepositoryError('not_found');
      touchMap(database, mapId, timestamp);
    })();
  }

  addEdge(mapId: string, sourceNodeId: string, targetNodeId: string, label: string, timestamp: string) {
    const database = this.database.get();
    return database.transaction(() => {
      if (sourceNodeId === targetNodeId) throw new KnowledgeMapRepositoryError('invalid_edge');
      assertMapExists(database, mapId);
      assertNodesBelongToMap(database, mapId, sourceNodeId, targetNodeId);
      const id = randomUUID();
      try {
        database
          .prepare(`
            INSERT INTO knowledge_map_edges (
              id, map_id, source_node_id, target_node_id, label, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
          `)
          .run(id, mapId, sourceNodeId, targetNodeId, label, timestamp, timestamp);
        touchMap(database, mapId, timestamp);
        return id;
      } catch (error) {
        if (isSqliteConstraint(error)) throw new KnowledgeMapRepositoryError('duplicate_edge');
        throw error;
      }
    })();
  }

  updateEdgeLabel(mapId: string, edgeId: string, label: string, timestamp: string) {
    const database = this.database.get();
    database.transaction(() => {
      const result = database
        .prepare('UPDATE knowledge_map_edges SET label = ?, updated_at = ? WHERE id = ? AND map_id = ?')
        .run(label, timestamp, edgeId, mapId);
      if (result.changes === 0) throw new KnowledgeMapRepositoryError('not_found');
      touchMap(database, mapId, timestamp);
    })();
  }

  deleteEdge(mapId: string, edgeId: string, timestamp: string) {
    const database = this.database.get();
    database.transaction(() => {
      const result = database
        .prepare('DELETE FROM knowledge_map_edges WHERE id = ? AND map_id = ?')
        .run(edgeId, mapId);
      if (result.changes === 0) throw new KnowledgeMapRepositoryError('not_found');
      touchMap(database, mapId, timestamp);
    })();
  }
}

export type KnowledgeMapNodeRecord = KnowledgeMapNodeRow;

function summarySql(where: string) {
  return `
    SELECT
      knowledge_maps.id,
      knowledge_maps.name,
      COUNT(DISTINCT knowledge_map_nodes.id) AS node_count,
      COUNT(DISTINCT knowledge_map_edges.id) AS edge_count,
      knowledge_maps.created_at,
      knowledge_maps.updated_at
    FROM knowledge_maps
    LEFT JOIN knowledge_map_nodes ON knowledge_map_nodes.map_id = knowledge_maps.id
    LEFT JOIN knowledge_map_edges ON knowledge_map_edges.map_id = knowledge_maps.id
    ${where}
    GROUP BY knowledge_maps.id
    ORDER BY knowledge_maps.updated_at DESC, knowledge_maps.created_at DESC, knowledge_maps.id
  `;
}

function toSummary(row: KnowledgeMapSummaryRow): KnowledgeMapSummary {
  return {
    id: row.id,
    name: row.name,
    nodeCount: row.node_count,
    edgeCount: row.edge_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toEdge(row: KnowledgeMapEdgeRow): KnowledgeMapEdge {
  return {
    id: row.id,
    mapId: row.map_id,
    sourceNodeId: row.source_node_id,
    targetNodeId: row.target_node_id,
    label: row.label,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function assertMapExists(database: Database.Database, mapId: string) {
  const map = database.prepare('SELECT 1 FROM knowledge_maps WHERE id = ?').get(mapId);
  if (!map) throw new KnowledgeMapRepositoryError('not_found');
}

function assertCardExists(database: Database.Database, cardId: string) {
  const card = database.prepare('SELECT 1 FROM cards WHERE id = ?').get(cardId);
  if (!card) throw new KnowledgeMapRepositoryError('invalid_card');
}

function assertNodesBelongToMap(
  database: Database.Database,
  mapId: string,
  sourceNodeId: string,
  targetNodeId: string,
) {
  const count = (
    database
      .prepare(`
        SELECT COUNT(*) AS count
        FROM knowledge_map_nodes
        WHERE map_id = ? AND id IN (?, ?)
      `)
      .get(mapId, sourceNodeId, targetNodeId) as { count: number }
  ).count;
  if (count !== 2) throw new KnowledgeMapRepositoryError('invalid_edge');
}

function touchMap(database: Database.Database, mapId: string, timestamp: string) {
  database.prepare('UPDATE knowledge_maps SET updated_at = ? WHERE id = ?').run(timestamp, mapId);
}

function isSqliteConstraint(error: unknown) {
  return (
    typeof error === 'object'
    && error !== null
    && String(Reflect.get(error, 'code')).startsWith('SQLITE_CONSTRAINT')
  );
}
