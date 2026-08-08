import { describe, expect, it } from 'vitest';
import { buildDocumentReportCsv, buildDocumentReportHtml } from './documentReport';
import type { Doc } from '@/types';

const document: Doc = {
  id: '11111111-1111-4111-8111-111111111111', filename: 'inspection.pdf', original_name: 'Inspection "A".pdf', mime_type: 'application/pdf', file_size: 256,
  document_type: 'Inspection Report', classification: 'Safety', status: 'Ready', linked_asset_id: null, source_department: 'Operations', uploaded_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-02T00:00:00.000Z', parsed_text: 'Pressure < limit', metadata_json: null, error_message: null, page_count: 1,
  supporting_evidence_type: 'link', supporting_url: 'https://example.com/evidence', supporting_uploaded_at: '2026-01-02T00:00:00.000Z',
};

describe('document report builders', () => {
  it('creates a CSV from stored document fields', () => {
    const csv = buildDocumentReportCsv(document);
    expect(csv).toContain('"Original file name","Inspection ""A"".pdf"');
    expect(csv).toContain('"Supporting evidence","https://example.com/evidence"');
  });

  it('creates an escaped standalone HTML report', () => {
    const html = buildDocumentReportHtml(document);
    expect(html).toContain('Record Assessment Report');
    expect(html).toContain('Pressure &lt; limit');
    expect(html).toContain('href="https://example.com/evidence"');
  });
});
