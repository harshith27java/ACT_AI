// POST { document_id }
// Builds the canonical structured source analysis with Gemini and
// stores it on documents.analysis. Analyzed once, reused by every
// artifact generation (token efficiency).
import { preflight, json } from "../_shared/cors.ts";
import { createAuthenticatedClient } from "../_shared/client.ts";
import { generateStructured, GeminiError } from "../_shared/gemini.ts";
import { sourceAnalysisPrompt, SYSTEM_INSTRUCTION, type ChunkRef } from "../_shared/prompts.ts";

Deno.serve(async (req) => {
  const pf = preflight(req);
  if (pf) return pf;

  try {
    const supabase = createAuthenticatedClient(req);
    const { document_id } = await req.json();
    if (!document_id) return json({ error: "document_id is required" }, 400);

    const { data: doc } = await supabase
      .from("documents")
      .select("id, filename, analysis")
      .eq("id", document_id)
      .single();
    if (!doc) return json({ error: "Document not found or not accessible" }, 404);

    // Reuse existing analysis — never re-analyze an unchanged document.
    if (doc.analysis) return json({ ok: true, analysis: doc.analysis, cached: true });

    const { data: chunks } = await supabase
      .from("document_chunks")
      .select("id, chunk_index, page_number, section_title, content")
      .eq("document_id", document_id)
      .order("chunk_index");
    if (!chunks || chunks.length === 0) {
      return json({ error: "Document has no processed chunks. Process it first." }, 409);
    }

    const analysis = await generateStructured(
      sourceAnalysisPrompt(chunks as ChunkRef[]),
      SYSTEM_INSTRUCTION,
    );

    const { error } = await supabase
      .from("documents")
      .update({ analysis })
      .eq("id", document_id);
    if (error) return json({ error: "Failed to store analysis." }, 500);

    return json({ ok: true, analysis, cached: false });
  } catch (e) {
    if (e instanceof GeminiError) return json({ error: e.message }, e.status);
    console.error("analyze-document failed:", e instanceof Error ? e.message : e);
    return json({ error: "Source analysis failed." }, 500);
  }
});
