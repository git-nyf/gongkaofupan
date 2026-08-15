ALTER TABLE shenlun_reviews
ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0;

ALTER TABLE shenlun_reviews
ADD COLUMN archived INTEGER NOT NULL DEFAULT 0;

CREATE INDEX idx_shenlun_reviews_archive_order
ON shenlun_reviews(archived, pinned DESC, updated_at DESC);
