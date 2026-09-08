import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Artifact } from "@/types";
import { Button, Card, Textarea } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

/** Renders the structured content of an artefact by type. */
export default function StructuredArtifactView({
  artifact, editable, onChange,
}: {
  artifact: Artifact;
  editable?: boolean;
  onChange?: (content: string) => void;
}) {
  const sc = artifact.structured_content;
  if (!sc) {
    return (
      <div>
        {editable ? (
          <Textarea rows={20} className="font-mono text-xs" value={artifact.content ?? ""}
            onChange={(e) => onChange?.(e.target.value)} />
        ) : (
          <pre className="whitespace-pre-wrap text-sm text-gray-800">{artifact.content}</pre>
        )}
      </div>
    );
  }
  if (artifact.type === "PRESENTATION" && sc.slides) {
    return <PresentationView artifact={artifact} />;
  }
  if (artifact.type === "VIDEO_PACKAGE" && sc.scenes) {
    return <VideoView artifact={artifact} />;
  }
  return <SectionView sc={sc} />;
}

function SectionView({ sc }: { sc: Record<string, unknown> }) {
  return (
    <div className="space-y-5">
      {Object.entries(sc)
        .filter(([k, v]) => k !== "claims" && v != null && v !== "")
        .map(([key, value]) => (
          <section key={key}>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              {key.replace(/_/g, " ")}
            </h3>
            {typeof value === "string" ? (
              <p className="mt-1 whitespace-pre-wrap text-sm text-gray-800">{value}</p>
            ) : Array.isArray(value) ? (
              typeof value[0] === "string" || value.length === 0 ? (
                <ul className="mt-1 list-disc space-y-1 pl-4 text-sm text-gray-800">
                  {(value as string[]).map((item, i) => <li key={i}>{item}</li>)}
                </ul>
              ) : (
                <div className="mt-1 space-y-2">
                  {(value as Record<string, unknown>[]).map((obj, i) => (
                    <div key={i} className="rounded-md border border-gray-100 bg-gray-50 p-3 text-sm">
                      {Object.entries(obj)
                        .filter(([, v]) => typeof v === "string" && v)
                        .map(([k, v]) => (
                          <p key={k} className="text-gray-800">
                            <span className="font-medium text-gray-600">{k.replace(/_/g, " ")}:</span> {String(v)}
                          </p>
                        ))}
                    </div>
                  ))}
                </div>
              )
            ) : null}
          </section>
        ))}
    </div>
  );
}

function PresentationView({ artifact }: { artifact: Artifact }) {
  const slides = artifact.structured_content?.slides ?? [];
  const [index, setIndex] = useState(0);
  if (slides.length === 0) return <p className="text-sm text-gray-500">No slides.</p>;
  const slide = slides[Math.min(index, slides.length - 1)];

  return (
    <div className="space-y-4">
      <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Slides">
        {slides.map((s, i) => (
          <button
            key={i} role="tab" aria-selected={i === index}
            onClick={() => setIndex(i)}
            className={cn(
              "w-28 shrink-0 rounded-md border p-2 text-left text-[11px] leading-tight",
              i === index ? "border-blue-400 bg-blue-50" : "border-gray-200 hover:border-gray-300",
            )}
          >
            <span className="block font-semibold text-gray-500">Slide {s.slide_number}</span>
            <span className="line-clamp-2 text-gray-800">{s.title}</span>
          </button>
        ))}
      </div>

      <Card className="aspect-video p-8">
        <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Slide {slide.slide_number}</p>
        <h3 className="mt-1 text-2xl font-bold text-gray-900">{slide.title}</h3>
        <ul className="mt-5 space-y-2.5">
          {(slide.bullets ?? []).map((b, i) => (
            <li key={i} className="flex gap-2 text-sm text-gray-700">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />{b}
            </li>
          ))}
        </ul>
      </Card>

      <div className="flex items-center justify-between">
        <Button variant="secondary" onClick={() => setIndex((i) => Math.max(0, i - 1))} disabled={index === 0}>
          <ChevronLeft size={14} /> Previous
        </Button>
        <span className="text-xs text-gray-500">{index + 1} / {slides.length}</span>
        <Button variant="secondary" onClick={() => setIndex((i) => Math.min(slides.length - 1, i + 1))} disabled={index === slides.length - 1}>
          Next <ChevronRight size={14} />
        </Button>
      </div>

      <Card className="p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Speaker notes</p>
        <p className="mt-1 text-sm text-gray-700">{slide.speaker_notes || "—"}</p>
        {slide.visual_recommendation && (
          <>
            <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Visual recommendation</p>
            <p className="mt-1 text-sm text-gray-700">{slide.visual_recommendation}</p>
          </>
        )}
      </Card>
    </div>
  );
}

function VideoView({ artifact }: { artifact: Artifact }) {
  const sc = artifact.structured_content!;
  return (
    <div className="space-y-4">
      <Card className="p-4">
        <dl className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
          <div><dt className="text-xs text-gray-500">Objective</dt><dd className="mt-0.5">{String(sc.objective ?? "—")}</dd></div>
          <div><dt className="text-xs text-gray-500">Audience</dt><dd className="mt-0.5">{String(sc.target_audience ?? "—")}</dd></div>
          <div><dt className="text-xs text-gray-500">Duration</dt><dd className="mt-0.5">{String(sc.estimated_duration ?? "—")}</dd></div>
          <div><dt className="text-xs text-gray-500">Scenes</dt><dd className="mt-0.5">{sc.scenes?.length ?? 0}</dd></div>
        </dl>
      </Card>
      {(sc.scenes ?? []).map((scene) => (
        <Card key={scene.number} className="p-4">
          <p className="text-xs font-semibold text-gray-500">Scene {scene.number} · {scene.duration || "—"}</p>
          <div className="mt-2 grid gap-3 md:grid-cols-2">
            <Field label="Visual" value={scene.visual_description} />
            <Field label="On-screen text" value={scene.on_screen_text} />
            <Field label="Narration" value={scene.narration} />
            <Field label="Transition" value={scene.transition} />
          </div>
        </Card>
      ))}
      {typeof sc.ending_cta === "string" && sc.ending_cta && (
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Ending / CTA</p>
          <p className="mt-1 text-sm text-gray-700">{sc.ending_cta}</p>
        </Card>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className="mt-0.5 text-sm text-gray-800">{value || "—"}</p>
    </div>
  );
}
