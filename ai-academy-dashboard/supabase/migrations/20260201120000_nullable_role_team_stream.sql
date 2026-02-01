-- Migration: Make role, team, stream nullable for progressive onboarding
-- Students should NOT be auto-assigned to a role/team/stream
-- They can choose these later from their profile

-- Step 1: Drop NOT NULL constraints
ALTER TABLE participants
  ALTER COLUMN role DROP NOT NULL;

ALTER TABLE participants
  ALTER COLUMN team DROP NOT NULL;

ALTER TABLE participants
  ALTER COLUMN stream DROP NOT NULL;

-- Step 2: Set default to NULL (remove any existing defaults)
ALTER TABLE participants
  ALTER COLUMN role SET DEFAULT NULL;

ALTER TABLE participants
  ALTER COLUMN team SET DEFAULT NULL;

ALTER TABLE participants
  ALTER COLUMN stream SET DEFAULT NULL;

-- Note: Existing users will keep their current values
-- New users will have NULL until they choose their assignment

COMMENT ON COLUMN participants.role IS 'User role in the academy - NULL means not yet assigned';
COMMENT ON COLUMN participants.team IS 'Team assignment - NULL means not yet joined a team';
COMMENT ON COLUMN participants.stream IS 'Learning stream (Tech/Business) - NULL means not yet selected';
