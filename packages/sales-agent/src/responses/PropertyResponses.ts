import type { PropertyListing } from "../domain/entities/PropertyListing.js";

import { formatPrice } from "./formatters.js";
import { pickFromPool } from "./PoolSelector.js";

/**
 * The PROPERTY-vertical response-pool content Clara's `PropertyResponseGenerator` draws from — the
 * sibling to `GreetingResponses`/`DiscoveryResponses`/`UnitResponses`/`PriceResponses`/
 * `ObjectionResponses`/`ClosingResponses`/`HandoffResponses`/`ColdResponses` combined into one file
 * (a deliberate consolidation for this phase's real scope — each pool stays independently exported
 * and testable, same `pickFromPool(pool, seed)` deterministic-selection discipline as the automotive
 * originals). Qualification-stage questions are NOT duplicated here: `PropertyScoreCalculator`'s
 * real `PROPERTY_SCORING_RULES` already carries spec-pinned Indonesian question copy per dimension
 * (`rule.question`) — `PropertyResponseGenerator` uses that directly instead of inventing a second
 * question pool.
 */

export const PROPERTY_GREETING_POOL: ReadonlyArray<string> = [
  "Hai kak! Selamat datang 😊 Lagi cari rumah, apartemen, atau ruko nih?",
  "Halo kak! Ada yang bisa Clara bantu soal properti hari ini? 😊",
  "Hai kak! Makasih udah hubungi kita ya 🙌 Mau cari properti tipe apa nih?",
];
export function getPropertyGreeting(seed: number): string {
  return pickFromPool(PROPERTY_GREETING_POOL, seed);
}

export const PROPERTY_DISCOVERY_POOL: ReadonlyArray<string> = [
  "Rencananya buat ditinggali sendiri atau investasi nih kak? 😊",
  "Ada tipe properti yang lagi kak incar? Rumah, apartemen, atau ruko? 😊",
  "Kira-kira budget dan area yang diinginkan udah kebayang belum kak? 😊",
];
export function getPropertyDiscoveryQuestion(seed: number): string {
  return pickFromPool(PROPERTY_DISCOVERY_POOL, seed);
}

export const PROPERTY_GENERIC_FOLLOW_UP_POOL: ReadonlyArray<string> = [
  "Ada preferensi lain kak yang mau ditambahin? Biar Clara makin pas cariinnya 😊",
  "Boleh cerita lebih detail lagi kak soal yang dicari? 😊",
];
export function getPropertyGenericFollowUp(seed: number): string {
  return pickFromPool(PROPERTY_GENERIC_FOLLOW_UP_POOL, seed);
}

/** Listing-found response pool — the PROPERTY sibling to `unitFoundPool`. */
export function listingFoundPool(listing: PropertyListing): ReadonlyArray<string> {
  const bedroomsText = listing.bedrooms !== undefined ? `${String(listing.bedrooms)} KT, ` : "";
  return [
    `Ada kak! ${listing.title}, ${bedroomsText}harga Rp ${formatPrice(listing.price)} 👍\nMau Clara kirimin detail fotonya?`,
    `Kebetulan ada nih kak! ${listing.title}, harga Rp ${formatPrice(listing.price)} 😊\nMau tau simulasi KPR-nya?`,
  ];
}
export function getListingFoundResponse(listing: PropertyListing, seed: number): string {
  return pickFromPool(listingFoundPool(listing), seed);
}

/** Listing-not-found response, optionally naming an alternative city that DOES have a match (mirrors `getUnitNotFoundResponse`'s alternative-branch suggestion). */
export function getListingNotFoundResponse(propertyType: string, alternativeCity?: string): string {
  if (alternativeCity !== undefined) {
    return `Untuk ${propertyType} di area itu lagi kosong kak, tapi di ${alternativeCity} ada nih yang bagus 😊 mau Clara cek?`;
  }
  return `Waduh, ${propertyType} yang kakak cari lagi kosong nih kak 😊 Mau Clara cariin yang mirip?`;
}

/** KPR/DP simulation pool — the PROPERTY sibling to `dpInfoPool`. Simple, transparent estimate: 20% DP, 80% financed over 180 months (15 years), no interest modeled (spec-simulation only, never a real bank quote). */
export function estimatedDp(price: number): number {
  return Math.round(price * 0.2);
}
export function estimatedMonthlyKpr(price: number): number {
  return Math.round((price * 0.8) / 180);
}
export function kprInfoPool(listing: PropertyListing): ReadonlyArray<string> {
  return [
    `DP-nya mulai Rp ${formatPrice(estimatedDp(listing.price))} kak, cicilan KPR sekitar Rp ${formatPrice(estimatedMonthlyKpr(listing.price))}/bulan (15 tahun) 😊\nMau Clara hitung simulasi lengkapnya?`,
  ];
}
export function getKprInfoResponse(listing: PropertyListing, seed: number): string {
  return pickFromPool(kprInfoPool(listing), seed);
}

