import { FormEvent, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Circle, CheckCircle2 } from "lucide-react";
import { getDocument, listDocuments, listTransformationsForProject, createTransformation } from "@/services/api";
import { ai } from "@/services/ai";
import {
  ARTIFACT_TYPES, AUDIENCES, CONTENT_STYLES, DETAIL_LEVELS,
  LANGUAGES, OBJECTIVES, TONES,
} from "@/lib/constants";
import type { ArtifactType } from "@/types";
import { ProcessingBadge } from "@/components/StatusBadge";
import { Button, Card, ErrorState, Label, Select, Spinner, Input } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

const STAGES = [
  "Analyzing source...",
  "Retrieving relevant evidence...",
  "Generating",
  "Verifying claims against source...",
  "Preparing review...",
];

export default function TransformPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const projectId = params.get("projectId") ?? "";

  const documents = useQuery({
    queryKey: ["documents", projectId],
    queryFn: () => listDocuments(projectId),
    enabled: !!projectId,
  });

  const readyDocs = useMemo(
    () => (documents.data ?? []).filter((d) => d.processing_status === "READY"),
    [documents.data],
  );
  const [documentId, setDocumentId] = useState(params.get("documentId") ?? "");
  const effectiveDocId = documentId || readyDocs[0]?.id || "";

  const selectedDoc = useQuery({
    queryKey: ["document", effectiveDocId],
    queryFn: () => getDocument(effectiveDocId),
    enabled: !!effectiveDocId,
  });

  const [audience, setAudience] = useState("Executive Leadership");
  const [customAudience, setCustomAudience] = useState("");
  const [tone, setTone] = useState("Professional");
  const [language, setLanguage] = useState("English");
  const [detail, setDetail] = useState("Detailed");
  const [objective, setObjective] = useState("Recommend Action");
  const [style, setStyle] = useState("Technical");
  const [outputs, setOutputs] = useState<ArtifactType[]>(["EXECUTIVE_SUMMARY", "TECHNICAL_ADVISORY"]);
  const [error, setError] = useState<string | null>(null);

  const generate = useMutation({
    mutationFn: async () => {
      const tf = await createTransformation({
        project_id: projectId,
        document_id: effectiveDocId,
        target_audience: audience === "Custom" ? customAudience || "Custom audience" : audience,
        tone, language, detail_level: detail,
        communication_objective: objective, content_style: style,
        output_types: outputs,
      });
      await ai.generateTransformation(tf.id);
      return tf;
    },
    onSuccess: (tf) => {
      queryClient.invalidateQueries({ queryKey: ["transformations", projectId] });
      navigate(`/transformations/${tf.id}`);
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Generation failed."),
  });

  function toggleOutput(type: ArtifactType) {
    setOutputs((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type],
    );
  }

  if (!projectId) return <ErrorState message="Missing project. Open a project first." />;
  if (documents.isLoading) return <div className="flex justify-center py-16"><Spinner className="h-6 w-6" /></div>;
  if (readyDocs.length === 0) {
    return <ErrorState message="No processed documents in this project. Upload and process a source first." />;
  }

  const busy = generate.isPending;

  return (
    <form
      onSubmit={(e: FormEvent) => { e.preventDefault(); if (outputs.length > 0) generate.mutate(); }}
      className="mx-auto max-w-3xl space-y-6"
    >
      <h1 className="text-xl font-semibold text-gray-900">Transformation</h1>

      <Card className="p-5">
        <h2 className="text-sm font-semibold text-gray-900">Source</h2>
        <div className="mt-3">
          <Label htmlFor="document">Source document</Label>
          <Select id="document" value={effectiveDocId} onChange={(e) => setDocumentId(e.target.value)} disabled={busy}>
            {readyDocs.map((d) => <option key={d.id} value={d.id}>{d.filename}</option>)}
          </Select>
        </div>
        {selectedDoc.data && (
          <div className="mt-3 flex items-center gap-3 rounded-md bg-gray-50 px-3 py-2">
            <span className="text-sm text-gray-900">{selectedDoc.data.filename}</span>
            <ProcessingBadge status={selectedDoc.data.processing_status} />
            {selectedDoc.data.analysis && (
              <span className="text-xs text-gray-500">analyzed ✓</span>
            )}
          </div>
        )}
      </Card>

      <Card className="p-5">
        <h2 className="text-sm font-semibold text-gray-900">Transformation Settings</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="audience">Target audience</Label>
            <Select id="audience" value={audience} onChange={(e) => setAudience(e.target.value)} disabled={busy}>
              {AUDIENCES.map((a) => <option key={a}>{a}</option>)}
            </Select>
            {audience === "Custom" && (
              <Input className="mt-2" placeholder="Describe your audience" value={customAudience}
                onChange={(e) => setCustomAudience(e.target.value)} disabled={busy} />
            )}
          </div>
          <div>
            <Label htmlFor="tone">Tone</Label>
            <Select id="tone" value={tone} onChange={(e) => setTone(e.target.value)} disabled={busy}>
              {TONES.map((t) => <option key={t}>{t}</option>)}
            </Select>
          </div>
          <div>
            <Label htmlFor="language">Language</Label>
            <Select id="language" value={language} onChange={(e) => setLanguage(e.target.value)} disabled={busy}>
              {LANGUAGES.map((l) => <option key={l}>{l}</option>)}
            </Select>
          </div>
          <div>
            <Label htmlFor="detail">Level of detail</Label>
            <Select id="detail" value={detail} onChange={(e) => setDetail(e.target.value)} disabled={busy}>
              {DETAIL_LEVELS.map((d) => <option key={d}>{d}</option>)}
            </Select>
          </div>
          <div>
            <Label htmlFor="objective">Communication objective</Label>
            <Select id="objective" value={objective} onChange={(e) => setObjective(e.target.value)} disabled={busy}>
              {OBJECTIVES.map((o) => <option key={o}>{o}</option>)}
            </Select>
          </div>
          <div>
            <Label htmlFor="style">Content style</Label>
            <Select id="style" value={style} onChange={(e) => setStyle(e.target.value)} disabled={busy}>
              {CONTENT_STYLES.map((s) => <option key={s}>{s}</option>)}
            </Select>
          </div>
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="text-sm font-semibold text-gray-900">Outputs</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {ARTIFACT_TYPES.map(({ type, label, description }) => {
            const checked = outputs.includes(type);
            return (
              <label
                key={type}
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-lg border p-3.5 transition-colors",
                  checked ? "border-blue-300 bg-blue-50/50" : "border-gray-200 hover:border-gray-300",
                )}
              >
                <input
                  type="checkbox" className="mt-0.5 h-4 w-4 accent-blue-600"
                  checked={checked} onChange={() => toggleOutput(type)} disabled={busy}
                />
                <span>
                  <span className="block text-sm font-medium text-gray-900">{label}</span>
                  <span className="mt-0.5 block text-xs text-gray-500">{description}</span>
                </span>
              </label>
            );
          })}
        </div>
      </Card>

      {error && <ErrorState message={error} onRetry={() => generate.mutate()} />}

      {busy && (
        <Card className="p-5" aria-live="polite">
          <ProgressIndicator />
        </Card>
      )}

      <div className="flex justify-end">
        <Button type="submit" disabled={busy || outputs.length === 0} className="px-6">
          {busy ? "Generating…" : "Generate"}
        </Button>
      </div>
    </form>
  );
}

