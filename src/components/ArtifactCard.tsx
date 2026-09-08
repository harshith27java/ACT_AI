import { Link } from "react-router-dom";
import { FileText } from "lucide-react";
import type { Artifact } from "@/types";
import { ARTIFACT_TYPES } from "@/lib/constants";
import { ArtifactBadge } from "@/components/StatusBadge";
import { Button, Card } from "@/components/ui/primitives";
import { formatDate } from "@/lib/utils";

export default function ArtifactCard({ artifact }: { artifact: Artifact }) {
  const meta = ARTIFACT_TYPES.find((t) => t.type === artifact.type);
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 rounded-md bg-gray-100 p-2 text-gray-500"><FileText size={16} aria-hidden /></span>
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
              {meta?.label ?? artifact.type}
            </p>
            <Link to={`/artifacts/${artifact.id}`} className="mt-0.5 block truncate text-sm font-semibold text-gray-900 hover:text-blue-700">
              {artifact.title}
            </Link>
          </div>
        </div>
        <ArtifactBadge status={artifact.status} />
      </div>
      <div className="mt-3 flex items-center gap-4 text-xs text-gray-500">
        {artifact.quality_score != null && (
          <span>Quality <span className="font-semibold text-gray-700">{artifact.quality_score}/100</span></span>
        )}
        <span>v{artifact.version}</span>
        <span>{formatDate(artifact.updated_at)}</span>
      </div>
      <div className="mt-3 flex gap-2">
        <Link to={`/artifacts/${artifact.id}`}>
          <Button variant="secondary" className="px-2.5 py-1.5 text-xs">Open</Button>
        </Link>
        <Link to={`/artifacts/${artifact.id}?tab=quality`}>
          <Button variant="ghost" className="px-2.5 py-1.5 text-xs">Review</Button>
        </Link>
      </div>
    </Card>
  );
}
