"use client";
import { useEffect, useState } from "react";
import { Drawer } from "@/components/common/Drawer";
import s from "./CopilotApprovals.module.css";
type Action = {
  id: string;
  agent: string;
  actionType: string;
  status: string;
  payload: Record<string, unknown>;
  createdAt: string;
};
const supported: Record<string, { label: string; effect: string }> = {
  CREATE_PROPERTY_CAMPAIGN: {
    label: "Buat campaign properti",
    effect:
      "Menjalankan pembuatan campaign dari listing melalui executor campaign. Pada mode LIVE, tindakan dapat mengubah Meta.",
  },
  REVIEW_CREATIVE_BRIEF: {
    label: "Setujui brief creative",
    effect:
      "Menyetujui brief lalu memulai produksi creative. Proses generasi dapat menggunakan kredit provider.",
  },
  PUBLISH_CAMPAIGN_FROM_ASSET: {
    label: "Publikasikan campaign dari aset",
    effect:
      "Memanggil executor campaign untuk listing terkait. Periksa listing dan aset sebelum melanjutkan.",
  },
  RESTRUCTURE_CAMPAIGN: {
    label: "Restrukturisasi campaign",
    effect:
      "Dapat menghentikan ad set yang diusulkan dan mengonsolidasikan budget ke ad set terpilih.",
  },
};
function text(value: unknown): string {
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.filter((v) => typeof v === "string").join(", ");
  return "Belum dicantumkan pada usulan.";
}
export function CopilotApprovals() {
  const [items, setItems] = useState<Action[]>([]),
    [selected, setSelected] = useState<Action>(),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [notes, setNotes] = useState(""),
    [confirmed, setConfirmed] = useState(false),
    [message, setMessage] = useState("");
  async function load() {
    setLoading(true);
    try {
      const r = await fetch("/api/pending-actions", { cache: "no-store" });
      const b = await r.json();
      if (!r.ok) throw Error(b.error?.message || "Antrean belum tersedia.");
      setItems(
        (b.actions ?? []).filter((a: Action) =>
          ["PENDING", "EXECUTING", "REJECTING", "EXECUTION_UNCERTAIN"].includes(a.status),
        ),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat antrean.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  async function decide(decision: "approve" | "reject") {
    if (!selected || busy) return;
    setBusy(true);
    setError("");
    try {
      const r = await fetch(`/api/pending-actions/${selected.id}/${decision}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ decisionNotes: notes }),
      });
      const b = await r.json();
      if (!r.ok) throw Error(b.error?.message || "Eksekusi belum berhasil.");
      setMessage(
        decision === "approve"
          ? "Persetujuan diproses oleh executor. Periksa Activity untuk hasil produksi atau perubahan campaign."
          : "Usulan ditolak.",
      );
      setSelected(undefined);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memproses.");
      setConfirmed(false);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className={s.panel}>
      <header>
        <div>
          <h2>Copilot · Persetujuan & Eksekusi</h2>
          <p>Review alasan dan perubahan sebelum Samantha menjalankan usulan.</p>
        </div>
        <button
          onClick={() => {
            setError("");
            void load();
          }}
          disabled={busy || loading}
        >
          Muat ulang
        </button>
      </header>
      {error && (
        <p role="alert" className={s.error}>
          {error}
        </p>
      )}
      {message && <p role="status">{message}</p>}
      {loading ? (
        <p>Memuat antrean approval…</p>
      ) : items.length === 0 ? (
        <p>
          Belum ada usulan yang masuk antrean approval. Rekomendasi analisis belum semuanya
          terhubung ke executor.
        </p>
      ) : (
        items.map((a) => (
          <div key={a.id} className={s.row}>
            <div>
              <strong>
                {supported[a.actionType]?.label ??
                  (a.actionType === "REVIEW_SAMANTHA_RECOMMENDATION"
                    ? "Rekomendasi Samantha · " + text(a.payload.decision)
                    : a.actionType)}
              </strong>
              <small>
                {a.agent} · {a.status} · {new Date(a.createdAt).toLocaleString("id-ID")}
              </small>
              <span>
                {text(
                  a.payload?.campaignName ??
                    a.payload?.listingTitle ??
                    a.payload?.listingId ??
                    a.payload?.campaignId,
                )}
              </span>
            </div>
            <button
              onClick={() => {
                setSelected(a);
                setNotes("");
                setConfirmed(false);
                setError("");
              }}
            >
              Review alasan & aksi
            </button>
          </div>
        ))
      )}
      <Drawer
        open={!!selected}
        onClose={() => {
          if (!busy) setSelected(undefined);
        }}
        title="Review keputusan Samantha"
      >
        {selected && (
          <div className={s.detail}>
            <h3>{supported[selected.actionType]?.label ?? selected.actionType}</h3>
            <h4>Alasan</h4>
            <p>
              {text(
                selected.payload?.reasoning ??
                  selected.payload?.reason ??
                  selected.payload?.reasons,
              )}
            </p>
            <h4>Status eksekusi</h4>
            <p>{selected.status}</p>
            {Array.isArray(selected.payload.blocked) && selected.payload.blocked.length > 0 && (
              <p role="status">Belum siap dieksekusi: {text(selected.payload.blocked)}</p>
            )}
            <h4>Target</h4>
            <p>
              {text(
                selected.payload?.campaignName ??
                  selected.payload?.listingTitle ??
                  selected.payload?.campaignId ??
                  selected.payload?.listingId ??
                  selected.payload?.creativePackageId,
              )}
            </p>
            <h4>Perubahan yang akan dijalankan</h4>
            <p>
              {supported[selected.actionType]?.effect ??
                "Executor untuk jenis usulan ini belum didukung."}
            </p>
            {selected.payload?.proposedKeepAdSetId !== undefined && (
              <p>Ad set dipertahankan: {text(selected.payload.proposedKeepAdSetId)}</p>
            )}
            {selected.payload?.proposedPauseAdSetIds !== undefined && (
              <p>Ad set dihentikan: {text(selected.payload.proposedPauseAdSetIds)}</p>
            )}
            <label>
              Catatan review
              <textarea
                value={notes}
                maxLength={2000}
                onChange={(e) => setNotes(e.target.value)}
                disabled={busy}
              />
            </label>
            {error && (
              <p role="alert" className={s.error}>
                {error}
              </p>
            )}
            <label className={s.confirm}>
              <input
                type="checkbox"
                checked={confirmed}
                disabled={busy}
                onChange={(e) => setConfirmed(e.target.checked)}
              />
              Saya telah meninjau alasan dan dampak tindakan ini.
            </label>
            <div className={s.buttons}>
              <button
                disabled={busy || selected.status !== "PENDING"}
                onClick={() => void decide("reject")}
              >
                Tolak
              </button>
              <button
                className={s.primary}
                disabled={
                  busy ||
                  selected.status !== "PENDING" ||
                  !confirmed ||
                  !supported[selected.actionType]
                }
                onClick={() => void decide("approve")}
              >
                {busy ? "Memproses…" : "Approve & Eksekusi"}
              </button>
            </div>
          </div>
        )}
      </Drawer>
    </section>
  );
}
