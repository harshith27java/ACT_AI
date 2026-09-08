// Centralized data access. All queries run under the caller's session so
// Row Level Security is the enforcing boundary.
import { supabase } from "@/lib/supabase";
import type {
  Artifact, ArtifactVersion, Claim, DocumentChunk, DocumentRow,
  EvidenceWithChunk, Project, Review, Transformation,
} from "@/types";
import type { ArtifactType } from "@/types";

// ---------- Projects ----------
export async function listProjects() {
  const { data, error } = await supabase
    .from("projects")
    .select("*, documents(count), transformations(count)")
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as (Project & {
    documents: { count: number }[];
    transformations: { count: number }[];
  })[];
}

export async function getProject(id: string) {
  const { data, error } = await supabase.from("projects").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function createProject(name: string, description: string) {
  const { data, error } = await supabase
    .from("projects").insert({ name, description }).select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function renameProject(id: string, name: string, description?: string) {
  const { error } = await supabase
    .from("projects").update({ name, ...(description !== undefined ? { description } : {}) }).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteProject(id: string) {
  // Remove stored files first (cascade removes rows).
  const { data: docs } = await supabase.from("documents").select("storage_path").eq("project_id", id);
  if (docs && docs.length > 0) {
    await supabase.storage.from("source-documents").remove(docs.map((d) => d.storage_path));
  }
  const { error } = await supabase.from("projects").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ---------- Documents ----------
export async function listDocuments(projectId: string) {
  const { data, error } = await supabase
    .from("documents").select("*").eq("project_id", projectId).order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as DocumentRow[];
}

export async function listAllDocuments() {
  const { data, error } = await supabase
    .from("documents").select("*").order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as DocumentRow[];
}

export async function getDocument(id: string) {
  const { data, error } = await supabase.from("documents").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data as DocumentRow | null;
}

export async function uploadDocument(
  projectId: string,
  file: File,
  onProgress?: (pct: number) => void,
): Promise<DocumentRow> {
  const id = crypto.randomUUID();
  const storagePath = `${projectId}/${id}/${file.name}`;
  onProgress?.(10);
  const { error: upErr } = await supabase.storage
    .from("source-documents").upload(storagePath, file);
  if (upErr) throw new Error(`Upload failed: ${upErr.message}`);
  onProgress?.(70);
  const { data, error } = await supabase
    .from("documents")
    .insert({
      id, project_id: projectId, filename: file.name,
      file_type: file.type || file.name.split(".").pop() || "",
      storage_path: storagePath, file_size: file.size,
    })
    .select().single();
  if (error) throw new Error(error.message);
  onProgress?.(100);
  return data;
}

export async function listChunks(documentId: string) {
  const { data, error } = await supabase
    .from("document_chunks").select("*").eq("document_id", documentId).order("chunk_index");
  if (error) throw new Error(error.message);
  return (data ?? []) as DocumentChunk[];
}

// ---------- Transformations ----------
export async function createTransformation(input: {
  project_id: string;
  document_id: string;
  target_audience: string;
  tone: string;
  language: string;
  detail_level: string;
  communication_objective: string;
  content_style: string;
  output_types: ArtifactType[];
}): Promise<Transformation> {
  const { data, error } = await supabase
    .from("transformations").insert(input).select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function getTransformation(id: string) {
  const { data, error } = await supabase.from("transformations").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data as Transformation | null;
}

export async function listTransformationsForProject(projectId: string) {
  const { data, error } = await supabase
    .from("transformations").select("*").eq("project_id", projectId).order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Transformation[];
}

export async function listRecentTransformations(limit = 5) {
  const { data, error } = await supabase
    .from("transformations").select("*").order("created_at", { ascending: false }).limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as Transformation[];
}

// ---------- Artifacts ----------
export async function listArtifactsForTransformation(transformationId: string) {
  const { data, error } = await supabase
    .from("artifacts").select("*").eq("transformation_id", transformationId);
  if (error) throw new Error(error.message);
  return (data ?? []) as Artifact[];
}

export async function getArtifact(id: string) {
  const { data, error } = await supabase
    .from("artifacts")
    .select("*, transformations(project_id, document_id, target_audience, tone, language, detail_level, communication_objective, content_style)")
    .eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data as (Artifact & {
    transformations: { project_id: string; document_id: string };
  }) | null;
}

export async function listArtifactsNeedingReview() {
  const { data, error } = await supabase
    .from("artifacts")
    .select("*, transformations(project_id, transformations:projects(name))")
    .in("status", ["NEEDS_REVIEW", "GENERATED"])
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as (Artifact & {
    transformations: { project_id: string; transformations: { name: string }[] };
  })[];
}

export async function listRecentApproved(limit = 5) {
  const { data, error } = await supabase
    .from("artifacts").select("*").eq("status", "APPROVED")
    .order("updated_at", { ascending: false }).limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as Artifact[];
}

export async function countArtifacts() {
  const { count, error } = await supabase.from("artifacts").select("*", { count: "exact", head: true });
  if (error) throw new Error(error.message);
  return count ?? 0;
}

// ---------- Claims & evidence ----------
export async function listClaims(artifactId: string) {
  const { data, error } = await supabase
    .from("claims").select("*").eq("artifact_id", artifactId).order("created_at");
  if (error) throw new Error(error.message);
  return (data ?? []) as Claim[];
}

export async function listEvidenceForArtifact(artifactId: string) {
  const { data, error } = await supabase
    .from("evidence")
    .select("*, claims!inner(artifact_id), document_chunks(id, page_number, section_title, content, chunk_index)")
    .eq("claims.artifact_id", artifactId);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as EvidenceWithChunk[];
}

// ---------- Review workflow ----------
export async function reviewArtifact(
  artifactId: string,
  status: "APPROVED" | "CHANGES_REQUESTED" | "REJECTED",
  comments: string,
  reviewerId: string,
) {
  const artifactStatus =
    status === "APPROVED" ? "APPROVED" : status === "REJECTED" ? "REJECTED" : "NEEDS_REVIEW";
  const { error: rErr } = await supabase.from("reviews").insert({
    artifact_id: artifactId, reviewer_id: reviewerId, status, comments,
    reviewed_at: new Date().toISOString(),
  });
  if (rErr) throw new Error(rErr.message);
  const { error } = await supabase
    .from("artifacts").update({ status: artifactStatus }).eq("id", artifactId);
  if (error) throw new Error(error.message);
}

export async function saveArtifactEdit(
  artifactId: string,
  content: string,
  userId: string,
  nextVersion: number,
) {
  const { error: vErr } = await supabase.from("artifact_versions").insert({
    artifact_id: artifactId, version_number: nextVersion, content,
    created_by: userId, label: "Human Edited",
  });
  if (vErr) throw new Error(vErr.message);
  const { error } = await supabase
    .from("artifacts").update({ content, version: nextVersion, status: "NEEDS_REVIEW" })
    .eq("id", artifactId);
  if (error) throw new Error(error.message);
}

export async function listVersions(artifactId: string) {
  const { data, error } = await supabase
    .from("artifact_versions").select("*").eq("artifact_id", artifactId)
    .order("version_number", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as ArtifactVersion[];
}
