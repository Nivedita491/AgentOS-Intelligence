/*
# ForgeMind AI — Core Schema

## Purpose
Industrial Knowledge Intelligence platform: unified asset & operations brain.
Single-tenant demo app (no auth). All policies allow anon+authenticated CRUD.

## Tables
1. assets — industrial equipment (pumps, boilers, compressors, etc.)
2. documents — uploaded industrial documents (manuals, SOPs, reports)
3. document_chunks — text chunks for retrieval
4. entities — extracted entities (asset tags, failure modes, dates, etc.)
5. entity_relationships — graph edges between entities
6. maintenance_events — maintenance history per asset
7. incidents — failure/incident records
8. inspections — inspection records per asset
9. compliance_rules — deterministic inspection/compliance rules
10. compliance_findings — computed compliance status per asset+rule
11. alerts — operational alerts
12. ai_queries — logged AI copilot queries
13. recommended_actions — actions derived from AI analysis

## Security
- RLS enabled on all tables.
- All tables allow anon+authenticated CRUD (single-tenant shared demo data).
*/

-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============ ASSETS ============
CREATE TABLE IF NOT EXISTS assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_tag text UNIQUE NOT NULL,
  name text NOT NULL,
  type text NOT NULL,
  location text NOT NULL,
  manufacturer text,
  model text,
  installation_date date,
  criticality text NOT NULL DEFAULT 'Medium',
  health_status text NOT NULL DEFAULT 'Healthy',
  health_score integer NOT NULL DEFAULT 100,
  last_maintenance_date date,
  next_inspection_date date,
  current_observations jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_crud_assets_s" ON assets;
CREATE POLICY "anon_crud_assets_s" ON assets FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_crud_assets_i" ON assets;
CREATE POLICY "anon_crud_assets_i" ON assets FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_crud_assets_u" ON assets;
CREATE POLICY "anon_crud_assets_u" ON assets FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_crud_assets_d" ON assets;
CREATE POLICY "anon_crud_assets_d" ON assets FOR DELETE TO anon, authenticated USING (true);
CREATE INDEX IF NOT EXISTS idx_assets_status ON assets(health_status);
CREATE INDEX IF NOT EXISTS idx_assets_type ON assets(type);
CREATE INDEX IF NOT EXISTS idx_assets_location ON assets(location);

-- ============ DOCUMENTS ============
CREATE TABLE IF NOT EXISTS documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  filename text NOT NULL,
  original_name text NOT NULL,
  mime_type text,
  file_size bigint DEFAULT 0,
  document_type text NOT NULL DEFAULT 'General Engineering Document',
  classification text,
  status text NOT NULL DEFAULT 'Uploaded',
  linked_asset_id uuid REFERENCES assets(id) ON DELETE SET NULL,
  source_department text,
  uploaded_at timestamptz DEFAULT now(),
  parsed_text text,
  metadata_json jsonb DEFAULT '{}'::jsonb,
  error_message text,
  page_count integer
);
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_crud_documents_s" ON documents;
CREATE POLICY "anon_crud_documents_s" ON documents FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_crud_documents_i" ON documents;
CREATE POLICY "anon_crud_documents_i" ON documents FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_crud_documents_u" ON documents;
CREATE POLICY "anon_crud_documents_u" ON documents FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_crud_documents_d" ON documents;
CREATE POLICY "anon_crud_documents_d" ON documents FOR DELETE TO anon, authenticated USING (true);
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
CREATE INDEX IF NOT EXISTS idx_documents_type ON documents(document_type);
CREATE INDEX IF NOT EXISTS idx_documents_linked_asset ON documents(linked_asset_id);

-- ============ DOCUMENT_CHUNKS ============
CREATE TABLE IF NOT EXISTS document_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  chunk_index integer NOT NULL,
  content text NOT NULL,
  page_number integer,
  section_name text,
  metadata_json jsonb DEFAULT '{}'::jsonb,
  embedding_json jsonb,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_crud_chunks_s" ON document_chunks;
