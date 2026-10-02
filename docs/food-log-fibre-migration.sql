-- Run once in the Neon SQL Editor before deploying food-log fibre support.
-- Existing logs remain valid; their fibre is unknown until the logs are edited
-- or newly created, so the application displays a dash for those values.

ALTER TABLE food_logs
  ADD COLUMN IF NOT EXISTS fibre DOUBLE PRECISION;
