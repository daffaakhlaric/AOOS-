"use client";
import { useEffect, useState } from "react";
import { Drawer } from "@/components/common/Drawer";
import type { KaiConcept, KaiDetail } from "@/lib/kai-studio";
import { presentLabel } from "@/lib/presentation";
import styles from "./KaiStudio.module.css";
const timestamp = (value?: string) =>
  value
    ? new Date(value).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })
    : "Unavailable";
const format = (value?: string) =>
  value === "VIDEO_AND_IMAGES"
    ? "Video + images"
    : value === "IMAGES_ONLY"
      ? "Images"
      : value
        ? presentLabel(value)
        : "Unavailable";
export function Status({ value }: { value: string }) {
  return (
    <span className={styles.status} data-status={value}>
      {value}
    </span>
  );
}
function Unavailable({ children }: { children: React.ReactNode }) {
  return <p className={styles.unavailable}>{children}</p>;
}
export function Asset({
  urls,
  name,
  video,
  play = false,
  onRatio,
}: {
  urls: (string | undefined)[];
  name: string;
  video?: string;
  play?: boolean;
  onRatio?: (ratio: string) => void;
}) {
  const [failed, setFailed] = useState<string[]>([]);
  const url = urls.find((u) => u && !failed.includes(u));
  return (
    <div className={styles.asset}>
      {video && play && !failed.includes(video) ? (
        <video
          controls
          preload="metadata"
          poster={url}
          src={video}
          aria-label={name}
          onError={() => setFailed((a) => [...a, video])}
        />
      ) : url ? (
        // eslint-disable-next-line @next/next/no-img-element -- persisted media, with ordered fallbacks
        <img
          src={url}
          alt={name}
          loading="lazy"
          onError={() => setFailed((a) => [...a, url])}
          onLoad={(e) => {
            const { naturalWidth: w, naturalHeight: h } = e.currentTarget;
            const ratio = [
              [1, 1],
              [4, 5],
              [9, 16],
              [16, 9],
            ].find(([a, b]) => a && b && Math.abs(w / h - a / b) < 0.02);
            onRatio?.(ratio ? ratio.join(":") : `${w} × ${h}`);
          }}
        />
      ) : (
        <div className={styles.mediaEmpty}>
          <span>▧</span>
          <small>{video ? "Video preview unavailable" : "No preview yet"}</small>
        </div>
      )}
      {video && !play && (
        <span className={styles.play} aria-hidden="true">
          ▶
        </span>
      )}
    </div>
  );
}
export function Inspector({
  concept,
  detail,
  loading,
  error,
  fallback,
  onPrevious,
  onNext,
  onClose,
  onRetry,
  previousDisabled,
  nextDisabled,
}: {
  concept: KaiConcept;
  detail?: KaiDetail;
  loading: boolean;
  error: boolean;
  fallback?: string;
  onPrevious: () => void;
  onNext: () => void;
  onClose: () => void;
  onRetry: () => void;
  previousDisabled: boolean;
  nextDisabled: boolean;
}) {
  const [variant, setVariant] = useState(0);
  const [ratio, setRatio] = useState<string>();
  const [metadata, setMetadata] = useState(false);
  useEffect(() => {
    setVariant(0);
    setRatio(undefined);
  }, [concept.id]);
  const selected = concept.media[variant];
  const pkg = concept.pkg;
  return (
    <section className={`${styles.panel} ${styles.inspector}`} aria-label="Creative inspector">
      <div className={styles.inspectorHead}>
        <h2>▧ Inspector</h2>
        <div>
          <button aria-label="Previous creative" disabled={previousDisabled} onClick={onPrevious}>
            ←
          </button>
          <button aria-label="Next creative" disabled={nextDisabled} onClick={onNext}>
            →
          </button>
          <button aria-label="Collapse inspector" onClick={onClose}>
            ×
          </button>
        </div>
      </div>
      <div className={styles.conceptHeading}>
        <b>{concept.label}</b>
        <h3>{concept.name}</h3>
        <Status value={concept.status} />
      </div>
      <div className={styles.inspectorTop}>
        <div>
          <Asset
            key={`${concept.id}-${variant}`}
            urls={[
              selected?.kind === "image" ? selected.url : concept.preview,
              concept.source,
              fallback,
            ]}
            video={selected?.kind === "video" ? selected.url : undefined}
            play
            name={concept.name}
            onRatio={setRatio}
          />
          <small>
            {selected
              ? `${selected.label}${ratio ? ` · ${ratio}` : ""}`
              : "Source preview · not generated"}
          </small>
        </div>
        <div>
          <h3>✧ Concept hypothesis</h3>
          <Unavailable>Concept hypothesis unavailable.</Unavailable>
          <dl className={styles.metadata}>
            <dt>Persona</dt>
            <dd>{pkg.targetPersona ? presentLabel(pkg.targetPersona) : "Unavailable"}</dd>
            <dt>Angle</dt>
            <dd>{presentLabel(pkg.angle)}</dd>
            <dt>Format</dt>
            <dd>{format(concept.format)}</dd>
            <dt>Model used</dt>
            <dd>{pkg.aiModel ?? "Not recorded"}</dd>
            <dt>Why selected</dt>
            <dd>Routing reason unavailable</dd>
          </dl>
        </div>
      </div>
      <div className={styles.qualityMetrics}>
        {["Property fidelity", "Architecture integrity", "QA score"].map((label) => (
          <div key={label}>
            <small>{label}</small>
            <b>—</b>
            <span>Not measured</span>
          </div>
        ))}
      </div>
      <div className={styles.qa}>
        <div className={styles.panelTitle}>
          <h3>Quality assurance</h3>
          <Status value={loading ? "Loading" : concept.qa.status} />
        </div>
        {error ? (
          <p role="status">
            QA details could not be loaded. <button onClick={onRetry}>Retry details</button>
          </p>
        ) : loading ? (
          <p>Loading QA evidence…</p>
        ) : concept.qa.status === "Unavailable" ? (
          <Unavailable>No structured QA result was recorded for this package.</Unavailable>
        ) : (
          <>
            <p>
              {concept.qa.status === "Passed"
                ? "Technical media checks passed."
                : "Technical media checks failed."}{" "}
              {concept.qa.at ? timestamp(concept.qa.at) : ""}
            </p>
            {concept.qa.checks.map((check, i) => (
              <p key={i} className={!check.passed ? styles.red : undefined}>
                {check.passed ? "✓" : "×"} {presentLabel(check.name)}
                <small>{check.detail}</small>
              </p>
            ))}
          </>
        )}
        <small>
          Technical QA checks file validity and dimensions. Property appearance and architecture
          have not been verified.
        </small>
      </div>
      {pkg.status === "FAILED" && (
        <div className={styles.failure}>
          <b>{concept.qa.status === "Failed" ? "QA failed" : "Generation did not complete"}</b>
          <p>
            {concept.qa.status === "Failed"
              ? "Review the recorded checks before retrying production."
              : "The provider did not return a completed creative. No automatic retry is claimed."}
          </p>
        </div>
      )}
      <div className={styles.smallMeta}>
        <div>
          <small>Prompt version</small>
          <b>Not recorded</b>
        </div>
        <div>
          <small>Actual render time</small>
          <b>{pkg.generationMs === undefined ? "—" : `${(pkg.generationMs / 1000).toFixed(1)}s`}</b>
        </div>
        <div>
          <small>Generation cost</small>
          <b>Not recorded</b>
        </div>
        <div>
          <small>Review</small>
          <b>{pkg.reviewedAt ? timestamp(pkg.reviewedAt) : "Pending"}</b>
        </div>
      </div>
      <section className={styles.variants}>
        <h3>▧ Render variants</h3>
        {concept.media.length ? (
          <div>
            {concept.media.map((asset, i) => (
              <button
                key={asset.id}
                aria-label={`Select ${asset.label}`}
                aria-pressed={variant === i}
                onClick={() => {
                  setVariant(i);
                  setRatio(undefined);
                }}
              >
                <Asset
                  urls={[asset.kind === "image" ? asset.url : concept.preview, concept.source]}
                  video={asset.kind === "video" ? asset.url : undefined}
                  name={asset.label}
                />
                <small>{asset.label}</small>
              </button>
            ))}
          </div>
        ) : (
          <Unavailable>No generated render variants yet.</Unavailable>
        )}
      </section>
      <section className={styles.lineage}>
        <h3>◇ Creative lineage</h3>
        <ol>
          {[
            [`${presentLabel(pkg.origin)} brief`, pkg.briefId.slice(0, 8)],
            ["Kai concept", concept.label],
            ["Generation", pkg.aiModel ?? "Not recorded"],
            ["QA review", concept.qa.status],
            [
              "Meta creative",
              pkg.publishedMetaAdIds?.length
                ? `${pkg.publishedMetaAdIds.length} linked ads`
                : "Not published",
            ],
          ].map(([label, value]) => (
            <li key={label}>
              <b>{label}</b>
              <small>{value}</small>
            </li>
          ))}
        </ol>
      </section>
      <button className={styles.textButton} onClick={() => setMetadata(true)}>
        View production details →
      </button>
      <Drawer open={metadata} onClose={() => setMetadata(false)} title="Production details">
        <dl className={styles.metadata}>
          <dt>Package</dt>
          <dd>{pkg.id}</dd>
          <dt>Brief</dt>
          <dd>{pkg.briefId}</dd>
          <dt>Listing</dt>
          <dd>{pkg.listingId ?? "Not linked"}</dd>
          <dt>Meta ads</dt>
          <dd>{pkg.publishedMetaAdIds?.join(", ") || "Not linked"}</dd>
        </dl>
        <h3>Copy variants</h3>
        {pkg.copyVariants?.map((copy) => (
          <article key={copy.id}>
            <h4>
              {copy.variantLabel} · {copy.headline}
            </h4>
            <p>{copy.primaryText}</p>
          </article>
        ))}
        <h3>Production history</h3>
        {detail?.logs.length ? (
          detail.logs.map((log) => (
            <p key={log.id}>
              <b>{presentLabel(log.eventType)}</b> · {timestamp(log.createdAt)}
            </p>
          ))
        ) : (
          <p>No production events recorded.</p>
        )}
      </Drawer>
    </section>
  );
}
