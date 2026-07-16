CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  parent_id TEXT REFERENCES categories(id),
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  UNIQUE(parent_id, name)
);

CREATE TABLE IF NOT EXISTS cards (
  id TEXT PRIMARY KEY,
  entry_mode TEXT NOT NULL CHECK(entry_mode IN ('mistake', 'knowledge')),
  raw_input TEXT NOT NULL,
  raw_content_json TEXT,
  normalized_statement TEXT NOT NULL DEFAULT '',
  wrong_point TEXT NOT NULL DEFAULT '',
  analysis TEXT NOT NULL DEFAULT '',
  mnemonic TEXT NOT NULL DEFAULT '',
  extension TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  source_type TEXT NOT NULL DEFAULT 'unknown',
  source_detail TEXT NOT NULL DEFAULT '',
  rating INTEGER NOT NULL DEFAULT 1 CHECK(rating BETWEEN 1 AND 5),
  mastery TEXT NOT NULL DEFAULT 'unseen' CHECK(mastery IN ('unseen', 'again', 'hard', 'good')),
  wrong_count INTEGER NOT NULL DEFAULT 0,
  ai_status TEXT NOT NULL CHECK(ai_status IN ('processing', 'ready', 'pending', 'needs_input')),
  ai_attempt_count INTEGER NOT NULL DEFAULT 0,
  ai_error_code TEXT NOT NULL DEFAULT '',
  archived INTEGER NOT NULL DEFAULT 0 CHECK(archived IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS card_categories (
  card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  category_id TEXT NOT NULL REFERENCES categories(id),
  PRIMARY KEY(card_id, category_id)
);

CREATE TABLE IF NOT EXISTS tags (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS card_tags (
  card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  origin TEXT NOT NULL CHECK(origin IN ('user', 'ai')),
  PRIMARY KEY(card_id, tag_id)
);

CREATE TABLE IF NOT EXISTS attachments (
  id TEXT PRIMARY KEY,
  card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  stored_name TEXT NOT NULL UNIQUE,
  original_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  byte_size INTEGER NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS quiz_items (
  id TEXT PRIMARY KEY,
  card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  direction TEXT NOT NULL CHECK(direction IN ('single', 'forward', 'reverse')),
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  mastery TEXT NOT NULL DEFAULT 'unseen' CHECK(mastery IN ('unseen', 'again', 'hard', 'good')),
  due_at TEXT NOT NULL,
  stability REAL NOT NULL DEFAULT 0,
  difficulty REAL NOT NULL DEFAULT 0,
  elapsed_days INTEGER NOT NULL DEFAULT 0,
  scheduled_days INTEGER NOT NULL DEFAULT 0,
  learning_steps INTEGER NOT NULL DEFAULT 0,
  reps INTEGER NOT NULL DEFAULT 0,
  lapses INTEGER NOT NULL DEFAULT 0,
  state INTEGER NOT NULL DEFAULT 0,
  last_review_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS review_logs (
  id TEXT PRIMARY KEY,
  quiz_item_id TEXT NOT NULL REFERENCES quiz_items(id) ON DELETE CASCADE,
  card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  rating TEXT NOT NULL CHECK(rating IN ('again', 'hard', 'good')),
  previous_due_at TEXT NOT NULL,
  next_due_at TEXT NOT NULL,
  reviewed_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cards_ai_status ON cards(ai_status);
CREATE INDEX IF NOT EXISTS idx_cards_archived ON cards(archived);
CREATE INDEX IF NOT EXISTS idx_quiz_items_due_at ON quiz_items(due_at);
CREATE INDEX IF NOT EXISTS idx_quiz_items_created_at ON quiz_items(created_at);
CREATE INDEX IF NOT EXISTS idx_review_logs_card_id ON review_logs(card_id);
