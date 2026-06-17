-- Migration to add invite_token to agency_staff table
ALTER TABLE agency_staff ADD COLUMN IF NOT EXISTS invite_token TEXT NULL UNIQUE;
CREATE INDEX IF NOT EXISTS idx_agency_staff_invite_token ON agency_staff(invite_token);
