import { Badge } from "@/components/ui/primitives";
import type { ArtifactStatus, ClaimStatus, ProcessingStatus, TransformationStatus } from "@/types";

export function ProcessingBadge({ status }: { status: ProcessingStatus }) {
  const map: Record<ProcessingStatus, { tone: "success" | "info" | "warning" | "error"; label: string }> = {
    READY: { tone: "success", label: "Ready" },
    PROCESSING: { tone: "info", label: "Processing" },
    UPLOADED: { tone: "warning", label: "Uploaded" },
    FAILED: { tone: "error", label: "Failed" },
  };
  const v = map[status];
  return <Badge tone={v.tone}>{v.label}</Badge>;
}

export function TransformationBadge({ status }: { status: TransformationStatus }) {
  const map: Record<TransformationStatus, { tone: "success" | "info" | "warning" | "error" | "neutral"; label: string }> = {
    READY: { tone: "success", label: "Ready" },
    GENERATING: { tone: "info", label: "Generating" },
    VERIFYING: { tone: "info", label: "Verifying" },
    CONFIGURING: { tone: "neutral", label: "Configuring" },
    FAILED: { tone: "error", label: "Failed" },
  };
  const v = map[status];
  return <Badge tone={v.tone}>{v.label}</Badge>;
}

export function ArtifactBadge({ status }: { status: ArtifactStatus }) {
  const map: Record<ArtifactStatus, { tone: "success" | "info" | "warning" | "error" | "neutral"; label: string }> = {
    APPROVED: { tone: "success", label: "Approved" },
    NEEDS_REVIEW: { tone: "warning", label: "Needs review" },
    GENERATED: { tone: "info", label: "Generated" },
    DRAFT: { tone: "neutral", label: "Draft" },
    REJECTED: { tone: "error", label: "Rejected" },
  };
  const v = map[status];
  return <Badge tone={v.tone}>{v.label}</Badge>;
}

export function ClaimBadge({ status }: { status: ClaimStatus }) {
  const map: Record<ClaimStatus, { tone: "success" | "warning" | "error" | "neutral"; label: string }> = {
    VERIFIED: { tone: "success", label: "Verified" },
    PARTIALLY_SUPPORTED: { tone: "warning", label: "Partially supported" },
    UNSUPPORTED: { tone: "error", label: "Unsupported" },
    NEEDS_REVIEW: { tone: "neutral", label: "Needs review" },
  };
  const v = map[status];
  return <Badge tone={v.tone}>{v.label}</Badge>;
}
