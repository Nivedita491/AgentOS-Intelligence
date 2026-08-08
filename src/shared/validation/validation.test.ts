/**
 * Tests for the Structured API Validation Layer.
 *
 * Each test verifies the request/response schema validation behaviour for the
 * application's API surfaces. Tests assert:
 *   - whether parsing succeeds or fails
 *   - the standardized error code (via the ApiError envelope)
 *   - the HTTP status mapping for the error code
 *   - the response envelope shape
 */

import { describe, it, expect } from 'vitest';
import {
  parseRequest,
  parseResponse,
  assertRequest,
  HTTP_STATUS,
  ok,
  created,
  badRequest,
  validationError,
  notFound,
  internalError,
  isApiError,
} from './index';
import {
  DocumentUploadSchema,
  DocumentAttachmentUploadSchema,
  DocumentAttachmentDeleteSchema,
  DocumentAttachmentListSchema,
  DocumentUpdateSchema,
  SupportingEvidenceUploadSchema,
  EvidenceURLSchema,
  SupportingEvidenceRemoveSchema,
  RecordFiltersSchema,
  ReportExportRequestSchema,
  QuerySchema,
  HybridRetrievalSchema,
  GraphSearchSchema,
  MemorySearchSchema,
  AgentExecuteSchema,
  JobCreationSchema,
  HistoryQuerySchema,
  UserActionSchema,
  CreateActivityEventSchema,
  ActivityHistoryQuerySchema,
} from './schemas/requestSchemas';
import { ApiErrorResponseSchema, ForgeAIResponseSchema, GenericSuccessSchema } from './schemas/responseSchemas';
import { serializeActivityMetadata } from '@/lib/activity';

const UUID = '00000000-0000-4000-8000-000000000000';

describe('Document Upload validation', () => {
  const validUpload = {
    action: 'create',
    storagePath: 'default/documents/uuid_file.pdf',
    originalName: 'OEM Manual.pdf',
    mimeType: 'application/pdf',
    fileSize: 1024 * 1024,
  };

  it('accepts a valid upload request and infers the typed model', () => {
    const result = parseRequest(validUpload, DocumentUploadSchema);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.originalName).toBe('OEM Manual.pdf');
      expect(result.data.fileSize).toBe(1024 * 1024);
    }
  });

  it('rejects an upload with a missing original name', () => {
    const result = parseRequest(
      { action: 'create', storagePath: 'default/documents/a.pdf', fileSize: 100 },
      DocumentUploadSchema,
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      // HTTP status mapping for VALIDATION_ERROR must be 400
      expect(result.error.code).toBe('VALIDATION_ERROR');
      expect(HTTP_STATUS[result.error.code]).toBe(400);
      // Field-level details point at the missing field
      const details = result.error.details as Array<{ path: string; message: string }>;
      expect(details.some((d) => d.path === 'originalName')).toBe(true);
    }
  });

  it('rejects a large payload exceeding the 15 MB limit', () => {
    const result = parseRequest(
      {
        action: 'create',
        storagePath: 'default/documents/a.pdf',
        originalName: 'big.pdf',
        fileSize: 20 * 1024 * 1024,
      },
      DocumentUploadSchema,
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(HTTP_STATUS[result.error.code]).toBe(400);
      expect(result.error.code).toBe('VALIDATION_ERROR');
    }
  });

  it('rejects an invalid linked asset UUID', () => {
    const result = parseRequest(
      { ...validUpload, linkedAssetId: 'not-a-uuid' },
      DocumentUploadSchema,
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      const details = result.error.details as Array<{ path: string; message: string }>;
      expect(details.some((d) => d.path === 'linkedAssetId')).toBe(true);
    }
  });
});

