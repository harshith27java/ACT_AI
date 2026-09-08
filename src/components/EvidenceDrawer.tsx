import { useQuery } from "@tanstack/react-query";
import { X, FileText } from "lucide-react";
import { listEvidenceForArtifact } from "@/services/api";
import type { Claim } from "@/types";
import { Spinner } from "@/components/ui/primitives";
import { useEffect } from "react";

/** Side drawer showing source evidence for one claim. */
export default function EvidenceDrawer({
  claim, artifactId, onClose,
}: { claim: Claim; artifactId: string; onClose: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ["evidence", artifactId],
    queryFn: () => listEvidenceForArtifact(artifactId),
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const items = (data ?? []).filter((ev) => ev.claim_id === claim.id);

  return (
    <div className="fixed inset-0 z-40 flex justify-end" role="dialog" aria-label="Evidence details">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />
      <div className="relative flex h-full w-full max-w-md flex-col overflow-y-auto bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <h2 className="text-sm font-semibold text-gray-900">Evidence</h2>
          <button onClick={onClose} aria-label="Close" className="rounded-md p-1 hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>
        <div className="space-y-4 px-5 py-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Claim</p>
            <p className="mt-1 text-sm text-gray-900">{claim.claim_text}</p>
            {claim.explanation && (
              <p className="mt-2 text-xs text-gray-600">{claim.explanation}</p>
            )}
          </div>
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-gray-500"><Spinner /> Loading evidence…</div>
          ) : items.length === 0 ? (
            <p className="text-sm text-gray-500">
              No linked source evidence for this claim. It may require manual review.
            </p>
          ) : (
            items.map((ev) => (
              <div key={ev.id} className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                <div className="flex items-center gap-2 text-xs font-medium text-gray-700">
                  <FileText size={14} aria-hidden />
                  Source document
                  {ev.document_chunks?.page_number != null && (
                    <span className="rounded bg-blue-50 px-1.5 py-0.5 text-blue-700">
                      Page {ev.document_chunks.page_number}
                    </span>
                  )}
                  {ev.document_chunks?.section_title && (
                    <span className="truncate text-gray-500">§ {ev.document_chunks.section_title}</span>
                  )}
                </div>
                <blockquote className="mt-2 border-l-2 border-blue-200 pl-3 text-sm italic text-gray-700">
                  “{ev.document_chunks?.content?.slice(0, 600)}
                  {(ev.document_chunks?.content?.length ?? 0) > 600 ? "…" : ""}”
                </blockquote>
                {ev.explanation && (
                  <p className="mt-2 text-xs text-gray-600"><span className="font-medium">Why this supports the claim:</span> {ev.explanation}</p>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
