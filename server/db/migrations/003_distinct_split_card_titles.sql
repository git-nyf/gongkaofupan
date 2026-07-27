UPDATE cards
SET
  normalized_statement = (
    SELECT quiz_items.question
    FROM quiz_items
    WHERE quiz_items.card_id = cards.id
    ORDER BY quiz_items.rowid
    LIMIT 1
  ),
  updated_at = CASE
    WHEN updated_at > created_at THEN updated_at
    ELSE created_at
  END
WHERE id IN (
  SELECT card_id
  FROM (
    SELECT
      cards.id AS card_id,
      COUNT(*) OVER (
        PARTITION BY cards.raw_input, cards.normalized_statement
      ) AS duplicate_count
    FROM cards
    JOIN quiz_items ON quiz_items.card_id = cards.id
    WHERE cards.ai_status = 'ready'
      AND quiz_items.direction = 'single'
    GROUP BY cards.id
    HAVING COUNT(quiz_items.id) = 1
  )
  WHERE duplicate_count > 1
);
