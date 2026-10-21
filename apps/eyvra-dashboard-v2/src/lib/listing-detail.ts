import {
  listingStatusLabels,
  propertyLabels,
  rupiah,
  type ListingRecord,
  type ListingCampaign,
  type PropertyListing,
} from "./listings";
export const detailTabs = [
  ["overview", "Overview"],
  ["property", "Detail Properti"],
  ["location", "Lokasi"],
  ["media", "Media"],
  ["documents", "Dokumen"],
  ["ai", "Analisis AI"],
  ["leads", "Leads"],
  ["activity", "Aktivitas"],
  ["history", "Riwayat"],
] as const;
export type DetailTab = (typeof detailTabs)[number][0];
export function parseDetailTab(value: string | null): DetailTab {
  return detailTabs.find(([key]) => key === value)?.[0] ?? "overview";
}
export interface DetailListing extends PropertyListing {
  garage?: number;
  electricity?: number;
  condition?: string;
  facing?: string;
  postalCode?: string;
}
export interface DetailWorkspace extends ListingRecord {
  listing: DetailListing;
  campaigns: ListingCampaign[] | null;
  errors: string[];
}
export interface KnowledgeDocument {
  id: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  status: string;
  error_code?: string;
  created_at: string;
  updated_at: string;
}
export interface ListingVideo {
  id: string;
  fileName: string;
  url: string | null;
}
export function dateLabel(value?: string) {
  if (!value || !Number.isFinite(Date.parse(value))) return "Belum tersedia";
  return new Date(value).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
}
export function mapListingDetail(data: DetailWorkspace) {
  const l = data.listing;
  const photos = [...(l.photos ?? [])].sort(
    (a, b) => Number(b.isMain) - Number(a.isMain) || a.order - b.order,
  );
  return {
    listing: l,
    photos,
    title: l.title,
    status: listingStatusLabels[l.listingStatus] ?? l.listingStatus,
    type: propertyLabels[l.propertyType] ?? "Tipe belum diisi",
    price: l.price > 0 ? rupiah(l.price) : "Harga belum diisi",
    location: [l.kecamatan, l.city, l.province].filter(Boolean).join(", ") || "Lokasi belum diisi",
    created: dateLabel(l.createdAt),
    updated: dateLabel(l.updatedAt),
    readiness: data.readiness,
    campaigns: data.campaigns,
    errors: data.errors,
    facts: mapPropertyFacts(l),
  };
}
export function mapPropertyFacts(l: DetailListing) {
  const entries: [string, string | number | undefined, string][] = [
    ["Luas tanah", l.landArea, "m²"],
    ["Luas bangunan", l.propertyType === "TANAH" ? undefined : l.buildArea, "m²"],
    ["Kamar tidur", l.propertyType === "TANAH" ? undefined : l.bedrooms, ""],
    ["Kamar mandi", l.propertyType === "TANAH" ? undefined : l.bathrooms, ""],
    ["Jumlah lantai", l.propertyType === "TANAH" ? undefined : l.floors, ""],
    ["Garasi", l.propertyType === "TANAH" ? undefined : l.garage, ""],
    ["Daya listrik", l.electricity, "VA"],
    ["Arah hadap", l.facing, ""],
  ];
  return entries
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([label, value, unit]) => ({ label, value: `${value}${unit ? ` ${unit}` : ""}` }));
}
export function mapListingKnowledge(doc: KnowledgeDocument) {
  const statuses: Record<string, string> = {
    READY: "Siap digunakan",
    FAILED: "Gagal diproses",
    OCR_REQUIRED: "Perlu OCR",
    UPLOADED: "Menunggu proses",
    PARSING: "Membaca dokumen",
    EMBEDDING: "Mengindeks",
    QUEUED: "Dalam antrean",
    PROCESSING: "Sedang diproses",
  };
  return {
    id: doc.id,
    name: doc.file_name,
    type: doc.file_name.split(".").pop()?.toUpperCase() ?? "FILE",
    size:
      doc.size_bytes >= 1048576
        ? `${(doc.size_bytes / 1048576).toFixed(1)} MB`
        : `${Math.ceil(doc.size_bytes / 1024)} KB`,
    status: statuses[doc.status] ?? doc.status,
    ready: doc.status === "READY",
    failed: ["FAILED", "OCR_REQUIRED"].includes(doc.status),
    updated: dateLabel(doc.updated_at),
    error: doc.error_code,
  };
}
