"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { ErrorCard } from "@/components/ui/ErrorCard";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { PLATFORM_LABEL } from "@/lib/sosmed-format";
import type {
  GenerateCaptionResponseDto,
  GenerateHashtagsResponseDto,
  SosmedAccountDto,
  SosmedContentType,
  SosmedTone,
  SosmedVertical,
} from "@/types/sosmed.types";

import styles from "./Sosmed.shared.module.css";

const CONTENT_TYPES: readonly { readonly key: SosmedContentType; readonly label: string }[] = [
  { key: "PROMO", label: "Promo listing/unit" },
  { key: "EDUKASI", label: "Edukasi" },
  { key: "TESTIMONI", label: "Testimoni" },
  { key: "BTS", label: "Behind the scenes" },
  { key: "TIPS", label: "Tips & trik" },
  { key: "MARKET_UPDATE", label: "Market update" },
];

const TONES: readonly { readonly key: SosmedTone; readonly label: string }[] = [
  { key: "FRIENDLY", label: "Friendly" },
  { key: "PROFESSIONAL", label: "Professional" },
  { key: "EXCITED", label: "Excited" },
  { key: "INFORMATIVE", label: "Informative" },
];

type Mode = "AUTO" | "MANUAL";
type AutoStep = 1 | 2 | 3 | 4;

/**
 * `/sosmed/studio` (AAOS-SOSMED-AUTOMATION Phase 5, Page 3 "Content Studio") — Auto mode's real
 * 4-step flow + a simpler Manual mode.
 *
 * Step 3 ("Kai generate visual" in the spec) is deliberately a manual media-URL input here, NOT a
 * generation call: `modules/sosmed` has no already-composed endpoint wiring `KaiAgentFactory`
 * into a sosmed-caption-to-visual pipeline (verified via direct read of `sosmed.module.ts` and the
 * whole `modules/sosmed/` tree — Phase 1-4 built caption/hashtag generation, CRUD, scheduling, and
 * OAuth, never a Kai visual-generation composition for this module). Building one from scratch
 * would be inventing net-new backend surface outside this phase's scope ("no more backend
 * endpoints need to be invented — wire the dashboard to what's real"), so this stays a manual
 * `mediaUrl` field, per the coordinator note's explicit fallback instruction.
 *
 * Step 4's account picker sets `accountId` on the created post (real, matches
 * `CreateScheduledPostBodyDto.accountId`) but does NOT auto-resolve a working `publishTarget`
 * (pageId/igUserId + access token): `SosmedPostsService.createPost`/`publishNow` (read directly,
 * `sosmed-posts.service.ts`) has no code path resolving a stored `sosmed_accounts.access_token`
 * from `accountId` at all yet — every real publish (`publishNow`/the `@Cron` scheduler) still
 * needs an explicit `publishTarget` supplied at create/update time or at publish-now time. Rather
 * than fabricate an auto-resolution that doesn't exist server-side, this page creates the post as
 * DRAFT/SCHEDULED with the chosen `accountId` for record-keeping, and leaves supplying the actual
 * publish credentials to Post Manager's existing "Post Sekarang" flow (same real, already-shipped
 * manual-token precedent Phase 3 established) — an honest scoping choice, not a broken feature.
 */