// Progress reflects the transformation row's live stage (polled below).
function ProgressIndicator() {
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get("projectId") ?? "";
  const { data: transformations } = useQuery({
    queryKey: ["transformations", projectId],
    queryFn: () => listTransformationsForProject(projectId),
    enabled: !!projectId,
    refetchInterval: 2000,
  });
  const active = (transformations ?? []).find((t) => t.status === "GENERATING" || t.status === "VERIFYING");
  const stage = active?.stage ?? "Preparing…";
  const stageIdx = STAGES.findIndex((s) => stage.startsWith(s));
  const currentIdx = stageIdx >= 0 ? stageIdx : 2;

  return (
    <div>
      <p className="flex items-center gap-2 text-sm font-medium text-gray-900">
        <Spinner /> {stage}
      </p>
      <ul className="mt-3 space-y-1.5">
        {STAGES.map((s, i) => (
          <li key={s} className={cn("flex items-center gap-2 text-sm", i <= currentIdx ? "text-gray-900" : "text-gray-400")}>
            {i < currentIdx ? <CheckCircle2 size={15} className="text-green-600" aria-hidden />
              : i === currentIdx ? <Circle size={15} className="animate-pulse text-blue-600" aria-hidden />
              : <Circle size={15} className="text-gray-300" aria-hidden />}
            {s === "Generating" ? "Generating artifacts" : s.replace("...", "")}
          </li>
        ))}
      </ul>
    </div>
  );
}
