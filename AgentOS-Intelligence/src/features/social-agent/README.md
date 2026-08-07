# Social Media Agent

Implement this agent on top of the shared TaskContext and Knowledge Service.

Required first workflow:
1. Receive a campaign objective and platform.
2. Request grounded evidence from the RAG agent.
3. Extract approved product facts, audience, brand constraints, pricing, and dates.
4. Draft platform-specific content.
5. Send every factual claim to the verifier.
6. If unsupported, revise or trigger re-retrieval.
7. Return draft + citations + verification status.
8. Require human approval before any posting/scheduling action.
