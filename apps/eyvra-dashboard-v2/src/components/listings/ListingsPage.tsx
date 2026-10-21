"use client";
import { useEffect, useState, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { Drawer } from "@/components/common/Drawer";
import { NavIcon } from "@/components/layout/NavIcon";
import {
  mapListingToListItem,
  filterListings,
  propertyLabels,
  listingStatusLabels,
  readinessLabels,
  compactPrice,
  type ListingInventory,
  type ListingFilters,
  type ListingItem,
} from "@/lib/listings";
import type { GrowthObjectiveResponseDto } from "@/types/dashboard.types";
import { SamanthaListingPanel } from "./SamanthaListingPanel";
import { ListingThumbnail } from "./ListingThumbnail";
import styles from "./Listings.module.css";
const initialFilters: ListingFilters = {
  search: "",
  area: "",
  status: "",
  type: "",
  price: "",
  readiness: "",
  campaign: "",
};
function ListingRow({
  item,
  selected,
  onSelect,
  onMore,
}: {
  item: ListingItem;
  selected: boolean;
  onSelect: () => void;
  onMore: () => void;
}) {
  return (
    <article className={styles.row} data-selected={selected}>
      <button
        className={styles.rowSelect}
        aria-pressed={selected}
        aria-label={`Analisis ${item.listing.title}`}
        onClick={onSelect}
      >
        <ListingThumbnail
          urls={item.images}
          title={item.listing.title}
          count={item.listing.photos.length}
        />
        <div className={styles.propertyInfo}>
          <h3>{item.listing.title}</h3>
          <p>⌖ {item.location}</p>
          <div className={styles.propertyMeta}>
            {item.metadata.slice(0, 3).map((text, i) => (
              <span key={i}>{text}</span>
            ))}
          </div>
          <small>
            {item.type} ·{" "}
            {listingStatusLabels[item.listing.listingStatus] ?? "Status belum diketahui"}
          </small>
        </div>
        <div className={styles.price}>
          <b>{item.price}</b>
          {item.perSquare !== undefined && (
            <small>
              {compactPrice(item.perSquare)}/m² {item.areaBasis}
            </small>
          )}
        </div>
        <div className={styles.readiness}>
          <span className={styles.badge} data-state={item.health.state}>
            {item.health.label}
          </span>
          <div className={styles.health}>
            <svg viewBox="0 0 40 40" aria-hidden="true">
              <circle cx="20" cy="20" r="16" />
              <circle
                cx="20"
                cy="20"
                r="16"
                pathLength="100"
                strokeDasharray={`${item.health.percent} 100`}
                data-ready={item.readiness.ready}
              />
              <text x="20" y="24" textAnchor="middle">
                {item.health.percent}
              </text>
            </svg>
            <span>
              Kelengkapan
              <b>
                {item.health.passed}/{item.health.total} data terpenuhi
              </b>
            </span>
          </div>
          <small>{item.health.campaignLabel}</small>
        </div>
      </button>
      <button
        className={styles.more}
        aria-label={`Buka detail ${item.listing.title}`}
        onClick={onMore}
      >
        ⋮
      </button>
    </article>
  );
}
export function ListingsPage() {
  const panelRef = useRef<HTMLDivElement>(null);
  const query = useSearchParams();
  const [inventory, setInventory] = useState<ListingInventory>(),
    [error, setError] = useState(false),
    [revision, setRevision] = useState(0);
  const [selectedId, setSelectedId] = useState<string>(),
    [filters, setFilters] = useState<ListingFilters>(initialFilters),
    [sort, setSort] = useState("newest");
  const [objectives, setObjectives] = useState<readonly GrowthObjectiveResponseDto[]>([]),
    [objectivesError, setObjectivesError] = useState(false);
  const [mobilePanel, setMobilePanel] = useState(false),
    [info, setInfo] = useState<"add" | "plan" | "listing" | undefined>();
  useEffect(() => {
    const controller = new AbortController();
    setError(false);
    fetch("/api/listings", { signal: controller.signal })
      .then(async (r) => {
        if (!r.ok) throw new Error();
        return r.json() as Promise<ListingInventory>;
      })
      .then((body) => {
        if (!controller.signal.aborted) setInventory(body);
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(true);
      });
    return () => controller.abort();
  }, [revision]);
  useEffect(() => {
    const controller = new AbortController();
    setObjectivesError(false);
    fetch("/api/growth-objectives", { signal: controller.signal })
      .then(async (r) => {
        if (!r.ok) throw new Error();
        return r.json() as Promise<{ objectives: GrowthObjectiveResponseDto[] }>;
      })
      .then((body) => {
        if (!controller.signal.aborted) setObjectives(body.objectives);
      })
      .catch(() => {
        if (!controller.signal.aborted) setObjectivesError(true);
      });
    return () => controller.abort();
  }, [revision]);
  useEffect(() => {
    if (!mobilePanel || !window.matchMedia("(max-width: 1100px)").matches) return;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusable = () =>
      panelRef.current?.querySelectorAll<HTMLElement>(
        'button:not(:disabled), a[href], select:not(:disabled), input, [tabindex="0"]',
      );
    focusable()?.[0]?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setMobilePanel(false);
      if (event.key === "Tab") {
        const nodes = focusable();
        const first = nodes?.[0],
          last = nodes?.[nodes.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", onKey);
      previous?.focus();
    };
  }, [mobilePanel]);
  const items = (inventory?.listings ?? []).map((record) =>
    mapListingToListItem(record, inventory?.campaigns),
  );
  const visible = filterListings(items, filters).sort((a, b) =>
    sort === "priceLow"
      ? a.listing.price - b.listing.price
      : sort === "priceHigh"
        ? b.listing.price - a.listing.price
        : b.listing.createdAt.localeCompare(a.listing.createdAt),
  );
  const selected =
    items.find((item) => item.listing.id === (selectedId ?? query.get("listing"))) || visible[0];
  const areas = [
    ...new Set(
      items.map((item) => item.listing.city).filter((city): city is string => Boolean(city)),
    ),
  ].sort();
  function update(key: keyof ListingFilters, value: string) {
    setFilters((current) => ({ ...current, [key]: value }));
    setSelectedId(undefined);
  }
  function choose(item: ListingItem) {
    setSelectedId(item.listing.id);
    setMobilePanel(true);
  }
  const ready = items.filter((item) => item.readiness.ready).length;
  return (
    <main className={styles.page}>
      <div className={styles.topbar}>
        <span>PROPERTY WORKSPACE</span>
        <span className={styles.topbarRight}>Listing → Strategy → Creative → Campaign</span>
      </div>
      <div className={styles.layout}>
        <section className={styles.listArea}>
          <header className={styles.header}>
            <div>
              <h1>Listings</h1>
              <p>Kelola listing dan siapkan advertising bersama Samantha.</p>
            </div>
            <div className={styles.headerActions}>
              <button
                className={styles.primary}
                onClick={() => {
                  window.location.href = "/listings/new";
                }}
              >
                ＋ Tambah Listing
              </button>
              <button onClick={() => setInfo("plan")} disabled={!selected}>
                ▷ Create Campaign
              </button>
            </div>
          </header>
          <div className={styles.summary} aria-label="Ringkasan listing">
            {[
              {
                label: "Total Listings",
                value: inventory?.total,
                icon: "layers",
                tone: "purple",
                note: "Listing pada akun ini",
              },
              {
                label: "Ready for Ads",
                value: inventory ? ready : undefined,
                icon: "check",
                tone: "green",
                note: "Data lengkap · perlu preflight",
              },
              {
                label: "Belum Punya Campaign",
                value: inventory?.campaigns
                  ? items.filter((item) => item.health.linked?.length === 0).length
                  : undefined,
                icon: "megaphone",
                tone: "red",
                note: "Belum ada hubungan tersimpan",
              },
              {
                label: "Butuh Asset",
                value: inventory
                  ? items.filter(
                      (item) =>
                        !item.readiness.checks.find((c) => c.name === "usablePhotos")?.passed,
                    ).length
                  : undefined,
                icon: "palette",
                tone: "orange",
                note: "Foto listing belum terdaftar",
              },
            ].map((metric) => (
              <div key={metric.label} className={styles.metric}>
                <span data-tone={metric.tone}>
                  <NavIcon name={metric.icon} size={21} />
                </span>
                <div>
                  <p>{metric.label}</p>
                  <b>
                    {metric.value === undefined
                      ? "—"
                      : new Intl.NumberFormat("id-ID").format(metric.value)}
                  </b>
                  <small>{metric.note}</small>
                </div>
              </div>
            ))}
          </div>
          <section className={styles.filterBar} aria-label="Filter listing">
            <label className={styles.search}>
              ⌕{" "}
              <input
                aria-label="Cari listing"
                placeholder="Cari judul, lokasi, atau ID listing…"
                value={filters.search}
                onChange={(e) => update("search", e.target.value)}
              />
            </label>
            <div className={styles.filterSelects}>
              <label>
                Area
                <select value={filters.area} onChange={(e) => update("area", e.target.value)}>
                  <option value="">Semua Area</option>
                  {areas.map((area) => (
                    <option key={area}>{area}</option>
                  ))}
                </select>
              </label>
              <label>
                Status
                <select value={filters.status} onChange={(e) => update("status", e.target.value)}>
                  <option value="">Semua Status</option>
                  {Object.entries(listingStatusLabels).map(([value, label]) => (
                    <option value={value} key={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Tipe
                <select value={filters.type} onChange={(e) => update("type", e.target.value)}>
                  <option value="">Semua Tipe</option>
                  {Object.entries(propertyLabels).map(([value, label]) => (
                    <option value={value} key={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Harga
                <select value={filters.price} onChange={(e) => update("price", e.target.value)}>
                  <option value="">Semua Harga</option>
                  <option value="under1">Di bawah Rp 1 M</option>
                  <option value="1to5">Rp 1–5 M</option>
                  <option value="over5">Di atas Rp 5 M</option>
                </select>
              </label>
            </div>
            <div className={styles.extraFilters}>
              <select
                aria-label="Advertising readiness"
                value={filters.readiness}
                onChange={(e) => update("readiness", e.target.value)}
              >
                <option value="">Semua kesiapan iklan</option>
                {Object.entries(readinessLabels)
                  .filter(([value]) => value !== "NO_CAMPAIGN")
                  .map(([value, label]) => (
                    <option value={value} key={value}>
                      {label}
                    </option>
                  ))}
              </select>
              <select
                aria-label="Campaign status"
                value={filters.campaign}
                onChange={(e) => update("campaign", e.target.value)}
                disabled={!inventory?.campaigns}
              >
                <option value="">Semua campaign</option>
                <option value="none">Belum ada campaign terhubung</option>
                <option value="active">Campaign aktif</option>
                <option value="paused">Campaign paused</option>
              </select>
              {Object.values(filters).some(Boolean) && (
                <button
                  onClick={() => {
                    setFilters(initialFilters);
                    setSelectedId(undefined);
                  }}
                >
                  Reset filter
                </button>
              )}
            </div>
          </section>
          <div className={styles.listToolbar}>
            <span aria-live="polite">
              {inventory ? `${visible.length} listing ditampilkan` : "Memuat listing…"}
            </span>
            <button onClick={() => setRevision((n) => n + 1)} aria-label="Refresh listing">
              ↻
            </button>
            <select
              aria-label="Urutan listing"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
            >
              <option value="newest">Urutan: Terbaru</option>
              <option value="priceLow">Harga terendah</option>
              <option value="priceHigh">Harga tertinggi</option>
            </select>
          </div>
          {error ? (
            <div role="alert" className={styles.empty}>
              <h2>Listing data unavailable</h2>
              <p>Data belum dapat dimuat. Coba kembali.</p>
              <button onClick={() => setRevision((n) => n + 1)}>Coba lagi</button>
            </div>
          ) : !inventory ? (
            <div aria-label="Memuat listing" role="status">
              {[1, 2, 3, 4].map((i) => (
                <div className={styles.skeleton} key={i} />
              ))}
            </div>
          ) : (
            <>
              {inventory.errors.map((message) => (
                <p role="status" key={message} className={styles.warning}>
                  {message}
                </p>
              ))}
              {!items.length ? (
                <div className={styles.empty}>
                  <h2>Belum ada listing.</h2>
                  <p>Tambahkan listing pertama untuk mulai menyiapkan campaign bersama Samantha.</p>
                  <button
                    onClick={() => {
                      window.location.href = "/listings/new";
                    }}
                  >
                    ＋ Tambah Listing
                  </button>
                </div>
              ) : !visible.length ? (
                <div className={styles.empty}>
                  <h2>Tidak ada listing sesuai filter.</h2>
                  <p>Coba kata kunci atau filter lainnya.</p>
                  <button onClick={() => setFilters(initialFilters)}>Reset filter</button>
                </div>
              ) : (
                <div className={styles.rows}>
                  {visible.map((item) => (
                    <ListingRow
                      item={item}
                      key={item.listing.id}
                      selected={selected?.listing.id === item.listing.id}
                      onSelect={() => choose(item)}
                      onMore={() => {
                        choose(item);
                        window.location.href = "/listings/" + encodeURIComponent(item.listing.id);
                      }}
                    />
                  ))}
                </div>
              )}
            </>
          )}
          <p className={styles.scopeNote}>
            Kelengkapan berdasarkan data tersimpan, bukan skor AI. Campaign memakai hubungan listing
            yang tersinkron; campaign lama yang belum dipetakan tidak termasuk.
          </p>
        </section>
        <div ref={panelRef} className={styles.panelArea} data-open={mobilePanel}>
          {selected && !error ? (
            <SamanthaListingPanel
              key={selected.listing.id}
              item={selected}
              objectives={objectives}
              objectivesError={objectivesError}
              onClose={() => setMobilePanel(false)}
            />
          ) : (
            <aside className={styles.intelligence}>
              <header className={styles.intelligenceHeader}>
                <span className={styles.avatar}>✧</span>
                <div>
                  <h2>Samantha Listing Intelligence</h2>
                  <p>Pilih listing untuk melihat data dan strategi.</p>
                </div>
              </header>
              <div className={styles.empty}>
                {inventory ? "Belum ada listing yang dipilih." : "Memuat listing…"}
              </div>
            </aside>
          )}
        </div>
      </div>
      <Drawer
        open={info !== undefined}
        onClose={() => setInfo(undefined)}
        title={
          info === "add"
            ? "Tambah Listing"
            : info === "plan"
              ? "Samantha Campaign Plan"
              : "Informasi listing"
        }
      >
        {info === "add" ? (
          <>
            <p>
              Form tambah listing V2 disiapkan pada tahap berikutnya. Data yang ada dibaca dari
              Listing Manager tenant ini.
            </p>
            <p>Halaman ini belum menyimpan listing baru.</p>
          </>
        ) : info === "plan" ? (
          <>
            <h3>{selected?.listing.title}</h3>
            <p>
              Mulai dengan memilih Growth Objective pada panel Samantha. Struktur dan rencana lokasi
              ditarik dari blueprint backend.
            </p>
            <p>
              Pembuatan campaign, pemilihan creative, dan preflight masuk tahap berikutnya. Tidak
              ada campaign yang dibuat atau diluncurkan dari tampilan ini.
            </p>
            <button
              onClick={() => {
                setInfo(undefined);
                setMobilePanel(true);
              }}
            >
              Buka strategi Samantha →
            </button>
          </>
        ) : (
          selected && (
            <>
              <h3>{selected.listing.title}</h3>
              <p>{selected.location}</p>
              <p>{selected.price}</p>
              <p>{selected.metadata.join(" · ")}</p>
              <p>{selected.health.campaignLabel}</p>
              <p>ID listing: {selected.listing.id}</p>
              <p>Diperbarui: {new Date(selected.listing.updatedAt).toLocaleString("id-ID")}</p>
            </>
          )
        )}
      </Drawer>
    </main>
  );
}
