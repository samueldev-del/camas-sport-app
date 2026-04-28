ALTER TABLE attendances ADD COLUMN IF NOT EXISTS position TEXT;

ALTER TABLE attendances DROP CONSTRAINT IF EXISTS attendances_position_check;

ALTER TABLE attendances
  ADD CONSTRAINT attendances_position_check
  CHECK (position IS NULL OR position IN ('G','DEF','MIL','ATT'));