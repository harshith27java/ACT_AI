import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getProject, listDocuments, listTransformationsForProject, listArtifactsForTransformation, uploadDocument } from "@/services/api";
import { ai } from "@/services/ai";
import UploadZone from "@/components/UploadZone";
import ArtifactCard from "@/components/ArtifactCard";
import { ArtifactBadge, ProcessingBadge, TransformationBadge } from "@/components/StatusBadge";
import { Button, Card, EmptyState, ErrorState, Spinner } from "@/components/ui/primitives";
import { formatBytes } from "@/lib/constants";
import { formatDate } from "@/lib/utils";
import type { Artifact } from "@/types";

export default function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);

  const project = useQuery({ queryKey: ["project", projectId], queryFn: () => getProject(projectId!), enabled: !!projectId });
  const documents = useQuery({ queryKey: ["documents", projectId], queryFn: () => listDocuments(projectId!), enabled: !!projectId, refetchInterval: (q) =>
    (q.state.data ?? []).some((d) => d.processing_status === "PROCESSING") ? 2000 : false });
  const transformations = useQuery({ queryKey: ["transformations", projectId], queryFn: () => listTransformationsForProject(projectId!), enabled: !!projectId });

  const upload = useMutation({
    mutationFn: async (file: File) => {
      setUploadError(null);
      const doc = await uploadDocument(projectId!, file);
      // Trigger processing immediately; status updates via polling.
      try {
        await ai.processDocument(doc.id);
      } catch (e) {
        setUploadError(e instanceof Error ? e.message : "Document processing failed.");
      }
      return doc;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["documents", projectId] }),
    onError: (e) => setUploadError(e instanceof Error ? e.message : "Upload failed."),
  });

  if (project.isLoading) return <div className="flex justify-center py-16"><Spinner className="h-6 w-6" /></div>;
  if (project.error || !project.data) {
    return <ErrorState message="Project not found or not accessible." />;
  }

  const docs = documents.data ?? [];
  const readyDoc = docs.find((d) => d.processing_status === "READY");
  const busyUploading = upload.isPending || docs.some((d) => d.processing_status === "PROCESSING");

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">{project.data.name}</h1>
          <p className="mt-0.5 text-sm text-gray-500">{project.data.description || "No description"}</p>
        </div>
        <Button onClick={() => navigate(`/transform?projectId=${projectId}&documentId=${readyDoc?.id ?? ""}`)}
          disabled={!readyDoc}>
          Create Transformation
        </Button>
      </div>

      <section aria-label="Source documents">
        <h2 className="mb-3 text-sm font-semibold text-gray-900">Source Documents</h2>
        <UploadZone onFile={(f) => upload.mutate(f)} disabled={busyUploading} />
        {upload.isPending && (
          <p className="mt-2 flex items-center gap-2 text-sm text-gray-500"><Spinner /> Uploading and processing…</p>
        )}
        {uploadError && (
          <div className="mt-2">
            <ErrorState message={uploadError} onRetry={() => {
              const last = upload.variables;
              if (last instanceof File) upload.mutate(last);
            }} />
          </div>
        )}
        <div className="mt-4 space-y-2">
          {docs.length === 0 && !upload.isPending ? (
            <EmptyState title="No documents." description="Upload a source document to begin." />
          ) : (
            docs.map((d) => (
              <Card key={d.id} className="flex items-center justify-between gap-4 p-4">
                <div className="min-w-0">
                  <Link to={`/documents/${d.id}`} className="truncate text-sm font-medium text-gray-900 hover:text-blue-700">
                    {d.filename}
                  </Link>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {formatBytes(d.file_size)} · {d.page_count ? `${d.page_count} pages · ` : ""}{formatDate(d.created_at)}
                  </p>
                  {d.processing_status === "FAILED" && d.processing_error && (
                    <p className="mt-1 text-xs text-red-700">{d.processing_error}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <ProcessingBadge status={d.processing_status} />
                  {d.processing_status === "FAILED" && (
                    <Button variant="secondary" className="px-2.5 py-1.5 text-xs"
                      onClick={async () => {
                        setProcessing(d.id);
                        try { await ai.processDocument(d.id); } catch { /* polling shows failure */ }
                        finally { setProcessing(null); queryClient.invalidateQueries({ queryKey: ["documents", projectId] }); }
                      }} disabled={processing === d.id}>
                      {processing === d.id ? "Retrying…" : "Retry processing"}
                    </Button>
                  )}
                </div>
              </Card>
            ))
          )}
        </div>
      </section>

      <section aria-label="Recent outputs">
        <h2 className="mb-3 text-sm font-semibold text-gray-900">Recent Outputs</h2>
        {(transformations.data ?? []).length === 0 ? (
          <EmptyState title="No transformations yet." description="Generate your first communication artefact." />
        ) : (
          <TransformationOutputs transformationIds={(transformations.data ?? []).map((t) => t.id)} />
        )}
      </section>
    </div>
  );
}

function TransformationOutputs({ transformationIds }: { transformationIds: string[] }) {
  const latest = transformationIds.slice(0, 2);
  return (
    <div className="space-y-4">
      {latest.map((id) => <OutputRow key={id} transformationId={id} />)}
    </div>
  );
}

function OutputRow({ transformationId }: { transformationId: string }) {
  const navigate = useNavigate();
  const { data } = useQuery({
    queryKey: ["artifacts", transformationId],
    queryFn: () => listArtifactsForTransformation(transformationId),
  });
  if (!data) return null;
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <button onClick={() => navigate(`/transformations/${transformationId}`)}
          className="text-xs font-medium text-blue-700 hover:underline">
          View transformation →
        </button>
      </div>
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {data.map((a: Artifact) => <ArtifactCard key={a.id} artifact={a} />)}
      </div>
    </div>
  );
}
