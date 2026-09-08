// POST { transformation_id }
// Orchestrates the full generation workflow with real progress stages
// (written to transformations.stage, polled by the UI):
//   ANALYZING -> RETRIEVING -> GENERATING:<type> -> VERIFYING -> READY
import { createAuthenticatedClient } from "../_shared/client.ts";
import { preflight, json } from "../_shared/cors.ts";
import { generateStructured, GeminiError } from "../_shared/gemini.ts";
import {
  artifactGenerationPrompt,
  claimVerificationPrompt,
  sourceAnalysisPrompt,
  SYSTEM_INSTRUCTION,
  type ChunkRef,
  type TransformConfig,
} from "../_shared/prompts.ts";
import { retrieveRelevant } from "../_shared/retrieval.ts";

interface GeneratedClaim {
  text: string;
  chunk_ids?: string[];
}

interface GeneratedArtifact {
  title?: string;
  claims?: GeneratedClaim[];
  [key: string]: unknown;
}

Deno.serve(async (req) => {
  const pf = preflight(req);
  if (pf) return pf;

  // Read the id up front — the request body can't be consumed twice.
  const body = await req.json().catch(() => ({}) as Record<string, unknown>);
  const transformationId = (body as { transformation_id?: string }).transformation_id;

  try {
    const supabase = createAuthenticatedClient(req);
    const transformation_id = transformationId;
    if (!transformation_id) return json({ error: "transformation_id is required" }, 400);

    const { data: tf } = await supabase
      .from("transformations")
      .select("*, documents(filename, processing_status, analysis)")
      .eq("id", transformation_id)
      .single();
    if (!tf) return json({ error: "Transformation not found or not accessible" }, 404);

    if (tf.documents?.processing_status !== "READY") {
      return json({ error: "Source document is not processed yet." }, 409);
    }

    const cfg: TransformConfig = {
      target_audience: tf.target_audience,
      tone: tf.tone,
      language: tf.language,
      detail_level: tf.detail_level,
      communication_objective: tf.communication_objective,
      content_style: tf.content_style,
    };
    const outputTypes: string[] = tf.output_types ?? [];
    if (outputTypes.length === 0) return json({ error: "No output types selected." }, 400);

    await supabase
      .from("transformations")
      .update({ status: "GENERATING", stage: "Analyzing source...", error: null })
      .eq("id", transformation_id);

    const { data: chunksRaw } = await supabase
      .from("document_chunks")
      .select("id, chunk_index, page_number, section_title, content")
      .eq("document_id", tf.document_id)
      .order("chunk_index");
    const chunks = (chunksRaw ?? []) as ChunkRef[];
    if (chunks.length === 0) {
      await markFailed(supabase, transformation_id, "Source document has no chunks.");
      return json({ error: "Source document has no chunks." }, 409);
    }

    // ---- Analysis (reuse if already stored) ----
    let analysis = tf.documents?.analysis as Record<string, unknown> | null;
    if (!analysis) {
      analysis = await generateStructured(sourceAnalysisPrompt(chunks), SYSTEM_INSTRUCTION);
      await supabase.from("documents").update({ analysis }).eq("id", tf.document_id);
    }
    const analysisJson = JSON.stringify(analysis);
    const analysisQuery = [
      analysis.document_title, analysis.summary,
      ...(analysis.key_topics ?? []),
    ].filter(Boolean).join(" ");

    // ---- Generation per artifact type ----
    const artifactIds: string[] = [];
    for (const type of outputTypes) {
      await supabase
        .from("transformations")
        .update({ stage: `Generating ${type.replace(/_/g, " ").toLowerCase()}...` })
        .eq("id", transformation_id);

      const relevant = retrieveRelevant(chunks, `${analysisQuery} ${type}`, 12);
      const artifact = await generateStructured<GeneratedArtifact>(
        artifactGenerationPrompt(type, analysisJson, relevant, cfg),
        SYSTEM_INSTRUCTION,
      );

      const { data: artifactRow, error: aErr } = await supabase
        .from("artifacts")
        .insert({
          transformation_id,
          type,
          title: artifact.title ?? `${type.replace(/_/g, " ")}`,
          content: renderPlainText(type, artifact),
          structured_content: artifact,
          status: "GENERATED",
        })
        .select("id")
        .single();
      if (aErr || !artifactRow) {
        await markFailed(supabase, transformation_id, `Failed to store ${type}.`);
        return json({ error: `Failed to store ${type}.` }, 500);
      }
      artifactIds.push(artifactRow.id);

      await supabase.from("artifact_versions").insert({
        artifact_id: artifactRow.id,
        version_number: 1,
        content: renderPlainText(type, artifact),
        structured_content: artifact,
        created_by: tf.created_by,
        label: "AI Generated",
      });

      // Store claims + evidence links
      const claims = (artifact.claims ?? []).slice(0, 40);
      for (const claim of claims) {
        const { data: claimRow } = await supabase
          .from("claims")
          .insert({ artifact_id: artifactRow.id, claim_text: claim.text, claim_type: "FACTUAL" })
          .select("id")
          .single();
        if (!claimRow) continue;
        const ids = (claim.chunk_ids ?? []).filter((id) =>
          relevant.some((c) => c.id === id)
        );
        for (const chunkId of ids.slice(0, 5)) {
          await supabase.from("evidence").insert({
            claim_id: claimRow.id,
            document_chunk_id: chunkId,
            relevance_score: 1,
          });
        }
      }
    }

    // ---- Verification ----
    await supabase
      .from("transformations")
      .update({ status: "VERIFYING", stage: "Verifying claims against source..." })
      .eq("id", transformation_id);

    let verified = 0, partial = 0, unsupported = 0, total = 0;
    for (const artifactId of artifactIds) {
      const score = await verifyArtifact(supabase, artifactId, chunks);
      total += score.total; verified += score.verified;
      partial += score.partial; unsupported += score.unsupported;
    }

    await supabase
      .from("transformations")
      .update({
        status: "READY",
        stage: "Ready for review",
        completed_at: new Date().toISOString(),
      })
      .eq("id", transformation_id);

    return json({
      ok: true,
      artifacts: artifactIds.length,
      claims: { total, verified, partial, unsupported },
    });
  } catch (e) {
    if (e instanceof GeminiError) {
      try {
        const supabase = createAuthenticatedClient(req);
        if (transformationId) await markFailed(supabase, transformationId, e.message);
      } catch { /* ignore */ }
      return json({ error: e.message }, e.status);
    }
    console.error("generate-transformation failed:", e instanceof Error ? e.message : e);
    try {
      const supabase = createAuthenticatedClient(req);
      if (transformationId) await markFailed(supabase, transformationId, "Generation failed.");
    } catch { /* ignore */ }
    return json({ error: "Generation failed." }, 500);
  }
});

