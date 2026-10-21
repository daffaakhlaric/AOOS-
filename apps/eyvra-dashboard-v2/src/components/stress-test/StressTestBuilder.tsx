"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card } from "@/components/common/Card";
import { ErrorState } from "@/components/common/ErrorState";
import {
  MODE_DESCRIPTIONS,
  MODE_LABELS,
  PLANNED_EVALUATION_CATEGORIES,
  PRIMARY_GOAL_LABELS,
  STATUS_LABELS,
  type ObjectionSourceDto,
  type ObjectionSourceKey,
  type PersonaPresetDto,
  type PersonaPresetId,
  type StressTestMode,
  type StressTestPrimaryGoal,
  type StressTestRunDto,
  type StressTestSourceType,
} from "@/lib/stress-test";
import { buildPrefillFromRun, type PrefillIntent } from "@/lib/stress-test-result";
import styles from "./StressTestBuilder.module.css";

interface ListingOption {
  readonly id: string;
  readonly title: string;
}
interface CampaignOption {
  readonly id: string;
  readonly name: string;
}
interface CreativeOption {
  readonly id: string;
  readonly title: string;
}
interface ListingPhoto {
  readonly id: string;
  readonly url: string;
  readonly isMain: boolean;
}

const STEPS = ["Pilih Context", "Creative", "Persona", "Pengaturan", "Jalankan"] as const;

/** Max wait for `POST …/execute` before handing off to the (polling) result page. */
const EXECUTE_HANDOFF_MS = 2500;

