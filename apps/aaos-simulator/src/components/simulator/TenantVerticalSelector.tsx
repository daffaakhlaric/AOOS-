"use client";

import { useEffect, useState } from "react";

import type {
  FetchActiveListingsResponse,
  FetchTenantsResponse,
  ListingSummaryDto,
  TenantSummaryDto,
} from "@/types/simulator.types";

/** The real, resolved selection this component hands back to its parent — never fabricated, always sourced from a real fetch. */
export interface TenantVerticalSelection {
  readonly tenantId: string;
  readonly vertical: "AUTOMOTIVE" | "PROPERTY";
  readonly listingId?: string;
}

export interface TenantVerticalSelectorProps {
  /**
   * `AAOS_SIMULATOR_TENANT_ID` (server env, forwarded down from a Server Component page) — an
   * honest DEFAULT/fallback for this selector's initial pick only, per the task's explicit
   * instruction. It is never the only real value used: once the real tenant list loads, the
   * selector picks a matching real row (or the first real row when there's no match/no default),
   * and the user can change it freely from there.
   */
  readonly defaultTenantId?: string;
  /** Called with the current real selection, or `undefined` while no tenant is resolved yet (e.g. still loading, or the real tenant list came back empty/failed). */
  readonly onSelectionChange: (selection: TenantVerticalSelection | undefined) => void;
}

/**
 * Real tenant + vertical + (PROPERTY-only) listing selector (this task — replaces the
 * `AAOS_SIMULATOR_TENANT_ID`-only hardcode and the silent default-to-AUTOMOTIVE behavior).
 *
 * TENANT SOURCE: `GET /api/tenants`, a thin proxy to `apps/aaos-api`'s real
 * `GET /api/v1/superadmin/tenants` (`src/lib/aaos-api-client.ts`'s `fetchTenants`) — never a
 * hardcoded list; a failed/misconfigured real call renders an honest error message, never a
 * fallback list.
 *
 * VERTICAL SOURCE: NOT a separate picker. Real investigation finding (`apps/aaos-api`'s own
 * `TenantResponseDto`): the real data model fixes exactly ONE `vertical` per tenant row — a tenant
 * is never ambiguous between AUTOMOTIVE/PROPERTY. The vertical shown here is simply the selected
 * tenant's own real `vertical` field, auto-resolved, not user-chosen.
 *
 * LISTING SOURCE (PROPERTY only): `GET /api/listings?tenantId=...`, a thin proxy to
 * `apps/aaos-api`'s real `GET /api/v1/listings?status=AKTIF` (`fetchActiveListings`) — same
 * never-fabricated discipline; an honest "Tidak ada listing aktif" empty state when the real list
 * is empty, never a hardcoded listing.
 */
