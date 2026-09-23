"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Drawer } from "@/components/common/Drawer";
import { LoadingState } from "@/components/common/LoadingState";
import {
  mapKaiBriefToViewModel,
  mapKaiConceptToCard,
  batchProgress,
  productionSteps,
  type KaiPackage,
  type KaiDetail,
  type KaiConcept,
} from "@/lib/kai-studio";
import { presentLabel } from "@/lib/presentation";
import type { ListingDto } from "@/types/dashboard.types";
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
const subtitles = [
  "Production context",
  "Creative direction",
  "Visualise ideas",
  "Create assets",
  "Quality review",
  "Select creatives",
  "Live experiment",
  "Scale up",
];
function Status({ value }: { value: string }) {
  return (
    <span className={styles.status} data-status={value}>
      {value}
    </span>
  );
}
function Unavailable({ children }: { children: React.ReactNode }) {
  return <p className={styles.unavailable}>{children}</p>;
}
function Asset({
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
function Pipeline({ concepts }: { concepts: KaiConcept[] }) {
  return (
    <ol className={styles.pipeline} aria-label="Kai production pipeline">
      {productionSteps(concepts).map((step, i) => (
        <li key={step.label} data-state={step.state}>
          <span className={styles.stepNumber}>
            {step.state === "Completed" ? "✓" : step.state === "Failed" ? "!" : i + 1}
          </span>
          <span>
            <b>{step.label}</b>
            <small>{subtitles[i]}</small>
            <span className={styles.srOnly}> · {step.state}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}
function ConceptCard({
  concept,
  selected,
  onSelect,
  fallback,
}: {
  concept: KaiConcept;
  selected: boolean;
  onSelect: () => void;
  fallback?: string;
}) {
  return (
    <button className={styles.concept} aria-pressed={selected} onClick={onSelect}>
      <div className={styles.cardVisual}>
        <Asset
          urls={[concept.preview, concept.source, fallback]}
          name={concept.name}
          video={concept.pkg.videoUrl}
        />
        <span className={styles.cardStatus}>
          <Status value={concept.status} />
        </span>
        {selected && <span className={styles.selectedMark}>✓</span>}
        {!concept.preview && (
          <span className={styles.sourceLabel}>
            {concept.source || fallback ? "Source asset · not generated" : "Preview unavailable"}
          </span>
        )}
      </div>
      <div className={styles.cardInfo}>
        <b>
          <span>{concept.label}</span> {concept.name}
        </b>
        <small>
          {format(concept.format)} · {presentLabel(concept.angle)}
        </small>
        <small>
          Family: unavailable{" "}
          <span>QA {concept.qa.status === "Unavailable" ? "—" : concept.qa.status}</span>
        </small>
      </div>
    </button>
  );
}
function BriefPanel({
  brief,
  concepts,
  listing,
  onAssets,
}: {
  brief: ReturnType<typeof mapKaiBriefToViewModel>;
  concepts: KaiConcept[];
  listing?: ListingDto;
  onAssets: () => void;
}) {
  const stats = batchProgress(concepts);
  return (
    <section className={`${styles.panel} ${styles.brief}`}>
      <div className={styles.panelTitle}>
        <span>▤</span>
        <div>
          <h2>Kai Brief</h2>
          <p>
            From {presentLabel(brief.origin)} · {timestamp(brief.createdAt)}
          </p>
        </div>
      </div>
      <div className={styles.context}>
        <Asset urls={[listing?.mainPhotoUrl, concepts[0]?.source]} name={brief.title} />
        <dl>
          <dt>Context</dt>
          <dd>{listing?.title ?? brief.title}</dd>
          <dt>Reason</dt>
          <dd>{brief.reason || "Not specified"}</dd>
          <dt>Goal</dt>
          <dd>{brief.message || "Not specified"}</dd>
        </dl>
      </div>
      <blockquote>
        <span>“</span>
        <p>{brief.reason || brief.message || "No strategic message was included in this brief."}</p>
        <cite>— {presentLabel(brief.origin)}</cite>
      </blockquote>
      <div className={styles.strategy}>
        <section>
          <h3 className={styles.green}>✓ Preserve</h3>
          <Unavailable>No preservation instructions recorded.</Unavailable>
        </section>
        <section>
          <h3 className={styles.red}>× Avoid</h3>
          <Unavailable>No exclusions recorded.</Unavailable>
        </section>
        <section>
          <h3>✧ Explore</h3>
          {brief.angles.map((a) => (
            <p key={a}>• {presentLabel(a)}</p>
          ))}
        </section>
        <section>
          <h3>▧ Requested formats</h3>
          {brief.formats.map((f) => (
            <p key={f}>• {format(f)}</p>
          ))}
          <small>Aspect ratios follow generated assets.</small>
        </section>
      </div>
      <button className={styles.textButton} onClick={onAssets}>
        View source assets →
      </button>
      <div className={styles.batchSummary}>
        <h3>▧ Batch Summary</h3>
        <p>Brief {brief.id.slice(0, 8)}</p>
        <small>{timestamp(brief.createdAt)}</small>
        <div className={styles.batchStats}>
          {[
            ["Concepts", stats.total],
            ["Ready", stats.ready],
            ["Generating", stats.generating],
            ["QA review", stats.review],
          ].map(([label, value]) => (
            <div key={label}>
              <b>{value}</b>
              <small>{label}</small>
            </div>
          ))}
        </div>
        <small>
          Packages sharing this exact brief. Render variants are not counted as new concepts.
        </small>
      </div>
    </section>
  );
}
function Inspector({
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
export function KaiStudio({ briefId }: { briefId?: string }) {
  const router = useRouter(),
    query = useSearchParams();
  const [packages, setPackages] = useState<KaiPackage[]>();
  const [error, setError] = useState(false),
    [revision, setRevision] = useState(0);
  const [details, setDetails] = useState<Record<string, KaiDetail>>({}),
    [detailLoading, setDetailLoading] = useState(false),
    [detailError, setDetailError] = useState(false),
    [detailRevision, setDetailRevision] = useState(0);
  const [listing, setListing] = useState<ListingDto>();
  const [filter, setFilter] = useState("All"),
    [search, setSearch] = useState("");
  const [help, setHelp] = useState(false),
    [assets, setAssets] = useState(false),
    [inspectorOpen, setInspectorOpen] = useState(true),
    [mobile, setMobile] = useState("Creatives");
  useEffect(() => {
    const controller = new AbortController();
    setError(false);
    fetch("/api/creative?limit=200", { signal: controller.signal })
      .then(async (r) => {
        if (!r.ok) throw new Error();
        return r.json() as Promise<{ packages: KaiPackage[] }>;
      })
      .then((body) => {
        if (!controller.signal.aborted) setPackages(body.packages);
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(true);
      });
    return () => controller.abort();
  }, [revision]);
  const requestedBrief =
    briefId ?? query.get("brief") ?? packages?.find((p) => p.id === query.get("package"))?.briefId;
  const brief = requestedBrief ? mapKaiBriefToViewModel(packages ?? [], requestedBrief) : undefined;
  const requestedConcept = query.get("concept");
  const selectedId =
    brief?.concepts.find((p) => p.id === requestedConcept)?.id ?? brief?.concepts[0]?.id;
  useEffect(() => {
    if (!selectedId) return;
    const controller = new AbortController();
    setDetailLoading(true);
    setDetailError(false);
    fetch(`/api/creative/${encodeURIComponent(selectedId)}`, { signal: controller.signal })
      .then(async (r) => {
        if (!r.ok) throw new Error();
        return r.json() as Promise<KaiDetail>;
      })
      .then((body) => {
        if (!controller.signal.aborted) {
          setDetails((previous) => ({ ...previous, [selectedId]: body }));
          setDetailLoading(false);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setDetailError(true);
          setDetailLoading(false);
        }
      });
    return () => controller.abort();
  }, [selectedId, detailRevision]);
  useEffect(() => {
    setListing(undefined);
    if (!brief?.listingId) return;
    const controller = new AbortController();
    fetch(`/api/listings/${encodeURIComponent(brief.listingId)}`, { signal: controller.signal })
      .then(async (r) => (r.ok ? (r.json() as Promise<ListingDto>) : undefined))
      .then((value) => {
        if (!controller.signal.aborted) setListing(value);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [brief?.listingId]);
  const concepts = (brief?.concepts ?? []).map((p) =>
    mapKaiConceptToCard(details[p.id]?.package ?? p, details[p.id]),
  );
  const selected = concepts.find((c) => c.id === selectedId);
  const index = concepts.findIndex((c) => c.id === selectedId);
  const stats = batchProgress(concepts);
  function choose(id: string) {
    const params = new URLSearchParams(query.toString());
    params.set("concept", id);
    router.replace(`/kai-studio/${encodeURIComponent(requestedBrief!)}?${params}`, {
      scroll: false,
    });
    setInspectorOpen(true);
    setMobile("Inspector");
  }
  function openBrief(id: string) {
    setFilter("All");
    setInspectorOpen(true);
    setMobile("Creatives");
    router.push(`/kai-studio/${encodeURIComponent(id)}`);
  }
  const visible = concepts.filter((c) =>
    filter === "All" || filter === "Rejected"
      ? filter === "All" ||
        c.status === "Rejected" ||
        c.status === "QA Failed" ||
        c.status === "Generation failed"
      : filter === "Ready"
        ? c.status === "Ready" || c.status === "Published"
        : c.status === filter,
  );
  const briefs = [...new Set((packages ?? []).map((p) => p.briefId))]
    .map((id) => mapKaiBriefToViewModel(packages ?? [], id))
    .filter((b) => `${b.title} ${b.reason}`.toLowerCase().includes(search.toLowerCase()));
  const sources = [
    ...new Set(
      concepts
        .flatMap((c) => c.pkg.sourcePhotoUrls ?? [])
        .concat(listing?.photos?.map((p) => p.url) ?? []),
    ),
  ];
  return (
    <main className={styles.page}>
      <div className={styles.topline}>
        <Link href="/command-center">← Command Center</Link>
        <input
          aria-label="Find production brief"
          placeholder="Find a production brief…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            if (requestedBrief) router.push("/kai-studio");
          }}
        />
        <span>Creative operations</span>
      </div>
      <header className={styles.header}>
        <div>
          <span className={styles.kaiMark}>✧</span>
          <div>
            <h1>Kai Studio</h1>
            <p>Creative production workspace managed by Kai.</p>
          </div>
        </div>
        <button onClick={() => setHelp(true)}>▷ How Kai Studio works</button>
      </header>
      <Pipeline concepts={concepts} />
      {error ? (
        <div role="alert" className={styles.error}>
          <h2>Production data could not be loaded</h2>
          <p>Your creative packages have not been changed.</p>
          <button onClick={() => setRevision((n) => n + 1)}>Retry production data</button>
        </div>
      ) : !packages ? (
        <div className={styles.layout}>
          {["Loading Kai brief…", "Loading concepts…", "Loading inspector…"].map((label) => (
            <section className={styles.panel} key={label}>
              <LoadingState processLabel={label} />
              <div className={styles.skeleton} />
            </section>
          ))}
        </div>
      ) : !requestedBrief ? (
        <>
          <div className={styles.queueHead}>
            <h2>Production queue</h2>
            <small>{briefs.length} briefs · latest 200 packages</small>
            <button onClick={() => setRevision((n) => n + 1)}>Refresh</button>
          </div>
          {briefs.length ? (
            <div className={styles.queue}>
              {briefs.map((b) => {
                const cards = b.concepts.map((p) => mapKaiConceptToCard(p));
                const counts = batchProgress(cards);
                return (
                  <button key={b.id} onClick={() => openBrief(b.id)}>
                    <Asset urls={[cards[0]?.preview, cards[0]?.source]} name={b.title} />
                    <div>
                      <h3>{b.title}</h3>
                      <p>{b.reason || "Creative production"}</p>
                      <small>{timestamp(b.createdAt)}</small>
                      <div>
                        <Status value={cards[0]?.status ?? "Planning"} />
                        <span>
                          {counts.ready}/{counts.total} ready
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <section className={styles.empty}>
              <h2>No active creative production</h2>
              <p>
                Kai receives a brief when a campaign needs new creative, a refresh, or an expansion.
              </p>
              <Link href="/campaigns">Open Campaigns to prepare a creative brief →</Link>
            </section>
          )}
        </>
      ) : !brief?.concepts.length ? (
        <section className={styles.empty}>
          <h2>Brief not found in the production queue</h2>
          <p>This view covers the latest 200 packages available to your account.</p>
          <Link href="/kai-studio">Back to production queue</Link>
        </section>
      ) : (
        <>
          <div className={styles.contextBar}>
            <Link href="/kai-studio">← Production queue</Link>
            <select
              aria-label="Select Kai brief"
              value={brief.id}
              onChange={(e) => openBrief(e.target.value)}
            >
              {briefs.map((b) => (
                <option value={b.id} key={b.id}>
                  {b.title}
                </option>
              ))}
            </select>
            <small>{concepts.length} concepts</small>
            <button
              onClick={() => {
                setRevision((n) => n + 1);
                setDetailRevision((n) => n + 1);
              }}
            >
              Refresh status
            </button>
          </div>
          <nav className={styles.mobileTabs} aria-label="Kai workspace panels">
            {["Brief", "Creatives", "Inspector"].map((label) => (
              <button
                aria-pressed={mobile === label}
                key={label}
                onClick={() => {
                  setMobile(label);
                  if (label === "Inspector") setInspectorOpen(true);
                }}
              >
                {label}
              </button>
            ))}
          </nav>
          <div
            className={`${styles.layout} ${!inspectorOpen ? styles.collapsed : ""}`}
            data-mobile={mobile}
          >
            <div className={styles.briefColumn}>
              <BriefPanel
                brief={brief}
                concepts={concepts}
                listing={listing}
                onAssets={() => setAssets(true)}
              />
            </div>
            <section className={`${styles.panel} ${styles.workspace}`}>
              <div className={styles.workspaceTitle}>
                <div>
                  <h2>▧ Creative Workspace</h2>
                  <p>Review visual concepts and production evidence.</p>
                </div>
                <div className={styles.viewModes}>
                  <button aria-pressed="true">▦ Grid</button>
                  <button disabled title="Compare mode is planned after this workspace review">
                    Compare
                  </button>
                  <button disabled title="Focus mode is planned after this workspace review">
                    Focus
                  </button>
                </div>
              </div>
              <div className={styles.filters}>
                {["All", "Ready", "Generating", "QA Review", "Rejected"].map((label) => (
                  <button
                    key={label}
                    aria-pressed={filter === label}
                    onClick={() => setFilter(label)}
                  >
                    {label}{" "}
                    <span>
                      {label === "All"
                        ? concepts.length
                        : label === "Ready"
                          ? stats.ready
                          : label === "Generating"
                            ? stats.generating
                            : label === "QA Review"
                              ? stats.review
                              : concepts.filter((c) =>
                                  ["Rejected", "QA Failed", "Generation failed"].includes(c.status),
                                ).length}
                    </span>
                  </button>
                ))}
              </div>
              {!visible.length ? (
                <div className={styles.empty}>
                  <h3>No concepts match this filter</h3>
                  <button onClick={() => setFilter("All")}>Show all concepts</button>
                </div>
              ) : (
                <div className={styles.grid}>
                  {visible.map((c) => (
                    <ConceptCard
                      key={c.id}
                      concept={c}
                      selected={selectedId === c.id}
                      onSelect={() => choose(c.id)}
                      fallback={
                        c.pkg.listingId === brief.listingId ? listing?.mainPhotoUrl : undefined
                      }
                    />
                  ))}
                </div>
              )}
              <div className={styles.batchProgress}>
                <b>▧ Batch Progress</b>
                <span>
                  {stats.ready}/{stats.total} ready · {stats.generating} generating · {stats.review}{" "}
                  under review
                </span>
                <strong>{stats.percent}%</strong>
                <progress
                  aria-label="Batch ready progress"
                  value={stats.ready}
                  max={stats.total || 1}
                />
              </div>
              {!inspectorOpen && (
                <button onClick={() => setInspectorOpen(true)}>Open inspector →</button>
              )}
            </section>
            {selected && inspectorOpen && (
              <div className={styles.inspectorColumn}>
                <Inspector
                  concept={selected}
                  detail={details[selected.id]}
                  loading={detailLoading}
                  error={detailError}
                  fallback={
                    selected.pkg.listingId === brief.listingId ? listing?.mainPhotoUrl : undefined
                  }
                  previousDisabled={index <= 0}
                  nextDisabled={index >= concepts.length - 1}
                  onPrevious={() => {
                    const c = concepts[index - 1];
                    if (c) choose(c.id);
                  }}
                  onNext={() => {
                    const c = concepts[index + 1];
                    if (c) choose(c.id);
                  }}
                  onClose={() => {
                    setInspectorOpen(false);
                    setMobile("Creatives");
                  }}
                  onRetry={() => setDetailRevision((n) => n + 1)}
                />
              </div>
            )}
          </div>
        </>
      )}
      <Drawer open={help} onClose={() => setHelp(false)} title="How Kai Studio works">
        <ol>
          <li>A production brief defines the direction and source assets.</li>
          <li>
            Each creative package is shown as one concept; its images and video remain render
            variants.
          </li>
          <li>Production status and recorded technical QA appear in the inspector.</li>
          <li>
            Review and publishing happen through the connected production workflow. This first
            workspace does not launch generation or publish ads.
          </li>
        </ol>
        <p>
          Property fidelity is not inferred from technical QA. Missing measurements are shown
          explicitly.
        </p>
      </Drawer>
      <Drawer open={assets} onClose={() => setAssets(false)} title="Source assets">
        <p>Original assets linked to this brief. These are not generated creative variants.</p>
        {sources.length ? (
          <div className={styles.sourceGrid}>
            {sources.map((url, i) => (
              <Asset key={url} urls={[url]} name={`Source asset ${i + 1}`} />
            ))}
          </div>
        ) : (
          <p>No source assets have been recorded.</p>
        )}
      </Drawer>
    </main>
  );
}
