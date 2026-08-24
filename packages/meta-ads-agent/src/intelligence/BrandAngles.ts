import { MOBIX_BRAND } from "./BusinessKnowledgeBase.js";
import type { IntelVertical } from "./SeasonalCalendarService.js";

/**
 * AAOS-TAMARA-INTELLIGENCE-LAYER Phase 4 ("PART 2: CAMPAIGN ANGLE STRATEGY", "Mode 1: Brand /
 * General"). The spec's `BRAND_ANGLES` constant is NOT a set of existing `AdAngle`/`PropertyAdAngle`
 * members — brand/awareness angles are a genuinely different concept from the PRODUCT angles those
 * two enums encode (unit/listing-specific performance angles), and the wider effort's coordinator
 * note point 4 explicitly asks for this to be given "a real home", not fabricated ad hoc inside the
 * new `LlmService.campaignStrategy` prompt string.
 *
 * This file is that real home: a small, typed, `BusinessKnowledgeBase.ts`-style constant (same
 * package, same "real structured queryable data" discipline that file's own docstring describes),
 * kept separate from `BusinessKnowledgeBase` itself because these 9 angles (5 AUTOMOTIVE + 4
 * PROPERTY) are specifically about brand/awareness campaign strategy, not the broader
 * client-profile/persona/USP knowledge `BusinessKnowledgeBase` already owns — though AUTOMOTIVE's
 * copy below is grounded in the SAME real `MOBIX_BRAND` facts that file already exports (no new
 * unverified brand claims invented here).
 *
 * `objective` values are real `CampaignObjective` string members
 * (`packages/meta-ads-connector/src/domain/value-objects/CampaignObjective.ts`:
 * `OUTCOME_AWARENESS | OUTCOME_LEADS | OUTCOME_ENGAGEMENT | ...`), kept as a small local literal
 * union rather than importing the full enum — this package already keeps `PROPERTY`'s angle
 * vocabulary as plain strings (see `SeasonalCalendarService`'s docstring for why it can't depend on
 * `@aos/creative-agent`), and a brand-angle objective is a narrower concept than the full
 * `CampaignObjective` enum (e.g. `OUTCOME_TRAFFIC`/`OUTCOME_SALES` never apply to a brand-awareness
 * angle), so re-declaring the 3 real values that DO apply here avoids implying every
 * `CampaignObjective` member is a valid choice for a brand angle.
 *
 * `copyTemplate` keeps the spec's `{cabang}`/`{company}` placeholders literally — the caller
 * (`LlmService.campaignStrategy`'s prompt-building, or a future dashboard "use this angle" action)
 * substitutes the tenant's real branch name / `tenant.name` before use; no placeholder is resolved
 * here since this file has no tenant context.
 */
export type BrandCampaignObjective = "OUTCOME_AWARENESS" | "OUTCOME_LEADS" | "OUTCOME_ENGAGEMENT";

export interface BrandAngleDefinition {
  readonly id: string;
  readonly label: string;
  readonly copyTemplate: string;
  readonly cta: string;
  readonly objective: BrandCampaignObjective;
}

/** Real `MOBIX_BRAND.usps` entries (fixed, 5-element literal array — see `BusinessKnowledgeBase.ts`), named here so the copy below reads clearly and needs no fallback for a case that can't happen. */
const USP_INSPECTION = MOBIX_BRAND.usps[0];
const USP_VERIFICATION = MOBIX_BRAND.usps[1];
const USP_WARRANTY = MOBIX_BRAND.usps[2];