export function TenantVerticalSelector({
  defaultTenantId,
  onSelectionChange,
}: TenantVerticalSelectorProps): React.ReactElement {
  const [tenants, setTenants] = useState<readonly TenantSummaryDto[] | undefined>(undefined);
  const [tenantsError, setTenantsError] = useState<string | undefined>(undefined);
  const [tenantsLoading, setTenantsLoading] = useState(true);
  const [selectedTenantId, setSelectedTenantId] = useState<string | undefined>(undefined);

  const [listings, setListings] = useState<readonly ListingSummaryDto[] | undefined>(undefined);
  const [listingsError, setListingsError] = useState<string | undefined>(undefined);
  const [listingsLoading, setListingsLoading] = useState(false);
  const [selectedListingId, setSelectedListingId] = useState<string | undefined>(undefined);

  // Real tenant list fetch, once on mount.
  useEffect(() => {
    let cancelled = false;
    async function loadTenants(): Promise<void> {
      setTenantsLoading(true);
      setTenantsError(undefined);
      try {
        const response = await fetch("/api/tenants");
        const result = (await response.json()) as FetchTenantsResponse;
        if (cancelled) {
          return;
        }
        if (!result.ok) {
          setTenantsError(result.reason);
          setTenants(undefined);
          return;
        }
        setTenants(result.tenants);
        const initial =
          result.tenants.find((t) => t.tenantId === defaultTenantId) ?? result.tenants[0];
        setSelectedTenantId(initial?.tenantId);
      } catch {
        if (!cancelled) {
          setTenantsError("Gagal terhubung ke server.");
        }
      } finally {
        if (!cancelled) {
          setTenantsLoading(false);
        }
      }
    }
    void loadTenants();
    return () => {
      cancelled = true;
    };
    // Only ever re-runs if the server-provided default itself changes (effectively never, in practice).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultTenantId]);

  const selectedTenant = tenants?.find((t) => t.tenantId === selectedTenantId);

  // Real active-listing fetch whenever the selected tenant is PROPERTY.
  useEffect(() => {
    setSelectedListingId(undefined);
    setListings(undefined);
    setListingsError(undefined);
    if (selectedTenant === undefined || selectedTenant.vertical !== "PROPERTY") {
      setListingsLoading(false);
      return;
    }
    let cancelled = false;
    async function loadListings(tenantId: string): Promise<void> {
      setListingsLoading(true);
      try {
        const response = await fetch(`/api/listings?tenantId=${encodeURIComponent(tenantId)}`);
        const result = (await response.json()) as FetchActiveListingsResponse;
        if (cancelled) {
          return;
        }
        if (!result.ok) {
          setListingsError(result.reason);
          return;
        }
        setListings(result.listings);
        setSelectedListingId(result.listings[0]?.id);
      } catch {
        if (!cancelled) {
          setListingsError("Gagal terhubung ke server.");
        }
      } finally {
        if (!cancelled) {
          setListingsLoading(false);
        }
      }
    }
    void loadListings(selectedTenant.tenantId);
    return () => {
      cancelled = true;
    };
  }, [selectedTenant]);

  // Reports the current real selection up to the parent.
  useEffect(() => {
    if (selectedTenant === undefined) {
      onSelectionChange(undefined);
      return;
    }
    onSelectionChange({
      tenantId: selectedTenant.tenantId,
      vertical: selectedTenant.vertical,
      ...(selectedListingId !== undefined ? { listingId: selectedListingId } : {}),
    });
    // `onSelectionChange` is expected to be a stable callback from the parent (matches the
    // established convention of every other callback-prop component in this codebase, e.g.
    // `PersonaSelector`'s `onSelect`).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTenant, selectedListingId]);

  return (
    <div className="flex flex-col gap-3 rounded-card border border-hairline bg-surface-card p-4 shadow-card">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Tenant</h2>

      {tenantsLoading && (
        <p className="text-sm text-ink-muted" data-testid="tenant-selector-loading">
          Memuat daftar tenant...
        </p>
      )}

      {!tenantsLoading && tenantsError !== undefined && (
        <p role="alert" className="text-sm text-brand-danger" data-testid="tenant-selector-error">
          Gagal memuat daftar tenant: {tenantsError}
        </p>
      )}

      {!tenantsLoading && tenantsError === undefined && tenants !== undefined && (
        <>
          {tenants.length === 0 ? (
            <p className="text-sm text-ink-muted" data-testid="tenant-selector-empty">
              Tidak ada tenant yang ditemukan.
            </p>
          ) : (
            <select
              data-testid="tenant-select"
              className="rounded-button border border-hairline bg-surface-base px-3 py-2 text-sm text-ink"
              value={selectedTenantId ?? ""}
              onChange={(event) => setSelectedTenantId(event.target.value)}
            >
              {tenants.map((tenant) => (
                <option key={tenant.tenantId} value={tenant.tenantId}>
                  {tenant.name} ({tenant.tenantId})
                </option>
              ))}
            </select>
          )}

          {selectedTenant !== undefined && (
            <p className="text-xs text-ink-muted" data-testid="vertical-badge">
              Vertical: <span className="font-semibold">{selectedTenant.vertical}</span>
            </p>
          )}
        </>
      )}

      {selectedTenant?.vertical === "PROPERTY" && (
        <div className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Listing</h3>
          {listingsLoading && (
            <p className="text-sm text-ink-muted" data-testid="listing-selector-loading">
              Memuat daftar listing...
            </p>
          )}
          {!listingsLoading && listingsError !== undefined && (
            <p
              role="alert"
              className="text-sm text-brand-danger"
              data-testid="listing-selector-error"
            >
              Gagal memuat daftar listing: {listingsError}
            </p>
          )}
          {!listingsLoading && listingsError === undefined && listings !== undefined && (
            <>
              {listings.length === 0 ? (
                <p className="text-sm text-ink-muted" data-testid="listing-selector-empty">
                  Tidak ada listing aktif untuk tenant ini.
                </p>
              ) : (
                <select
                  data-testid="listing-select"
                  className="rounded-button border border-hairline bg-surface-base px-3 py-2 text-sm text-ink"
                  value={selectedListingId ?? ""}
                  onChange={(event) => setSelectedListingId(event.target.value)}
                >
                  {listings.map((listing) => (
                    <option key={listing.id} value={listing.id}>
                      {listing.title}
                    </option>
                  ))}
                </select>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
