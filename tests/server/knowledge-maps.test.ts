import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../../server/app';
import { migrate } from '../../server/db/migrations';
import { createKnowledgeMapService } from '../../server/knowledgeMaps/service';
import { createTestDatabase } from '../helpers/testDatabase';

type TestDatabase = ReturnType<typeof createTestDatabase>;

function setup() {
  const database = createTestDatabase();
  const app = createApp({
    knowledgeMapService: createKnowledgeMapService({
      database: database.manager,
      now: () => new Date('2026-08-01T10:00:00.000Z'),
    }),
  });
  return { app, database };
}

function insertCard(database: TestDatabase, id: string, rawInput = id) {
  database.db
    .prepare(`
      INSERT INTO cards (
        id, entry_mode, raw_input, template, normalized_statement,
        wrong_point, analysis, mnemonic, extension, notes,
        source_type, source_detail, rating, mastery, wrong_count,
        ai_status, archived, created_at, updated_at
      ) VALUES (?, 'knowledge', ?, '常识判断', ?, '', '解析', '速记', '', '',
        'manual', '', 1, 'unseen', 0, 'ready', 0, ?, ?)
    `)
    .run(id, rawInput, `${rawInput}整理稿`, '2026-08-01T09:00:00.000Z', '2026-08-01T09:00:00.000Z');
  database.db
    .prepare('INSERT INTO card_categories (card_id, category_id) VALUES (?, ?), (?, ?)')
    .run(id, '常识判断', id, '常识判断/法律');
}