describe('Document attachment validation', () => {
  const attachment = {
    documentId: UUID,
    fileName: 'supporting-evidence.pdf',
    extension: 'pdf',
    mimeType: 'application/pdf',
    fileSize: 1024,
    storagePath: `default/documents/${UUID}/attachments/attachment-supporting-evidence.pdf`,
  };

  it('accepts a valid attachment and allows a document with no attachments', () => {
    expect(parseRequest({ documentId: UUID }, DocumentAttachmentListSchema).success).toBe(true);
    expect(parseRequest(attachment, DocumentAttachmentUploadSchema).success).toBe(true);
  });

  it('validates updates to persisted document fields', () => {
    expect(parseRequest({ documentId: UUID, documentType: 'Project Brief', classification: 'Strategy', sourceDepartment: 'Operations', status: 'Ready', notes: 'Reviewed', recommendations: ['Publish the approved brief'] }, DocumentUpdateSchema).success).toBe(true);
    expect(parseRequest({ documentId: UUID, documentType: '', classification: null, sourceDepartment: null, status: 'Active' }, DocumentUpdateSchema).success).toBe(false);
  });

  it('accepts multiple independently valid attachments', () => {
    expect(parseRequest({ ...attachment, fileName: 'photo.png', extension: 'png', mimeType: 'image/png' }, DocumentAttachmentUploadSchema).success).toBe(true);
    expect(parseRequest({ ...attachment, fileName: 'notes.txt', extension: 'txt', mimeType: 'text/plain' }, DocumentAttachmentUploadSchema).success).toBe(true);
  });

  it('rejects an unsupported attachment type and oversized file', () => {
    expect(parseRequest({ ...attachment, fileName: 'script.exe', extension: 'exe', mimeType: 'application/x-msdownload' }, DocumentAttachmentUploadSchema).success).toBe(false);
    expect(parseRequest({ ...attachment, fileSize: 11 * 1024 * 1024 }, DocumentAttachmentUploadSchema).success).toBe(false);
  });

  it('validates attachment deletion and rejects malformed document IDs', () => {
    expect(parseRequest({ documentId: UUID, attachmentId: UUID }, DocumentAttachmentDeleteSchema).success).toBe(true);
    expect(parseRequest({ documentId: 'not-a-uuid' }, DocumentAttachmentListSchema).success).toBe(false);
  });
});

describe('Supporting evidence and record-report validation', () => {
  const evidenceFile = {
    documentId: UUID,
    fileName: 'inspection-photo.png',
    extension: 'png',
    mimeType: 'image/png',
    fileSize: 1024,
    storagePath: `default/documents/${UUID}/evidence/inspection-photo.png`,
  };

  it('accepts one supported evidence file, a link, filters, and report exports', () => {
    expect(parseRequest(evidenceFile, SupportingEvidenceUploadSchema).success).toBe(true);
    expect(parseRequest({ documentId: UUID, url: 'https://evidence.example/record/123' }, EvidenceURLSchema).success).toBe(true);
    expect(parseRequest({ documentId: UUID }, SupportingEvidenceRemoveSchema).success).toBe(true);
    expect(parseRequest({ keyword: 'pump', documentType: 'Inspection Report', category: 'Safety', status: 'Ready' }, RecordFiltersSchema).success).toBe(true);
    expect(parseRequest({ documentId: UUID, format: 'csv' }, ReportExportRequestSchema).success).toBe(true);
  });

  it('rejects unsupported evidence, non-HTTP evidence links, and unknown export formats', () => {
    expect(parseRequest({ ...evidenceFile, extension: 'txt', mimeType: 'text/plain' }, SupportingEvidenceUploadSchema).success).toBe(false);
    expect(parseRequest({ ...evidenceFile, extension: 'pdf', mimeType: 'image/png' }, SupportingEvidenceUploadSchema).success).toBe(false);
    expect(parseRequest({ keyword: 'pump', status: 'Active' }, RecordFiltersSchema).success).toBe(false);
    expect(parseRequest({ documentId: UUID, url: 'ftp://evidence.example/record/123' }, EvidenceURLSchema).success).toBe(false);
    expect(parseRequest({ documentId: UUID, format: 'pdf' }, ReportExportRequestSchema).success).toBe(true);
    expect(parseRequest({ documentId: UUID, format: 'docx' }, ReportExportRequestSchema).success).toBe(false);
  });
});

describe('RAG Query validation', () => {
  it('accepts a valid hybrid retrieval request', () => {
    const result = parseRequest(
      { query: 'approved product features', mode: 'search', topK: 8 },
      HybridRetrievalSchema,
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.topK).toBe(8);
      expect(result.data.mode).toBe('search');
    }
  });

  it('rejects a missing / too-short query', () => {
    const result = parseRequest({ query: 'ab' }, QuerySchema);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('VALIDATION_ERROR');
      expect(HTTP_STATUS[result.error.code]).toBe(400);
      const details = result.error.details as Array<{ path: string; message: string }>;
      expect(details.some((d) => d.path === 'query')).toBe(true);
    }
  });

  it('rejects an invalid organization UUID', () => {
    const result = parseRequest(
      { query: 'pricing approved', organizationId: 'oops' },
      QuerySchema,
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      const details = result.error.details as Array<{ path: string; message: string }>;
      expect(details.some((d) => d.path === 'organizationId')).toBe(true);
    }
  });

  it('applies the default topK when omitted', () => {
    const result = parseRequest({ query: 'approved features' }, QuerySchema);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.topK).toBe(6);
  });
});

