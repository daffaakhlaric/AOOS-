"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorCard } from "@/components/ui/ErrorCard";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { useCampaignsSnapshot } from "@/lib/useCampaignsSnapshot";
import type {
  CampaignAdDto,
  LlmChatMessageDto,
  LlmCreativeBriefResponseDto,
} from "@/types/dashboard.types";

import styles from "./SimulasiClient.module.css";

const FREQUENCY_THRESHOLD = 3.5;
const AD_ANGLES = [
  "DP_RINGAN",
  "KREDIT_SYARIAH",
  "GUDANGNYA",
  "QNA",
  "DISCOVERY",
  "TESTIMONIAL",
  "WEBSITE_REDIRECT",
] as const;
const VIDEO_FORMATS = new Set(["VIDEO_15S", "VIDEO_AND_IMAGES"]);

function needsRefresh(ad: CampaignAdDto): boolean {
  return ad.verdict === "REFRESH" || ad.metrics.frequency >= FREQUENCY_THRESHOLD;
}

/** Deterministic, real-ad-derived fallback brief when `/api/llm/creative-brief` is unavailable — never a literal copy of the spec mockup's hardcoded example, so a failure still reflects the SELECTED ad rather than always showing "Xpander Cross 2019". */
function fallbackBrief(ad: CampaignAdDto, angle: string): LlmCreativeBriefResponseDto {
  return {
    unit: ad.name,
    angle,
    branch: ad.branch,
    primaryMessage: `Promo terbaru untuk ${ad.name} — cek sekarang.`,
    tone: "casual, relatable",
    formats: ["VIDEO_15S", "IMAGE_SQUARE"],
    avoid: ["klaim berlebihan"],
    urgency: ad.metrics.frequency >= FREQUENCY_THRESHOLD ? "HIGH" : "MEDIUM",
    reason:
      ad.verdict === "REFRESH"
        ? "Verdict REFRESH — creative perlu diperbarui."
        : `Frequency ${ad.metrics.frequency.toFixed(1)} — audiens mulai jenuh.`,
  };
}

function formatDecision(formats: readonly string[]): "VIDEO_AND_IMAGES" | "IMAGES_ONLY" {
  return formats.some((format) => VIDEO_FORMATS.has(format)) ? "VIDEO_AND_IMAGES" : "IMAGES_ONLY";
}

/** Builds the (simulated) English prompt Kai would send to Kie AI — pure client-side text templating, no backend call (coordinator note #5: Step 3/4 has no real endpoint). */
function buildKaiPrompt(brief: LlmCreativeBriefResponseDto): string {
  return `Generate a ${formatDecision(brief.formats)} ad creative for "${brief.unit}" (branch: ${brief.branch}). Angle: ${brief.angle}. Primary message: "${brief.primaryMessage}". Tone: ${brief.tone}. Avoid: ${brief.avoid.join(", ") || "none"}.`;
}

type BriefState =
  | { readonly status: "idle" }
  | { readonly status: "loading" }
  | {
      readonly status: "ready";
      readonly brief: LlmCreativeBriefResponseDto;
      readonly fromAi: boolean;
    };

type ChatEntry = LlmChatMessageDto & { readonly key: string };

/**
 * "Simulasi Tamara × Kai" page (spec `meta-ads/simulasi/page.tsx`) — a 4-step walkthrough of how
 * Tamara briefs Kai for a creative refresh, plus a Tamara chat widget.
 *
 * Coordinator note #5: Step 3 ("Kai receive brief") / Step 4 ("Preview hasil") are a PURE
 * CLIENT-SIDE SIMULATION — `/api/v1/creative/simulate` does not exist on the real `aaos-api`, and
 * this page's own header text ("Lihat bagaimana Tamara brief Kai...") already frames it as a
 * simulation/preview, not a real generation run. "[Approve & Launch]" navigates to the real,
 * already-built `/creative` page rather than attempting to create a real `CreativePackage`.
 */
