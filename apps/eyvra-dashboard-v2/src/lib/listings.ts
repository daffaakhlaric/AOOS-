import type { ListingDto } from "@/types/dashboard.types";
export interface PropertyListing extends ListingDto {
  propertyType: string;
  listingStatus: string;
  price: number;
  city?: string;
  province?: string;
  kecamatan?: string;
  address?: string;
  landArea?: number;
  buildArea?: number;
  bedrooms?: number;
  bathrooms?: number;
  floors?: number;
  certificate?: string;
  waNumber?: string;
  description?: string;
  highlights: string[];
  createdAt: string;
  updatedAt: string;
}
export interface ListingReadiness {
  ready: boolean;
  checks: { name: string; passed: boolean; reason?: string }[];
  blockingIssues: string[];
  skippedChecks: string[];
}
export interface ListingCopy {
  id: string;
  origin: "LISTING_FACTS";
  primaryText: string;
  headline: string;
  description: string;
  destination?: "WHATSAPP";
  factsUpdatedAt: string;
}
export interface ListingRecord {
  listing: PropertyListing;
  readiness: ListingReadiness;
  copy: ListingCopy;
}
export interface ListingCampaign {
  id: string;
  listingId: string;
  name: string;
  status: string;
  syncedAt: string;
}
export interface ListingInventory {
  listings: ListingRecord[];
  total: number;
  campaigns?: ListingCampaign[];
  errors: string[];
}
export interface ListingBlueprint {
  goal: string;
  destination?: string;
  campaign: { name: string; objective: string; initialStatus: string };
  adSet: {
    audienceStrategy: string;
    geo: { city?: string; province?: string; kecamatan?: string };
    dailyBudgetIdr?: number;
    placements: string[];
  };
  creativeStrategy: { formats: string[] };
  warnings: string[];
}
export const propertyLabels: Record<string, string> = {
  RUMAH: "Rumah",
  APARTEMEN: "Apartemen",
  RUKO: "Ruko",
  TANAH: "Tanah",
  VILLA: "Villa",
};
export const listingStatusLabels: Record<string, string> = {
  AKTIF: "Aktif",
  DISEWAKAN: "Disewakan",
  TERJUAL: "Terjual",
  DRAFT: "Draft",
};
export const readinessLabels: Record<string, string> = {
  READY_FOR_ADS: "Ready for Ads",
  ACTIVE_CAMPAIGN: "Active Campaign",
  NO_CAMPAIGN: "Belum Punya Campaign",
  NEED_ASSETS: "Butuh Asset",
  NEED_DATA: "Data Belum Lengkap",
  PAUSED: "Paused",
  UNAVAILABLE: "Tidak Tersedia",
};
export const checkLabels: Record<string, string> = {
  propertyType: "Tipe properti",
  price: "Harga listing",
  location: "Lokasi",
  listingActive: "Listing aktif",
  usablePhotos: "Foto terdaftar",
  whatsappDestination: "Tujuan WhatsApp",
};
export function rupiah(value?: number) {
  return value === undefined
    ? "—"
    : new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        maximumFractionDigits: 0,
      }).format(value);
}
export function compactPrice(value: number) {
  return value >= 1e9
    ? `Rp ${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(value / 1e9)} M`
    : value >= 1e6
      ? `Rp ${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 }).format(value / 1e6)} jt`
      : rupiah(value);
}
export function mapListingReadiness(record: ListingRecord, campaigns?: ListingCampaign[]) {
  const listing = record.listing;
  const linked = campaigns?.filter((c) => c.listingId === listing.id);
  const state =
    listing.listingStatus === "TERJUAL" || listing.listingStatus === "DISEWAKAN"
      ? "UNAVAILABLE"
      : !record.readiness.checks.find((c) => c.name === "usablePhotos")?.passed
        ? "NEED_ASSETS"
        : !record.readiness.ready
          ? "NEED_DATA"
          : linked?.some((c) => c.status === "ACTIVE")
            ? "ACTIVE_CAMPAIGN"
            : linked?.length && linked.every((c) => c.status === "PAUSED")
              ? "PAUSED"
              : "READY_FOR_ADS";
  const passed = record.readiness.checks.filter((c) => c.passed).length,
    total = record.readiness.checks.length;
  return {
    state,
    label: readinessLabels[state],
    passed,
    total,
    percent: total ? Math.round((passed / total) * 100) : 0,
    linked,
    campaignLabel:
      linked === undefined
        ? "Status campaign belum tersedia"
        : linked.length === 0
          ? "Belum ada campaign terhubung"
          : `${linked.length} campaign · ${linked.filter((c) => c.status === "ACTIVE").length} aktif`,
  };
}
export function mapListingToListItem(record: ListingRecord, campaigns?: ListingCampaign[]) {
  const l = record.listing;
  const area = l.propertyType === "APARTEMEN" ? l.buildArea : l.landArea;
  return {
    ...record,
    location: [l.kecamatan, l.city, l.province].filter(Boolean).join(", ") || "Lokasi belum diisi",
    type: propertyLabels[l.propertyType] ?? "Properti",
    price: l.price > 0 ? compactPrice(l.price) : "Harga belum diisi",
    perSquare: area && area > 0 ? l.price / area : undefined,
    areaBasis: l.propertyType === "APARTEMEN" ? "bangunan" : "tanah",
    health: mapListingReadiness(record, campaigns),
    images: [l.mainPhotoUrl, ...l.photos.map((p) => p.url)].filter((u): u is string => Boolean(u)),
    metadata: [
      l.landArea ? `Tanah ${l.landArea} m²` : undefined,
      l.buildArea ? `Bangunan ${l.buildArea} m²` : undefined,
      l.bedrooms ? `${l.bedrooms} kamar tidur` : undefined,
      l.bathrooms ? `${l.bathrooms} kamar mandi` : undefined,
      l.certificate,
    ].filter(Boolean),
  };
}
export type ListingItem = ReturnType<typeof mapListingToListItem>;
export interface ListingFilters {
  search: string;
  area: string;
  status: string;
  type: string;
  price: string;
  readiness: string;
  campaign: string;
}
export function filterListings(items: ListingItem[], filters: ListingFilters) {
  return items.filter((item) => {
    const l = item.listing;
    const needle = filters.search.toLowerCase().trim();
    return (
      (!needle ||
        `${l.id} ${l.title} ${item.location} ${l.address ?? ""}`.toLowerCase().includes(needle)) &&
      (!filters.area || l.city === filters.area) &&
      (!filters.status || l.listingStatus === filters.status) &&
      (!filters.type || l.propertyType === filters.type) &&
      (!filters.price ||
        (filters.price === "under1"
          ? l.price < 1e9
          : filters.price === "1to5"
            ? l.price >= 1e9 && l.price <= 5e9
            : l.price > 5e9)) &&
      (!filters.readiness || item.health.state === filters.readiness) &&
      (!filters.campaign ||
        (filters.campaign === "none"
          ? item.health.linked?.length === 0
          : filters.campaign === "active"
            ? item.health.linked?.some((c) => c.status === "ACTIVE")
            : item.health.linked?.some((c) => c.status === "PAUSED")))
    );
  });
}
export function mapAudienceRecommendation(blueprint?: ListingBlueprint) {
  const strategies: Record<string, string> = {
    LOCAL: "Area lokal",
    LOCAL_ONLY: "Area lokal",
    CITY: "Satu kota",
    EXPAND: "Perluasan area",
    REGIONAL: "Regional",
    NATIONAL: "Nasional",
    AUTO: "Otomatis",
    AUTO_EXPAND: "Perluasan otomatis",
    LOCAL_FIRST: "Prioritas area lokal",
  };
  return {
    locations: blueprint
      ? Object.values(blueprint.adSet.geo).filter(Boolean).join(", ")
      : undefined,
    strategy: blueprint
      ? (strategies[blueprint.adSet.audienceStrategy] ?? "Sesuai Growth Objective")
      : undefined,
    age: "Belum divalidasi untuk konfigurasi Meta ini",
    radius: "Belum divalidasi untuk konfigurasi Meta ini",
  };
}
export function mapListingIntelligence(item: ListingItem, blueprint?: ListingBlueprint) {
  return {
    objective: blueprint?.goal === "GENERATE_HOT_LEADS" ? "Qualified Leads" : undefined,
    structure: blueprint ? "1 Campaign · 1 Primary Ad Set" : undefined,
    audience: mapAudienceRecommendation(blueprint),
    formats: blueprint?.creativeStrategy.formats.map((f) => (f === "IMAGE" ? "Image" : f)),
    copy: item.copy,
  };
}
