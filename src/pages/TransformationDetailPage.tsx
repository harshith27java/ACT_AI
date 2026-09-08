import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getTransformation, listArtifactsForTransformation } from "@/services/api";
import ArtifactCard from "@/components/ArtifactCard";
import { TransformationBadge } from "@/components/StatusBadge";
import { Card, ErrorState, Spinner } from "@/components/ui/primitives";
import { formatDate } from "@/lib/utils";

export default function TransformationDetailPage() {
  const { transformationId } = useParams<{ transformationId: string }>();
  const tf = useQuery({
    queryKey: ["transformation", transformationId],
    queryFn: () => getTransformation(transformationId!),
    enabled: !!transformationId,
    refetchInterval: (q) =>
      q.state.data && (q.state.data.status === "GENERATING" || q.state.data.status === "VERIFYING") ? 2000 : false,
  });
  const artifacts = useQuery({
    queryKey: ["artifacts", transformationId],
    queryFn: () => listArtifactsForTransformation(transformationId!),
    enabled: !!transformationId,
  });

  if (tf.isLoading) return <div className="flex justify-center py-16"><Spinner className="h-6 w-6" /></div>;
  if (tf.error || !tf.data) return <ErrorState message="Transformation not found or not accessible." />;

  const t = tf.data;
  const list = artifacts.data ?? [];
  const verified = list.filter((a) => a.status === "APPROVED").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">
            {t.output_types.length} artefact{t.output_types.length === 1 ? "" : "s"} · {t.target_audience}
          </h1>
          <p className="mt-0.5 text-sm text-gray-500">
            {t.tone} · {t.detail_level} · {t.communication_objective} · created {formatDate(t.created_at)}
          </p>
        </div>
        <TransformationBadge status={t.status} />
      </div>

      {(t.status === "GENERATING" || t.status === "VERIFYING") && (
        <Card className="p-5" aria-live="polite">
          <p className="flex items-center gap-2 text-sm font-medium text-gray-900">
            <Spinner /> {t.stage ?? "Working…"}
          </p>
          <p className="mt-1 text-xs text-gray-500">This reflects the actual backend stage.</p>
        </Card>
      )}

      {t.status === "FAILED" && (
        <ErrorState message={t.error ?? "Generation failed."} />
      )}

      {t.status === "READY" && (
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-gray-900">Transformation Complete</h2>
          <p className="mt-1 text-sm text-gray-600">
            {list.length} artefact{list.length === 1 ? "" : "s"} generated · {verified} approved
          </p>
        </Card>
      )}

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {list.map((a) => <ArtifactCard key={a.id} artifact={a} />)}
      </div>
    </div>
  );
}
