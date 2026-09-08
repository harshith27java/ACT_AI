export type Role = "ADMIN" | "OPERATOR" | "REVIEWER";
export type ProcessingStatus = "UPLOADED" | "PROCESSING" | "READY" | "FAILED";
export type TransformationStatus =
  | "CONFIGURING"
  | "GENERATING"
  | "VERIFYING"
  | "READY"
  | "FAILED";
export type ArtifactType =
  | "EXECUTIVE_SUMMARY"
  | "TECHNICAL_ADVISORY"
  | "SOCIAL_POST"
  | "PRESENTATION"
  | "VIDEO_PACKAGE";
export type ArtifactStatus =
  | "DRAFT"
  | "GENERATED"
  | "NEEDS_REVIEW"
  | "APPROVED"
  | "REJECTED";
export type ClaimStatus =
  | "VERIFIED"
  | "PARTIALLY_SUPPORTED"
  | "UNSUPPORTED"
  | "NEEDS_REVIEW";
export type ReviewStatus = "PENDING" | "APPROVED" | "CHANGES_REQUESTED" | "REJECTED";

export interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
  role: Role;
  created_at: string;
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface SourceAnalysis {
  document_title?: string;
  summary?: string;
  key_topics?: string[];
  entities?: string[];
  events?: { description: string; date: string }[];
  important_numbers?: { value: string; context: string }[];
  risks?: string[];
  recommendations?: string[];
  technical_findings?: string[];
  key_claims?: { text: string; chunk_index: number }[];
  audience_relevant_points?: string[];
}

export interface DocumentRow {
  id: string;
  project_id: string;
  uploaded_by: string;
  filename: string;
  file_type: string;
  storage_path: string;
  file_size: number;
  processing_status: ProcessingStatus;
  processing_error: string | null;
  page_count: number | null;
  analysis: SourceAnalysis | null;
  created_at: string;
  updated_at: string;
}

export interface DocumentChunk {
  id: string;
  document_id: string;
  chunk_index: number;
  content: string;
  page_number: number | null;
  section_title: string | null;
  created_at: string;
}

export interface Transformation {
  id: string;
  project_id: string;
  document_id: string;
  created_by: string;
  target_audience: string;
  tone: string;
  language: string;
  detail_level: string;
  communication_objective: string;
  content_style: string;
  output_types: ArtifactType[];
  status: TransformationStatus;
  stage: string | null;
  error: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface GeneratedClaim {
  text: string;
  chunk_ids?: string[];
}

export interface PresentationSlide {
  slide_number: number;
  title: string;
  bullets: string[];
  speaker_notes: string;
  visual_recommendation: string;
  chunk_ids?: string[];
}

export interface VideoScene {
  number: number;
  duration: string;
  visual_description: string;
  on_screen_text: string;
  narration: string;
  transition: string;
  chunk_ids?: string[];
}

export interface StructuredContent {
  title?: string;
  claims?: GeneratedClaim[];
  slides?: PresentationSlide[];
  scenes?: VideoScene[];
  [key: string]: unknown;
}

export interface Artifact {
  id: string;
  transformation_id: string;
  type: ArtifactType;
  title: string;
  content: string | null;
  structured_content: StructuredContent | null;
  quality_score: number | null;
  version: number;
  status: ArtifactStatus;
  created_at: string;
  updated_at: string;
}

export interface Claim {
  id: string;
  artifact_id: string;
  claim_text: string;
  claim_type: string | null;
  verification_status: ClaimStatus;
  confidence_score: number | null;
  explanation: string | null;
  created_at: string;
}

export interface Evidence {
  id: string;
  claim_id: string;
  document_chunk_id: string | null;
  relevance_score: number | null;
  explanation: string | null;
  created_at: string;
}

export interface EvidenceWithChunk extends Evidence {
  document_chunks: Pick<DocumentChunk, "id" | "page_number" | "section_title" | "content" | "chunk_index"> | null;
}

export interface Review {
  id: string;
  artifact_id: string;
  reviewer_id: string;
  status: ReviewStatus;
  comments: string | null;
  reviewed_at: string | null;
}

export interface ArtifactVersion {
  id: string;
  artifact_id: string;
  version_number: number;
  content: string | null;
  structured_content: StructuredContent | null;
  created_by: string;
  label: string;
  created_at: string;
}
