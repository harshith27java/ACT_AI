import type { Claim } from "@/types";
import { Card } from "@/components/ui/primitives";

/** Transparent, clearly-labeled internal verification metric. */
export default function QualityPanel({ claims }: { claims: Claim[] }) {
  const total = claims.length;
  const verified = claims.filter((c) => c.verification_status === "VERIFIED").length;
  const partial = claims.filter((c) => c.verification_status === "PARTIALLY_SUPPORTED").length;
  const unsupported = claims.filter((c) => c.verification_status === "UNSUPPORTED").length;
  const review = claims.filter((c) => c.verification_status === "NEEDS_REVIEW").length;
  const score = total > 0 ? Math.round((100 * (verified + 0.5 * partial)) / total) : null;
  const pct = (n: number) => (total > 0 ? Math.round((100 * n) / total) : 0);

  return (
    <Card className="p-5">
      <h3 className="text-sm font-semibold text-gray-900">ACT Quality Check</h3>
      <p className="mt-0.5 text-xs text-gray-500">
        An internal verification metric — not a scientifically validated probability.
      </p>
      {score === null ? (
        <p className="mt-4 text-sm text-gray-500">No claims were extracted for this artefact.</p>
      ) : (
        <>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-gray-900">{score}</span>
            <span className="text-sm text-gray-500">/ 100 overall score</span>
          </div>
          <div className="mt-4 space-y-2.5">
            <ScoreBar label="Claims verified" value={pct(verified)} detail={`${verified} of ${total}`} />
            <ScoreBar label="Partially supported" value={pct(partial)} detail={`${partial}`} tone="warning" />
            <ScoreBar label="Unsupported" value={pct(unsupported)} detail={`${unsupported}`} tone="error" />
            <ScoreBar label="Needs review" value={pct(review)} detail={`${review}`} tone="neutral" />
          </div>
        </>
      )}
    </Card>
  );
}

function ScoreBar({
  label, value, detail, tone = "success",
}: { label: string; value: number; detail: string; tone?: "success" | "warning" | "error" | "neutral" }) {
  const colors = {
    success: "bg-green-500", warning: "bg-amber-500", error: "bg-red-500", neutral: "bg-gray-400",
  };
  return (
    <div>
      <div className="flex justify-between text-xs text-gray-600">
        <span>{label}</span>
        <span className="tabular-nums text-gray-500">{detail} · {value}%</span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-gray-100" role="presentation">
        <div className={`h-full rounded-full ${colors[tone]}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}
