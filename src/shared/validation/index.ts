/**
 * Structured API Validation Layer — public barrel.
 *
 * Re-exports the shared validation primitives used across the frontend API layer,
 * pages, and error UI.
 */

export * from './errorCodes';
export * from './requestId';
export * from './apiResponse';
export * from './validator';
export * from './errorUtils';

export * from './schemas/common';
export * from './schemas/requestSchemas';
export * from './schemas/responseSchemas';

export { logValidationFailure, logRequestSuccess } from './logger';
export type { LogContext, ValidationFailureLog } from './logger';

export type {
  ApiSuccess,
  ApiError,
  ApiResponse,
} from './apiResponse';

export type {
  QueryRequest,
  HybridRetrievalRequest,
  DocumentUploadRequest,
  DocumentActionRequest,
  GraphSearchRequest,
  MemorySearchRequest,
  AgentExecuteRequest,
  JobCreationRequest,
  HistoryQueryRequest,
  UserActionRequest,
  CopilotQueryRequest,
  SettingsQueryRequest,
  CreateActivityEventRequest,
  ActivityEventResponse,
  ActivityHistoryQueryRequest,
} from './schemas/requestSchemas';

export type { ApiErrorResponse } from './schemas/responseSchemas';