export function ContentStudioClient(): React.ReactElement {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("AUTO");
  const [vertical, setVertical] = useState<SosmedVertical>("AUTOMOTIVE");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/settings")
      .then((res) =>
        res.ok ? (res.json() as Promise<{ tenant?: { vertical?: SosmedVertical } }>) : null,
      )
      .then((data) => {
        if (!cancelled && data?.tenant?.vertical !== undefined) {
          setVertical(data.tenant.vertical);
        }
      })
      .catch(() => {
        // Best-effort only — defaults to AUTOMOTIVE, matches Sidebar's own established precedent.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className={styles.page}>
      <div className={styles.headerRow}>
        <div>
          <h2 className={styles.title}>Content Studio</h2>
          <p className={styles.subtitle}>Samantha strategi konten, Kai generate visual</p>
        </div>
      </div>

      <div className={styles.chipRow}>
        <button
          type="button"
          className={mode === "AUTO" ? styles.chipActive : styles.chip}
          onClick={() => setMode("AUTO")}
        >
          ● Auto — Samantha buat konten otomatis
        </button>
        <button
          type="button"
          className={mode === "MANUAL" ? styles.chipActive : styles.chip}
          onClick={() => setMode("MANUAL")}
        >
          ○ Manual — Saya buat sendiri
        </button>
      </div>

      {mode === "AUTO" ? (
        <AutoModeFlow vertical={vertical} onScheduled={() => router.push("/sosmed/posts")} />
      ) : (
        <ManualModeForm onScheduled={() => router.push("/sosmed/posts")} />
      )}
    </div>
  );
}

function AutoModeFlow({
  vertical,
  onScheduled,
}: {
  readonly vertical: SosmedVertical;
  readonly onScheduled: () => void;
}): React.ReactElement {
  const [step, setStep] = useState<AutoStep>(1);
  const [contentType, setContentType] = useState<SosmedContentType>("PROMO");
  const [tone, setTone] = useState<SosmedTone>("FRIENDLY");
  const [productRef, setProductRef] = useState("");
  const [angle, setAngle] = useState("");
  const [brand, setBrand] = useState("");
  const [location, setLocation] = useState("");

  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | undefined>(undefined);
  const [caption, setCaption] = useState<GenerateCaptionResponseDto | undefined>(undefined);
  const [hashtagsResult, setHashtagsResult] = useState<GenerateHashtagsResponseDto | undefined>(
    undefined,
  );
  const [instagramCaption, setInstagramCaption] = useState("");
  const [hashtags, setHashtags] = useState<readonly string[]>([]);

  const [mediaUrl, setMediaUrl] = useState("");

  async function handleGenerate(): Promise<void> {
    setGenerating(true);
    setGenError(undefined);
    try {
      const [captionRes, hashtagsRes] = await Promise.all([
        fetch("/api/sosmed/generate-caption", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ contentType, productRef, angle, tone, vertical }),
        }),
        fetch("/api/sosmed/generate-hashtags", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ productName: productRef, brand, location, vertical }),
        }),
      ]);
      if (!captionRes.ok || !hashtagsRes.ok) {
        setGenError("Gagal memanggil Samantha. Coba lagi.");
        return;
      }
      const captionBody = (await captionRes.json()) as GenerateCaptionResponseDto;
      const hashtagsBody = (await hashtagsRes.json()) as GenerateHashtagsResponseDto;
      setCaption(captionBody);
      setHashtagsResult(hashtagsBody);
      if (captionBody.available) {
        setInstagramCaption(captionBody.instagramCaption);
      }
      if (hashtagsBody.available) {
        setHashtags(hashtagsBody.hashtags);
      }
      setStep(2);
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div>
      <div className={styles.stepRow}>
        {([1, 2, 3, 4] as const).map((n) => (
          <span
            key={n}
            className={
              step === n ? styles.stepDotActive : step > n ? styles.stepDotDone : styles.stepDot
            }
          >
            {n}
          </span>
        ))}
      </div>

      {step === 1 ? (
        <div className={styles.formGrid}>
          <div className={styles.formRow}>
            <p className={styles.formLabel}>Tipe Konten</p>
            <div className={styles.chipRow}>
              {CONTENT_TYPES.map((ct) => (
                <button
                  key={ct.key}
                  type="button"
                  className={contentType === ct.key ? styles.chipActive : styles.chip}
                  onClick={() => setContentType(ct.key)}
                >
                  {ct.label}
                </button>
              ))}
            </div>
          </div>
          <div className={styles.formRow}>
            <label className={styles.formLabel} htmlFor="product-ref">
              Unit/Listing
            </label>
            <input
              id="product-ref"
              className={styles.input}
              value={productRef}
              onChange={(e) => setProductRef(e.target.value)}
              placeholder="Xpander Cross 2019 - Cinere, DP mulai 29 juta"
            />
          </div>
          <div className={styles.formRow}>
            <label className={styles.formLabel} htmlFor="angle">
              Angle
            </label>
            <input
              id="angle"
              className={styles.input}
              value={angle}
              onChange={(e) => setAngle(e.target.value)}
              placeholder="DP Ringan"
            />
          </div>
          <div className={styles.formRow}>
            <label className={styles.formLabel} htmlFor="brand">
              Brand
            </label>
            <input
              id="brand"
              className={styles.input}
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
            />
          </div>
          <div className={styles.formRow}>
            <label className={styles.formLabel} htmlFor="location">
              Lokasi
            </label>
            <input
              id="location"
              className={styles.input}
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>
          <div className={styles.formRow}>
            <p className={styles.formLabel}>Tone</p>
            <div className={styles.chipRow}>
              {TONES.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  className={tone === t.key ? styles.chipActive : styles.chip}
                  onClick={() => setTone(t.key)}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          {genError !== undefined ? <ErrorCard message={genError} /> : null}
          <button
            type="button"
            className={styles.primaryButton}
            disabled={generating || productRef.trim().length === 0 || angle.trim().length === 0}
            onClick={() => void handleGenerate()}
            style={{ alignSelf: "flex-start" }}
          >
            {generating ? "Samantha sedang generate..." : "🤖 Generate Konten →"}
          </button>
        </div>
      ) : null}

      {step === 2 ? (
        <div className={styles.formGrid} style={{ maxWidth: "100%" }}>
          {caption !== undefined && !caption.available ? (
            <p className={styles.warningNote}>⚠ {caption.message}</p>
          ) : null}
          {hashtagsResult !== undefined && !hashtagsResult.available ? (
            <p className={styles.warningNote}>⚠ {hashtagsResult.message}</p>
          ) : null}
          <div className={styles.formRow}>
            <label className={styles.formLabel} htmlFor="caption-ig">
              Caption (IG)
            </label>
            <textarea
              id="caption-ig"
              className={styles.textarea}
              value={instagramCaption}
              onChange={(e) => setInstagramCaption(e.target.value)}
            />
          </div>
          <div className={styles.formRow}>
            <p className={styles.formLabel}>Hashtags</p>
            <div className={styles.chipRow} data-testid="hashtag-chips">
              {hashtags.map((tag) => (
                <span key={tag} className={styles.chip}>
                  {tag}
                </span>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <button type="button" className={styles.secondaryButton} onClick={() => setStep(1)}>
              ← Kembali
            </button>
            <button
              type="button"
              className={styles.primaryButton}
              disabled={instagramCaption.trim().length === 0}
              onClick={() => setStep(3)}
            >
              Lanjut →
            </button>
          </div>
        </div>
      ) : null}

      {step === 3 ? (
        <div className={styles.formGrid}>
          <div className={styles.formRow}>
            <label className={styles.formLabel} htmlFor="media-url">
              URL Media (foto/video)
            </label>
            <input
              id="media-url"
              className={styles.input}
              value={mediaUrl}
              onChange={(e) => setMediaUrl(e.target.value)}
              placeholder="https://storage.googleapis.com/.../foto-unit.jpg"
            />
            <p className={styles.mutedText}>
              Generate visual otomatis via Kai belum tersedia untuk konten sosmed — tempel URL
              foto/video secara manual (mis. dari Asset Library).
            </p>
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <button type="button" className={styles.secondaryButton} onClick={() => setStep(2)}>
              ← Kembali
            </button>
            <button type="button" className={styles.primaryButton} onClick={() => setStep(4)}>
              Lanjut →
            </button>
          </div>
        </div>
      ) : null}

      {step === 4 ? (
        <ScheduleStep
          caption={instagramCaption}
          hashtags={hashtags}
          mediaUrl={mediaUrl.trim().length > 0 ? mediaUrl.trim() : undefined}
          contentType={contentType}
          productRef={productRef}
          angle={angle}
          onBack={() => setStep(3)}
          onScheduled={onScheduled}
        />
      ) : null}
    </div>
  );
}

function ScheduleStep({
  caption,
  hashtags,
  mediaUrl,
  contentType,
  productRef,
  angle,
  onBack,
  onScheduled,
}: {
  readonly caption: string;
  readonly hashtags: readonly string[];
  readonly mediaUrl: string | undefined;
  readonly contentType: SosmedContentType;
  readonly productRef: string;
  readonly angle: string;
  readonly onBack: () => void;
  readonly onScheduled: () => void;
}): React.ReactElement {
  const [accounts, setAccounts] = useState<readonly SosmedAccountDto[] | undefined>(undefined);
  const [selectedAccountId, setSelectedAccountId] = useState<string | undefined>(undefined);
  const [scheduleNow, setScheduleNow] = useState(true);
  const [scheduledAt, setScheduledAt] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | undefined>(undefined);

  useEffect(() => {
    fetch("/api/sosmed/accounts")
      .then(async (res) =>
        res.ok
          ? ((await res.json()) as { accounts: readonly SosmedAccountDto[] })
          : { accounts: [] },
      )
      .then((body) => setAccounts(body.accounts));
  }, []);

  async function handleSubmit(): Promise<void> {
    setSubmitting(true);
    setSubmitError(undefined);
    try {
      const response = await fetch("/api/sosmed/posts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          caption,
          hashtags,
          ...(mediaUrl !== undefined ? { mediaUrl, mediaType: "IMAGE" } : {}),
          contentType,
          productId: productRef,
          angle,
          ...(selectedAccountId !== undefined ? { accountId: selectedAccountId } : {}),
          generatedBy: "SAMANTHA",
          status: scheduleNow ? "DRAFT" : "SCHEDULED",
          ...(!scheduleNow && scheduledAt.length > 0
            ? { scheduledAt: new Date(scheduledAt).toISOString() }
            : {}),
        }),
      });
      if (response.ok) {
        onScheduled();
      } else {
        const body = (await response.json().catch(() => undefined)) as
          { error?: { message?: string } } | undefined;
        setSubmitError(body?.error?.message ?? "Gagal menyimpan post.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.formGrid}>
      {accounts === undefined ? (
        <LoadingSpinner />
      ) : (
        <div className={styles.formRow}>
          <p className={styles.formLabel}>Post ke akun</p>
          <div className={styles.chipRow}>
            {accounts.map((account) => (
              <button
                key={account.id}
                type="button"
                className={selectedAccountId === account.id ? styles.chipActive : styles.chip}
                onClick={() => setSelectedAccountId(account.id)}
              >
                {PLATFORM_LABEL[account.platform]} {account.accountName}
              </button>
            ))}
            {accounts.length === 0 ? (
              <p className={styles.mutedText}>Belum ada akun terhubung.</p>
            ) : null}
          </div>
        </div>
      )}

      <div className={styles.formRow}>
        <p className={styles.formLabel}>Jadwal</p>
        <div className={styles.chipRow}>
          <button
            type="button"
            className={scheduleNow ? styles.chipActive : styles.chip}
            onClick={() => setScheduleNow(true)}
          >
            ● Simpan sebagai Draft
          </button>
          <button
            type="button"
            className={!scheduleNow ? styles.chipActive : styles.chip}
            onClick={() => setScheduleNow(false)}
          >
            ○ Jadwalkan
          </button>
        </div>
        {!scheduleNow ? (
          <input
            type="datetime-local"
            className={styles.input}
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
          />
        ) : null}
      </div>

      {submitError !== undefined ? <ErrorCard message={submitError} /> : null}

      <div style={{ display: "flex", gap: 12 }}>
        <button type="button" className={styles.secondaryButton} onClick={onBack}>
          ← Kembali
        </button>
        <button
          type="button"
          className={styles.primaryButton}
          disabled={submitting || (!scheduleNow && scheduledAt.length === 0)}
          onClick={() => void handleSubmit()}
        >
          {submitting ? "Menyimpan..." : "📤 Simpan Post"}
        </button>
      </div>
    </div>
  );
}

function ManualModeForm({ onScheduled }: { readonly onScheduled: () => void }): React.ReactElement {
  const [caption, setCaption] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [hashtagsInput, setHashtagsInput] = useState("");
  const [accounts, setAccounts] = useState<readonly SosmedAccountDto[] | undefined>(undefined);
  const [selectedAccountId, setSelectedAccountId] = useState<string | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | undefined>(undefined);

  useEffect(() => {
    fetch("/api/sosmed/accounts")
      .then(async (res) =>
        res.ok
          ? ((await res.json()) as { accounts: readonly SosmedAccountDto[] })
          : { accounts: [] },
      )
      .then((body) => setAccounts(body.accounts));
  }, []);

  async function handleSubmit(): Promise<void> {
    setSubmitting(true);
    setSubmitError(undefined);
    try {
      const hashtags = hashtagsInput
        .split(/\s+/)
        .map((h) => h.trim())
        .filter((h) => h.length > 0);
      const response = await fetch("/api/sosmed/posts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          caption,
          ...(mediaUrl.trim().length > 0 ? { mediaUrl: mediaUrl.trim(), mediaType: "IMAGE" } : {}),
          ...(hashtags.length > 0 ? { hashtags } : {}),
          ...(selectedAccountId !== undefined ? { accountId: selectedAccountId } : {}),
          generatedBy: "MANUAL",
          status: "DRAFT",
        }),
      });
      if (response.ok) {
        onScheduled();
      } else {
        const body = (await response.json().catch(() => undefined)) as
          { error?: { message?: string } } | undefined;
        setSubmitError(body?.error?.message ?? "Gagal menyimpan post.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.formGrid}>
      <div className={styles.formRow}>
        <label className={styles.formLabel} htmlFor="manual-caption">
          Caption
        </label>
        <textarea
          id="manual-caption"
          className={styles.textarea}
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
        />
      </div>
      <div className={styles.formRow}>
        <label className={styles.formLabel} htmlFor="manual-media">
          URL Media
        </label>
        <input
          id="manual-media"
          className={styles.input}
          value={mediaUrl}
          onChange={(e) => setMediaUrl(e.target.value)}
        />
      </div>
      <div className={styles.formRow}>
        <label className={styles.formLabel} htmlFor="manual-hashtags">
          Hashtags (pisahkan spasi)
        </label>
        <input
          id="manual-hashtags"
          className={styles.input}
          value={hashtagsInput}
          onChange={(e) => setHashtagsInput(e.target.value)}
          placeholder="#MobixCinere #XpanderCross"
        />
      </div>
      {accounts !== undefined && accounts.length > 0 ? (
        <div className={styles.formRow}>
          <p className={styles.formLabel}>Post ke akun</p>
          <div className={styles.chipRow}>
            {accounts.map((account) => (
              <button
                key={account.id}
                type="button"
                className={selectedAccountId === account.id ? styles.chipActive : styles.chip}
                onClick={() => setSelectedAccountId(account.id)}
              >
                {PLATFORM_LABEL[account.platform]} {account.accountName}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      {submitError !== undefined ? <ErrorCard message={submitError} /> : null}
      <button
        type="button"
        className={styles.primaryButton}
        disabled={submitting || caption.trim().length === 0}
        onClick={() => void handleSubmit()}
        style={{ alignSelf: "flex-start" }}
      >
        {submitting ? "Menyimpan..." : "Simpan sebagai Draft"}
      </button>
    </div>
  );
}
