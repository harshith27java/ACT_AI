# ACT — Automated Content Transformation

**Transform one source. Communicate it everywhere.**

ACT turns a single high-quality source document (PDF / DOCX / TXT) into multiple
audience-specific communication artefacts — executive summary, technical advisory,
social post, presentation, and video package — while keeping every factual claim
traceable to source evidence and subjecting output to AI verification and human review.

```
Source → Understanding → Transformation → Evidence → Verification → Human Review → Trusted Output
```

## Stack

- **Frontend:** React 18, TypeScript (strict), Vite, Tailwind CSS v4, React Router, TanStack Query
- **Backend:** Supabase (Auth, PostgreSQL + RLS, Storage, Edge Functions)
- **AI:** Gemini via server-side Edge Functions (`GEMINI_API_KEY` is a Supabase secret — never in the browser)

## Setup

### 1. Frontend

```bash
npm install
cp .env.example .env.local   # fill in your Supabase URL + anon key
npm run dev
```

### 2. Database

Run `supabase/schema.sql` in the Supabase SQL editor. It creates all tables
(profiles, projects, documents, document_chunks, transformations, artifacts,
claims, evidence, reviews, artifact_versions), enables Row Level Security on
everything, creates the private `source-documents` storage bucket, and adds a
trigger that creates a profile on signup (default role `OPERATOR`).

### 3. Edge Functions

```bash
supabase functions deploy process-document
supabase functions deploy analyze-document
supabase functions deploy generate-transformation
supabase functions deploy verify-artifact
supabase secrets set GEMINI_API_KEY=<your-key>
```

## Architecture notes

- **RAG pipeline:** files are extracted, cleaned, section/page-detected, and chunked
  (~500–1200 tokens, 15% overlap) with per-chunk provenance. Retrieval is lexical
  (deterministic, zero-cost); the chunk schema keeps an `embedding` column so
  pgvector can be layered in later without interface changes.
- **Analyze once, generate many:** a canonical structured analysis is stored on the
  document and reused by every artefact; each generation receives only the analysis
  plus the top relevant chunks (token efficiency).
- **Progressive progress:** generation stages are written to `transformations.stage`
  by the Edge Function and polled by the UI — no fake timers.
- **Verification:** claims cite chunk ids at generation time, then a second Gemini
  pass scores each claim (VERIFIED / PARTIALLY_SUPPORTED / UNSUPPORTED /
  NEEDS_REVIEW) and computes the **ACT Quality Score** (an internal metric,
  clearly labeled as such).
- **Human in the loop:** edits create new artifact versions (AI Generated →
  Human Edited → Approved); reviews are recorded with reviewer, status, comments.
- **Prompt-injection defense:** source content is wrapped in `<source>` tags and the
  system instruction declares it DATA, never instructions.
- **No fake functionality:** missing API key / failed extraction surface real errors.

## Extensibility (designed, not built)

New artefact types (newsletter, press release, policy brief…) are a new enum value +
prompt schema in `supabase/functions/_shared/prompts.ts` + a card in
`src/lib/constants.ts`. Additional AI providers slot in behind the same four Edge
Functions. Future input types (images/video) extend `process-document` only.
