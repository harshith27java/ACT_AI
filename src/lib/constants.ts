import type { ArtifactType } from "@/types";

export const AUDIENCES = [
  "General Public", "Technical Team", "Security Team", "Executive Leadership",
  "Management", "Developers", "Policy Makers", "Students", "Custom",
] as const;

export const TONES = [
  "Professional", "Technical", "Formal", "Concise", "Persuasive",
  "Educational", "Neutral", "Urgent",
] as const;

export const LANGUAGES = ["English"] as const;

export const DETAIL_LEVELS = ["Brief", "Moderate", "Detailed", "Highly Detailed"] as const;

export const OBJECTIVES = [
  "Inform", "Educate", "Warn", "Recommend Action", "Persuade",
  "Summarize", "Brief Leadership",
] as const;

export const CONTENT_STYLES = [
  "Technical", "Executive", "Educational", "Journalistic",
  "Social Media", "Advisory", "Presentation",
] as const;

export const ARTIFACT_TYPES: { type: ArtifactType; label: string; description: string }[] = [
  {
    type: "EXECUTIVE_SUMMARY",
    label: "Executive Summary",
    description: "Condense the source into a concise decision-oriented briefing.",
  },
  {
    type: "TECHNICAL_ADVISORY",
    label: "Technical Advisory",
    description: "A formal advisory with affected systems, indicators, and mitigations.",
  },
  {
    type: "SOCIAL_POST",
    label: "LinkedIn / X Post",
    description: "Platform-aware social content grounded in the source.",
  },
  {
    type: "PRESENTATION",
    label: "Presentation",
    description: "A structured slide deck with speaker notes and evidence.",
  },
  {
    type: "VIDEO_PACKAGE",
    label: "Video Package",
    description: "Scene-by-scene storyboard, narration script, and subtitles.",
  },
];

export const ACCEPTED_EXTENSIONS = [".pdf", ".docx", ".txt"];
export const MAX_FILE_SIZE = 25 * 1024 * 1024; // must match the edge function

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
