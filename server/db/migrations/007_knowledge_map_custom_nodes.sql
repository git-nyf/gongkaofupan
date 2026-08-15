CREATE TABLE knowledge_map_nodes_new (
  id TEXT PRIMARY KEY,
  map_id TEXT NOT NULL REFERENCES knowledge_maps(id) ON DELETE CASCADE,
  card_id TEXT REFERENCES cards(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  level INTEGER NOT NULL DEFAULT 1 CHECK(level >= 1 AND level = CAST(level AS INTEGER)),
  x REAL NOT NULL,
  y REAL NOT NULL,
  z REAL NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(map_id, card_id)
);

CREATE TABLE knowledge_map_edges_new (
  id TEXT PRIMARY KEY,
  map_id TEXT NOT NULL REFERENCES knowledge_maps(id) ON DELETE CASCADE,
  source_node_id TEXT NOT NULL REFERENCES knowledge_map_nodes_new(id) ON DELETE CASCADE,
  target_node_id TEXT NOT NULL REFERENCES knowledge_map_nodes_new(id) ON DELETE CASCADE,
  label TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK(source_node_id <> target_node_id),
  UNIQUE(map_id, source_node_id, target_node_id)
);

INSERT INTO knowledge_map_nodes_new (
  id, map_id, card_id, title, content, level, x, y, z, created_at, updated_at
)
SELECT id, map_id, card_id, '', '', 2, x, y, z, created_at, updated_at
FROM knowledge_map_nodes;

INSERT INTO knowledge_map_edges_new (
  id, map_id, source_node_id, target_node_id, label, created_at, updated_at
)
SELECT id, map_id, source_node_id, target_node_id, label, created_at, updated_at
FROM knowledge_map_edges;

DROP TABLE knowledge_map_edges;
DROP TABLE knowledge_map_nodes;

ALTER TABLE knowledge_map_nodes_new RENAME TO knowledge_map_nodes;
ALTER TABLE knowledge_map_edges_new RENAME TO knowledge_map_edges;

CREATE INDEX idx_knowledge_map_nodes_card_id ON knowledge_map_nodes(card_id);
CREATE INDEX idx_knowledge_map_nodes_map_id ON knowledge_map_nodes(map_id);
CREATE INDEX idx_knowledge_map_edges_map_id ON knowledge_map_edges(map_id);
