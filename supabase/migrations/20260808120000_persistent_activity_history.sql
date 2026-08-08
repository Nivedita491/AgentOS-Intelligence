-- Persistent, organization-scoped audit-style history for user and system actions.
CREATE TABLE IF NOT EXISTS activity_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  request_id text,
  activity_type text NOT NULL,
  category text NOT NULL CHECK (category IN ('documents', 'rag', 'ai', 'graph', 'memory', 'system', 'agents')),
  status text NOT NULL CHECK (status IN ('success', 'failed', 'running', 'warning')),
  title text NOT NULL,
  description text,
  entity_type text,
  entity_id text,
  document_id uuid REFERENCES documents(id) ON DELETE SET NULL,
  task_id text,
  agent_name text,
  duration_ms integer CHECK (duration_ms IS NULL OR duration_ms >= 0),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_code text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activity_events_org_created ON activity_events(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_events_type ON activity_events(activity_type);
CREATE INDEX IF NOT EXISTS idx_activity_events_category ON activity_events(category);
CREATE INDEX IF NOT EXISTS idx_activity_events_status ON activity_events(status);
CREATE INDEX IF NOT EXISTS idx_activity_events_document ON activity_events(document_id);
CREATE INDEX IF NOT EXISTS idx_activity_events_request ON activity_events(request_id) WHERE request_id IS NOT NULL;

ALTER TABLE activity_events ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON activity_events TO anon, authenticated;
DROP POLICY IF EXISTS activity_events_organization_scope ON activity_events;
CREATE POLICY activity_events_organization_scope ON activity_events
  FOR ALL TO anon, authenticated
  USING (organization_id = default_organization_id() OR is_organization_member(organization_id))
  WITH CHECK (organization_id = default_organization_id() OR is_organization_member(organization_id));
