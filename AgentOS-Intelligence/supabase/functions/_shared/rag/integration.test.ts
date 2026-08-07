// These tests are deliberately opt-in: they exercise a real Supabase project and
// Gemini provider, never mocked vectors or simulated retrieval.
const enabled = Deno.env.get("RUN_RAG_INTEGRATION") === "true";

Deno.test({ name: "integration: upload → extract → chunk → embed → retrieve", ignore: !enabled, async fn() {
  const endpoint = Deno.env.get("RAG_INTEGRATION_ENDPOINT");
  if (!endpoint) throw new Error("Set RAG_INTEGRATION_ENDPOINT when RUN_RAG_INTEGRATION=true.");
  // The deploy-specific test harness supplies a pre-uploaded fixture and verifies
  // the returned chunk, vector, citation, and working/episodic memory records.
  const response = await fetch(endpoint);
  if (!response.ok) throw new Error(`Integration harness failed (${response.status}).`);
} });

Deno.test({ name: "integration: graph-assisted retrieval returns evidence-backed chunks", ignore: !enabled, async fn() {
  const endpoint = Deno.env.get("RAG_GRAPH_INTEGRATION_ENDPOINT");
  if (!endpoint) throw new Error("Set RAG_GRAPH_INTEGRATION_ENDPOINT when RUN_RAG_INTEGRATION=true.");
  const response = await fetch(endpoint);
  if (!response.ok) throw new Error(`Graph integration harness failed (${response.status}).`);
} });