CREATE POLICY "anon_crud_chunks_s" ON document_chunks FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_crud_chunks_i" ON document_chunks;
CREATE POLICY "anon_crud_chunks_i" ON document_chunks FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_crud_chunks_u" ON document_chunks;
CREATE POLICY "anon_crud_chunks_u" ON document_chunks FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_crud_chunks_d" ON document_chunks;
CREATE POLICY "anon_crud_chunks_d" ON document_chunks FOR DELETE TO anon, authenticated USING (true);
CREATE INDEX IF NOT EXISTS idx_chunks_document_id ON document_chunks(document_id);

-- ============ ENTITIES ============
CREATE TABLE IF NOT EXISTS entities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  name text NOT NULL,
  normalized_name text NOT NULL,
  metadata_json jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  UNIQUE (entity_type, normalized_name)
);
ALTER TABLE entities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_crud_entities_s" ON entities;
CREATE POLICY "anon_crud_entities_s" ON entities FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_crud_entities_i" ON entities;
CREATE POLICY "anon_crud_entities_i" ON entities FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_crud_entities_u" ON entities;
CREATE POLICY "anon_crud_entities_u" ON entities FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_crud_entities_d" ON entities;
CREATE POLICY "anon_crud_entities_d" ON entities FOR DELETE TO anon, authenticated USING (true);
CREATE INDEX IF NOT EXISTS idx_entities_type ON entities(entity_type);

-- ============ ENTITY_RELATIONSHIPS ============
CREATE TABLE IF NOT EXISTS entity_relationships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_entity_id uuid NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  relationship_type text NOT NULL,
  target_entity_id uuid NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  evidence_document_id uuid REFERENCES documents(id) ON DELETE SET NULL,
  confidence text DEFAULT 'medium',
  metadata_json jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE entity_relationships ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_crud_er_s" ON entity_relationships;
CREATE POLICY "anon_crud_er_s" ON entity_relationships FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_crud_er_i" ON entity_relationships;
CREATE POLICY "anon_crud_er_i" ON entity_relationships FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_crud_er_u" ON entity_relationships;
CREATE POLICY "anon_crud_er_u" ON entity_relationships FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_crud_er_d" ON entity_relationships;
CREATE POLICY "anon_crud_er_d" ON entity_relationships FOR DELETE TO anon, authenticated USING (true);
CREATE INDEX IF NOT EXISTS idx_er_source ON entity_relationships(source_entity_id);
CREATE INDEX IF NOT EXISTS idx_er_target ON entity_relationships(target_entity_id);
CREATE INDEX IF NOT EXISTS idx_er_type ON entity_relationships(relationship_type);

