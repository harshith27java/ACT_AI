import { useState } from "react";
import type { Claim } from "@/types";
import { ClaimBadge } from "@/components/StatusBadge";
import EvidenceDrawer from "@/components/EvidenceDrawer";

export default function ClaimList({ claims, artifactId }: { claims: Claim[]; artifactId: string }) {
  const [active, setActive] = useState<Claim | null>(null);

  if (claims.length === 0) {
    return <p className="text-sm text-gray-500">No claims were extracted from this artefact.</p>;
  }

  return (
    <>
      <ul className="divide-y divide-gray-100">
        {claims.map((claim, i) => (
          <li key={claim.id} className="flex items-start justify-between gap-4 py-3">
            <div className="min-w-0">
              <p className="text-sm text-gray-900">
                <span className="mr-1.5 text-xs font-semibold text-gray-400">#{i + 1}</span>
                {claim.claim_text}
              </p>
              <button
                onClick={() => setActive(claim)}
                className="mt-1 inline-flex items-center gap-1 rounded bg-blue-50 px-1.5 py-0.5 text-xs font-medium text-blue-700 hover:bg-blue-100"
              >
                Source: view evidence
              </button>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <ClaimBadge status={claim.verification_status} />
              {claim.confidence_score != null && (
                <span className="text-xs tabular-nums text-gray-400">
                  confidence {(claim.confidence_score * 100).toFixed(0)}%
                </span>
              )}
            </div>
          </li>
        ))}
      </ul>
      {active && (
        <EvidenceDrawer claim={active} artifactId={artifactId} onClose={() => setActive(null)} />
      )}
    </>
  );
}
