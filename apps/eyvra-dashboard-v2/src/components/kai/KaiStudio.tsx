"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Drawer } from "@/components/common/Drawer";
import { LoadingState } from "@/components/common/LoadingState";
import {
  mapKaiBriefToViewModel,
  mapKaiConceptToCard,
  type KaiPackage,
  type KaiDetail,
} from "@/lib/kai-studio";
import type { ListingDto } from "@/types/dashboard.types";
import type { KaiProjectDetail } from "@/lib/kai-project";
import styles from "./KaiStudio.module.css";
import { KaiProductionWorkspace } from "./KaiProductionWorkspace";
import { Asset } from "./KaiMediaInspector";
import { KaiStudioHub } from "./KaiStudioHub";
import { KaiStudioNavigation, kaiView } from "./KaiStudioNavigation";
export function KaiStudio({ briefId }: { briefId?: string }) {
  const router = useRouter(),
    query = useSearchParams();
  const [packages, setPackages] = useState<KaiPackage[]>();
  const projectId = query.get("project");
  const [project, setProject] = useState<KaiProjectDetail>();
  const [projectError, setProjectError] = useState("");
  const [projectQueue, setProjectQueue] = useState<
    {
      id: string;
      briefId: string;
      title: string;
      objective: string;
      status: string;
      updatedAt: string;
    }[]
  >([]);
  const [queueError, setQueueError] = useState(false);
  const [error, setError] = useState(false),
    [revision, setRevision] = useState(0);
  const [details, setDetails] = useState<Record<string, KaiDetail>>({}),
    [detailLoading, setDetailLoading] = useState(false),
    [detailError, setDetailError] = useState(false),
    [detailRevision, setDetailRevision] = useState(0);
  const [listing, setListing] = useState<ListingDto>();
  const [search, setSearch] = useState("");
  const [help, setHelp] = useState(false),
    [assets, setAssets] = useState(false);
  useEffect(() => {
    if (!projectId) {
      setProject(undefined);
      return;
    }
    const controller = new AbortController();
    setProject(undefined);
    setProjectError("");
    fetch(`/api/creative/projects/${encodeURIComponent(projectId)}`, { signal: controller.signal })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.message);
        return data as KaiProjectDetail;
      })
      .then((data) => {
        if (!controller.signal.aborted) setProject(data);
      })
      .catch((e) => {
        if (!controller.signal.aborted)
          setProjectError(e instanceof Error ? e.message : "Proyek gagal dimuat");
      });
    return () => controller.abort();
  }, [projectId, revision]);
  useEffect(() => {
    const controller = new AbortController();
    setError(false);
    setQueueError(false);
    fetch("/api/creative/projects", { signal: controller.signal })
      .then(async (r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((data) => {
        if (!controller.signal.aborted) setProjectQueue(data.projects ?? []);
      })
      .catch(() => {
        if (!controller.signal.aborted) setQueueError(true);
      });
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
    project?.brief.briefId ??
    briefId ??
    query.get("brief") ??
    packages?.find((p) => p.id === query.get("package"))?.briefId;
  const legacyBrief = requestedBrief
    ? mapKaiBriefToViewModel(packages ?? [], requestedBrief)
    : undefined;
  const brief =
    project && legacyBrief
      ? {
          ...legacyBrief,
          title: project.brief.offer.primaryOffer ?? legacyBrief.title,
          listingId: project.brief.listingId,
          origin: project.brief.createdBy,
          createdAt: project.project.created_at,
          reason: project.brief.optimizationGoal,
          message: project.brief.creativeStrategy.preserve.join(" · "),
          angles: [
            ...project.brief.creativeStrategy.primaryAngles,
            ...project.brief.creativeStrategy.secondaryAngles,
          ],
        }
      : legacyBrief;
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
  const generating = concepts.some((c) => c.status === "Generating");
  useEffect(() => {
    if (!generating) return;
    const timer = setInterval(() => {
      setRevision((n) => n + 1);
      setDetailRevision((n) => n + 1);
    }, 5000);
    return () => clearInterval(timer);
  }, [generating]);
  const selected = concepts.find((c) => c.id === selectedId);
  function choose(id: string) {
    const params = new URLSearchParams(query.toString());
    params.set("concept", id);
    router.replace(`/kai-studio/${encodeURIComponent(requestedBrief!)}?${params}`, {
      scroll: false,
    });
  }
  function openBrief(id: string) {
    router.push(`/kai-studio/${encodeURIComponent(id)}`);
  }
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
    <main className={styles.page} data-project={!!requestedBrief}>
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
            <p>Agentic Creative Production · Image, Video & Carousel</p>
          </div>
        </div>
        <button onClick={() => setHelp(true)}>▷ How Kai Studio works</button>
      </header>
      <KaiStudioNavigation view={requestedBrief ? "projects" : kaiView(query.get("view"))} />
      {projectError ? (
        <section role="alert" className={styles.error}>
          <p>{projectError}</p>
          <button onClick={() => setRevision((n) => n + 1)}>Muat ulang proyek</button>
        </section>
      ) : projectId && !project ? (
        <LoadingState processLabel="Memuat brief dan proyek Kai…" />
      ) : error ? (
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
        <KaiStudioHub
          view={kaiView(query.get("view"))}
          packages={packages}
          projects={projectQueue}
          search={search}
          queueError={queueError}
          refresh={() => setRevision((n) => n + 1)}
        />
      ) : !brief || (!brief.concepts.length && !project) ? (
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
                  {project && b.id === brief.id ? brief.title : b.title}
                </option>
              ))}
              {project && !briefs.some((b) => b.id === brief.id) && (
                <option value={brief.id}>{brief.title}</option>
              )}
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
          <KaiProductionWorkspace
            key={brief.id}
            brief={brief}
            project={project}
            concepts={concepts}
            listing={listing}
            selected={selected}
            detail={selected ? details[selected.id] : undefined}
            detailLoading={detailLoading}
            detailError={detailError}
            onSelect={choose}
            onAssets={() => setAssets(true)}
            onRetry={() => setDetailRevision((n) => n + 1)}
          />
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
