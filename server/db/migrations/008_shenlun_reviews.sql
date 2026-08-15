CREATE TABLE shenlun_reviews (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  template INTEGER NOT NULL CHECK(template IN (200, 400, 800, 1000)),
  text TEXT NOT NULL,
  marks_json TEXT NOT NULL,
  notes TEXT NOT NULL,
  standard_answer TEXT NOT NULL,
  annotations_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_shenlun_reviews_updated_at
ON shenlun_reviews(updated_at DESC);