const AUTOMOTIVE_BRAND_ANGLES: ReadonlyArray<BrandAngleDefinition> = [
  {
    id: "BRAND_TRUST",
    label: "Kepercayaan Brand",
    copyTemplate: `${MOBIX_BRAND.brandName} by DSS Motor — dealer mobil bekas terpercaya di {cabang}. ${MOBIX_BRAND.tagline}.`,
    cta: "Pelajari Lebih",
    objective: "OUTCOME_AWARENESS",
  },
  {
    id: "JUAL_BELI",
    label: "Jual Beli Mobil",
    copyTemplate: `Mau jual atau beli mobil bekas? ${MOBIX_BRAND.brandName} {cabang} tempat yang tepat! Harga transparan, proses cepat, ${USP_WARRANTY.toLowerCase()}.`,
    cta: "Hubungi Kami",
    objective: "OUTCOME_LEADS",
  },
  {
    id: "TUKAR_TAMBAH",
    label: "Tukar Tambah",
    copyTemplate: `Upgrade mobil lama kamu sekarang! Tukar tambah di ${MOBIX_BRAND.brandName} {cabang} — harga terbaik, proses cepat.`,
    cta: "Hitung Harga Sekarang",
    objective: "OUTCOME_LEADS",
  },
  {
    id: "BENGKEL_GRATIS",
    label: "Layanan Inspeksi",
    copyTemplate: `Setiap unit ${MOBIX_BRAND.brandName} sudah melalui ${USP_INSPECTION.toLowerCase()}. ${USP_VERIFICATION}.`,
    cta: "Lihat Proses Inspeksi",
    objective: "OUTCOME_AWARENESS",
  },
  {
    id: "KOMUNITAS",
    label: "Komunitas Customer",
    copyTemplate: `Ribuan keluarga sudah percaya ${MOBIX_BRAND.brandName}. "${MOBIX_BRAND.slogan}" — baca cerita mereka dan temukan mobil impian kamu.`,
    cta: "Lihat Testimoni",
    objective: "OUTCOME_ENGAGEMENT",
  },
];

/**
 * PROPERTY has no `BusinessKnowledgeBase`-equivalent brand-fact source in this package (the
 * PROPERTY vertical's own tenant `name`/branding is only known at request time in `aaos-api`, not
 * at this package's build time — see `SeasonalCalendarService`'s docstring for the same "PROPERTY
 * gets its own vocabulary, no shared cross-vertical brand data" reasoning). `{company}` is kept
 * literally as the spec's own placeholder, substituted by the caller from the real tenant row.
 */
const PROPERTY_BRAND_ANGLES: ReadonlyArray<BrandAngleDefinition> = [
  {
    id: "BRAND_TRUST",
    label: "Kepercayaan Brand",
    copyTemplate:
      "{company} — platform properti terpercaya. Ribuan listing verified, agen profesional siap bantu.",
    cta: "Jelajahi Properti",
    objective: "OUTCOME_AWARENESS",
  },
  {
    id: "AGEN_PROFESIONAL",
    label: "Agen Terpercaya",
    copyTemplate:
      "Agen properti kami bersertifikat dan berpengalaman. Gratis konsultasi KPR & legalitas.",
    cta: "Konsultasi Gratis",
    objective: "OUTCOME_LEADS",
  },
  {
    id: "EDUKASI_KPR",
    label: "Edukasi KPR",
    copyTemplate:
      "Mau punya rumah tapi bingung soal KPR? Kami bantu hitung cicilan dan proses pengajuan.",
    cta: "Hitung Simulasi KPR",
    objective: "OUTCOME_LEADS",
  },
  {
    id: "INVESTASI_PROPERTI",
    label: "Investasi Properti",
    copyTemplate:
      "Properti masih jadi investasi terbaik di Indonesia. Yuk mulai dengan konsultasi gratis.",
    cta: "Mulai Investasi",
    objective: "OUTCOME_LEADS",
  },
];

export const BRAND_ANGLES: Record<IntelVertical, ReadonlyArray<BrandAngleDefinition>> = {
  AUTOMOTIVE: AUTOMOTIVE_BRAND_ANGLES,
  PROPERTY: PROPERTY_BRAND_ANGLES,
};

/** Every real brand-angle `id` for `vertical` — the closed set a caller (e.g. `LlmService.campaignStrategy`'s post-parse validation) should treat as valid, matching the "fail closed on a hallucinated angle" discipline `CreativeBriefLlmPayloadSchema` established for product angles. */
export function getBrandAngleIds(vertical: IntelVertical): ReadonlyArray<string> {
  return BRAND_ANGLES[vertical].map((angle) => angle.id);
}
