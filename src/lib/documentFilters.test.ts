import { describe, expect, it } from 'vitest';
import { filterDocuments } from './documentFilters';
import type { Doc } from '@/types';

const docs: Doc[] = [
  { id: '11111111-1111-4111-8111-111111111111', filename: 'pump-inspection.pdf', original_name: 'Pump inspection.pdf', mime_type: 'application/pdf', file_size: 100, document_type: 'Inspection Report', classification: 'Safety', status: 'Ready', linked_asset_id: null, source_department: 'Operations', uploaded_at: '2026-01-01T00:00:00.000Z', parsed_text: 'Hydraulic pressure is within limit.', metadata_json: { tags: ['pump', 'hydraulic'] }, error_message: null, page_count: 1 },
  { id: '22222222-2222-4222-8222-222222222222', filename: 'quality-sop.pdf', original_name: 'Quality SOP.pdf', mime_type: 'application/pdf', file_size: 200, document_type: 'Standard Operating Procedure', classification: 'Quality', status: 'Uploaded', linked_asset_id: null, source_department: 'Quality', uploaded_at: '2026-01-02T00:00:00.000Z', parsed_text: 'Calibration procedure.', metadata_json: { tags: ['calibration'] }, error_message: null, page_count: 2 },
];

describe('filterDocuments', () => {
  it('searches stored document text and tags', () => {
    expect(filterDocuments(docs, { keyword: 'hydraulic' })).toEqual([docs[0]]);
    expect(filterDocuments(docs, { keyword: 'calibration' })).toEqual([docs[1]]);
  });

  it('combines actual type, category, and status fields', () => {
    expect(filterDocuments(docs, { documentType: 'Inspection Report', category: 'Safety', status: 'Ready' })).toEqual([docs[0]]);
    expect(filterDocuments(docs, { documentType: 'Inspection Report', category: 'Quality', status: 'Ready' })).toEqual([]);
  });
});
