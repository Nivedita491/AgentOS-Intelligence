/*
  Phase 1 — organizational RAG, graph, and shared-memory foundation.

  Embeddings use Gemini `gemini-embedding-001` at 768 dimensions. The model
  supports configurable dimensions and 768 is one of its recommended sizes;
  changing the provider/dimension requires a new migration and reindex.
*/

CREATE EXTENSION IF NOT EXISTS vector;

-- ============ ORGANIZATIONS / ACCESS FOUNDATION ============
CREATE TABLE IF NOT EXISTS organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO organizations (slug, name)
VALUES ('default', 'ForgeMind Demo Organization')
ON CONFLICT (slug) DO NOTHING;

CREATE OR REPLACE FUNCTION default_organization_id()
RETURNS uuid
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT id FROM organizations WHERE slug = 'default' LIMIT 1;
$$;

CREATE TABLE IF NOT EXISTS organization_members (
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, user_id)
);

CREATE OR REPLACE FUNCTION is_organization_member(p_organization_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM organization_members
    WHERE organization_id = p_organization_id
      AND user_id = auth.uid()
  );
$$;

-- Add a tenant key to existing organizational records before tightening RLS.
DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'assets', 'documents', 'document_chunks', 'entities', 'entity_relationships',
    'maintenance_events', 'incidents', 'inspections', 'compliance_findings',
    'alerts', 'ai_queries', 'recommended_actions', 'qms_records', 'engineering_drawings'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(id)', table_name);
    EXECUTE format('UPDATE %I SET organization_id = default_organization_id() WHERE organization_id IS NULL', table_name);
    EXECUTE format('ALTER TABLE %I ALTER COLUMN organization_id SET NOT NULL', table_name);
    EXECUTE format('ALTER TABLE %I ALTER COLUMN organization_id SET DEFAULT default_organization_id()', table_name);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I(organization_id)', 'idx_' || table_name || '_organization_id', table_name);
  END LOOP;
END $$;

-- Existing document records stay valid; the extra fields make versions, lineage,
-- processing state, and permission-aware retrieval explicit.
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS storage_path text,
  ADD COLUMN IF NOT EXISTS processing_stage text NOT NULL DEFAULT 'uploaded',
  ADD COLUMN IF NOT EXISTS processing_error jsonb,
  ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'organization',
  ADD COLUMN IF NOT EXISTS department_id text,
  ADD COLUMN IF NOT EXISTS project_id text,
  ADD COLUMN IF NOT EXISTS allowed_roles text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS document_version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS effective_from timestamptz,
  ADD COLUMN IF NOT EXISTS effective_until timestamptz,
  ADD COLUMN IF NOT EXISTS is_current boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE document_chunks
  ADD COLUMN IF NOT EXISTS content_hash text,
  ADD COLUMN IF NOT EXISTS section_title text,
  ADD COLUMN IF NOT EXISTS heading_path text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS source_type text,
  ADD COLUMN IF NOT EXISTS mime_type text,
  ADD COLUMN IF NOT EXISTS token_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS start_offset integer,
  ADD COLUMN IF NOT EXISTS end_offset integer,
  ADD COLUMN IF NOT EXISTS embedding vector(768),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

UPDATE document_chunks
SET section_title = COALESCE(section_title, section_name, 'Document')
WHERE section_title IS NULL;

ALTER TABLE document_chunks
  ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (to_tsvector('english', coalesce(content, ''))) STORED;

CREATE UNIQUE INDEX IF NOT EXISTS idx_chunks_document_content_hash
  ON document_chunks(document_id, content_hash)
  WHERE content_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_chunks_org_document ON document_chunks(organization_id, document_id);
