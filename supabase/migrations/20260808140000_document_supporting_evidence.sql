-- One optional supporting-evidence item per document: either a private file or an HTTP(S) link.
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS supporting_evidence_type text CHECK (supporting_evidence_type IN ('file', 'link')),
  ADD COLUMN IF NOT EXISTS supporting_file_name text,
  ADD COLUMN IF NOT EXISTS supporting_storage_path text,
  ADD COLUMN IF NOT EXISTS supporting_mime_type text,
  ADD COLUMN IF NOT EXISTS supporting_file_size bigint,
  ADD COLUMN IF NOT EXISTS supporting_url text,
  ADD COLUMN IF NOT EXISTS supporting_uploaded_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'documents_supporting_evidence_shape'
  ) THEN
    ALTER TABLE documents ADD CONSTRAINT documents_supporting_evidence_shape CHECK (
    (supporting_evidence_type IS NULL
      AND supporting_file_name IS NULL
      AND supporting_storage_path IS NULL
      AND supporting_mime_type IS NULL
      AND supporting_file_size IS NULL
      AND supporting_url IS NULL)
    OR (supporting_evidence_type = 'file'
      AND supporting_file_name IS NOT NULL
      AND supporting_storage_path IS NOT NULL
      AND supporting_mime_type IS NOT NULL
      AND supporting_file_size IS NOT NULL
      AND supporting_file_size > 0
      AND supporting_url IS NULL)
    OR (supporting_evidence_type = 'link'
      AND supporting_url IS NOT NULL
      AND supporting_file_name IS NULL
      AND supporting_storage_path IS NULL
      AND supporting_mime_type IS NULL
      AND supporting_file_size IS NULL)
    );
  END IF;
END $$;