export const PROPERTY_OBJECTION_NOT_SURE_POOL: ReadonlyArray<string> = [
  "Gak papa kak, santai aja 😊 Kalau ada yang mau ditanyain lagi soal propertinya, Clara siap bantu!",
  "No problem kak! Mau lihat-lihat dulu juga boleh. Nanti kalau ada pertanyaan langsung tanya Clara ya 😊",
];
export const PROPERTY_PRICE_OBJECTION_POOL: ReadonlyArray<string> = [
  "Harga sudah sesuai kondisi dan lokasi kak 😊 Kalau mau bandingkan, kita welcome — yang penting kak nyaman sama pilihannya.",
  "Mungkin ada yang lebih murah kak, tapi legalitas dan kondisi unit kita jamin 😊 Mau Clara jelasin detail keunggulannya?",
];
export function getPropertyObjectionResponse(
  messageText: string,
  seed: number,
  intents: ReadonlyArray<string> = [],
): string {
  const isPriceComparison =
    /di tempat lain/i.test(messageText) ||
    /developer lain/i.test(messageText) ||
    /lebih murah/i.test(messageText);
  if (isPriceComparison || intents.includes("COMPLAINT")) {
    return pickFromPool(PROPERTY_PRICE_OBJECTION_POOL, seed);
  }
  return pickFromPool(PROPERTY_OBJECTION_NOT_SURE_POOL, seed);
}

export const PROPERTY_CLOSING_WARM_POOL: ReadonlyArray<string> = [
  "Mau Clara bantu jadwalin survey ke lokasi kak? Bisa langsung lihat unitnya 😊",
  "Kapan kira-kira kak mau survey propertinya? Bisa kita atur jadwalnya 😊",
];
export const PROPERTY_CLOSING_HOT_POOL: ReadonlyArray<string> = [
  "Kak mau jadwalin survey kapan? Unitnya masih ready nih 😊",
  "Mau survey langsung ke lokasi kak? Clara bantu atur jadwalnya 🙏",
];
export const PROPERTY_CLOSING_FOLLOW_POOL: ReadonlyArray<string> = [
  "Gimana kak, mau Clara bantu jadwalin survey lokasinya? 😊",
  "Kalau udah yakin, tinggal tentuin jadwal survey aja kak 🙏",
];
export function getPropertyClosingResponse(
  scoreNumber: number,
  closingAttemptCount: number,
  hotThreshold: number,
  seed: number,
): string {
  if (scoreNumber >= hotThreshold) {
    return pickFromPool(PROPERTY_CLOSING_HOT_POOL, seed);
  }
  if (closingAttemptCount === 0) {
    return pickFromPool(PROPERTY_CLOSING_WARM_POOL, seed);
  }
  return pickFromPool(PROPERTY_CLOSING_FOLLOW_POOL, seed);
}

export function propertyHandoffPool(salesName: string): ReadonlyArray<string> {
  return [
    `Oke kak! Clara sambungin ke ${salesName} dari tim kita ya, dia yang bisa bantu lebih detail dan atur jadwal survey 🙏\nSebentar ya kak!`,
  ];
}
export function getPropertyHandoffResponse(salesName: string, seed: number): string {
  return pickFromPool(propertyHandoffPool(salesName), seed);
}

export const PROPERTY_COLD_NURTURE_POOL: ReadonlyArray<string> = [
  "Gak buru-buru kok kak, santai aja 😊 Kalau nanti udah siap atau ada pertanyaan, tinggal chat Clara lagi ya!",
  "Oke kak, Clara standby kalau sewaktu-waktu mau tanya-tanya lagi soal propertinya ya 😊",
];
export function getPropertyColdNurtureResponse(seed: number): string {
  return pickFromPool(PROPERTY_COLD_NURTURE_POOL, seed);
}

export const PROPERTY_SYARIAH_POOL: ReadonlyArray<string> = [
  "Kita juga sediain opsi KPR syariah kak, tanpa riba dan sesuai prinsip syariah 😊 Mau Clara jelasin skemanya?",
];
export function getPropertySyariahResponse(seed: number): string {
  return pickFromPool(PROPERTY_SYARIAH_POOL, seed);
}

export const PROPERTY_CLOSED_POOL: ReadonlyArray<string> = [
  "Terima kasih ya kak udah ngobrol sama Clara 🙏 Kalau butuh bantuan lagi soal properti, tinggal chat aja!",
];
export function getPropertyClosedResponse(seed: number): string {
  return pickFromPool(PROPERTY_CLOSED_POOL, seed);
}
