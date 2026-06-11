-- Create vault_view_tokens table for replay-attack protection
CREATE TABLE vault_view_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paper_id UUID NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  is_used BOOLEAN NOT NULL DEFAULT FALSE,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '60 seconds'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for efficient token verification
CREATE INDEX idx_vault_view_tokens_lookup ON vault_view_tokens(token, is_used, expires_at);

-- Enable Row-Level Security (RLS)
ALTER TABLE vault_view_tokens ENABLE ROW LEVEL SECURITY;

-- super_admin: ALL permissions
CREATE POLICY vault_view_tokens_admin ON vault_view_tokens FOR ALL TO authenticated
  USING (public.get_user_role() = 'super_admin');

-- print_operator: SELECT active, unused tokens
CREATE POLICY vault_view_tokens_operator ON vault_view_tokens FOR SELECT TO authenticated
  USING (public.get_user_role() = 'print_operator' AND is_used = FALSE AND expires_at > NOW());