export function StressTestBuilder(): React.ReactElement {
  const router = useRouter();
  const [step, setStep] = useState(0);

  const [name, setName] = useState("");
  const [sourceType, setSourceType] = useState<StressTestSourceType>("LISTING");
  const [listingId, setListingId] = useState("");
  const [campaignId, setCampaignId] = useState("");
  const [creativeIds, setCreativeIds] = useState<readonly string[]>([]);
  const [personaIds, setPersonaIds] = useState<readonly PersonaPresetId[]>([]);
  const [objectionSources, setObjectionSources] = useState<readonly ObjectionSourceKey[]>([]);
  const [mode, setMode] = useState<StressTestMode>("STANDARD");
  const [primaryGoal, setPrimaryGoal] = useState<StressTestPrimaryGoal>("CREATIVE_QUALITY");

  const [listings, setListings] = useState<readonly ListingOption[]>([]);
  const [campaigns, setCampaigns] = useState<readonly CampaignOption[]>([]);
  const [creatives, setCreatives] = useState<readonly CreativeOption[]>([]);
  const [listingPhotos, setListingPhotos] = useState<readonly ListingPhoto[]>([]);
  const [presets, setPresets] = useState<readonly PersonaPresetDto[]>([]);
  const [sources, setSources] = useState<readonly ObjectionSourceDto[]>([]);
  const [lastRun, setLastRun] = useState<StressTestRunDto | undefined>();

  const [submitError, setSubmitError] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);

  // "Run Lagi dengan Pengaturan Ini" / "Duplicate Run" from the result page: `?fromRun=<id>&intent=`
  // loads that real run and prefills this form with its real settings. Nothing is created until the
  // user presses "Jalankan" — frontend-only, no new backend endpoint.
  const query = useSearchParams();
  const fromRunId = query.get("fromRun") ?? "";
  const prefillIntent: PrefillIntent = query.get("intent") === "duplicate" ? "duplicate" : "rerun";
  const [prefillNotice, setPrefillNotice] = useState<string | undefined>();

  useEffect(() => {
    if (fromRunId === "") return;
    const controller = new AbortController();
    fetch(`/api/creative-stress-test/${encodeURIComponent(fromRunId)}`, {
      signal: controller.signal,
    })
      .then(async (r) => {
        if (!r.ok) throw new Error();
        return (await r.json()) as StressTestRunDto;
      })
      .then((source) => {
        if (controller.signal.aborted) return;
        const prefill = buildPrefillFromRun(source, prefillIntent);
        if (prefill === undefined) {
          setPrefillNotice(
            "Pengaturan run sumber tidak dapat dimuat ulang untuk jenis sumber ini.",
          );
          return;
        }
        setName(prefill.name);
        setSourceType(prefill.sourceType);
        setListingId(prefill.listingId);
        setCampaignId(prefill.campaignId);
        setCreativeIds(prefill.creativeIds);
        setMode(prefill.mode);
        setPrimaryGoal(prefill.primaryGoal);
        setPersonaIds(prefill.personaIds);
        setObjectionSources(prefill.objectionSources);
        setPrefillNotice(
          prefillIntent === "duplicate"
            ? `Diduplikasi dari run "${source.name}" — tinjau lalu jalankan sebagai run baru.`
            : `Pengaturan dimuat dari run "${source.name}" — tekan Jalankan untuk membuat run baru.`,
        );
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setPrefillNotice("Run sumber belum dapat dimuat — isi pengaturan secara manual.");
      });
    return () => controller.abort();
  }, [fromRunId, prefillIntent]);

  useEffect(() => {
    fetch("/api/listings")
      .then(async (r) =>
        r.ok ? ((await r.json()) as { listings: { listing: ListingOption }[] }) : undefined,
      )
      .then((body) => {
        if (body) setListings(body.listings.map((l) => l.listing));
      })
      .catch(() => undefined);
    fetch("/api/campaigns")
      .then(async (r) => (r.ok ? ((await r.json()) as { campaigns: CampaignOption[] }) : undefined))
      .then((body) => {
        if (body) setCampaigns(body.campaigns);
      })
      .catch(() => undefined);
    fetch("/api/creative-stress-test/persona-presets")
      .then(async (r) => (r.ok ? ((await r.json()) as { presets: PersonaPresetDto[] }) : undefined))
      .then((body) => {
        if (body) setPresets(body.presets);
      })
      .catch(() => undefined);
    fetch("/api/creative-stress-test/objection-sources")
      .then(async (r) =>
        r.ok ? ((await r.json()) as { sources: ObjectionSourceDto[] }) : undefined,
      )
      .then((body) => {
        if (body) setSources(body.sources);
      })
      .catch(() => undefined);
    fetch("/api/creative-stress-test")
      .then(async (r) => (r.ok ? ((await r.json()) as { runs: StressTestRunDto[] }) : undefined))
      .then((body) => {
        if (body && body.runs.length > 0) setLastRun(body.runs[0]);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (sourceType !== "CAMPAIGN" || campaignId === "") {
      setCreatives([]);
      return;
    }
    const controller = new AbortController();
    fetch(`/api/campaigns/${encodeURIComponent(campaignId)}/workspace`, {
      signal: controller.signal,
    })
      .then(async (r) => (r.ok ? ((await r.json()) as { packages?: CreativeOption[] }) : undefined))
      .then((body) => {
        if (body?.packages && !controller.signal.aborted) setCreatives(body.packages);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [sourceType, campaignId]);

  // Real listing photos — a listing has no Meta/Kai creative packages of its own, but its real
  // photos are still real creative assets worth stress-testing before any campaign exists. Reuses
  // the same real `/api/listings/:id` (`ListingDto.photos`) the Listing Editor already renders.
  useEffect(() => {
    if (sourceType !== "LISTING" || listingId === "") {
      setListingPhotos([]);
      return;
    }
    const controller = new AbortController();
    fetch(`/api/listings/${encodeURIComponent(listingId)}`, { signal: controller.signal })
      .then(async (r) => (r.ok ? ((await r.json()) as { photos?: ListingPhoto[] }) : undefined))
      .then((body) => {
        if (body?.photos && !controller.signal.aborted) setListingPhotos(body.photos);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [sourceType, listingId]);

  const contextChosen =
    (sourceType === "LISTING" && listingId !== "") ||
    (sourceType === "CAMPAIGN" && campaignId !== "");
  const canSubmit = name.trim().length > 0 && contextChosen && personaIds.length > 0 && !submitting;

  function togglePersona(id: PersonaPresetId): void {
    setPersonaIds((current) =>
      current.includes(id) ? current.filter((p) => p !== id) : [...current, id],
    );
  }
  function toggleObjectionSource(key: ObjectionSourceKey): void {
    setObjectionSources((current) =>
      current.includes(key) ? current.filter((s) => s !== key) : [...current, key],
    );
  }
  function toggleCreative(id: string): void {
    setCreativeIds((current) =>
      current.includes(id) ? current.filter((c) => c !== id) : [...current, id],
    );
  }

  async function runSimulation(): Promise<void> {
    setSubmitError(undefined);
    setSubmitting(true);
    try {
      const createResponse = await fetch("/api/creative-stress-test", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          sourceType,
          ...(sourceType === "LISTING" ? { listingId } : {}),
          ...(sourceType === "CAMPAIGN" ? { campaignId } : {}),
          creativeIds,
          mode,
          primaryGoal,
          personaIds,
          objectionSources,
        }),
      });
      const created = (await createResponse.json()) as StressTestRunDto & { message?: string };
      if (!createResponse.ok) {
        setSubmitError(created.message ?? "Run belum dapat dibuat.");
        setSubmitting(false);
        return;
      }
      // `execute` runs every evaluator synchronously (can take a while). Wait until it finishes OR
      // EXECUTE_HANDOFF_MS has passed — by then the backend has persisted RUNNING + real per-evaluator
      // progress, so the result page (which polls while QUEUED/RUNNING) shows live step progress
      // instead of this form spinning. The request itself keeps running after navigation.
      const execution = fetch(
        `/api/creative-stress-test/${encodeURIComponent(created.id)}/execute`,
        {
          method: "POST",
        },
      ).catch(() => undefined);
      await Promise.race([
        execution,
        new Promise((resolve) => setTimeout(resolve, EXECUTE_HANDOFF_MS)),
      ]);
      router.push(`/samantha/stress-test/${created.id}`);
    } catch {
      setSubmitError("Run belum dapat dibuat. Coba lagi.");
      setSubmitting(false);
    }
  }

  const selectedListingTitle = useMemo(
    () => listings.find((l) => l.id === listingId)?.title,
    [listings, listingId],
  );

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1>Creative Stress Test — Uji Ketahanan Creative</h1>
          <p>
            Uji creative terhadap persona pembeli dan sumber objection sebelum campaign berjalan.
          </p>
        </div>
      </header>
      {prefillNotice !== undefined ? (
        <p role="status" data-testid="stress-test-prefill-notice">
          {prefillNotice}
        </p>
      ) : null}
      <nav className={styles.stepper} aria-label="Tahapan">
        {STEPS.map((label, index) => (
          <button
            key={label}
            type="button"
            className={`${styles.step} ${index === step ? styles.stepActive : ""}`}
            onClick={() => setStep(index)}
          >
            {index + 1}. {label}
          </button>
        ))}
      </nav>
      <div className={styles.layout}>
        <div>
          <Card title="Campaign / Listing Context" testId="stress-test-context-card">
            <div className={styles.field}>
              <label htmlFor="stress-test-name">Nama Run</label>
              <input
                id="stress-test-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Contoh: Stress test — Xpander DP Ringan"
              />
            </div>
            <div className={styles.field}>
              <label htmlFor="stress-test-source-type">Sumber</label>
              <select
                id="stress-test-source-type"
                value={sourceType}
                onChange={(e) => {
                  // Listing photo ids and campaign creative-package ids are different real ID
                  // spaces — clear the selection when switching so a stale id from the other
                  // source never gets submitted silently.
                  setCreativeIds([]);
                  setSourceType(e.target.value as StressTestSourceType);
                }}
              >
                <option value="LISTING">Listing</option>
                <option value="CAMPAIGN">Campaign</option>
              </select>
            </div>
            {sourceType === "LISTING" ? (
              <div className={styles.field}>
                <label htmlFor="stress-test-listing">Listing</label>
                <select
                  id="stress-test-listing"
                  value={listingId}
                  onChange={(e) => setListingId(e.target.value)}
                >
                  <option value="">Pilih listing…</option>
                  {listings.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.title}
                    </option>
                  ))}
                </select>
                {selectedListingTitle !== undefined ? <small>{selectedListingTitle}</small> : null}
              </div>
            ) : (
              <div className={styles.field}>
                <label htmlFor="stress-test-campaign">Campaign</label>
                <select
                  id="stress-test-campaign"
                  value={campaignId}
                  onChange={(e) => setCampaignId(e.target.value)}
                >
                  <option value="">Pilih campaign…</option>
                  {campaigns.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </Card>

          <Card title="Creative Under Test" testId="stress-test-creative-card">
            {sourceType === "LISTING" ? (
              listingId === "" ? (
                <p>Pilih listing untuk memilih foto nyata dari listing tersebut (opsional).</p>
              ) : listingPhotos.length === 0 ? (
                <p>Listing ini belum memiliki foto.</p>
              ) : (
                <div className={styles.creativeGrid}>
                  {listingPhotos.map((photo) => (
                    <button
                      key={photo.id}
                      type="button"
                      className={`${styles.creativeCard} ${creativeIds.includes(photo.id) ? styles.creativeCardSelected : ""}`}
                      aria-pressed={creativeIds.includes(photo.id)}
                      onClick={() => toggleCreative(photo.id)}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element -- real tenant listing photo, same pattern as ListingEditor */}
                      <img className={styles.creativeThumb} src={photo.url} alt="" />
                      {photo.isMain ? "Foto utama" : "Foto listing"}
                    </button>
                  ))}
                </div>
              )
            ) : sourceType !== "CAMPAIGN" || campaignId === "" ? (
              <p>Pilih campaign untuk memilih creative nyata dari campaign tersebut (opsional).</p>
            ) : creatives.length === 0 ? (
              <p>Belum ada creative package pada campaign ini.</p>
            ) : (
              <div className={styles.creativeGrid}>
                {creatives.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className={`${styles.creativeCard} ${creativeIds.includes(c.id) ? styles.creativeCardSelected : ""}`}
                    aria-pressed={creativeIds.includes(c.id)}
                    onClick={() => toggleCreative(c.id)}
                  >
                    {c.title}
                  </button>
                ))}
              </div>
            )}
          </Card>

          <Card title="Buyer Persona Stress Test" testId="stress-test-persona-card">
            <p>Preset persona terkonfigurasi (bukan data pembeli nyata) — pilih minimal satu.</p>
            <div className={styles.presetGrid}>
              {presets.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  className={`${styles.presetCard} ${personaIds.includes(preset.id) ? styles.presetCardSelected : ""}`}
                  aria-pressed={personaIds.includes(preset.id)}
                  onClick={() => togglePersona(preset.id)}
                >
                  <strong>{preset.label}</strong>
                  <p>{preset.description}</p>
                </button>
              ))}
            </div>
          </Card>

          <Card title="Objection Sources" testId="stress-test-objection-card">
            {sources.map((source) => (
              <div
                key={source.key}
                className={`${styles.checkRow} ${!source.available ? styles.disabled : ""}`}
              >
                <input
                  type="checkbox"
                  id={`objection-${source.key}`}
                  checked={objectionSources.includes(source.key)}
                  onChange={() => toggleObjectionSource(source.key)}
                  title={source.note}
                />
                <label htmlFor={`objection-${source.key}`}>
                  {source.label}
                  <small>{source.available ? "Real — data tersedia" : source.note}</small>
                </label>
              </div>
            ))}
          </Card>

          <Card title="Simulation Settings" testId="stress-test-settings-card">
            <div className={styles.field}>
              <label>Mode</label>
              <div className={styles.modeRow}>
                {(["FAST", "STANDARD", "DEEP"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    className={`${styles.modeButton} ${mode === m ? styles.modeButtonSelected : ""}`}
                    aria-pressed={mode === m}
                    onClick={() => setMode(m)}
                  >
                    <strong>{MODE_LABELS[m]}</strong>
                    <div>
                      <small>{MODE_DESCRIPTIONS[m]}</small>
                    </div>
                  </button>
                ))}
              </div>
            </div>
            <div className={styles.field}>
              <label htmlFor="stress-test-goal">Primary Goal</label>
              <select
                id="stress-test-goal"
                value={primaryGoal}
                onChange={(e) => setPrimaryGoal(e.target.value as StressTestPrimaryGoal)}
              >
                {Object.entries(PRIMARY_GOAL_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <small>
                Nilai ini hanya disimpan pada run — belum ada baseline CPQL/Hot Lead Rate real yang
                diukur.
              </small>
            </div>
          </Card>

          {submitError !== undefined ? <ErrorState message={submitError} /> : null}
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.primary}
              disabled={!canSubmit}
              onClick={() => void runSimulation()}
            >
              {submitting ? "Menjalankan…" : "Jalankan Uji Ketahanan Creative"}
            </button>
          </div>
        </div>

        <aside className={styles.rail}>
          <Card title="Simulation Preview" testId="stress-test-preview-card">
            <p>
              Evaluator nyata yang akan dijalankan (dibatasi jumlah sesuai mode agar biaya/waktu
              terkendali):
            </p>
            <ul className={styles.categoryList}>
              {PLANNED_EVALUATION_CATEGORIES.map((category) => (
                <li key={category}>{category}</li>
              ))}
            </ul>
          </Card>
          <Card title="Expected Output" testId="stress-test-expected-output-card">
            <p>
              Setelah dijalankan, run ini akan berstatus <strong>{STATUS_LABELS.COMPLETED}</strong>{" "}
              dengan simulasi AI per persona, evaluasi copy, fact-check terhadap Listing Knowledge
              (jika tersedia), skor per dimensi, dan rekomendasi utama — atau{" "}
              <strong>{STATUS_LABELS.FAILED}</strong> jika seluruh evaluator gagal dijalankan.
            </p>
          </Card>
          <Card title="Last Simulation" testId="stress-test-last-run-card">
            {lastRun === undefined ? (
              <p>Belum ada run sebelumnya.</p>
            ) : (
              <div>
                <strong>{lastRun.name}</strong>
                <p>{STATUS_LABELS[lastRun.status]}</p>
                <small>{new Date(lastRun.createdAt).toLocaleString("id-ID")}</small>
              </div>
            )}
          </Card>
        </aside>
      </div>
    </main>
  );
}
