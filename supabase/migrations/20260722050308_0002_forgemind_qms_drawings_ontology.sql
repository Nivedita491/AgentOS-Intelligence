/*
# ForgeMind AI — Architectural Enhancement: QMS, Drawings, Ontology

## Purpose
Extends the existing schema to support:
1. Quality Management System (QMS) — deviations, CAPA, NCR, audits
2. Engineering Drawings — P&ID, equipment layouts, vision agent extraction
3. Industrial Ontology — ontology_class on entities + new typed relationships

## New Tables
- `qms_records` — unified QMS records (deviation, capa, ncr, audit_finding, corrective_action, preventive_action, training_record, quality_event, batch_investigation)
- `engineering_drawings` — uploaded drawings with vision-extracted entities

## Modified Tables
- `entities` — add `ontology_class` column (maps entities to ontology classes like Asset, Component, FailureMode, etc.)

## Security
- RLS enabled on new tables with anon+authenticated CRUD (single-tenant demo).
*/

-- ============ Add ontology_class to entities ============
ALTER TABLE entities ADD COLUMN IF NOT EXISTS ontology_class text;

-- ============ QMS RECORDS ============
CREATE TABLE IF NOT EXISTS qms_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  record_type text NOT NULL,
  code text UNIQUE NOT NULL,
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'Open',
  severity text DEFAULT 'Medium',
  owner text,
  department text,
  asset_id uuid REFERENCES assets(id) ON DELETE SET NULL,
  linked_document_id uuid REFERENCES documents(id) ON DELETE SET NULL,
  linked_incident_id uuid REFERENCES incidents(id) ON DELETE SET NULL,
  linked_maintenance_id uuid REFERENCES maintenance_events(id) ON DELETE SET NULL,
  root_cause text,
  corrective_action text,
  preventive_action text,
  due_date date,
  closed_date date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE qms_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_crud_qms_s" ON qms_records;
CREATE POLICY "anon_crud_qms_s" ON qms_records FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_crud_qms_i" ON qms_records;
CREATE POLICY "anon_crud_qms_i" ON qms_records FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_crud_qms_u" ON qms_records;
CREATE POLICY "anon_crud_qms_u" ON qms_records FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_crud_qms_d" ON qms_records;
CREATE POLICY "anon_crud_qms_d" ON qms_records FOR DELETE TO anon, authenticated USING (true);
CREATE INDEX IF NOT EXISTS idx_qms_type ON qms_records(record_type);
CREATE INDEX IF NOT EXISTS idx_qms_status ON qms_records(status);
CREATE INDEX IF NOT EXISTS idx_qms_asset_id ON qms_records(asset_id);

-- ============ ENGINEERING_DRAWINGS ============
CREATE TABLE IF NOT EXISTS engineering_drawings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  filename text NOT NULL,
  original_name text NOT NULL,
  drawing_type text NOT NULL DEFAULT 'P&ID',
  status text NOT NULL DEFAULT 'Uploaded',
  linked_asset_id uuid REFERENCES assets(id) ON DELETE SET NULL,
  uploaded_at timestamptz DEFAULT now(),
  ocr_text text,
  detected_tags jsonb DEFAULT '[]'::jsonb,
  detected_instruments jsonb DEFAULT '[]'::jsonb,
  detected_labels jsonb DEFAULT '[]'::jsonb,
  extracted_entities jsonb DEFAULT '[]'::jsonb,
  metadata_json jsonb DEFAULT '{}'::jsonb,
  error_message text
);
ALTER TABLE engineering_drawings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_crud_ed_s" ON engineering_drawings;
CREATE POLICY "anon_crud_ed_s" ON engineering_drawings FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_crud_ed_i" ON engineering_drawings;
CREATE POLICY "anon_crud_ed_i" ON engineering_drawings FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_crud_ed_u" ON engineering_drawings;
CREATE POLICY "anon_crud_ed_u" ON engineering_drawings FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_crud_ed_d" ON engineering_drawings;
CREATE POLICY "anon_crud_ed_d" ON engineering_drawings FOR DELETE TO anon, authenticated USING (true);
CREATE INDEX IF NOT EXISTS idx_ed_linked_asset ON engineering_drawings(linked_asset_id);
