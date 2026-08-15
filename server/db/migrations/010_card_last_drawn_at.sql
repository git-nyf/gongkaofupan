ALTER TABLE cards ADD COLUMN last_drawn_at TEXT;

CREATE INDEX idx_cards_last_drawn_at ON cards(last_drawn_at);
