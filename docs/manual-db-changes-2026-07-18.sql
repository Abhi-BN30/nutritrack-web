-- Run these in Neon manually before using the new app code.
-- This keeps old target columns on users for now, but the app will use nutrition_targets going forward.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1) Rename role PATIENT -> USER
ALTER TYPE "Role" RENAME VALUE 'PATIENT' TO 'USER';

-- 2) Add mobile number and start date on users
ALTER TABLE users ADD COLUMN IF NOT EXISTS "mobileNumber" TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- 3) Backfill mobile numbers for existing rows if needed.
-- Replace these placeholder values with real values before production use.
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY "createdAt", id) AS rn
  FROM users
  WHERE "mobileNumber" IS NULL OR "mobileNumber" = ''
)
UPDATE users u
SET "mobileNumber" = '900000' || LPAD(numbered.rn::text, 4, '0')
FROM numbered
WHERE u.id = numbered.id;

ALTER TABLE users ALTER COLUMN "mobileNumber" SET NOT NULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'users_mobileNumber_key'
  ) THEN
    CREATE UNIQUE INDEX "users_mobileNumber_key" ON users ("mobileNumber");
  END IF;
END $$;

-- 4) Create target-history table
CREATE TABLE IF NOT EXISTS nutrition_targets (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "userId" TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "effectiveFrom" TIMESTAMP(3) NOT NULL,
  "targetCarbs" DOUBLE PRECISION NOT NULL,
  "targetProteins" DOUBLE PRECISION NOT NULL,
  "targetFats" DOUBLE PRECISION NOT NULL,
  "targetCalories" DOUBLE PRECISION NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS nutrition_targets_user_effective_key
  ON nutrition_targets ("userId", "effectiveFrom");

CREATE INDEX IF NOT EXISTS nutrition_targets_user_effective_idx
  ON nutrition_targets ("userId", "effectiveFrom");

-- 5) Seed target-history rows for existing users from the old columns
INSERT INTO nutrition_targets (
  id,
  "userId",
  "effectiveFrom",
  "targetCarbs",
  "targetProteins",
  "targetFats",
  "targetCalories",
  "createdAt"
)
SELECT
  gen_random_uuid()::text,
  u.id,
  COALESCE(u."startDate", u."createdAt", CURRENT_TIMESTAMP),
  COALESCE(u."targetCarbs", 80),
  COALESCE(u."targetProteins", 60),
  COALESCE(u."targetFats", 150),
  COALESCE(u."targetCalories", 2000),
  CURRENT_TIMESTAMP
FROM users u
WHERE NOT EXISTS (
  SELECT 1 FROM nutrition_targets nt WHERE nt."userId" = u.id
);

-- 6) Add protein/carb ratio on food logs and backfill it
ALTER TABLE food_logs ADD COLUMN IF NOT EXISTS "proteinCarbRatio" DOUBLE PRECISION;

UPDATE food_logs
SET "proteinCarbRatio" = CASE
  WHEN carbs > 0 THEN ROUND((proteins / carbs)::numeric, 1)::double precision
  ELSE NULL
END
WHERE "proteinCarbRatio" IS NULL;


-- 7) Store original quantity input and metric for food logs so the UI can display
-- values like "10 ml" or "2 no's." instead of only gram equivalents.
ALTER TABLE food_logs ADD COLUMN IF NOT EXISTS "quantityValue" DOUBLE PRECISION;
ALTER TABLE food_logs ADD COLUMN IF NOT EXISTS "quantityMetric" TEXT;

UPDATE food_logs
SET
  "quantityValue" = COALESCE("quantityValue", "quantityGms"),
  "quantityMetric" = COALESCE("quantityMetric", 'GRAMS')
WHERE "quantityValue" IS NULL OR "quantityMetric" IS NULL;

ALTER TABLE food_logs ALTER COLUMN "quantityValue" SET NOT NULL;
ALTER TABLE food_logs ALTER COLUMN "quantityMetric" SET NOT NULL;
ALTER TABLE food_logs ALTER COLUMN "quantityMetric" SET DEFAULT 'GRAMS';


-- 8) Create a separate personal food table for user-owned items.
-- This keeps the master food_items table clean while allowing each user to
-- maintain their own private nutrition entries.
CREATE TABLE IF NOT EXISTS personal_food_items (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "userId" TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "ownerEmail" TEXT NOT NULL,
  "itemName" TEXT NOT NULL,
  carbohydrates DOUBLE PRECISION NOT NULL,
  proteins DOUBLE PRECISION NOT NULL,
  fats DOUBLE PRECISION NOT NULL,
  calories DOUBLE PRECISION NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS personal_food_items_user_item_key
  ON personal_food_items ("userId", "itemName");

CREATE INDEX IF NOT EXISTS personal_food_items_user_idx
  ON personal_food_items ("userId");

CREATE INDEX IF NOT EXISTS personal_food_items_owner_email_idx
  ON personal_food_items ("ownerEmail");

-- Optional one-time sync in case existing users already changed email values and
-- you later import rows manually into personal_food_items.
UPDATE personal_food_items pfi
SET "ownerEmail" = u.email
FROM users u
WHERE pfi."userId" = u.id
  AND pfi."ownerEmail" IS DISTINCT FROM u.email;

-- 9) Allow food logs to point either to the master food table OR the new
-- personal_food_items table.
ALTER TABLE food_logs ADD COLUMN IF NOT EXISTS "personalFoodItemId" TEXT;

ALTER TABLE food_logs ALTER COLUMN "foodItemId" DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'food_logs_personalFoodItemId_fkey'
  ) THEN
    ALTER TABLE food_logs
      ADD CONSTRAINT "food_logs_personalFoodItemId_fkey"
      FOREIGN KEY ("personalFoodItemId")
      REFERENCES personal_food_items(id)
      ON DELETE RESTRICT
      ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS food_logs_personal_food_item_idx
  ON food_logs ("personalFoodItemId");

-- Existing rows stay valid automatically because they already reference
-- food_items through foodItemId and personalFoodItemId will remain NULL.
