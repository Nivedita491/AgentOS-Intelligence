# Target Architecture

```text
User / Organization
        |
        v
Command Center
        |
        v
Orchestrator / Planner
        |
        +--------------------+
        |                    |
        v                    v
     RAG Agent          Research Agent
        |                    |
        +---------+----------+
                  |
                  v
          Shared Task Context
                  |
                  v
          Social Media Agent
                  |
                  v
             Verifier
             /      \
      unsupported   supported
          |             |
      re-retrieve       v
          +--------> Verified Output
                          |
                     Human Approval
                          |
                    External Action
                          |
                    Verified Memory
```

## Knowledge layer
Documents -> parsing -> structure-aware chunking -> embeddings -> pgvector + metadata -> knowledge graph -> hybrid retrieval.

## Permanent-memory rule
Generated agent output becomes a knowledge candidate, not permanent truth. Promote it only after source-backed verification (and optionally human approval for high-impact facts).