async function markFailed(supabase: ReturnType<typeof createAuthenticatedClient>, id: string, msg: string) {
  await supabase
    .from("transformations")
    .update({ status: "FAILED", stage: null, error: msg })
    .eq("id", id);
}

async function verifyArtifact(
  supabase: ReturnType<typeof createAuthenticatedClient>,
  artifactId: string,
  chunks: ChunkRef[],
): Promise<{ verified: number; partial: number; unsupported: number; total: number }> {
  const { data: claims } = await supabase
    .from("claims")
    .select("id, claim_text")
    .eq("artifact_id", artifactId);
  let verified = 0, partial = 0, unsupported = 0;
  const total = claims?.length ?? 0;

  if (total > 0) {
    try {
      const results = await generateStructured<{ results: { claim_id: string; status: string; confidence: number; explanation: string; supporting_chunk_ids?: string[] }[] }>(
        claimVerificationPrompt(claims!, chunks),
        SYSTEM_INSTRUCTION,
      );
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
          if (chunks.some((c) => c.id === cid)) {
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
    } catch (_e) {
      // Verification is best-effort; claims stay NEEDS_REVIEW.
    }
  }

  // ACT Quality Score — internal verification metric, not a probability.
  const denom = Math.max(1, total);
  const score = Math.round(100 * (verified + 0.5 * partial) / denom);
  await supabase
    .from("artifacts")
    .update({
      quality_score: total > 0 ? score : null,
      status: "NEEDS_REVIEW",
    })
    .eq("id", artifactId);
  return { verified, partial, unsupported, total };
}

/** Human-readable fallback rendering of structured content. */
function renderPlainText(type: string, a: GeneratedArtifact): string {
  const lines: string[] = [];
  if (a.title) lines.push(`# ${a.title}`, "");
  for (const [k, v] of Object.entries(a)) {
    if (k === "title" || k === "claims") continue;
    if (typeof v === "string" && v) {
      lines.push(`## ${k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}`, v, "");
    } else if (Array.isArray(v)) {
      const items = v.filter((i) => typeof i === "string") as string[];
      if (items.length) {
        lines.push(`## ${k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}`);
        items.forEach((i) => lines.push(`- ${i}`));
        lines.push("");
      } else if (v.length && typeof v[0] === "object") {
        lines.push(`## ${k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}`);
        for (const obj of v as Record<string, unknown>[]) {
          lines.push(
            ...Object.entries(obj)
              .filter(([, val]) => typeof val === "string" && val)
              .map(([ik, val]) => `- ${ik.replace(/_/g, " ")}: ${val}`),
            "",
          );
        }
      }
    }
  }
  return lines.join("\n");
}
