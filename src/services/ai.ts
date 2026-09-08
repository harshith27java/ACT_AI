// AI service abstraction. The frontend never talks to Gemini directly —
// all calls go through Supabase Edge Functions where GEMINI_API_KEY
// lives as a server-side secret. A second provider can be added behind
// these functions without touching the UI.
import { supabase, isConfigured } from "@/lib/supabase";
import { FunctionsHttpError } from "@supabase/supabase-js";

export class AIConfigurationError extends Error {
  constructor() {
    super(
      "ACT cannot reach the AI service. Check that the Edge Functions are deployed and GEMINI_API_KEY is set as a Supabase secret.",
    );
  }
}

async function invoke<T>(name: string, body: Record<string, unknown>): Promise<T> {
  if (!isConfigured) throw new AIConfigurationError();
  const { data, error } = await supabase.functions.invoke<T>(name, { body });
  if (error) {
    // Non-2xx responses arrive as FunctionsHttpError; the function's JSON
    // body carries the human-readable reason — surface it.
    if (error instanceof FunctionsHttpError) {
      const detail = await error.context.json().catch(() => null);
      const message = (detail as { error?: string } | null)?.error;
      throw new Error(message ?? `The AI service returned an error (HTTP ${error.context.status}).`);
    }
    const detail = (data as { error?: string } | null)?.error;
    throw new Error(detail ?? error.message);
  }
  if (!data || (data as { error?: string }).error) {
    throw new Error((data as { error?: string })?.error ?? "The AI service returned no data.");
  }
  return data;
}

export const ai = {
  processDocument: (documentId: string) =>
    invoke<{ ok: boolean; chunks: number; page_count: number | null }>("process-document", { document_id: documentId }),

  analyzeDocument: (documentId: string) =>
    invoke<{ ok: boolean; cached: boolean }>("analyze-document", { document_id: documentId }),

  generateTransformation: (transformationId: string) =>
    invoke<{ ok: boolean; artifacts: number; claims: { total: number; verified: number; partial: number; unsupported: number } }>(
      "generate-transformation", { transformation_id: transformationId },
    ),

  verifyArtifact: (artifactId: string) =>
    invoke<{ ok: boolean; quality_score: number }>("verify-artifact", { artifact_id: artifactId }),
};
