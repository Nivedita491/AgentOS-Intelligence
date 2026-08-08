import { isSupabaseConfigured } from './supabase';

/** Service-layer runtime switch; UI components remain backend-agnostic. */
export const isLocalKnowledgeRuntime = !isSupabaseConfigured;
