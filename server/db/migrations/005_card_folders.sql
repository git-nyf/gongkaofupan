CREATE TABLE card_folders (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL COLLATE NOCASE UNIQUE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE card_folder_items (
  folder_id TEXT NOT NULL REFERENCES card_folders(id) ON DELETE CASCADE,
  card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  PRIMARY KEY (folder_id, card_id)
);

CREATE INDEX idx_card_folder_items_card_id ON card_folder_items(card_id);
