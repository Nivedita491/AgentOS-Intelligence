# Legacy: ForgeMind (Historical Prototype)

> ⚠️ **Archive / historical context only.** This document preserves the original *ForgeMind* prototype that was the foundation for AgentOS Intelligence. It is retained for provenance and product context. It is **not** the current product story and should not be used as the primary repository README.

The current product, **AgentOS Intelligence**, is a collaborative organizational intelligence layer built on Hybrid RAG, knowledge graphs, and shared memory. The ForgeMind prototype was an industrial-domain pilot (built for the ET AI Hackathon 2026, Problem Statement 8) whose working codebase (document processing, RAG, knowledge graph, and React shell) was reused as the technical foundation.

References here to keyword vector search, browser-only binary parsing, and deterministic answer fallback are **historical** and have been superseded by the Phase 1 hybrid RAG implementation.

---

## ForgeMind AI — Original Summary

**Industrial knowledge, connected to action.**

The unified intelligence layer for assets, operations, maintenance, and compliance.

### Problem Statement (historical)

Industrial organisations store operational knowledge across disconnected sources — equipment manuals, SOPs, maintenance records, inspection reports, incident reports, work orders, shift handover logs, safety procedures, quality records, and compliance checklists. This fragmentation causes excessive search time, incomplete maintenance decisions, repeated failures, unplanned downtime, compliance gaps, and loss of expert knowledge.

ForgeMind AI converted fragmented industrial documents into a unified, queryable, evidence-backed operations intelligence system.

### Original Solution Overview

1. **Document Intelligence** — upload, parse, classify, and index industrial documents
2. **Asset Intelligence** — 360-degree asset views with health, timeline, and relationships
3. **Retrieval-Augmented Generation** — grounded answers with source citations
4. **Root-Cause Analysis** — evidence-backed probable causes and recommended actions
5. **Compliance Intelligence** — deterministic rule-based compliance engine
6. **Lessons-Learned Intelligence** — similar incident detection across the corpus
7. **Knowledge Graph** — visualised relationships between assets, documents, and events
8. **Source Citations & Explainability** — every AI answer includes traceable evidence

### Original Core Features

- Command Center dashboard with operational metrics, asset health, and priority alerts
- Asset 360 with overview, timeline, documents, failure history, inspections, and relationship graph
- Document Intelligence with drag-and-drop upload, parsing, classification, entity extraction, chunking, and indexing
- AI Copilot with structured answers, citations, confidence levels, and recommended actions
- Maintenance Intelligence with RCA workspace, risk queue, and repeated failure patterns
- Compliance Intelligence with a deterministic rule engine
- Knowledge Graph with React Flow and an industrial ontology
- Alerts, Quality Management System, and Engineering Drawings (deterministic OCR tag extraction)
- Multi-agent orchestration concepts (Orchestrator, Knowledge, Maintenance, Compliance, Quality, Knowledge Graph, Vision)

### Original Industrial Ontology

Entities: Asset, Equipment, Component, Subsystem, MaintenanceActivity, Inspection, Incident, FailureMode, Symptom, CorrectiveAction, PreventiveAction, SafetyProcedure, OperatingProcedure, QualityRecord, Deviation, CAPA, NCR, Audit, Technician, Department, Location, Document, Procedure, ComplianceRequirement, Risk, Drawing.

Typed relationships: HAS_COMPONENT, LOCATED_IN, MENTIONED_IN, FAILED_AS, GENERATED_INCIDENT, INSPECTED_BY, HAS_SOP, REQUIRES_ACTION, RELATED_TO, SIMILAR_FAILURE, REFERENCES_DOCUMENT, HAS_QMS_RECORD, EVIDENCED_BY, ASSOCIATED_WITH, SIMILAR_TO, EXPERIENCED_FAILURE, INSPECTED_IN, GOVERNED_BY.

### Original Fallback Strategy

When Gemini was unavailable, the original prototype continued to provide lexical/metadata document search, deterministic compliance calculations, and clearly-labelled deterministic fallback answers grounded in seeded evidence.

---

## Relationship to the Current Product

The ForgeMind codebase contributed:

- The React + TypeScript + Vite + Tailwind frontend shell and shared UI components.
- The Supabase/PostgreSQL schema foundation (documents, chunks, entities, relationships, assets, QMS, drawings).
- The original `forge-ai` edge-function pattern and CORS/error-handling conventions.
- The knowledge-graph visualization and the concept of evidence-backed retrieval.

AgentOS Intelligence retains the working industrial demo data (assets, documents, QMS, drawings) as sample/demo material, but the product story is now centered on **hybrid organizational RAG, knowledge graphs, and shared organizational memory** rather than an industrial-only maintenance tool.

See `docs/RAG_ARCHITECTURE.md`, `docs/INGESTION_PIPELINE.md`, `docs/KNOWLEDGE_GRAPH.md`, `docs/MEMORY_ARCHITECTURE.md`, and `docs/DATABASE_SCHEMA.md` for the current architecture.