describe('Graph Search validation', () => {
  it('accepts a valid graph search request', () => {
    const result = parseRequest(
      { query: 'P-204 relationships', maxHops: 2, limit: 20 },
      GraphSearchSchema,
    );
    expect(result.success).toBe(true);
  });

  it('rejects a bad graph request with missing query', () => {
    const result = parseRequest({ maxHops: 2 }, GraphSearchSchema);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('VALIDATION_ERROR');
      expect(HTTP_STATUS[result.error.code]).toBe(400);
    }
  });

  it('rejects a graph request with out-of-range maxHops', () => {
    const result = parseRequest(
      { query: 'hops', maxHops: 99 },
      GraphSearchSchema,
    );
    expect(result.success).toBe(false);
  });
});

describe('Memory Search validation', () => {
  it('accepts a valid memory search request', () => {
    const result = parseRequest(
      { query: 'recent episodes', memoryType: 'episodic', limit: 30 },
      MemorySearchSchema,
    );
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.memoryType).toBe('episodic');
  });

  it('rejects an invalid memoryType', () => {
    const result = parseRequest(
      { query: 'x', memoryType: 'quantum' },
      MemorySearchSchema,
    );
    expect(result.success).toBe(false);
  });
});

describe('Agent Execute validation', () => {
  it('accepts a valid agent execution request', () => {
    const result = parseRequest(
      { agentId: 'rag-agent', task: 'Retrieve approval evidence' },
      AgentExecuteSchema,
    );
    expect(result.success).toBe(true);
  });

  it('rejects a malformed agent request (missing agentId and task)', () => {
    const result = parseRequest({ timeoutMs: 5000 }, AgentExecuteSchema);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('VALIDATION_ERROR');
      expect(HTTP_STATUS[result.error.code]).toBe(400);
      const details = result.error.details as Array<{ path: string; message: string }>;
      expect(details.some((d) => d.path === 'agentId')).toBe(true);
      expect(details.some((d) => d.path === 'task')).toBe(true);
    }
  });
});

describe('Job Creation & History validation', () => {
  it('accepts a valid job creation request', () => {
    const result = parseRequest(
      { jobType: 'reindex', priority: 'high' },
      JobCreationSchema,
    );
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.priority).toBe('high');
  });

  it('rejects a job creation request without a jobType', () => {
    const result = parseRequest({}, JobCreationSchema);
    expect(result.success).toBe(false);
  });

  it('accepts a valid history query with defaults', () => {
    const result = parseRequest({}, HistoryQuerySchema);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(20);
      expect(result.data.offset).toBe(0);
    }
  });
});

describe('User Action validation', () => {
  it('accepts a valid user action', () => {
    const result = parseRequest(
      { action: 'approve', entityType: 'compliance_finding', entityId: UUID },
      UserActionSchema,
    );
    expect(result.success).toBe(true);
  });

  it('rejects an invalid user action entityId', () => {
    const result = parseRequest(
      { action: 'approve', entityType: 'compliance_finding', entityId: 'bad' },
      UserActionSchema,
    );
    expect(result.success).toBe(false);
  });

  it('rejects an unlisted action value', () => {
    const result = parseRequest(
      { action: 'explode', entityType: 'x', entityId: UUID },
      UserActionSchema,
    );
    expect(result.success).toBe(false);
  });
});

