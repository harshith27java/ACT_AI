import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getDocument, listChunks } from "@/services/api";
import { ProcessingBadge } from "@/components/StatusBadge";
import { Button, Card, ErrorState, Spinner } from "@/components/ui/primitives";
import { formatBytes } from "@/lib/constants";
import { formatDate } from "@/lib/utils";

export default function DocumentDetailPage() {
  const { documentId } = useParams<{ documentId: string }>();
  const doc = useQuery({ queryKey: ["document", documentId], queryFn: () => getDocument(documentId!), enabled: !!documentId });
  const chunks = useQuery({
    queryKey: ["chunks", documentId],
    queryFn: () => listChunks(documentId!),
    enabled: !!documentId && doc.data?.processing_status === "READY",
  });

  if (doc.isLoading) return <div className="flex justify-center py-16"><Spinner className="h-6 w-6" /></div>;
  if (doc.error || !doc.data) return <ErrorState message="Document not found or not accessible." />;

  const d = doc.data;
  const analysis = d.analysis;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold text-gray-900">{d.filename}</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            {d.file_type.toUpperCase()} · {formatBytes(d.file_size)} · uploaded {formatDate(d.created_at)}
          </p>
        </div>
        <ProcessingBadge status={d.processing_status} />
      </div>

      <Card className="p-5">
        <h2 className="text-sm font-semibold text-gray-900">Details</h2>
        <dl className="mt-3 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
          <div><dt className="text-xs text-gray-500">Pages</dt><dd className="mt-0.5">{d.page_count ?? "—"}</dd></div>
          <div><dt className="text-xs text-gray-500">Chunks</dt><dd className="mt-0.5">{chunks.data?.length ?? "—"}</dd></div>
          <div><dt className="text-xs text-gray-500">Status</dt><dd className="mt-0.5">{d.processing_status}</dd></div>
          <div><dt className="text-xs text-gray-500">Updated</dt><dd className="mt-0.5">{formatDate(d.updated_at)}</dd></div>
        </dl>
        {d.processing_error && <p className="mt-3 text-sm text-red-700">{d.processing_error}</p>}
      </Card>

      {analysis && (
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-gray-900">Source Analysis</h2>
          {analysis.document_title && <p className="mt-2 text-sm font-medium text-gray-900">{analysis.document_title}</p>}
          {analysis.summary && <p className="mt-1 text-sm text-gray-600">{analysis.summary}</p>}
          {analysis.key_topics && analysis.key_topics.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {analysis.key_topics.map((t) => (
                <span key={t} className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700">{t}</span>
              ))}
            </div>
          )}
          {analysis.recommendations && analysis.recommendations.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Recommendations</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-4 text-sm text-gray-700">
                {analysis.recommendations.slice(0, 8).map((r) => <li key={r}>{r}</li>)}
              </ul>
            </div>
          )}
        </Card>
      )}

      {chunks.data && chunks.data.length > 0 && (
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-gray-900">Extracted Text</h2>
          <div className="mt-3 max-h-96 space-y-2 overflow-y-auto">
            {chunks.data.map((c) => (
              <div key={c.id} className="rounded-md border border-gray-100 bg-gray-50 p-3">
                <p className="text-xs text-gray-400">
                  Chunk {c.chunk_index}
                  {c.page_number != null && ` · Page ${c.page_number}`}
                  {c.section_title && ` · § ${c.section_title}`}
                </p>
                <p className="mt-1 line-clamp-3 text-sm text-gray-700">{c.content}</p>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
