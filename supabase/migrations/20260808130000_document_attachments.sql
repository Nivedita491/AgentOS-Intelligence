-- Attachments remain private objects in the existing organizational-documents bucket.
CREATE TABLE IF NOT EXISTS record_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  storage_path text NOT NULL UNIQUE,
  mime_type text,
  file_size bigint,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_record_attachments_document ON record_attachments(document_id);

ALTER TABLE record_attachments ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON record_attachments TO anon, authenticated;
DROP POLICY IF EXISTS record_attachments_read_scope ON record_attachments;
CREATE POLICY record_attachments_read_scope ON record_attachments
  FOR SELECT TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM documents d
      WHERE d.id = record_attachments.document_id
        AND d.organization_id = record_attachments.organization_id
    )
  );