-- ============ MAINTENANCE_EVENTS ============
CREATE TABLE IF NOT EXISTS maintenance_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  event_date date NOT NULL,
  event_type text NOT NULL,
  description text,
  technician text,
  downtime_hours numeric DEFAULT 0,
  findings text,
  action_taken text,
  source_document_id uuid REFERENCES documents(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE maintenance_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_crud_me_s" ON maintenance_events;
CREATE POLICY "anon_crud_me_s" ON maintenance_events FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_crud_me_i" ON maintenance_events;
CREATE POLICY "anon_crud_me_i" ON maintenance_events FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_crud_me_u" ON maintenance_events;
CREATE POLICY "anon_crud_me_u" ON maintenance_events FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_crud_me_d" ON maintenance_events;
CREATE POLICY "anon_crud_me_d" ON maintenance_events FOR DELETE TO anon, authenticated USING (true);
CREATE INDEX IF NOT EXISTS idx_me_asset_id ON maintenance_events(asset_id);
CREATE INDEX IF NOT EXISTS idx_me_event_date ON maintenance_events(event_date);

-- ============ INCIDENTS ============
CREATE TABLE IF NOT EXISTS incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  incident_date date NOT NULL,
  title text NOT NULL,
  symptoms text,
  root_cause text,
  severity text DEFAULT 'Medium',
  downtime_hours numeric DEFAULT 0,
  corrective_action text,
  source_document_id uuid REFERENCES documents(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_crud_inc_s" ON incidents;
CREATE POLICY "anon_crud_inc_s" ON incidents FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_crud_inc_i" ON incidents;
CREATE POLICY "anon_crud_inc_i" ON incidents FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_crud_inc_u" ON incidents;
CREATE POLICY "anon_crud_inc_u" ON incidents FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_crud_inc_d" ON incidents;
CREATE POLICY "anon_crud_inc_d" ON incidents FOR DELETE TO anon, authenticated USING (true);
CREATE INDEX IF NOT EXISTS idx_inc_asset_id ON incidents(asset_id);

-- ============ INSPECTIONS ============
CREATE TABLE IF NOT EXISTS inspections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  inspection_type text NOT NULL,
  completed_date date,
  due_date date,
  result text,
  findings text,
  source_document_id uuid REFERENCES documents(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE inspections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_crud_ins_s" ON inspections;
CREATE POLICY "anon_crud_ins_s" ON inspections FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_crud_ins_i" ON inspections;
CREATE POLICY "anon_crud_ins_i" ON inspections FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_crud_ins_u" ON inspections;
CREATE POLICY "anon_crud_ins_u" ON inspections FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_crud_ins_d" ON inspections;
CREATE POLICY "anon_crud_ins_d" ON inspections FOR DELETE TO anon, authenticated USING (true);
CREATE INDEX IF NOT EXISTS idx_ins_asset_id ON inspections(asset_id);

-- ============ COMPLIANCE_RULES ============
CREATE TABLE IF NOT EXISTS compliance_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  scope_asset_type text,
  interval_days integer NOT NULL,
  severity text DEFAULT 'Medium',
  configured_source text DEFAULT 'Internal prototype compliance rule',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE compliance_rules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_crud_cr_s" ON compliance_rules;
CREATE POLICY "anon_crud_cr_s" ON compliance_rules FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_crud_cr_i" ON compliance_rules;
CREATE POLICY "anon_crud_cr_i" ON compliance_rules FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_crud_cr_u" ON compliance_rules;
CREATE POLICY "anon_crud_cr_u" ON compliance_rules FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_crud_cr_d" ON compliance_rules;
CREATE POLICY "anon_crud_cr_d" ON compliance_rules FOR DELETE TO anon, authenticated USING (true);

-- ============ COMPLIANCE_FINDINGS ============
CREATE TABLE IF NOT EXISTS compliance_findings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  compliance_rule_id uuid NOT NULL REFERENCES compliance_rules(id) ON DELETE CASCADE,
  asset_id uuid NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  last_evidence_date date,
  due_date date,
  status text NOT NULL DEFAULT 'Compliant',
  days_overdue integer DEFAULT 0,
  evidence_document_id uuid REFERENCES documents(id) ON DELETE SET NULL,
  recommended_action text,
  created_at timestamptz DEFAULT now(),
  resolved_at timestamptz,
  UNIQUE (compliance_rule_id, asset_id)
);
ALTER TABLE compliance_findings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_crud_cf_s" ON compliance_findings;
CREATE POLICY "anon_crud_cf_s" ON compliance_findings FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_crud_cf_i" ON compliance_findings;
CREATE POLICY "anon_crud_cf_i" ON compliance_findings FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_crud_cf_u" ON compliance_findings;
CREATE POLICY "anon_crud_cf_u" ON compliance_findings FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_crud_cf_d" ON compliance_findings;
CREATE POLICY "anon_crud_cf_d" ON compliance_findings FOR DELETE TO anon, authenticated USING (true);
CREATE INDEX IF NOT EXISTS idx_cf_asset_id ON compliance_findings(asset_id);
CREATE INDEX IF NOT EXISTS idx_cf_status ON compliance_findings(status);

-- ============ ALERTS ============
CREATE TABLE IF NOT EXISTS alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid REFERENCES assets(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  description text,
  severity text DEFAULT 'Medium',
  status text DEFAULT 'Open',
  evidence_document_id uuid REFERENCES documents(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  resolved_at timestamptz
);
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_crud_al_s" ON alerts;
CREATE POLICY "anon_crud_al_s" ON alerts FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_crud_al_i" ON alerts;
CREATE POLICY "anon_crud_al_i" ON alerts FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_crud_al_u" ON alerts;
CREATE POLICY "anon_crud_al_u" ON alerts FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_crud_al_d" ON alerts;
CREATE POLICY "anon_crud_al_d" ON alerts FOR DELETE TO anon, authenticated USING (true);
CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts(status);
CREATE INDEX IF NOT EXISTS idx_alerts_severity ON alerts(severity);

-- ============ AI_QUERIES ============
CREATE TABLE IF NOT EXISTS ai_queries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  query text NOT NULL,
  intent text,
  asset_id uuid REFERENCES assets(id) ON DELETE SET NULL,
  answer jsonb,
  confidence text,
  sources_json jsonb DEFAULT '[]'::jsonb,
  response_time_ms integer,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE ai_queries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_crud_aq_s" ON ai_queries;
CREATE POLICY "anon_crud_aq_s" ON ai_queries FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_crud_aq_i" ON ai_queries;
CREATE POLICY "anon_crud_aq_i" ON ai_queries FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_crud_aq_u" ON ai_queries;
CREATE POLICY "anon_crud_aq_u" ON ai_queries FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_crud_aq_d" ON ai_queries;
CREATE POLICY "anon_crud_aq_d" ON ai_queries FOR DELETE TO anon, authenticated USING (true);
CREATE INDEX IF NOT EXISTS idx_aq_created_at ON ai_queries(created_at DESC);

-- ============ RECOMMENDED_ACTIONS ============
CREATE TABLE IF NOT EXISTS recommended_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid REFERENCES assets(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  priority text DEFAULT 'Medium',
  status text DEFAULT 'Open',
  source_query_id uuid REFERENCES ai_queries(id) ON DELETE SET NULL,
  due_date date,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE recommended_actions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_crud_ra_s" ON recommended_actions;
CREATE POLICY "anon_crud_ra_s" ON recommended_actions FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_crud_ra_i" ON recommended_actions;
CREATE POLICY "anon_crud_ra_i" ON recommended_actions FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_crud_ra_u" ON recommended_actions;
CREATE POLICY "anon_crud_ra_u" ON recommended_actions FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_crud_ra_d" ON recommended_actions;
CREATE POLICY "anon_crud_ra_d" ON recommended_actions FOR DELETE TO anon, authenticated USING (true);
CREATE INDEX IF NOT EXISTS idx_ra_asset_id ON recommended_actions(asset_id);
CREATE INDEX IF NOT EXISTS idx_ra_status ON recommended_actions(status);

-- ============ SETTINGS (key-value) ============
CREATE TABLE IF NOT EXISTS app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_crud_as_s" ON app_settings;
CREATE POLICY "anon_crud_as_s" ON app_settings FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_crud_as_i" ON app_settings;
CREATE POLICY "anon_crud_as_i" ON app_settings FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_crud_as_u" ON app_settings;
CREATE POLICY "anon_crud_as_u" ON app_settings FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_crud_as_d" ON app_settings;
CREATE POLICY "anon_crud_as_d" ON app_settings FOR DELETE TO anon, authenticated USING (true);

-- updated_at trigger helper
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_assets_updated ON assets;
CREATE TRIGGER trg_assets_updated BEFORE UPDATE ON assets
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
