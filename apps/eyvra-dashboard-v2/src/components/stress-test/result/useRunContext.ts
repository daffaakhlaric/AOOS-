"use client";
import { useEffect, useMemo, useState } from "react";
import type { StressTestRunDto } from "@/lib/stress-test";
import {
  parseListingContext,
  resolveCreativeInfo,
  type CreativeInfoResult,
  type ListingContext,
  type PackageLike,
} from "@/lib/stress-test-result";

export interface RunContext {
  readonly listing?: ListingContext;
  /** The real listing id this run relates to (the run's own, else its resolved package's / campaign's). */
  readonly listingId?: string;
  readonly creativeInfo: CreativeInfoResult;
  readonly loading: boolean;
}

function isPackageLike(v: unknown): v is PackageLike {
  return v !== null && typeof v === "object" && typeof (v as { id?: unknown }).id === "string";
}

/**
 * Loads real context for a run from EXISTING endpoints only: `/api/campaigns/[id]/workspace`
 * (creative packages + the campaign's real listing id) for campaign/package runs, and
 * `/api/listings/[id]` for the listing. Every failure degrades to "not available" — never a fallback
 * value.
 */
export function useRunContext(run: StressTestRunDto | undefined): RunContext {
  const [packages, setPackages] = useState<readonly PackageLike[] | undefined>();
  const [workspaceListingId, setWorkspaceListingId] = useState<string | undefined>();
  const [packagesDone, setPackagesDone] = useState(false);
  const [listing, setListing] = useState<ListingContext | undefined>();
  const [listingDone, setListingDone] = useState(false);

  const needsPackages =
    run !== undefined &&
    (run.sourceType === "CAMPAIGN" || run.sourceType === "CREATIVE_PACKAGE") &&
    run.campaignId !== undefined;
  // Keyed on the campaign id (not the run object) so polling a running run never re-fetches the workspace.
  const campaignId = run?.campaignId;

  useEffect(() => {
    setPackages(undefined);
    setWorkspaceListingId(undefined);
    setPackagesDone(false);
    if (!needsPackages || campaignId === undefined) {
      setPackagesDone(true);
      return;
    }
    const controller = new AbortController();
    fetch(`/api/campaigns/${encodeURIComponent(campaignId)}/workspace`, {
      signal: controller.signal,
    })
      .then(async (r) =>
        r.ok ? ((await r.json()) as { packages?: unknown; listingId?: unknown }) : undefined,
      )
      .then((body) => {
        if (controller.signal.aborted) return;
        if (body !== undefined && body !== null) {
          if (Array.isArray(body.packages)) setPackages(body.packages.filter(isPackageLike));
          if (typeof body.listingId === "string") setWorkspaceListingId(body.listingId);
        }
        setPackagesDone(true);
      })
      .catch(() => {
        if (!controller.signal.aborted) setPackagesDone(true);
      });
    return () => controller.abort();
  }, [campaignId, needsPackages]);

  const packageListingId = useMemo(() => {
    if (run === undefined || packages === undefined) return undefined;
    for (const id of run.creativeIds) {
      const pkg = packages.find((p) => p.id === id);
      if (pkg !== undefined) return pkg.listingId;
    }
    return undefined;
  }, [run, packages]);

  const listingId = run?.listingId ?? packageListingId ?? workspaceListingId;

  useEffect(() => {
    setListing(undefined);
    setListingDone(false);
    if (listingId === undefined) {
      setListingDone(true);
      return;
    }
    const controller = new AbortController();
    fetch(`/api/listings/${encodeURIComponent(listingId)}`, { signal: controller.signal })
      .then(async (r) => (r.ok ? ((await r.json()) as unknown) : undefined))
      .then((body) => {
        if (controller.signal.aborted) return;
        setListing(parseListingContext(body));
        setListingDone(true);
      })
      .catch(() => {
        if (!controller.signal.aborted) setListingDone(true);
      });
    return () => controller.abort();
  }, [listingId]);

  const creativeInfo = useMemo(
    () =>
      run === undefined
        ? { creatives: [] }
        : resolveCreativeInfo({
            sourceType: run.sourceType,
            creativeIds: run.creativeIds,
            ...(listing !== undefined ? { listing } : {}),
            ...(packages !== undefined ? { packages } : {}),
          }),
    [run, listing, packages],
  );

  return {
    ...(listing !== undefined ? { listing } : {}),
    ...(listingId !== undefined ? { listingId } : {}),
    creativeInfo,
    loading: !packagesDone || !listingDone,
  };
}
