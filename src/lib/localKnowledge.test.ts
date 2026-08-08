import { beforeEach, describe, expect, it } from 'vitest';
import { getActivity, localCopilot, localRagSearch } from './localKnowledge';

const storage = new Map<string, string>();

beforeEach(() => {
  storage.clear();
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      localStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
      },
    },
  });
});

describe('local knowledge fallback', () => {
  it('returns grounded citations for flexible local questions', () => {
    const response = localCopilot('Who is the CEO for Project Aurora?');
    expect(response.fallback).toBe(true);
    expect(response.answer.directAnswer).toContain('Maya Chen');
    expect(response.sources.length).toBeGreaterThan(0);
  });

  it('uses neutral deterministic relevance results and records the query activity', () => {
    const result = localRagSearch('current pricing for Aurora');
    expect(result.embeddingModel).toBe('local-token-ranking');
    expect(result.finalResults[0]?.documentName).toBe('Aurora Pricing Framework.pdf');
    localCopilot('What technologies are used by Aurora?');
    expect(getActivity({ category: 'ai' }).events[0]?.activity_type).toBe('LOCAL_KNOWLEDGE_QUERY_COMPLETED');
  });
});
