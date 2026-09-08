// POST { artifact_id }
// Re-runs claim verification and recomputes the ACT Quality Score
// for a single artifact (used after human edits).
import { createAuthenticatedClient } from "../_shared/client.ts";
import { preflight, json } from "../_shared/cors.ts";
import { generateStructured, GeminiError } from "../_shared/gemini.ts";
import { claimVerificationPrompt, SYSTEM_INSTRUCTION, type ChunkRef } from "../_shared/prompts.ts";

Deno.serve(async (req) => {
  const pf = preflight(req);
  if (pf) return pf;

  try {
    const supabase = createAuthenticatedClient(req);
    const { artifact_id } = await req.json();
    if (!artifact_id) return json({ error: "artifact_id is required" }, 400);

    const { data: artifact } = await supabase
      .from("artifacts")
      .select("id, transformation_id, transformations(document_id)")
      .eq("id", artifact_id)
      .single();
    if (!artifact) return json({ error: "Artifact not found or not accessible" }, 404);

    const { data: chunks } = await supabase
      .from("document_chunks")
      .select("id, chunk_index, page_number, section_title, content")
      .eq("document_id", artifact.transformations.document_id)
      .order("chunk_index");
    if (!chunks || chunks.length === 0) {
      return json({ error: "Source chunks are unavailable." }, 409);
    }

    const { data: claims } = await supabase
      .from("claims")
      .select("id, claim_text")
      .eq("artifact_id", artifact_id);
    if (!claims || claims.length === 0) {
      return json({ ok: true, message: "No claims to verify." });
    }

    const results = await generateStructured<{ results: { claim_id: string; status: string; confidence: number; explanation: string; supporting_chunk_ids?: string[] }[] }>(
      claimVerificationPrompt(claims, chunks as ChunkRef[]),
      SYSTEM_INSTRUCTION,
    );

    let verified = 0, partial = 0, unsupported = 0;
    const chunkIds = new Set((chunks as ChunkRef[]).map((c) => c.id));
    for (const r of results.results ?? []) {
      const status = ["VERIFIED", "PARTIALLY_SUPPORTED", "UNSUPPORTED", "NEEDS_REVIEW"].includes(r.status)
        ? r.status
        : "NEEDS_REVIEW";
      await supabase
        .from("claims")
        .update({
          verification_status: status,
          confidence_score: Math.max(0, Math.min(1, r.confidence ?? 0)),
          explanation: r.explanation,
        })
        .eq("id", r.claim_id);
      for (const cid of (r.supporting_chunk_ids ?? []).slice(0, 5)) {
        if (chunkIds.has(cid)) {
          await supabase.from("evidence").upsert({
            claim_id: r.claim_id,
            document_chunk_id: cid,
            relevance_score: r.confidence ?? 0.5,
            explanation: r.explanation,
          });
        }
      }
      if (status === "VERIFIED") verified++;
      else if (status === "PARTIALLY_SUPPORTED") partial++;
      else if (status === "UNSUPPORTED") unsupported++;
    }

    const score = Math.round(100 * (verified + 0.5 * partial) / Math.max(1, claims.length));
    await supabase
      .from("artifacts")
      .update({ quality_score: score })
      .eq("id", artifact_id);

    return json({ ok: true, quality_score: score, verified, partial, unsupported, total: claims.length });
  } catch (e) {
    if (e instanceof GeminiError) return json({ error: e.message }, e.status);
    console.error("verify-artifact failed:", e instanceof Error ? e.message : e);
    return json({ error: "Verification failed." }, 500);
  }
});
