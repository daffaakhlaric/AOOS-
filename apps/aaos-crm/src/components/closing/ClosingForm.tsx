"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { ErrorCard } from "@/components/ui/ErrorCard";
import { formatIdr } from "@/lib/formatters";
import { useSalesSession } from "@/lib/session";
import type { ClosingType } from "@/types/crm.types";

const CLOSING_TYPE_LABEL: Record<ClosingType, string> = {
  TEST_DRIVE: "Test Drive",
  SPK: "SPK",
  CANCELLED: "Batal",
};

/** Input closing/SPK (spec "closing/new/page.tsx"). Komisi Rp is auto-calculated from `%` x `harga` (spec "Komisi (Rp): Rp 5.850.000 (auto-calc)"). `harga` is required for an `SPK` closing (spec's own pinned test "validation: harga required for SPK"). */
export function ClosingForm(): React.ReactElement {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { session } = useSalesSession();

  const [leadId, setLeadId] = useState(searchParams.get("leadId") ?? "");
  const [closingType, setClosingType] = useState<ClosingType>("TEST_DRIVE");
  const [unitModel, setUnitModel] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [commissionPct, setCommissionPct] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);

  const commissionIdr = useMemo(() => {
    const price = Number(unitPrice);
    const pct = Number(commissionPct);
    if (!Number.isFinite(price) || !Number.isFinite(pct) || price <= 0 || pct <= 0) {
      return 0;
    }
    return Math.round((price * pct) / 100);
  }, [unitPrice, commissionPct]);

  async function handleSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    setError(undefined);

    if (leadId.trim().length === 0) {
      setError("Lead wajib diisi.");
      return;
    }
    if (closingType === "SPK" && unitPrice.trim().length === 0) {
      setError("Harga wajib diisi untuk SPK.");
      return;
    }
    if (session === undefined) {
      setError("Sesi tidak ditemukan. Silakan login ulang.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/closings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          leadId,
          salesHumanId: session.salesHumanId,
          closingType,
          unitModel: unitModel.trim().length > 0 ? unitModel.trim() : undefined,
          unitPrice: unitPrice.trim().length > 0 ? Number(unitPrice) : undefined,
          commissionPct: commissionPct.trim().length > 0 ? Number(commissionPct) : undefined,
          commissionIdr: commissionIdr > 0 ? commissionIdr : undefined,
          notes: notes.trim().length > 0 ? notes.trim() : undefined,
        }),
      });
      if (!response.ok) {
        setError("Gagal menyimpan closing. Coba lagi.");
        return;
      }
      router.push("/closing");
      router.refresh();
    } catch {
      setError("Gagal menyimpan closing. Coba lagi.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-4">
      <h1 className="text-lg font-semibold text-ink">✅ Input Closing</h1>

      <label className="flex flex-col gap-1 text-sm text-ink">
        Lead
        <input
          value={leadId}
          onChange={(event) => setLeadId(event.target.value)}
          className="rounded-button border border-hairline px-3 py-2"
          placeholder="Lead ID"
        />
      </label>

      <fieldset className="flex flex-col gap-1">
        <legend className="text-sm text-ink">Hasil</legend>
        <div className="flex gap-4">
          {(Object.keys(CLOSING_TYPE_LABEL) as ClosingType[]).map((type) => (
            <label key={type} className="flex items-center gap-1.5 text-sm text-ink">
              <input
                type="radio"
                name="closingType"
                value={type}
                checked={closingType === type}
                onChange={() => setClosingType(type)}
              />
              {CLOSING_TYPE_LABEL[type]}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="flex flex-col gap-1 text-sm text-ink">
        Unit
        <input
          value={unitModel}
          onChange={(event) => setUnitModel(event.target.value)}
          className="rounded-button border border-hairline px-3 py-2"
          placeholder="mis. Xpander Cross AT 2020"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm text-ink">
        Harga
        <input
          type="number"
          min={0}
          value={unitPrice}
          onChange={(event) => setUnitPrice(event.target.value)}
          className="rounded-button border border-hairline px-3 py-2"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm text-ink">
        Komisi (%)
        <input
          type="number"
          min={0}
          max={100}
          value={commissionPct}
          onChange={(event) => setCommissionPct(event.target.value)}
          className="rounded-button border border-hairline px-3 py-2"
        />
      </label>

      <p data-testid="commission-idr" className="text-sm text-ink-muted">
        Komisi (Rp): {formatIdr(commissionIdr)} (auto-calc)
      </p>

      <label className="flex flex-col gap-1 text-sm text-ink">
        Catatan
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          className="rounded-button border border-hairline px-3 py-2"
        />
      </label>

      {error !== undefined ? <ErrorCard message={error} /> : null}

      <button
        type="submit"
        disabled={submitting}
        className="rounded-button bg-brand-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
      >
        {submitting ? "Menyimpan..." : "✅ Simpan Closing"}
      </button>
    </form>
  );
}
