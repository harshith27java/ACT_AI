import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { FolderKanban, FileText, Layers, ClipboardCheck } from "lucide-react";
import {
  listProjects, listAllDocuments, listRecentTransformations,
  listArtifactsNeedingReview, listRecentApproved, countArtifacts,
} from "@/services/api";
import { Button, Card, EmptyState, ErrorState, Spinner } from "@/components/ui/primitives";
import { TransformationBadge } from "@/components/StatusBadge";
import { formatDate } from "@/lib/utils";

export default function DashboardPage() {
  const projects = useQuery({ queryKey: ["projects"], queryFn: listProjects });
  const documents = useQuery({ queryKey: ["documents-all"], queryFn: listAllDocuments });
  const transformations = useQuery({ queryKey: ["transformations-recent"], queryFn: () => listRecentTransformations(5) });
  const pending = useQuery({ queryKey: ["artifacts-review"], queryFn: listArtifactsNeedingReview });
  const approved = useQuery({ queryKey: ["artifacts-approved"], queryFn: () => listRecentApproved(5) });
  const artifactCount = useQuery({ queryKey: ["artifacts-count"], queryFn: countArtifacts });

  const isLoading = projects.isLoading || documents.isLoading;
  const error = projects.error ?? documents.error;
  if (isLoading) return <div className="flex justify-center py-16"><Spinner className="h-6 w-6" /></div>;
  if (error) return <ErrorState message={(error as Error).message} onRetry={() => { projects.refetch(); documents.refetch(); }} />;

  const pendingList = pending.data ?? [];
  const readyDocs = (documents.data ?? []).filter((d) => d.processing_status === "READY").length;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Dashboard</h1>
          <p className="mt-0.5 text-sm text-gray-500">What is happening with your content.</p>
        </div>
        <Link to="/projects"><Button>Create Project</Button></Link>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Metric icon={FolderKanban} label="Projects" value={projects.data?.length ?? 0} />
        <Metric icon={FileText} label="Sources" value={documents.data?.length ?? 0} sub={`${readyDocs} ready`} />
        <Metric icon={Layers} label="Artifacts" value={artifactCount.data ?? 0} />
        <Metric icon={ClipboardCheck} label="Pending Reviews" value={pendingList.length} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-gray-900">Recent transformations</h2>
          <div className="mt-3">
            {(transformations.data ?? []).length === 0 ? (
              <EmptyState title="No transformations yet." description="Generate your first communication artefact." />
            ) : (
              <ul className="divide-y divide-gray-100">
                {(transformations.data ?? []).map((t) => (
                  <li key={t.id} className="flex items-center justify-between py-2.5">
                    <Link to={`/transformations/${t.id}`} className="text-sm text-gray-900 hover:text-blue-700">
                      {t.target_audience} · {t.tone}
                    </Link>
                    <div className="flex items-center gap-2">
                      <TransformationBadge status={t.status} />
                      <span className="text-xs text-gray-400">{formatDate(t.created_at)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="text-sm font-semibold text-gray-900">Artifacts needing review</h2>
          <div className="mt-3">
            {pendingList.length === 0 ? (
              <EmptyState title="Nothing to review." description="Approved artefacts appear below once processed." />
            ) : (
              <ul className="divide-y divide-gray-100">
                {pendingList.slice(0, 5).map((a) => (
                  <li key={a.id} className="flex items-center justify-between py-2.5">
                    <Link to={`/artifacts/${a.id}`} className="text-sm text-gray-900 hover:text-blue-700">
                      {a.title}
                    </Link>
                    <span className="text-xs text-gray-400">
                      {a.quality_score != null ? `${a.quality_score}/100` : formatDate(a.updated_at)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      </div>

      <Card className="p-5">
        <h2 className="text-sm font-semibold text-gray-900">Recently approved artifacts</h2>
        <div className="mt-3">
          {(approved.data ?? []).length === 0 ? (
            <p className="text-sm text-gray-500">No approved artefacts yet.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {(approved.data ?? []).map((a) => (
                <li key={a.id} className="flex items-center justify-between py-2.5">
                  <Link to={`/artifacts/${a.id}`} className="text-sm text-gray-900 hover:text-blue-700">{a.title}</Link>
                  <span className="text-xs text-gray-400">{formatDate(a.updated_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>
    </div>
  );
}

function Metric({
  icon: Icon, label, value, sub,
}: { icon: typeof FolderKanban; label: string; value?: number; sub?: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-gray-400"><Icon size={14} aria-hidden /><span className="text-xs font-medium text-gray-500">{label}</span></div>
      <p className="mt-1.5 text-2xl font-bold text-gray-900 tabular-nums">{value ?? 0}</p>
      {sub && <p className="text-xs text-gray-400">{sub}</p>}
    </Card>
  );
}
