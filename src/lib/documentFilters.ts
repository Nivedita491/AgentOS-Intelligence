import type { Doc } from '@/types';
import { assertRequest, RecordFiltersSchema } from '@/shared/validation';

export interface DocumentFilters {
  keyword?: string;
  documentType?: string;
  category?: string;
  status?: string;
}

function documentTags(document: Doc): string[] {
  const tags = document.metadata_json?.tags;
  return Array.isArray(tags) ? tags.filter((tag): tag is string => typeof tag === 'string') : [];
}

/** Filters only persisted document fields and document metadata tags. */
export function filterDocuments(documents: Doc[], filters: DocumentFilters): Doc[] {
  const request = assertRequest({
    keyword: filters.keyword?.trim() || undefined,
    documentType: filters.documentType && filters.documentType !== 'all' ? filters.documentType : undefined,
    category: filters.category && filters.category !== 'all' ? filters.category : undefined,
    status: filters.status && filters.status !== 'all' ? filters.status : undefined,
  }, RecordFiltersSchema);
  const keyword = request.keyword?.toLocaleLowerCase();

  return documents.filter((document) => {
    const searchable = [
      document.filename,
      document.original_name,
      document.document_type,
      document.classification,
      document.status,
      document.source_department,
      document.parsed_text,
      ...documentTags(document),
    ].filter((value): value is string => Boolean(value)).join(' ').toLocaleLowerCase();
    return (!keyword || searchable.includes(keyword))
      && (!request.documentType || document.document_type === request.documentType)
      && (!request.category || document.classification === request.category)
      && (!request.status || document.status === request.status);
  });
}
