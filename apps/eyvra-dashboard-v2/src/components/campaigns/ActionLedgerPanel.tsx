"use client";
import { useCallback, useEffect, useState } from "react";
import { Drawer } from "@/components/common/Drawer";
import styles from "./ActionLedgerPanel.module.css";

interface Action {
  id: string;
  commandHash: string;
  actionType: string;
  entityId: string;
  state: string;
  revision: number;
  policyVersion: number;
  adAccountId: string;
  approvedBy: string | null;
  correlationId: string;
  beforeStatus?: string | null;
  targetStatus?: string | null;
  evidenceSnapshotId?: string;
  reason?: string | null;
  steps?: { id: string; key: string; state: string; providerObjectId: string | null }[];
}
const explanations: Record<string, string> = {
  PAUSE_OUTCOME_BASIS_UNVERIFIED:
    "Policy memakai hasil bisnis/qualified lead. Bukti raw lead Meta belum cukup untuk keputusan ini.",
  PAUSE_DIAGNOSIS_UNVERIFIED: "Diagnosis belum mendukung penghentian belanja campaign.",
  PAUSE_METRICS_UNVERIFIED:
    "Metrik belum membuktikan belanja tanpa lead; analisis ulang diperlukan.",
  LOW_CONFIDENCE: "Confidence belum memenuhi batas policy.",
  INSUFFICIENT_DATA: "Data performa belum cukup untuk menjalankan rekomendasi.",
  OBSERVATION_WINDOW: "Periode pengamatan belum memenuhi batas policy.",
  CAMPAIGN_LEARNING_PROTECTED:
    "Ada ad set dalam learning atau learning limited. Rekomendasi ditahan.",
  LEARNING_COVERAGE_UNVERIFIED:
    "Data seluruh ad set belum lengkap; kondisi learning belum bisa dipastikan.",
  LEARNING_UNVERIFIED: "Meta belum memberikan status learning yang dapat diverifikasi.",
  LEARNING_UNAVAILABLE:
    "Status learning belum dapat dibaca dari Meta. Periksa kembali status eksekusi.",
  LEARNING_SCOPE_MISMATCH: "Data ad set tidak cocok dengan campaign dan akun yang disetujui.",
  TRACKING_UNVERIFIED:
    "Kesehatan tracking belum terverifikasi. Eksekusi rekomendasi Samantha masih ditahan.",
  META_WRITE_DISABLED: "Perubahan Meta belum diaktifkan pada server.",
  META_CAPABILITY_UNVERIFIED: "Akun ini belum terverifikasi untuk menjalankan aksi tersebut.",
  BUDGET_WRITE_UNVERIFIED: "Satuan budget Meta belum terverifikasi; perubahan budget diblokir.",
  RESUME_EVIDENCE_UNVERIFIED: "Resume masih menunggu pemeriksaan tracking dan fase learning.",
  ACTION_EVIDENCE_EXPIRED: "Assessment sudah kedaluwarsa. Jalankan analisis Samantha kembali.",
  ACTION_EVIDENCE_SUPERSEDED:
    "Ada assessment yang lebih baru. Rekomendasi ini perlu ditinjau ulang.",
  ACTION_EVIDENCE_CHANGED: "Isi assessment tidak lagi sesuai dengan rencana yang disetujui.",
  ACTION_EVIDENCE_MISMATCH: "Assessment tidak cocok dengan campaign pada rencana ini.",
  ACTION_EVIDENCE_UNAVAILABLE:
    "Assessment belum dapat diperiksa. Muat ulang status eksekusi sebelum mencoba lagi.",
  AUTOMATED_STATUS_EVIDENCE_UNVERIFIED:
    "Eksekusi rekomendasi Samantha masih menunggu pengaman learning dan tracking.",
};
export function ActionLedgerPanel() {
  const [actions, setActions] = useState<Action[]>();
  const [canManage, setCanManage] = useState(false);
  const [detail, setDetail] = useState<Action>();
  const [busy, setBusy] = useState<string>();
  const [error, setError] = useState<string>();
  const [preflight, setPreflight] = useState<{
    id: string;
    ready: boolean;
    blocked: string[];
    commandHash: string;
    checkedAt: string;
  }>();
  const load = useCallback(async () => {
    const response = await fetch("/api/actions", { cache: "no-store" });
    if (!response.ok) throw new Error("Daftar eksekusi belum dapat dimuat.");
    const body = (await response.json()) as { actions: Action[]; canManage: boolean };
    setActions(body.actions);
    setCanManage(body.canManage);
  }, []);
  useEffect(() => {
    void load().catch((e) => setError(String(e.message)));
  }, [load]);
  const inspect = async (action: Action) => {
    setError(undefined);
    setPreflight(undefined);
    try {
      const r = await fetch(`/api/actions/${action.id}`, { cache: "no-store" });
      if (!r.ok) throw new Error("Detail belum dapat dimuat.");
      setDetail((await r.json()) as Action);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Detail belum tersedia.");
    }
  };
  const checkReadiness = async (action: Action) => {
    setBusy(action.id);
    setPreflight(undefined);
    setError(undefined);
    try {
      const response = await fetch(`/api/actions/${action.id}/preflight`, { cache: "no-store" });
      if (!response.ok) throw new Error("Kesiapan belum dapat diperiksa.");
      const result = await response.json();
      setPreflight({ ...result, id: action.id });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Pemeriksaan belum tersedia.");
    } finally {
      setBusy(undefined);
    }
  };
  const run = async (action: Action) => {
    if (
      !preflight?.ready ||
      preflight.id !== action.id ||
      preflight.commandHash !== action.commandHash
    )
      return;
    setBusy(action.id);
    setError(undefined);
    try {
      for (const operation of action.state === "AWAITING_APPROVAL"
        ? ["approve", "execute"]
        : ["execute"]) {
        const response = await fetch(`/api/actions/${action.id}/${operation}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(operation === "approve" ? { commandHash: action.commandHash } : {}),
        });
        const body = (await response.json()) as Action & { error?: { message?: string } };
        if (!response.ok) {
          const message = body.error?.message ?? "Status belum dapat dipastikan. Muat ulang.";
          throw new Error(explanations[message] ?? message);
        }
        setDetail(body);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Hasil belum pasti. Muat ulang status.");
    } finally {
      setPreflight(undefined);
      await load().catch(() => undefined);
      setBusy(undefined);
    }
  };
  return (
    <section className={styles.panel} aria-label="Antrean eksekusi campaign">
      <header>
        <div>
          <h2>Approval & Eksekusi</h2>
          <p>
            Status berasal dari ledger eksekusi. Approval belum berarti perubahan Meta berhasil.
          </p>
        </div>
        <button
          disabled={!!busy}
          onClick={() => {
            setError(undefined);
            void load().catch((e) => setError(e.message));
          }}
        >
          Muat ulang
        </button>
      </header>
      {error && <p role="alert">{error}</p>}
      {!actions ? (
        <p>{error ? "Status belum tersedia. Silakan muat ulang." : "Memuat status…"}</p>
      ) : actions.length === 0 ? (
        <p>Belum ada action dengan rencana eksekusi tersimpan.</p>
      ) : (
        <ul>
          {actions.map((action) => (
            <li key={action.id}>
              <div>
                <strong>{action.actionType.replaceAll("_", " ")}</strong>
                <p>
                  Objek {action.entityId} · Revisi {action.revision} · {action.state}
                </p>
              </div>
              <button disabled={!!busy} onClick={() => void inspect(action)}>
                Lihat detail
              </button>
            </li>
          ))}
        </ul>
      )}
      <Drawer
        open={!!detail}
        onClose={() => {
          if (!busy) setDetail(undefined);
        }}
        title="Detail action"
      >
        {detail && (
          <div className={styles.detail}>
            <p>
              {detail.id} · {detail.state}
            </p>
            <p>
              Akun {detail.adAccountId} · Policy v{detail.policyVersion}
            </p>
            <p>
              Status sebelum: {detail.beforeStatus ?? "—"} → Target: {detail.targetStatus ?? "—"}
            </p>
            <p>Referensi evidence: {detail.evidenceSnapshotId ?? "Belum tersedia"}</p>
            <p>Alasan Samantha: {detail.reason ?? "Belum tersedia untuk action ini."}</p>
            <p>
              Eksekusi memeriksa ulang policy, akses akun, dan kondisi Meta. Approval saja belum
              mengubah iklan.
            </p>
            {error && <p role="alert">{error}</p>}
            {canManage && ["AWAITING_APPROVAL", "APPROVED"].includes(detail.state) && (
              <>
                <button disabled={!!busy} onClick={() => void checkReadiness(detail)}>
                  Periksa kesiapan
                </button>
                {preflight?.id === detail.id && (
                  <div role="status">
                    <p>
                      {preflight.ready
                        ? "Pemeriksaan awal lulus. Eksekusi tetap akan memeriksa ulang kondisi."
                        : "Eksekusi belum siap:"}
                    </p>
                    {preflight.blocked.map((code) => (
                      <p key={code}>{explanations[code] ?? code}</p>
                    ))}
                  </div>
                )}
                <button
                  disabled={
                    !!busy ||
                    !preflight?.ready ||
                    preflight.id !== detail.id ||
                    preflight.commandHash !== detail.commandHash
                  }
                  onClick={() => void run(detail)}
                >
                  {busy
                    ? "Memeriksa & menjalankan…"
                    : detail.state === "APPROVED"
                      ? "Jalankan"
                      : "Approve & Execute"}
                </button>
              </>
            )}
            <p>Referensi: {detail.correlationId}</p>
            {detail.steps?.map((step) => (
              <p key={step.id}>
                {step.key}: {step.state}
                {step.providerObjectId ? ` · Meta ${step.providerObjectId}` : ""}
              </p>
            ))}
            <button disabled={!!busy} onClick={() => setDetail(undefined)}>
              Tutup detail
            </button>
          </div>
        )}
      </Drawer>
    </section>
  );
}