CREATE INDEX IF NOT EXISTS idx_chunks_org_page ON document_chunks(organization_id, page_number);
CREATE INDEX IF NOT EXISTS idx_chunks_metadata ON document_chunks USING gin(metadata_json);
CREATE INDEX IF NOT EXISTS idx_chunks_search_vector ON document_chunks USING gin(search_vector);
CREATE INDEX IF NOT EXISTS idx_chunks_created_at ON document_chunks(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chunks_embedding_hnsw
  ON document_chunks USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE INDEX IF NOT EXISTS idx_documents_org_status ON documents(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_documents_org_updated ON documents(organization_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_documents_permission_fields
  ON documents(organization_id, visibility, department_id, project_id, owner_id);
CREATE INDEX IF NOT EXISTS idx_documents_metadata ON documents USING gin(metadata_json);

DROP TRIGGER IF EXISTS trg_documents_updated ON documents;
CREATE TRIGGER trg_documents_updated BEFORE UPDATE ON documents
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_document_chunks_updated ON document_chunks;
CREATE TRIGGER trg_document_chunks_updated BEFORE UPDATE ON document_chunks
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Cache only real provider output. Reindexing can reuse identical normalized text.
CREATE TABLE IF NOT EXISTS embedding_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  content_hash text NOT NULL,
  model text NOT NULL,
  dimensions integer NOT NULL CHECK (dimensions = 768),
  embedding vector(768) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, content_hash, model)
);
ALTER TABLE embedding_cache ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_embedding_cache_lookup
  ON embedding_cache(organization_id, content_hash, model);

-- ============ EVIDENCE-BACKED KNOWLEDGE GRAPH ============
ALTER TABLE entities
  ADD COLUMN IF NOT EXISTS canonical_name text,
  ADD COLUMN IF NOT EXISTS aliases jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS confidence numeric(4,3),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
UPDATE entities
SET canonical_name = COALESCE(canonical_name, name)
WHERE canonical_name IS NULL;
ALTER TABLE entities ALTER COLUMN canonical_name SET NOT NULL;
ALTER TABLE entities DROP CONSTRAINT IF EXISTS entities_entity_type_normalized_name_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_entities_org_type_normalized
  ON entities(organization_id, entity_type, normalized_name);
CREATE INDEX IF NOT EXISTS idx_entities_org_type ON entities(organization_id, entity_type);
CREATE INDEX IF NOT EXISTS idx_entities_aliases ON entities USING gin(aliases);
DROP TRIGGER IF EXISTS trg_entities_updated ON entities;
CREATE TRIGGER trg_entities_updated BEFORE UPDATE ON entities
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE entity_relationships
  ADD COLUMN IF NOT EXISTS evidence_chunk_id uuid REFERENCES document_chunks(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS evidence text,
  ADD COLUMN IF NOT EXISTS confidence_score numeric(4,3),
  ADD COLUMN IF NOT EXISTS observed_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_relationships_org_source ON entity_relationships(organization_id, source_entity_id);
CREATE INDEX IF NOT EXISTS idx_relationships_org_target ON entity_relationships(organization_id, target_entity_id);
CREATE INDEX IF NOT EXISTS idx_relationships_evidence_chunk ON entity_relationships(evidence_chunk_id);

CREATE TABLE IF NOT EXISTS entity_mentions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  entity_id uuid NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  chunk_id uuid NOT NULL REFERENCES document_chunks(id) ON DELETE CASCADE,
  surface_form text NOT NULL,
  context text,
  confidence numeric(4,3),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (entity_id, chunk_id, surface_form)
);
ALTER TABLE entity_mentions ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_entity_mentions_entity ON entity_mentions(organization_id, entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_mentions_chunk ON entity_mentions(organization_id, chunk_id);
CREATE INDEX IF NOT EXISTS idx_entity_mentions_document ON entity_mentions(organization_id, document_id);

-- ============ SHARED ORGANIZATIONAL MEMORY ============
CREATE TABLE IF NOT EXISTS working_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL UNIQUE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  original_query text NOT NULL,
  rewritten_queries jsonb NOT NULL DEFAULT '[]'::jsonb,
  retrieved_chunk_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  discovered_entities jsonb NOT NULL DEFAULT '[]'::jsonb,
  current_plan jsonb NOT NULL DEFAULT '[]'::jsonb,
  intermediate_outputs jsonb NOT NULL DEFAULT '{}'::jsonb,
  current_status text NOT NULL DEFAULT 'retrieving',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz
);
ALTER TABLE working_memory ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_working_memory_org_updated ON working_memory(organization_id, updated_at DESC);
DROP TRIGGER IF EXISTS trg_working_memory_updated ON working_memory;
CREATE TRIGGER trg_working_memory_updated BEFORE UPDATE ON working_memory
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS episodic_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id uuid NOT NULL UNIQUE,
  task_id uuid REFERENCES working_memory(task_id) ON DELETE SET NULL,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  query text NOT NULL,
  agents_used jsonb NOT NULL DEFAULT '[]'::jsonb,
  retrieved_evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
  final_output jsonb,
  success boolean NOT NULL DEFAULT false,
  confidence numeric(4,3),
  latency_ms integer,
  token_usage integer,
  cost_estimate numeric(12,6),
  debug_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE episodic_memory ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_episodic_memory_org_created ON episodic_memory(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_episodic_memory_query ON episodic_memory USING gin(to_tsvector('english', query));

-- ============ HYBRID RETRIEVAL RPCS ============
CREATE OR REPLACE FUNCTION match_document_chunks(
  p_query_embedding vector(768),
  p_organization_id uuid,
  p_match_count integer DEFAULT 20,
  p_match_threshold real DEFAULT 0,
  p_document_ids uuid[] DEFAULT NULL,
  p_source_types text[] DEFAULT NULL,
  p_date_from timestamptz DEFAULT NULL,
  p_date_to timestamptz DEFAULT NULL,
  p_metadata_filter jsonb DEFAULT '{}'::jsonb
)
RETURNS TABLE (
  chunk_id uuid,
  document_id uuid,
  document_name text,
  content text,
  metadata jsonb,
  page_number integer,
  section_title text,
  heading_path text[],
  source_type text,
  similarity real
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT
    c.id, c.document_id, d.original_name, c.content, c.metadata_json,
    c.page_number, c.section_title, c.heading_path, c.source_type,
    (1 - (c.embedding <=> p_query_embedding))::real AS similarity
  FROM document_chunks c
  JOIN documents d ON d.id = c.document_id
  WHERE c.organization_id = p_organization_id
    AND d.organization_id = p_organization_id
    AND c.embedding IS NOT NULL
    AND (p_document_ids IS NULL OR c.document_id = ANY(p_document_ids))
    AND (p_source_types IS NULL OR c.source_type = ANY(p_source_types))
    AND (p_date_from IS NULL OR d.uploaded_at >= p_date_from)
    AND (p_date_to IS NULL OR d.uploaded_at <= p_date_to)
    AND c.metadata_json @> COALESCE(p_metadata_filter, '{}'::jsonb)
    AND (1 - (c.embedding <=> p_query_embedding)) >= p_match_threshold
  ORDER BY c.embedding <=> p_query_embedding
  LIMIT LEAST(GREATEST(p_match_count, 1), 100);
$$;

CREATE OR REPLACE FUNCTION match_document_chunks_lexical(
  p_query text,
  p_organization_id uuid,
  p_match_count integer DEFAULT 20,
  p_document_ids uuid[] DEFAULT NULL,
  p_source_types text[] DEFAULT NULL,
  p_date_from timestamptz DEFAULT NULL,
  p_date_to timestamptz DEFAULT NULL,
  p_metadata_filter jsonb DEFAULT '{}'::jsonb
)
RETURNS TABLE (
  chunk_id uuid,
  document_id uuid,
  document_name text,
  content text,
  metadata jsonb,
  page_number integer,
  section_title text,
  heading_path text[],
  source_type text,
  lexical_score real
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH query AS (SELECT websearch_to_tsquery('english', p_query) AS value)
  SELECT
    c.id, c.document_id, d.original_name, c.content, c.metadata_json,
    c.page_number, c.section_title, c.heading_path, c.source_type,
    ts_rank_cd(c.search_vector, query.value)::real AS lexical_score
  FROM document_chunks c
  JOIN documents d ON d.id = c.document_id
  CROSS JOIN query
  WHERE c.organization_id = p_organization_id
    AND d.organization_id = p_organization_id
    AND c.search_vector @@ query.value
    AND (p_document_ids IS NULL OR c.document_id = ANY(p_document_ids))
    AND (p_source_types IS NULL OR c.source_type = ANY(p_source_types))
    AND (p_date_from IS NULL OR d.uploaded_at >= p_date_from)
    AND (p_date_to IS NULL OR d.uploaded_at <= p_date_to)
    AND c.metadata_json @> COALESCE(p_metadata_filter, '{}'::jsonb)
  ORDER BY ts_rank_cd(c.search_vector, query.value) DESC, d.uploaded_at DESC
  LIMIT LEAST(GREATEST(p_match_count, 1), 100);
$$;

CREATE OR REPLACE FUNCTION match_metadata_document_chunks(
  p_organization_id uuid,
  p_match_count integer DEFAULT 20,
  p_document_ids uuid[] DEFAULT NULL,
  p_source_types text[] DEFAULT NULL,
  p_department text DEFAULT NULL,
  p_tags text[] DEFAULT NULL,
  p_date_from timestamptz DEFAULT NULL,
  p_date_to timestamptz DEFAULT NULL,
  p_metadata_filter jsonb DEFAULT '{}'::jsonb
)
RETURNS TABLE (
  chunk_id uuid,
  document_id uuid,
  document_name text,
  content text,
  metadata jsonb,
  page_number integer,
  section_title text,
  heading_path text[],
  source_type text,
  metadata_score real
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT
    c.id, c.document_id, d.original_name, c.content, c.metadata_json,
    c.page_number, c.section_title, c.heading_path, c.source_type,
    1.0::real AS metadata_score
  FROM document_chunks c
  JOIN documents d ON d.id = c.document_id
  WHERE c.organization_id = p_organization_id
    AND d.organization_id = p_organization_id
    AND (p_document_ids IS NULL OR c.document_id = ANY(p_document_ids))
    AND (p_source_types IS NULL OR c.source_type = ANY(p_source_types))
    AND (p_department IS NULL OR d.source_department = p_department)
    AND (p_tags IS NULL OR c.metadata_json -> 'tags' ?| p_tags)
    AND (p_date_from IS NULL OR d.uploaded_at >= p_date_from)
    AND (p_date_to IS NULL OR d.uploaded_at <= p_date_to)
    AND c.metadata_json @> COALESCE(p_metadata_filter, '{}'::jsonb)
  ORDER BY d.uploaded_at DESC, c.chunk_index
  LIMIT LEAST(GREATEST(p_match_count, 1), 100);
$$;

CREATE OR REPLACE FUNCTION match_graph_document_chunks(
  p_query text,
  p_organization_id uuid,
  p_match_count integer DEFAULT 10,
  p_max_hops integer DEFAULT 2
)
RETURNS TABLE (
  chunk_id uuid,
  document_id uuid,
  document_name text,
  content text,
  metadata jsonb,
  page_number integer,
  section_title text,
  heading_path text[],
  source_type text,
  graph_score real,
  traversal text[]
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH RECURSIVE
  query AS (SELECT websearch_to_tsquery('simple', p_query) AS value),
  seed AS (
    SELECT e.id, 0 AS hops, ARRAY[e.id] AS path,
      ts_rank_cd(to_tsvector('simple', concat_ws(' ', e.canonical_name, e.description, e.aliases::text)), query.value)::real AS score
    FROM entities e
    CROSS JOIN query
    WHERE e.organization_id = p_organization_id
      AND to_tsvector('simple', concat_ws(' ', e.canonical_name, e.description, e.aliases::text)) @@ query.value
    ORDER BY score DESC
    LIMIT 12
  ),
  walk AS (
    SELECT * FROM seed
    UNION ALL
    SELECT
      CASE WHEN r.source_entity_id = w.id THEN r.target_entity_id ELSE r.source_entity_id END,
      w.hops + 1,
      w.path || CASE WHEN r.source_entity_id = w.id THEN r.target_entity_id ELSE r.source_entity_id END,
      (w.score / (w.hops + 2))::real
    FROM walk w
    JOIN entity_relationships r
      ON r.organization_id = p_organization_id
      AND (r.source_entity_id = w.id OR r.target_entity_id = w.id)
    WHERE w.hops < LEAST(GREATEST(p_max_hops, 1), 2)
      AND NOT (CASE WHEN r.source_entity_id = w.id THEN r.target_entity_id ELSE r.source_entity_id END = ANY(w.path))
  ),
  candidates AS (
    SELECT em.chunk_id, max(w.score)::real AS score, array_agg(DISTINCT e.canonical_name) AS traversal
    FROM walk w
    JOIN entities e ON e.id = w.id
    JOIN entity_mentions em ON em.entity_id = w.id AND em.organization_id = p_organization_id
    GROUP BY em.chunk_id
  )
  SELECT
    c.id, c.document_id, d.original_name, c.content, c.metadata_json,
    c.page_number, c.section_title, c.heading_path, c.source_type,
    candidates.score, candidates.traversal
  FROM candidates
  JOIN document_chunks c ON c.id = candidates.chunk_id
  JOIN documents d ON d.id = c.document_id
  WHERE c.organization_id = p_organization_id
  ORDER BY candidates.score DESC, d.uploaded_at DESC
  LIMIT LEAST(GREATEST(p_match_count, 1), 100);
$$;

-- Remove stale graph artifacts after a document deletion/reindex has removed its
-- mentions and evidence. This never removes entities still connected to evidence.
CREATE OR REPLACE FUNCTION prune_orphan_graph_records(p_organization_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM entity_relationships r
  WHERE r.organization_id = p_organization_id
    AND r.evidence_document_id IS NULL
    AND r.evidence_chunk_id IS NULL
    AND NOT EXISTS (SELECT 1 FROM entity_mentions m WHERE m.entity_id = r.source_entity_id)
    AND NOT EXISTS (SELECT 1 FROM entity_mentions m WHERE m.entity_id = r.target_entity_id);

  DELETE FROM entities e
  WHERE e.organization_id = p_organization_id
    AND NOT EXISTS (SELECT 1 FROM entity_mentions m WHERE m.entity_id = e.id)
    AND NOT EXISTS (
      SELECT 1 FROM entity_relationships r
      WHERE r.source_entity_id = e.id OR r.target_entity_id = e.id
    );
END;
$$;

-- ============ ORGANIZATION-SCOPED RLS ============
-- The legacy demo has no login. Anonymous access is deliberately restricted to
-- the seeded default organization; authenticated users can only access memberships.
DO $$
DECLARE
  table_name text;
  policy_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'assets', 'documents', 'document_chunks', 'entities', 'entity_relationships',
    'maintenance_events', 'incidents', 'inspections', 'compliance_findings',
    'alerts', 'ai_queries', 'recommended_actions', 'qms_records', 'engineering_drawings',
    'embedding_cache', 'entity_mentions', 'working_memory', 'episodic_memory'
  ]
  LOOP
    FOR policy_name IN
      SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = table_name
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON %I', policy_name, table_name);
    END LOOP;
    EXECUTE format(
      'CREATE POLICY organization_scope ON %I FOR ALL TO anon, authenticated USING (organization_id = default_organization_id() OR is_organization_member(organization_id)) WITH CHECK (organization_id = default_organization_id() OR is_organization_member(organization_id))',
      table_name
    );
  END LOOP;
END $$;

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS organization_directory_scope ON organizations;
CREATE POLICY organization_directory_scope ON organizations FOR SELECT TO anon, authenticated
  USING (id = default_organization_id() OR is_organization_member(id));

ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS organization_members_scope ON organization_members;
CREATE POLICY organization_members_scope ON organization_members FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR is_organization_member(organization_id));

-- Private document objects are uploaded under default/documents in the unauthenticated
-- demo. A future authenticated uploader should receive a signed upload URL from the
-- ingestion function rather than broad client storage access.
INSERT INTO storage.buckets (id, name, public)
VALUES ('organizational-documents', 'organizational-documents', false)
ON CONFLICT (id) DO UPDATE SET public = false;

DROP POLICY IF EXISTS organizational_documents_insert ON storage.objects;
CREATE POLICY organizational_documents_insert ON storage.objects FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'organizational-documents' AND (storage.foldername(name))[1] = 'default');
DROP POLICY IF EXISTS organizational_documents_select ON storage.objects;
CREATE POLICY organizational_documents_select ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'organizational-documents' AND (storage.foldername(name))[1] = 'default');
DROP POLICY IF EXISTS organizational_documents_delete ON storage.objects;
CREATE POLICY organizational_documents_delete ON storage.objects FOR DELETE TO anon, authenticated
  USING (bucket_id = 'organizational-documents' AND (storage.foldername(name))[1] = 'default');