describe('知识图谱接口', () => {
  function replaceKnowledgeMapNodesWithLegacySchema(database: TestDatabase) {
    database.db.exec(`
      DROP TABLE knowledge_map_edges;
      DROP TABLE knowledge_map_nodes;

      CREATE TABLE knowledge_map_nodes (
        id TEXT PRIMARY KEY,
        map_id TEXT NOT NULL REFERENCES knowledge_maps(id) ON DELETE CASCADE,
        card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
        x REAL NOT NULL,
        y REAL NOT NULL,
        z REAL NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(map_id, card_id)
      );

      CREATE TABLE knowledge_map_edges (
        id TEXT PRIMARY KEY,
        map_id TEXT NOT NULL REFERENCES knowledge_maps(id) ON DELETE CASCADE,
        source_node_id TEXT NOT NULL REFERENCES knowledge_map_nodes(id) ON DELETE CASCADE,
        target_node_id TEXT NOT NULL REFERENCES knowledge_map_nodes(id) ON DELETE CASCADE,
        label TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        CHECK(source_node_id <> target_node_id),
        UNIQUE(map_id, source_node_id, target_node_id)
      );

      CREATE INDEX idx_knowledge_map_nodes_card_id ON knowledge_map_nodes(card_id);
      CREATE INDEX idx_knowledge_map_nodes_map_id ON knowledge_map_nodes(map_id);
      CREATE INDEX idx_knowledge_map_edges_map_id ON knowledge_map_edges(map_id);
    `);
  }

  const opened: TestDatabase[] = [];

  afterEach(() => {
    opened.splice(0).forEach((item) => item.dispose());
  });

  it('创建、重命名和读取多个命名图谱', async () => {
    const { app, database } = setup();
    opened.push(database);

    const defaultNamed = await request(app).post('/api/knowledge-maps').send({});
    expect(defaultNamed.status).toBe(201);
    expect(defaultNamed.body.map).toMatchObject({ name: '知识图谱 1', nodeCount: 0, edgeCount: 0 });

    const created = await request(app).post('/api/knowledge-maps').send({ name: '  法律关系图  ' });
    expect(created.status).toBe(201);
    expect(created.body.map).toMatchObject({ name: '法律关系图', nodeCount: 0, edgeCount: 0 });

    const duplicate = await request(app).post('/api/knowledge-maps').send({ name: '法律关系图' });
    expect(duplicate.status).toBe(409);

    const renamed = await request(app)
      .patch(`/api/knowledge-maps/${created.body.map.id}`)
      .send({ name: '常识判断图谱' });
    expect(renamed.status).toBe(200);
    expect(renamed.body.map.name).toBe('常识判断图谱');

    const listed = await request(app).get('/api/knowledge-maps');
    expect(listed.body).toHaveLength(2);
    expect(listed.body).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: created.body.map.id, name: '常识判断图谱' }),
      expect.objectContaining({ id: defaultNamed.body.map.id, name: '知识图谱 1' }),
    ]));
  });

  it('添加节点、移动节点、创建关系并编辑关系标签', async () => {
    const { app, database } = setup();
    opened.push(database);
    insertCard(database, 'card-a', '宪法');
    insertCard(database, 'card-b', '法律');

    const created = await request(app).post('/api/knowledge-maps').send({ name: '法律图谱' });
    const mapId = created.body.map.id as string;

    const missingCard = await request(app)
      .post(`/api/knowledge-maps/${mapId}/nodes`)
      .send({ cardId: 'missing', x: 1, y: 2, z: 3 });
    expect(missingCard.status).toBe(400);

    const firstNode = await request(app)
      .post(`/api/knowledge-maps/${mapId}/nodes`)
      .send({ cardId: 'card-a', x: 260, y: 0, z: 0 });
    expect(firstNode.status).toBe(201);
    const firstNodeId = firstNode.body.nodes[0].id as string;
    expect(firstNode.body.nodes[0]).toMatchObject({
      cardId: 'card-a',
      title: '',
      content: '',
      level: 2,
      x: 260,
      card: expect.objectContaining({ rawInput: '宪法' }),
    });

    const duplicateNode = await request(app)
      .post(`/api/knowledge-maps/${mapId}/nodes`)
      .send({ cardId: 'card-a', x: 0, y: 260, z: 0 });
    expect(duplicateNode.status).toBe(409);

    const moved = await request(app)
      .patch(`/api/knowledge-maps/${mapId}/nodes/${firstNodeId}`)
      .send({ x: 0, y: 260, z: 0, level: 2 });
    expect(moved.status).toBe(200);
    expect(moved.body.nodes[0]).toMatchObject({ x: 0, y: 260, z: 0, level: 2 });

    const secondNode = await request(app)
      .post(`/api/knowledge-maps/${mapId}/nodes`)
      .send({ cardId: 'card-b', x: 0, y: 0, z: 260 });
    const secondNodeId = secondNode.body.nodes.find((node: { cardId: string }) => node.cardId === 'card-b').id;

    const selfEdge = await request(app)
      .post(`/api/knowledge-maps/${mapId}/edges`)
      .send({ sourceNodeId: firstNodeId, targetNodeId: firstNodeId, label: '自连' });
    expect(selfEdge.status).toBe(400);

    const edge = await request(app)
      .post(`/api/knowledge-maps/${mapId}/edges`)
      .send({ sourceNodeId: firstNodeId, targetNodeId: secondNodeId, label: '属于' });
    expect(edge.status).toBe(201);
    expect(edge.body.map).toMatchObject({ nodeCount: 2, edgeCount: 1 });
    const edgeId = edge.body.edges[0].id as string;

    const duplicateEdge = await request(app)
      .post(`/api/knowledge-maps/${mapId}/edges`)
      .send({ sourceNodeId: firstNodeId, targetNodeId: secondNodeId, label: '属于' });
    expect(duplicateEdge.status).toBe(409);

    const updated = await request(app)
      .patch(`/api/knowledge-maps/${mapId}/edges/${edgeId}`)
      .send({ label: '易混' });
    expect(updated.status).toBe(200);
    expect(updated.body.edges[0]).toMatchObject({ label: '易混' });
  });

  it('允许创建 content 为空的自定义知识点，并拒绝标题和正文都为空', async () => {
    const { app, database } = setup();
    opened.push(database);

    const created = await request(app).post('/api/knowledge-maps').send({ name: '空正文容错图谱' });
    const mapId = created.body.map.id as string;

    const nullContentNode = await request(app)
      .post(`/api/knowledge-maps/${mapId}/nodes`)
      .send({ title: '1', content: null, level: 1, x: 1, y: 2, z: 3 });
    expect(nullContentNode.status).toBe(201);
    expect(nullContentNode.body.nodes[0]).toMatchObject({
      cardId: null,
      title: '1',
      content: '',
      level: 1,
      x: 1,
      y: 2,
      z: 3,
    });

    const textContentNode = await request(app)
      .post(`/api/knowledge-maps/${mapId}/nodes`)
      .send({ title: '1', content: '1', level: 1, x: 2, y: 3, z: 4 });
    expect(textContentNode.status).toBe(201);
    expect(textContentNode.body.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          cardId: null,
          title: '1',
          content: '1',
          level: 1,
          x: 2,
          y: 3,
          z: 4,
        }),
      ]),
    );

    const emptyContentNode = await request(app)
      .post(`/api/knowledge-maps/${mapId}/nodes`)
      .send({ title: ' ', content: '', x: 0, y: 0, z: 0 });
    expect(emptyContentNode.status).toBe(400);

    const nullContentWithoutTitle = await request(app)
      .post(`/api/knowledge-maps/${mapId}/nodes`)
      .send({ content: null, x: 0, y: 0, z: 0 });
    expect(nullContentWithoutTitle.status).toBe(400);
  });

  it('创建和更新不绑定卡片的自定义节点，并与卡片节点共享层级和关系', async () => {
    const { app, database } = setup();
    opened.push(database);
    insertCard(database, 'card-a', '行政处罚');

    const created = await request(app).post('/api/knowledge-maps').send({ name: '自定义图谱' });
    const mapId = created.body.map.id as string;

    const invalidCreateLevel = await request(app)
      .post(`/api/knowledge-maps/${mapId}/nodes`)
      .send({ title: '非法层级', level: 0, x: 0, y: 0, z: 0 });
    expect(invalidCreateLevel.status).toBe(400);

    const emptyCustomNode = await request(app)
      .post(`/api/knowledge-maps/${mapId}/nodes`)
      .send({ x: 0, y: 0, z: 0 });
    expect(emptyCustomNode.status).toBe(400);

    const customNode = await request(app)
      .post(`/api/knowledge-maps/${mapId}/nodes`)
      .send({ title: '行政行为', content: '不绑定任何卡片', level: 3, x: 12, y: 24, z: 0 });
    expect(customNode.status).toBe(201);
    const customNodeId = customNode.body.nodes[0].id as string;
    expect(customNode.body.nodes[0]).toMatchObject({
      cardId: null,
      title: '行政行为',
      content: '不绑定任何卡片',
      level: 3,
      x: 12,
      y: 24,
      z: 0,
      card: null,
    });

    const duplicateCustomNode = await request(app)
      .post(`/api/knowledge-maps/${mapId}/nodes`)
      .send({ title: '行政行为', content: '不绑定任何卡片', level: 3, x: 20, y: 30, z: 0 });
    expect(duplicateCustomNode.status).toBe(201);

    const cardNode = await request(app)
      .post(`/api/knowledge-maps/${mapId}/nodes`)
      .send({ cardId: 'card-a', level: 2, x: 0, y: 0, z: 260 });
    expect(cardNode.status).toBe(201);
    const cardNodeId = cardNode.body.nodes.find((node: { cardId: string | null }) => node.cardId === 'card-a').id;

    const edge = await request(app)
      .post(`/api/knowledge-maps/${mapId}/edges`)
      .send({ sourceNodeId: customNodeId, targetNodeId: cardNodeId, label: '展开' });
    expect(edge.status).toBe(201);
    expect(edge.body.map).toMatchObject({ nodeCount: 3, edgeCount: 1 });
    expect(edge.body.edges[0]).toMatchObject({
      sourceNodeId: customNodeId,
      targetNodeId: cardNodeId,
      label: '展开',
    });

    const invalidUpdateLevel = await request(app)
      .patch(`/api/knowledge-maps/${mapId}/nodes/${customNodeId}`)
      .send({ level: -1 });
    expect(invalidUpdateLevel.status).toBe(400);

    const updated = await request(app)
      .patch(`/api/knowledge-maps/${mapId}/nodes/${customNodeId}`)
      .send({ title: '行政行为分类', content: '二维和三维共用该节点数据', level: 4 });
    expect(updated.status).toBe(200);
    const updatedCustomNode = updated.body.nodes.find((node: { id: string }) => node.id === customNodeId);
    expect(updatedCustomNode).toMatchObject({
      title: '行政行为分类',
      content: '二维和三维共用该节点数据',
      level: 4,
      cardId: null,
      card: null,
    });
  });

  it('拒绝跨图关系，并在删除卡片时级联清理节点和关系', async () => {
    const { app, database } = setup();
    opened.push(database);
    insertCard(database, 'card-a', '甲');
    insertCard(database, 'card-b', '乙');
    insertCard(database, 'card-c', '丙');

    const firstMap = await request(app).post('/api/knowledge-maps').send({ name: '图谱一' });
    const secondMap = await request(app).post('/api/knowledge-maps').send({ name: '图谱二' });
    const firstMapId = firstMap.body.map.id as string;
    const secondMapId = secondMap.body.map.id as string;
    const firstNode = await request(app)
      .post(`/api/knowledge-maps/${firstMapId}/nodes`)
      .send({ cardId: 'card-a', x: 260, y: 0, z: 0 });
    const secondNode = await request(app)
      .post(`/api/knowledge-maps/${firstMapId}/nodes`)
      .send({ cardId: 'card-b', x: 0, y: 260, z: 0 });
    const otherNode = await request(app)
      .post(`/api/knowledge-maps/${secondMapId}/nodes`)
      .send({ cardId: 'card-c', x: 0, y: 0, z: 260 });
    const customNode = await request(app)
      .post(`/api/knowledge-maps/${firstMapId}/nodes`)
      .send({ title: '自定义保留节点', level: 2, x: 20, y: 20, z: 0 });
    const customNodeId = customNode.body.nodes.find((node: { cardId: string | null }) => node.cardId === null).id;
    const secondNodeId = secondNode.body.nodes.find((node: { cardId: string | null }) => node.cardId === 'card-b').id;

    const crossMapEdge = await request(app)
      .post(`/api/knowledge-maps/${firstMapId}/edges`)
      .send({
        sourceNodeId: firstNode.body.nodes[0].id,
        targetNodeId: otherNode.body.nodes[0].id,
        label: '跨图',
      });
    expect(crossMapEdge.status).toBe(400);

    await request(app)
      .post(`/api/knowledge-maps/${firstMapId}/edges`)
      .send({
        sourceNodeId: firstNode.body.nodes[0].id,
        targetNodeId: secondNodeId,
        label: '关联',
      });
    await request(app)
      .post(`/api/knowledge-maps/${firstMapId}/edges`)
      .send({
        sourceNodeId: customNodeId,
        targetNodeId: secondNodeId,
        label: '自定义关联',
      });

    database.db.prepare("DELETE FROM cards WHERE id = 'card-a'").run();
    const detail = await request(app).get(`/api/knowledge-maps/${firstMapId}`);
    expect(detail.status).toBe(200);
    expect(detail.body.map).toMatchObject({ nodeCount: 2, edgeCount: 1 });
    expect(detail.body.nodes.map((node: { cardId: string | null }) => node.cardId)).toEqual(
      expect.arrayContaining(['card-b', null]),
    );
    expect(detail.body.edges).toEqual([
      expect.objectContaining({ sourceNodeId: customNodeId, targetNodeId: secondNodeId, label: '自定义关联' }),
    ]);
  });

  it('keeps child nodes and their custom levels when deleting a parent node', async () => {
    const { app, database } = setup();
    opened.push(database);

    const created = await request(app).post('/api/knowledge-maps').send({ name: 'parent-delete-map' });
    const mapId = created.body.map.id as string;
    const parent = await request(app)
      .post(`/api/knowledge-maps/${mapId}/nodes`)
      .send({ title: 'parent', level: 2, x: 0, y: 0, z: 0 });
    const parentNodeId = parent.body.nodes[0].id as string;
    const child = await request(app)
      .post(`/api/knowledge-maps/${mapId}/nodes`)
      .send({ title: 'child', level: 7, x: 100, y: 100, z: 0 });
    const childNodeId = child.body.nodes.find((node: { title: string }) => node.title === 'child').id as string;

    const edge = await request(app)
      .post(`/api/knowledge-maps/${mapId}/edges`)
      .send({ sourceNodeId: parentNodeId, targetNodeId: childNodeId, label: 'parent-child' });
    expect(edge.status).toBe(201);

    const deleted = await request(app).delete(`/api/knowledge-maps/${mapId}/nodes/${parentNodeId}`);
    expect(deleted.status).toBe(200);
    expect(deleted.body.map).toMatchObject({ nodeCount: 1, edgeCount: 0 });
    expect(deleted.body.nodes).toEqual([
      expect.objectContaining({ id: childNodeId, title: 'child', level: 7 }),
    ]);
    expect(deleted.body.edges).toEqual([]);

    const detail = await request(app).get(`/api/knowledge-maps/${mapId}`);
    expect(detail.status).toBe(200);
    expect(detail.body.nodes).toEqual([
      expect.objectContaining({ id: childNodeId, title: 'child', level: 7 }),
    ]);
    expect(detail.body.edges).toEqual([]);
  });

  it('repairs legacy knowledge map node schema when version 7 was already recorded', async () => {
    const { app, database } = setup();
    opened.push(database);
    insertCard(database, 'card-a', 'legacy-a');
    insertCard(database, 'card-b', 'legacy-b');

    const created = await request(app).post('/api/knowledge-maps').send({ name: 'legacy-schema-map' });
    const mapId = created.body.map.id as string;
    replaceKnowledgeMapNodesWithLegacySchema(database);
    database.db
      .prepare(`
        INSERT INTO knowledge_map_nodes (id, map_id, card_id, x, y, z, created_at, updated_at)
        VALUES ('legacy-node', ?, 'card-a', 1, 2, 3, '2026-08-01T09:00:00.000Z', '2026-08-01T09:00:00.000Z')
      `)
      .run(mapId);

    migrate(database.db);

    const detail = await request(app).get(`/api/knowledge-maps/${mapId}`);
    expect(detail.status).toBe(200);
    expect(detail.body.nodes[0]).toMatchObject({
      id: 'legacy-node',
      cardId: 'card-a',
      title: '',
      content: '',
      level: 2,
    });

    const customNode = await request(app)
      .post(`/api/knowledge-maps/${mapId}/nodes`)
      .send({ title: 'custom-node', content: '', level: 1, x: 4, y: 5, z: 6 });
    expect(customNode.status).toBe(201);
    expect(customNode.body.nodes).toEqual(expect.arrayContaining([
      expect.objectContaining({ cardId: null, title: 'custom-node', level: 1 }),
    ]));

    const cardNode = await request(app)
      .post(`/api/knowledge-maps/${mapId}/nodes`)
      .send({ cardId: 'card-b', x: 7, y: 8, z: 9 });
    expect(cardNode.status).toBe(201);
    expect(cardNode.body.nodes).toEqual(expect.arrayContaining([
      expect.objectContaining({ cardId: 'card-b', level: 2 }),
    ]));
  });
});