describe('Persistent Activity History validation', () => {
  const activity = {
    organizationId: UUID,
    requestId: 'req_activity_123',
    activityType: 'DOCUMENT_INDEXED',
    category: 'documents',
    status: 'success',
    title: 'Document indexed',
    documentId: UUID,
    metadata: { documentName: 'AgentOS Overview.md', chunkCount: 4 },
  };

  it('accepts a valid activity event', () => {
    const result = parseRequest(activity, CreateActivityEventSchema);
    expect(result.success).toBe(true);
  });

  it('rejects an invalid activity type', () => {
    const result = parseRequest({ ...activity, activityType: 'UNKNOWN_EVENT' }, CreateActivityEventSchema);
    expect(result.success).toBe(false);
  });

  it('rejects an invalid activity status', () => {
    const result = parseRequest({ ...activity, status: 'pending' }, CreateActivityEventSchema);
    expect(result.success).toBe(false);
  });

  it('validates history query filters and search input', () => {
    const result = parseRequest({ category: 'rag', status: 'success', search: 'req_activity_123', limit: 25, offset: 0 }, ActivityHistoryQuerySchema);
    expect(result.success).toBe(true);
  });

  it('rejects an inverted activity date range', () => {
    const result = parseRequest({ dateFrom: '2026-08-08T00:00:00.000Z', dateTo: '2026-08-07T00:00:00.000Z' }, ActivityHistoryQuerySchema);
    expect(result.success).toBe(false);
  });

  it('serializes activity metadata safely', () => {
    expect(serializeActivityMetadata({ chunks: 6, nested: { source: 'document' } })).toEqual({ chunks: 6, nested: { source: 'document' } });
  });
});

describe('Response validation', () => {
  it('validates a standardized success envelope', () => {
    const envelope = ok({ documentId: UUID, status: 'Ready' }, { chunkCount: 3 });
    const result = parseResponse(envelope, GenericSuccessSchema);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.success).toBe(true);
      expect((result.data as { requestId: string }).requestId).toBeTruthy();
    }
  });

  it('validates a standardized error envelope', () => {
    const envelope = badRequest('Missing query', [{ path: 'query', message: 'Required' }]);
    const result = parseResponse(envelope, ApiErrorResponseSchema);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.success).toBe(false);
      expect((result.data as { code: string }).code).toBe('VALIDATION_ERROR');
    }
  });

  it('validates a Forge AI success payload with answer fields', () => {
    const envelope = {
      success: true,
      requestId: UUID,
      answer: { directAnswer: 'ok', keyFindings: [], probableCauses: [], recommendedActions: [], riskNote: 'none', confidence: { level: 'high', score: 100 }, sources: [] },
    };
    const result = parseResponse(envelope, ForgeAIResponseSchema);
    expect(result.success).toBe(true);
  });

  it('validates a Forge AI search payload with retrieval fields', () => {
    const envelope = {
      success: true,
      requestId: UUID,
      retrieval: { debug: { query: 'x' } },
    };
    const result = parseResponse(envelope, ForgeAIResponseSchema);
    expect(result.success).toBe(true);
  });

  it('rejects a Forge AI payload missing both answer and retrieval', () => {
    const envelope = {
      success: true,
      requestId: UUID,
    };
    const result = parseResponse(envelope, ForgeAIResponseSchema);
    expect(result.success).toBe(false);
  });

  it('rejects a payload that is not an API envelope', () => {
    const result = parseResponse({ random: true }, ApiErrorResponseSchema);
    expect(result.success).toBe(false);
  });

  it('rejects a success envelope missing a requestId', () => {
    const result = parseResponse(
      { success: true, data: { ok: 1 } },
      GenericSuccessSchema,
    );
    expect(result.success).toBe(false);
  });
});

describe('API response helpers', () => {
  it('builds a success envelope with a requestId', () => {
    const res = created({ id: UUID });
    expect(res.success).toBe(true);
    expect(res.requestId).toBeTruthy();
    expect(res.meta?.status).toBe(201);
  });

it('builds standardized error envelopes with correct codes', () => {
    expect(validationError().code).toBe('VALIDATION_ERROR');
    expect(notFound().code).toBe('NOT_FOUND');
    expect(internalError().code).toBe('INTERNAL_ERROR');
    expect(HTTP_STATUS[notFound().code]).toBe(404);
    expect(HTTP_STATUS[internalError().code]).toBe(500);
    expect(HTTP_STATUS[validationError().code]).toBe(400);
  });

  it('isApiError narrows valid error envelopes', () => {
    expect(isApiError(badRequest('x'))).toBe(true);
    expect(isApiError(ok({}))).toBe(false);
    expect(isApiError(null)).toBe(false);
  });

it('assertRequest throws the standardized ApiError on failure', () => {
    try {
      assertRequest({ query: 'x' }, QuerySchema);
      expect.unreachable('assertRequest should have thrown');
    } catch (err) {
      expect((err as Error & { code?: string }).code).toBe('VALIDATION_ERROR');
    }
  });
});
