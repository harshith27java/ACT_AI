import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { listArtifactsNeedingReview, listRecentApproved } from "@/services/api";
import { ArtifactBadge } from "@/components/StatusBadge";
import { Button, Card, EmptyState, ErrorState, Spinner } from "@/components/ui/primitives";
import { ARTIFACT_TYPES } from "@/lib/constants";
import { formatDate } from "@/lib/utils";
import type { Artifact } from "@/types";

export default function ReviewQueuePage() {
  const pending = useQuery({ queryKey: ["artifacts-review"], queryFn: listArtifactsNeedingReview, refetchInterval: 10000 });
  const approved = useQuery({ queryKey: ["artifacts-approved"], queryFn: () => listRecentApproved(10) });

  if (pending.isLoading) return <div className="flex justify-center py-16"><Spinner className="h-6 w-6" /></div>;
  if (pending.error) return <ErrorState message={(pending.error as Error).message} onRetry={() => pending.refetch()} />;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Review Queue</h1>
        <p className="mt-0.5 text-sm text-gray-500">
          Generated output requires human approval before it is considered final.
        </p>
      </div>

      <section aria-label="Needs review">
        <h2 className="mb-3 text-sm font-semibold text-gray-900">Needs Review</h2>
        {(pending.data ?? []).length === 0 ? (
          <EmptyState title="Nothing to review." description="All generated artefacts have been reviewed." />
        ) : (
          <div className="overflow-hidden rounded-lg border border-gray-200">
            <table className="w-full bg-white text-sm">
              <thead className="border-b border-gray-200 bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Artefact</th>
                  <th className="px-4 py-2.5 font-medium">Type</th>
                  <th className="px-4 py-2.5 font-medium">Quality</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium">Created</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(pending.data ?? []).map((a) => (
                  <Row key={a.id} artifact={a} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-label="Approved">
        <h2 className="mb-3 text-sm font-semibold text-gray-900">Approved</h2>
        {(approved.data ?? []).length === 0 ? (
          <p className="text-sm text-gray-500">No approved artefacts yet.</p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-gray-200">
            <table className="w-full bg-white text-sm">
              <tbody className="divide-y divide-gray-100">
                {(approved.data ?? []).map((a) => <Row key={a.id} artifact={a} />)}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Row({ artifact }: { artifact: Artifact & { transformations?: { transformations?: { name: string }[] } } }) {
  const meta = ARTIFACT_TYPES.find((t) => t.type === artifact.type);
  const projectName = artifact.transformations?.transformations?.[0]?.name;
  return (
    <tr className="hover:bg-gray-50">
      <td className="px-4 py-2.5">
        <Link to={`/artifacts/${artifact.id}`} className="font-medium text-gray-900 hover:text-blue-700">
          {artifact.title}
        </Link>
        {projectName && <p className="text-xs text-gray-400">{projectName}</p>}
      </td>
      <td className="px-4 py-2.5 text-gray-600">{meta?.label ?? artifact.type}</td>
      <td className="px-4 py-2.5 tabular-nums text-gray-600">
        {artifact.quality_score != null ? `${artifact.quality_score}/100` : "—"}
      </td>
      <td className="px-4 py-2.5"><ArtifactBadge status={artifact.status} /></td>
      <td className="px-4 py-2.5 text-xs text-gray-400">{formatDate(artifact.updated_at)}</td>
      <td className="px-4 py-2.5 text-right">
        <Link to={`/artifacts/${artifact.id}`}>
          <Button variant="secondary" className="px-2.5 py-1.5 text-xs">Review</Button>
        </Link>
      </td>
    </tr>
  );
}
