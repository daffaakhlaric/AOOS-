"use client";

import { useCallback, useEffect, useState } from "react";

import { TopBar } from "@/components/layout/TopBar";
import { ErrorCard } from "@/components/ui/ErrorCard";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import type { ListingDto, ListingListDto } from "@/types/listing.types";

import { ListingCard } from "./ListingCard";
import styles from "./ListingsClient.module.css";
import { ListingModal } from "./ListingModal";

/**
 * `/listings` — Listing Manager (spec Part 4), PROPERTY vertical's real replacement for Scraper
 * Mobix. KPI strip (TOTAL LISTING / AKTIF / FOTO / TERJUAL), search + status filter, grid of
 * `ListingCard`s, `[+ Tambah Listing]` opening `ListingModal`.
 */
export function ListingsClient(): React.ReactElement {
  const [data, setData] = useState<ListingListDto | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingListing, setEditingListing] = useState<ListingDto | undefined>(undefined);

  const load = useCallback(() => {
    const params = new URLSearchParams();
    if (search.trim().length > 0) {
      params.set("search", search.trim());
    }
    if (statusFilter.length > 0) {
      params.set("status", statusFilter);
    }
    const qs = params.toString();
    fetch(`/api/listings${qs.length > 0 ? `?${qs}` : ""}`)
      .then(async (res) => {
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
          throw new Error(body.error?.message ?? "Gagal memuat listing.");
        }
        return (await res.json()) as ListingListDto;
      })
      .then(setData)
      .catch((caught: unknown) => {
        setError(caught instanceof Error ? caught.message : "Gagal memuat listing.");
      });
  }, [search, statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  if (error !== undefined) {
    return <ErrorCard message={error} />;
  }
  if (data === undefined) {
    return <LoadingSpinner />;
  }

  const totalListing = data.total;
  const aktif = data.listings.filter((l) => l.listingStatus === "AKTIF").length;
  const totalFoto = data.listings.reduce((sum, l) => sum + l.photos.length, 0);
  const terjual = data.listings.filter((l) => l.listingStatus === "TERJUAL").length;

  return (
    <main>
      <TopBar title="Listing Manager" />
      <div className={styles.page}>
        <section data-testid="listing-kpi" className={styles.kpiStrip}>
          <Kpi label="TOTAL LISTING" value={totalListing} />
          <Kpi label="AKTIF" value={aktif} />
          <Kpi label="FOTO" value={totalFoto} />
          <Kpi label="TERJUAL" value={terjual} />
        </section>

        <div className={styles.toolbar}>
          <button
            type="button"
            className={styles.primaryButton}
            onClick={() => {
              setEditingListing(undefined);
              setShowModal(true);
            }}
          >
            + Tambah Listing
          </button>
          <input
            className={styles.searchInput}
            placeholder="🔍 Cari..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className={styles.filterSelect}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">Semua</option>
            <option value="AKTIF">AKTIF</option>
            <option value="DISEWAKAN">DISEWAKAN</option>
            <option value="TERJUAL">TERJUAL</option>
            <option value="DRAFT">DRAFT</option>
          </select>
        </div>

        {data.listings.length === 0 ? (
          <p className={styles.emptyState}>Belum ada listing.</p>
        ) : (
          <div className={styles.grid}>
            {data.listings.map((listing) => (
              <ListingCard
                key={listing.id}
                listing={listing}
                onEdit={() => {
                  setEditingListing(listing);
                  setShowModal(true);
                }}
              />
            ))}
          </div>
        )}
      </div>

      {showModal ? (
        <ListingModal
          editing={editingListing}
          onClose={() => setShowModal(false)}
          onSaved={() => {
            load();
          }}
        />
      ) : null}
    </main>
  );
}

function Kpi({
  label,
  value,
}: {
  readonly label: string;
  readonly value: number;
}): React.ReactElement {
  return (
    <div className={styles.kpi}>
      <span className={styles.kpiLabel}>{label}</span>
      <span className={styles.kpiValue}>{value}</span>
    </div>
  );
}
