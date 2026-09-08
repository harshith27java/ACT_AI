import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getArtifact, listClaims, listVersions, reviewArtifact, saveArtifactEdit } from "@/services/api";
import { ai } from "@/services/ai";
import {
  copyToClipboard, exportAsJson, exportAsMarkdown, exportAsText, exportPresentationAsPptx,
} from "@/services/export";
import StructuredArtifactView from "@/components/StructuredArtifactView";
import ClaimList from "@/components/ClaimList";
import QualityPanel from "@/components/QualityPanel";
import { ArtifactBadge } from "@/components/StatusBadge";
import { Button, Card, ErrorState, Spinner, Textarea } from "@/components/ui/primitives";
import { ARTIFACT_TYPES } from "@/lib/constants";
import { cn, formatDate } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import type { Artifact } from "@/types";

const TABS = ["Content", "Evidence", "Quality", "Versions"] as const;
type Tab = (typeof TABS)[number];

export default function ArtifactDetailPage() {
  const { artifactId } = useParams<{ artifactId: string }>();
  const [params] = useSearchParams();
  const [tab, setTab] = useState<Tab>(
    (params.get("tab") === "quality" ? "Quality" : "Content") as Tab,
  );
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [comments, setComments] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const { session } = useAuth();
  const queryClient = useQueryClient();

  const artifact = useQuery({ queryKey: ["artifact", artifactId], queryFn: () => getArtifact(artifactId!), enabled: !!artifactId });
  const claims = useQuery({ queryKey: ["claims", artifactId], queryFn: () => listClaims(artifactId!), enabled: !!artifactId });
  const versions = useQuery({ queryKey: ["versions", artifactId], queryFn: () => listVersions(artifactId!), enabled: !!artifactId });

  useEffect(() => {
    if (artifact.data) setDraft(artifact.data.content ?? "");
  }, [artifact.data?.id, artifact.data?.version]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["artifact", artifactId] });
    queryClient.invalidateQueries({ queryKey: ["claims", artifactId] });
    queryClient.invalidateQueries({ queryKey: ["versions", artifactId] });
  };

  const review = useMutation({
    mutationFn: (status: "APPROVED" | "CHANGES_REQUESTED" | "REJECTED") =>
      reviewArtifact(artifactId!, status, comments, session!.user.id),
    onSuccess: (_d, status) => {
      invalidate();
      setNotice(
        status === "APPROVED" ? "Artefact approved." :
        status === "REJECTED" ? "Artefact rejected." : "Changes requested.",
      );
      setComments("");
    },
  });

  const save = useMutation({
    mutationFn: () => saveArtifactEdit(artifactId!, draft, session!.user.id, (artifact.data?.version ?? 1) + 1),
    onSuccess: () => { invalidate(); setEditing(false); setNotice("Edit saved as a new version."); },
  });

  const reverify = useMutation({
    mutationFn: () => ai.verifyArtifact(artifactId!),
    onSuccess: () => { invalidate(); setNotice("Claims re-verified against the source."); },
  });

  if (artifact.isLoading) return <div className="flex justify-center py-16"><Spinner className="h-6 w-6" /></div>;
  if (artifact.error || !artifact.data) return <ErrorState message="Artefact not found or not accessible." />;

  const a = artifact.data;
  const meta = ARTIFACT_TYPES.find((t) => t.type === a.type);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400">{meta?.label ?? a.type}</p>
          <h1 className="mt-0.5 text-xl font-semibold text-gray-900">{a.title}</h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-gray-500">
            <ArtifactBadge status={a.status} />
            <span>v{a.version}</span>
            {a.quality_score != null && <span>Quality {a.quality_score}/100</span>}
            <span>{formatDate(a.updated_at)}</span>
            <Link to={`/transformations/${a.transformation_id}`} className="text-blue-700 hover:underline">
              View transformation
            </Link>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {editing ? (
            <>
              <Button onClick={() => save.mutate()} disabled={save.isPending}>
                {save.isPending ? "Saving…" : "Save new version"}
              </Button>
              <Button variant="secondary" onClick={() => { setEditing(false); setDraft(a.content ?? ""); }}>Cancel</Button>
            </>
          ) : (
            <>
              <Button variant="secondary" onClick={() => setEditing(true)}>Edit</Button>
              <ExportButtons artifact={a} />
            </>
          )}
        </div>
      </div>

      {notice && (
        <p role="status" className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
          {notice}
        </p>
      )}
      {(review.error || save.error || reverify.error) && (
        <ErrorState message={((review.error ?? save.error ?? reverify.error) as Error | null)?.message ?? "Operation failed."} />
      )}

      <div className="border-b border-gray-200" role="tablist" aria-label="Artefact sections">
        {TABS.map((t) => (
          <button
            key={t} role="tab" aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={cn(
              "-mb-px border-b-2 px-4 py-2 text-sm font-medium",
              tab === t ? "border-blue-600 text-blue-700" : "border-transparent text-gray-500 hover:text-gray-800",
            )}
          >
            {t}{t === "Evidence" && claims.data ? ` (${claims.data.length})` : ""}
          </button>
        ))}
      </div>

      {tab === "Content" && (
        <Card className="p-6">
          {editing ? (
            <>
              <p className="mb-2 text-xs text-gray-500">
                Editing the human-readable content. Saving creates a new version; the previous version is retained.
              </p>
              <Textarea rows={18} className="font-mono text-xs" value={draft} onChange={(e) => setDraft(e.target.value)} />
            </>
          ) : (
            <StructuredArtifactView artifact={a} />
          )}
        </Card>
      )}

      {tab === "Evidence" && (
        <Card className="p-6">
          <h2 className="text-sm font-semibold text-gray-900">Claims & Source Evidence</h2>
          <p className="mt-0.5 text-xs text-gray-500">
            Every factual claim is traceable to source chunks. Click a claim's evidence indicator.
          </p>
          <div className="mt-4">
            {claims.isLoading ? <Spinner /> : <ClaimList claims={claims.data ?? []} artifactId={a.id} />}
          </div>
        </Card>
      )}

      {tab === "Quality" && (
        <div className="space-y-4">
          <QualityPanel claims={claims.data ?? []} />
          <Button variant="secondary" onClick={() => reverify.mutate()} disabled={reverify.isPending}>
            {reverify.isPending ? "Re-verifying…" : "Re-run verification"}
          </Button>
        </div>
      )}

      {tab === "Versions" && (
        <Card className="p-6">
          <h2 className="text-sm font-semibold text-gray-900">Version History</h2>
          <ul className="mt-3 divide-y divide-gray-100">
            {(versions.data ?? []).map((v) => (
              <li key={v.id} className="flex items-center justify-between py-2.5 text-sm">
                <span className="text-gray-900">Version {v.version_number} — {v.label}</span>
                <span className="text-xs text-gray-400">{formatDate(v.created_at)}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card className="p-5">
        <h2 className="text-sm font-semibold text-gray-900">Review</h2>
        <Textarea
          rows={2} className="mt-3" placeholder="Review comments (optional)"
          value={comments} onChange={(e) => setComments(e.target.value)}
        />
        <div className="mt-3 flex gap-2">
          <Button onClick={() => review.mutate("APPROVED")} disabled={review.isPending}>Approve</Button>
          <Button variant="secondary" onClick={() => review.mutate("CHANGES_REQUESTED")} disabled={review.isPending}>
            Request Changes
          </Button>
          <Button variant="danger" onClick={() => review.mutate("REJECTED")} disabled={review.isPending}>
            Reject
          </Button>
        </div>
      </Card>
    </div>
  );
}

function ExportButtons({ artifact }: { artifact: Artifact }) {
  const [pptxError, setPptxError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function handlePptx() {
    setPptxError(null);
    try {
      await exportPresentationAsPptx(artifact);
    } catch (e) {
      setPptxError(e instanceof Error ? e.message : "PPTX export failed.");
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {artifact.type === "PRESENTATION" && (
        <Button variant="secondary" onClick={handlePptx}>Export PPTX</Button>
      )}
      {artifact.type === "SOCIAL_POST" ? (
        <Button variant="secondary" onClick={async () => {
          await copyToClipboard(artifact.content ?? "");
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}>
          {copied ? "Copied ✓" : "Copy text"}
        </Button>
      ) : (
        <Button variant="secondary" onClick={() => exportAsMarkdown(artifact)}>Export MD</Button>
      )}
      <Button variant="secondary" onClick={() => exportAsText(artifact)}>Export TXT</Button>
      <Button variant="secondary" onClick={() => exportAsJson(artifact)}>Export JSON</Button>
      {pptxError && <span role="alert" className="text-xs text-red-700">{pptxError}</span>}
    </div>
  );
}
