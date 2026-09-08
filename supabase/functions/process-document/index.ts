// POST { document_id }
// Downloads the uploaded file, extracts text, chunks it with source
// location metadata, and stores document_chunks. Runs under the
// caller's JWT so RLS enforces ownership.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { preflight, json } from "../_shared/cors.ts";
import { chunkSections, type RawSection } from "../_shared/retrieval.ts";

const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25 MB

async function extractTxt(bytes: Uint8Array): Promise<string> {
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
}

async function extractDocx(bytes: Uint8Array): Promise<string> {
  const mammoth = await import("https://esm.sh/mammoth@1.8.0");
  const buffer = bytes.slice().buffer;
  const result = await mammoth.extractRawText({ arrayBuffer: buffer });
  return result.value;
}

async function extractPdf(bytes: Uint8Array): Promise<RawSections> {
  const pdfjs = await import(
    "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.7.76/legacy/build/pdf.mjs"
  );
  pdfjs.GlobalWorkerOptions.workerSrc =
    "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.7.76/legacy/build/pdf.worker.mjs";
  const buffer = bytes.slice().buffer as ArrayBuffer;
  const doc = await pdfjs.getDocument({ data: buffer }).promise;
  const sections: RawSection[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const text = content.items
      .map((i: { str?: string }) => i.str ?? "")
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    if (text) sections.push({ page_number: p, section_title: null, text });
  }
  return { sections, pageCount: doc.numPages };
}

type RawSections = { sections: RawSection[]; pageCount: number };

// Heading heuristic for non-paginated formats: ALL-CAPS or numbered lines.
function splitByHeadings(text: string): RawSection[] {
  const lines = text.split(/\r?\n/);
  const sections: RawSection[] = [];
  let current: RawSection = { page_number: null, section_title: "Introduction", text: "" };
  for (const line of lines) {
    const trimmed = line.trim();
    const isHeading =
      trimmed.length > 3 &&
      trimmed.length < 80 &&
      (/^[0-9]+(\.[0-9]+)*\s+\S/.test(trimmed) ||
        (trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed)));
    if (isHeading) {
      if (current.text.trim()) sections.push(current);
      current = { page_number: null, section_title: trimmed, text: "" };
    } else {
      current.text += line + "\n";
    }
  }
  if (current.text.trim()) sections.push(current);
  return sections;
}

Deno.serve(async (req) => {
  const pf = preflight(req);
  if (pf) return pf;

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );

    const { document_id } = await req.json();
    if (!document_id) return json({ error: "document_id is required" }, 400);

    const { data: doc, error: docErr } = await supabase
      .from("documents")
      .select("id, filename, file_type, storage_path, file_size")
      .eq("id", document_id)
      .single();
    if (docErr || !doc) return json({ error: "Document not found or not accessible" }, 404);

    await supabase
      .from("documents")
      .update({ processing_status: "PROCESSING", processing_error: null })
      .eq("id", document_id);

    if (doc.file_size > MAX_FILE_BYTES) {
      await fail(supabase, document_id, "File exceeds the 25 MB limit.");
      return json({ error: "File exceeds the 25 MB limit." }, 413);
    }

    const { data: fileData, error: dlErr } = await supabase.storage
      .from("source-documents")
      .download(doc.storage_path);
    if (dlErr || !fileData) {
      await fail(supabase, document_id, "Could not download the stored file.");
      return json({ error: "Could not download the stored file." }, 500);
    }
    const bytes = new Uint8Array(await fileData.arrayBuffer());

    let sections: RawSection[] = [];
    let pageCount: number | null = null;
    try {
      if (doc.file_type === "pdf" || doc.filename.toLowerCase().endsWith(".pdf")) {
        const result = await extractPdf(bytes);
        sections = result.sections;
        pageCount = result.pageCount;
      } else if (doc.filename.toLowerCase().endsWith(".docx")) {
        const text = await extractDocx(bytes);
        sections = splitByHeadings(text);
      } else {
        const text = await extractTxt(bytes);
        sections = splitByHeadings(text);
      }
    } catch (e) {
      await fail(supabase, document_id, "Text extraction failed for this file.");
      return json({ error: "Text extraction failed for this file." }, 422);
    }

    const totalText = sections.map((s) => s.text).join(" ").trim();
    if (totalText.length < 40) {
      await fail(supabase, document_id, "No readable text found in the document.");
      return json({ error: "No readable text found in the document." }, 422);
    }

    // Replace any previous chunks (retry-safe)
    await supabase.from("document_chunks").delete().eq("document_id", document_id);
    const chunks = chunkSections(sections);
    const { error: insertErr } = await supabase
      .from("document_chunks")
      .insert(
        chunks.map((c) => ({
          document_id,
          chunk_index: c.chunk_index,
          content: c.content,
          page_number: c.page_number,
          section_title: c.section_title,
          metadata: { word_count: c.content.split(/\s+/).length },
        })),
      );
    if (insertErr) {
      await fail(supabase, document_id, "Failed to store document chunks.");
      return json({ error: "Failed to store document chunks." }, 500);
    }

    await supabase
      .from("documents")
      .update({ processing_status: "READY", page_count: pageCount, processing_error: null })
      .eq("id", document_id);

    return json({ ok: true, chunks: chunks.length, page_count: pageCount });
  } catch (e) {
    console.error("process-document failed:", e instanceof Error ? e.message : e);
    return json({ error: "Document processing failed." }, 500);
  }
});

async function fail(supabase: ReturnType<typeof createClient>, id: string, msg: string) {
  await supabase
    .from("documents")
    .update({ processing_status: "FAILED", processing_error: msg })
    .eq("id", id);
}
