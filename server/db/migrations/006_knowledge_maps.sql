CREATE TABLE knowledge_maps (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL COLLATE NOCASE UNIQUE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

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