export function SimulasiClient(): React.ReactElement {
  const { data, loading, error } = useCampaignsSnapshot();
  const router = useRouter();

  const [selectedAd, setSelectedAd] = useState<CampaignAdDto | undefined>(undefined);
  const [angle, setAngle] = useState<string>(AD_ANGLES[0]);
  const [brief, setBrief] = useState<BriefState>({ status: "idle" });
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  const [chatInput, setChatInput] = useState("");
  const [chatHistory, setChatHistory] = useState<readonly ChatEntry[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | undefined>(undefined);

  async function generateBrief(ad: CampaignAdDto): Promise<void> {
    setBrief({ status: "loading" });
    try {
      const res = await fetch("/api/llm/creative-brief", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ad, angle, branch: ad.branch }),
      });
      if (!res.ok) {
        setBrief({ status: "ready", brief: fallbackBrief(ad, angle), fromAi: false });
        return;
      }
      const result = (await res.json()) as LlmCreativeBriefResponseDto;
      setBrief({ status: "ready", brief: result, fromAi: true });
    } catch {
      setBrief({ status: "ready", brief: fallbackBrief(ad, angle), fromAi: false });
    }
  }

  async function sendChat(): Promise<void> {
    const content = chatInput.trim();
    if (content.length === 0) {
      return;
    }
    const userEntry: ChatEntry = { key: `user-${Date.now()}`, role: "user", content };
    const nextHistory = [...chatHistory, userEntry];
    setChatHistory(nextHistory);
    setChatInput("");
    setChatLoading(true);
    setChatError(undefined);
    try {
      const res = await fetch("/api/llm/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          messages: nextHistory.map(({ role, content: text }) => ({ role, content: text })),
          context: "meta-ads-simulasi",
        }),
      });
      if (!res.ok) {
        setChatError("Tamara tidak bisa menjawab saat ini.");
        return;
      }
      const result = (await res.json()) as { readonly reply: string };
      setChatHistory([
        ...nextHistory,
        { key: `assistant-${Date.now()}`, role: "assistant", content: result.reply },
      ]);
    } catch {
      setChatError("Tamara tidak bisa menjawab saat ini.");
    } finally {
      setChatLoading(false);
    }
  }

  if (data === undefined) {
    return (
      <div className={styles.page}>
        <Header />
        {loading ? <LoadingSpinner /> : null}
        {!loading && error !== undefined ? <ErrorCard message={error} /> : null}
        {!loading && error === undefined ? (
          <EmptyState
            title="Belum ada data"
            description="Tarik data di halaman Data Iklan terlebih dahulu."
          />
        ) : null}
      </div>
    );
  }

  const candidates = data.ads.filter(needsRefresh);

  return (
    <div className={styles.page}>
      <Header />

      <section data-testid="simulasi-step-1" className={styles.section}>
        <h3 className={styles.sectionTitle}>Step 1: Pilih iklan yang butuh REFRESH creative</h3>
        {candidates.length === 0 ? (
          <p className={styles.mutedText}>Tidak ada iklan yang butuh refresh saat ini.</p>
        ) : (
          <ul className={styles.list}>
            {candidates.map((ad) => (
              <li key={ad.id} className={styles.row}>
                <span className={styles.rowText}>
                  {ad.stableId} {ad.name} · {ad.verdict} · freq {ad.metrics.frequency.toFixed(1)}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedAd(ad);
                    setBrief({ status: "idle" });
                    setStep(2);
                  }}
                  className={styles.secondaryButton}
                >
                  Pilih iklan ini
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {selectedAd !== undefined && step >= 2 ? (
        <section data-testid="simulasi-step-2" className={styles.section}>
          <h3 className={styles.sectionTitle}>Step 2: Tamara generate CreativeBrief</h3>
          <label className={styles.angleLabel}>
            Angle
            <select
              value={angle}
              onChange={(event) => setAngle(event.target.value)}
              className={styles.select}
            >
              {AD_ANGLES.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => void generateBrief(selectedAd)}
            disabled={brief.status === "loading"}
            className={styles.primaryButton}
          >
            Generate Brief
          </button>
          {brief.status === "loading" ? (
            <p className={styles.mutedText}>Tamara sedang menyusun brief…</p>
          ) : null}
          {brief.status === "ready" ? (
            <div data-testid="creative-brief-preview" className={styles.briefCard}>
              {!brief.fromAi ? (
                <p className={styles.briefNotice}>
                  AI tidak tersedia — menampilkan brief dasar dari data iklan.
                </p>
              ) : null}
              <p>
                <strong>Unit:</strong> {brief.brief.unit}
              </p>
              <p>
                <strong>Angle:</strong> {brief.brief.angle}
              </p>
              <p>
                <strong>Branch:</strong> {brief.brief.branch}
              </p>
              <p>
                <strong>Pesan utama:</strong> {brief.brief.primaryMessage}
              </p>
              <p>
                <strong>Format:</strong> {brief.brief.formats.join(", ")}
              </p>
              <button type="button" onClick={() => setStep(3)} className={styles.secondaryButton}>
                Lanjut ke Step 3
              </button>
            </div>
          ) : null}
        </section>
      ) : null}

      {step >= 3 && brief.status === "ready" ? (
        <section data-testid="simulasi-step-3" className={styles.section}>
          <h3 className={styles.sectionTitle}>Step 3: Kai receive brief</h3>
          <p className={styles.mutedText}>Kai menerima brief dari Tamara…</p>
          <p className={styles.kaiPrompt}>{buildKaiPrompt(brief.brief)}</p>
          <p className={styles.rowText}>
            Format decision: <strong>{formatDecision(brief.brief.formats)}</strong>
          </p>
          <button type="button" onClick={() => setStep(4)} className={styles.primaryButton}>
            Simulasi Generate
          </button>
        </section>
      ) : null}

      {step >= 4 && brief.status === "ready" ? (
        <section data-testid="simulasi-step-4" className={styles.section}>
          <h3 className={styles.sectionTitle}>Step 4: Preview hasil</h3>
          <div className={styles.previewGrid}>
            <div className={styles.previewTile}>🎬 Video</div>
            {[1, 2, 3].map((index) => (
              <div key={index} className={styles.previewTile}>
                🖼️ Image {index}
              </div>
            ))}
          </div>
          <div className={styles.copyList}>
            <p>Copy A: {brief.brief.primaryMessage}</p>
            <p>Copy B: {brief.brief.primaryMessage} — Hubungi kami sekarang!</p>
            <p>Copy C: {brief.brief.primaryMessage} — Stok terbatas.</p>
          </div>
          <button
            type="button"
            onClick={() => router.push("/creative")}
            className={styles.primaryButton}
          >
            Approve & Launch
          </button>
        </section>
      ) : null}

      <section data-testid="tamara-chat-widget" className={styles.chatWidget}>
        <h3 className={styles.sectionTitle}>Tanya Tamara tentang data iklan ini…</h3>
        <ul className={styles.chatHistory}>
          {chatHistory.map((entry) => (
            <li
              key={entry.key}
              className={`${styles.chatBubble} ${entry.role === "user" ? styles.chatBubbleUser : styles.chatBubbleAssistant}`}
            >
              {entry.content}
            </li>
          ))}
        </ul>
        {chatLoading ? <p className={styles.mutedText}>Tamara sedang mengetik…</p> : null}
        {chatError !== undefined ? <ErrorCard message={chatError} /> : null}
        <div className={styles.chatInputRow}>
          <input
            type="text"
            value={chatInput}
            onChange={(event) => setChatInput(event.target.value)}
            placeholder="Kenapa Bandung Rp/lead nya mahal banget?"
            aria-label="Tanya Tamara"
            className={styles.chatInput}
          />
          <button
            type="button"
            onClick={() => void sendChat()}
            disabled={chatLoading}
            className={styles.secondaryButton}
          >
            Send
          </button>
        </div>
      </section>
    </div>
  );
}

function Header(): React.ReactElement {
  return (
    <div>
      <h2 className={styles.title}>🎬 Simulasi Koordinasi Tamara × Kai</h2>
      <p className={styles.subtitle}>
        Lihat bagaimana Tamara brief Kai untuk generate creative baru.
      </p>
    </div>
  );
}
