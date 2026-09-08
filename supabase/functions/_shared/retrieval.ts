// Lightweight lexical retrieval over document chunks. This avoids a hard
// pgvector dependency while remaining deterministic and cheap; embeddings
// can be layered in later without changing the interface.
import type { ChunkRef } from "./prompts.ts";

const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "of", "to", "in", "on", "for", "with",
  "is", "are", "was", "were", "be", "been", "that", "this", "it", "as",
  "at", "by", "from", "has", "have", "had", "not", "but", "were", "will",
  "their", "they", "which", "who", "what", "when", "where", "how", "than",
]);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOPWORDS.has(t));
}

/** Rank chunks by lexical overlap with the query; return top-k. */
export function retrieveRelevant(
  chunks: ChunkRef[],
  query: string,
  topK = 12,
): ChunkRef[] {
  const qTokens = new Set(tokenize(query));
  if (qTokens.size === 0) return chunks.slice(0, topK);
  const scored = chunks.map((c) => {
    const tokens = tokenize(c.content);
    const hits = tokens.filter((t) => qTokens.has(t)).length;
    return { chunk: c, score: hits / Math.sqrt(tokens.length || 1) };
  });
  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, topK).filter((s) => s.score > 0);
  return top.length > 0 ? top.map((s) => s.chunk) : chunks.slice(0, topK);
}

// ---------------------------------------------------------------
// Chunking: ~500-1200 tokens (approximated by words), 15% overlap.
// ---------------------------------------------------------------
export interface RawSection {
  page_number: number | null;
  section_title: string | null;
  text: string;
}

export function chunkSections(
  sections: RawSection[],
  targetWords = 260,
  overlapWords = 40,
): { chunk_index: number; page_number: number | null; section_title: string | null; content: string }[] {
  const chunks: { chunk_index: number; page_number: number | null; section_title: string | null; content: string }[] = [];
  let index = 0;
  for (const sec of sections) {
    const words = sec.text.split(/\s+/).filter(Boolean);
    if (words.length === 0) continue;
    if (words.length <= targetWords) {
      chunks.push({
        chunk_index: index++,
        page_number: sec.page_number,
        section_title: sec.section_title,
        content: sec.text.trim(),
      });
      continue;
    }
    for (let start = 0; start < words.length; start += targetWords - overlapWords) {
      const slice = words.slice(start, start + targetWords).join(" ");
      if (slice.trim().length === 0) break;
      chunks.push({
        chunk_index: index++,
        page_number: sec.page_number,
        section_title: sec.section_title,
        content: slice,
      });
      if (start + targetWords >= words.length) break;
    }
  }
  return chunks;
}
