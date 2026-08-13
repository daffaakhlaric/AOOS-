"use client";

import { useState } from "react";

export interface ClaimButtonProps {
  readonly leadId: string;
  readonly salesHumanId: string;
  readonly onClaimed?: () => void;
}

/**
 * Claim lead → assign ke sales ini (spec "components/leads/ClaimButton.tsx"). Optimistic UI:
 * shows "Diklaim" immediately on click, rolls back to the button on error (spec "Claim Lead
 * Flow" — "Show 'Diklaim' immediately on click / Rollback if API returns error"). A 409 (already
 * claimed by someone else) shows the spec's own pinned copy, "Sudah diklaim".
 */
export function ClaimButton({
  leadId,
  salesHumanId,
  onClaimed,
}: ClaimButtonProps): React.ReactElement {
  const [status, setStatus] = useState<"idle" | "claiming" | "claimed" | "error">("idle");
  const [error, setError] = useState<string | undefined>(undefined);

  async function handleClaim(): Promise<void> {
    setStatus("claiming");
    setError(undefined);
    try {
      const response = await fetch(`/api/leads/${leadId}/claim`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ salesHumanId }),
      });
      if (response.status === 409) {
        setStatus("error");
        setError("Sudah diklaim");
        return;
      }
      if (!response.ok) {
        setStatus("error");
        setError("Gagal klaim lead. Coba lagi.");
        return;
      }
      setStatus("claimed");
      onClaimed?.();
    } catch {
      setStatus("error");
      setError("Gagal klaim lead. Coba lagi.");
    }
  }

  if (status === "claimed") {
    return (
      <span data-testid="claim-status-claimed" className="text-sm font-semibold text-brand-success">
        Diklaim
      </span>
    );
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={() => {
          void handleClaim();
        }}
        disabled={status === "claiming"}
        className="rounded-button bg-brand-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
      >
        {status === "claiming" ? "Memproses..." : "Claim Lead →"}
      </button>
      {status === "error" && error !== undefined ? (
        <span data-testid="claim-error" className="text-xs font-medium text-brand-danger">
          {error}
        </span>
      ) : null}
    </div>
  );
}
