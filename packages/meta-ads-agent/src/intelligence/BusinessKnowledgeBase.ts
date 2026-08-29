import { AdDestinationType, Branch, CampaignObjective, Funnel } from "@aos/meta-ads-connector";

import { AdAngle } from "../domain/value-objects/AdAngle.js";
import type { FatiguePattern } from "../domain/value-objects/FatiguePattern.js";
import { toFatiguePatternMap } from "../domain/value-objects/FatiguePattern.js";
import type { PerformanceBaseline } from "../domain/value-objects/PerformanceBaseline.js";
import { TargetPersona } from "../domain/value-objects/TargetPersona.js";

/** DSS Motor's ad-account and dealership footprint (spec: "Client Profile"). */
export interface ClientProfile {
  readonly client: string;
  readonly brand: string;
  readonly business: string;
  readonly locations: ReadonlyArray<string>;
  readonly adAccountIds: ReadonlyArray<string>;
  readonly topUnits: ReadonlyArray<string>;
}

/** One target-market persona definition (spec: "Target Market"). */
export interface PersonaProfile {
  readonly persona: TargetPersona;
  readonly ageRange: string;
  readonly location?: string;
  readonly budgetRangeIDR: { readonly minIDR: number; readonly maxIDR: number };
  readonly payment: string;
  readonly painPoints: ReadonlyArray<string>;
  readonly triggers: ReadonlyArray<string>;
  readonly units?: ReadonlyArray<string>;
  readonly priority?: string;
}

export type AngleTier = "HIGH" | "MEDIUM" | "LOW";

export interface AngleTierBand {
  readonly tier: AngleTier;
  readonly rphD3RangeIDR: { readonly minIDR: number; readonly maxIDR: number | null };
  readonly angles: ReadonlyArray<string>;
}

/** A campaign-naming-convention → funnel/branch classification example (spec: "Campaign Naming Conventions"). */
export interface CampaignNamingRule {
  readonly pattern: string;
  readonly funnel: Funnel;
  readonly branch: Branch;
  readonly description: string;
}

const CLIENT_PROFILE: ClientProfile = {
  client: "DSS Motor",
  brand: "Mobix",
  business: "Used car dealer — jual beli mobil bekas",
  locations: ["Cinere", "Bintaro", "Bandung", "Jabodetabek coverage"],
  adAccountIds: ["act_752604553578354", "act_1398036411113054"],
  topUnits: ["Xpander", "Brio", "Avanza", "Veloz", "Raize", "Rush", "Stargazer"],
};

const PRIMARY_FAMILY_PERSONA: PersonaProfile = {
  persona: TargetPersona.PRIMARY_FAMILY,
  ageRange: "25-40 tahun",
  location: "Jabodetabek, especially South Jakarta corridor",
  budgetRangeIDR: { minIDR: 100_000_000, maxIDR: 250_000_000 },
  payment: "Kredit (60-70% of buyers)",
  painPoints: [
    "Takut beli mobil bekas bermasalah",
    "Ribet urusan kredit / takut ditolak",
    "Tidak tahu harga wajar pasar",
    "Takut unit ditarik leasing",
  ],
  triggers: [
    "Anak masuk sekolah/kuliah",
    "Pindah kerja jauh",
    "Upgrade dari motor",
    "Bonus/THR/salary naik",
  ],
};

const SECONDARY_BUSINESS_PERSONA: PersonaProfile = {
  persona: TargetPersona.SECONDARY_BUSINESS,
  ageRange: "30-50 tahun",
  budgetRangeIDR: { minIDR: 150_000_000, maxIDR: 350_000_000 },
  payment: "Cash atau kredit",
  painPoints: [],
  triggers: [],
  units: ["MPV", "pick-up", "niaga"],
  priority: "Kilometer rendah, mesin prima, no trouble",
};

const ANGLE_TIER_BANDS: ReadonlyArray<AngleTierBand> = [
  {
    tier: "HIGH",
    rphD3RangeIDR: { minIDR: 0, maxIDR: 7_000 },
    angles: [
      "DP ringan mulai X juta",
      "Kredit syariah, halal",
      "Gudangnya [model]",
      "Q&A / edukasi",
      "Budget X juta dapat mobil apa?",
    ],
  },
  {
    tier: "MEDIUM",
    rphD3RangeIDR: { minIDR: 7_000, maxIDR: 15_000 },
    angles: ["Unit-specific (Xpander 2019...)", "Promo / diskon", "Testimonial customer"],
  },
  {
    tier: "LOW",
    rphD3RangeIDR: { minIDR: 15_000, maxIDR: null },
    angles: ["Brand/lifestyle only", "Website redirect", "IG profile visit objective"],
  },
];

const CAMPAIGN_NAMING_RULES: ReadonlyArray<CampaignNamingRule> = [
  {
    pattern: "Meta-DM-Leads-Mobix",
    funnel: Funnel.DM,
    branch: Branch.MULTI,
    description: "DM funnel, multi-branch",
  },
  {
    pattern: "Meta-CTWA-Leads-Mobix-Cinere",
    funnel: Funnel.CTWA,
    branch: Branch.CINERE,
    description: "CTWA, Cinere branch",
  },
  {
    pattern: "Meta-CTWA-Leads-Mobix-Bintaro",
    funnel: Funnel.CTWA,
    branch: Branch.BINTARO,
    description: "CTWA, Bintaro branch",
  },
  {
    pattern: "Post: [content]",
    funnel: Funnel.BRAND_BOOST,
    branch: Branch.BOOST,
    description: "Boost/Brand, content post",
  },
  {
    pattern: "Instagram post: [content]",
    funnel: Funnel.BRAND_BOOST,
    branch: Branch.BOOST,
    description: "Boost/Brand, IG content",
  },
];

/**
 * DSS Motor / Mobix domain knowledge, encoded as real, structured, queryable data — the ONE place
 * in the whole package this knowledge lives (queried by `AngleRecommender`, `CreativeIntelligence`,
 * `AudienceInsightEngine`), per the spec's "Business Domain Knowledge" section.
 */
export class BusinessKnowledgeBase {
  static clientProfile(): ClientProfile {
    return CLIENT_PROFILE;
  }

  static personas(): ReadonlyArray<PersonaProfile> {
    return [PRIMARY_FAMILY_PERSONA, SECONDARY_BUSINESS_PERSONA];
  }

  static persona(persona: TargetPersona): PersonaProfile {
    return persona === TargetPersona.PRIMARY_FAMILY
      ? PRIMARY_FAMILY_PERSONA
      : SECONDARY_BUSINESS_PERSONA;
  }

  static angleTierBands(): ReadonlyArray<AngleTierBand> {
    return ANGLE_TIER_BANDS;
  }

  /** Classifies an Rp/D3 rate into a performance tier: HIGH `< Rp 7.000`, MEDIUM `Rp 7.000-15.000`, LOW `> Rp 15.000`. `null` rphD3 (undefined rate) has no tier. */
  static classifyAngleTier(rphD3IDR: number | null): AngleTier | null {
    if (rphD3IDR === null || !Number.isFinite(rphD3IDR)) {
      return null;
    }
    if (rphD3IDR < 7_000) {
      return "HIGH";
    }
    if (rphD3IDR <= 15_000) {
      return "MEDIUM";
    }
    return "LOW";
  }

  static campaignNamingRules(): ReadonlyArray<CampaignNamingRule> {
    return CAMPAIGN_NAMING_RULES;
  }

  /** Static Mobix brand + location + angle + unit knowledge, loaded instantly (no I/O) — the S2 half of `SamanthaAgentFactory.createWithFullContext()`'s init sequence, step 1. */
  static loadMobixKnowledge(): MobixKnowledge {
    return {
      brand: MOBIX_BRAND,
      locations: MOBIX_LOCATIONS,
      angleUsps: ANGLE_USP_MAP,
      topUnits: TOP_UNITS,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// AAOS-W1D-S1S2 (S1 + S2) — Historical Learning seed baselines + Mobix brand/inventory
// knowledge, appended below the W1D-base `BusinessKnowledgeBase` above.
// ═══════════════════════════════════════════════════════════════════════════════════════

/** One dealer branch's coverage/performance profile (spec: "Locations"). */
export interface LocationProfile {
  readonly branch: Branch;
  readonly fullName: string;
  readonly area: string;
  readonly coverage: ReadonlyArray<string>;
  readonly bestFunnel: Funnel;
  readonly bestPlatform: string;
  readonly avgRphLead: number | null;
  readonly sampleSize: number;
  readonly note?: string;
}

/** One top-selling unit model's profile (spec: "Top Unit Profiles"). */
export interface UnitProfile {
  readonly model: string;
  readonly brand: string;
  readonly type: string;
  readonly priceRange: { readonly min: number; readonly max: number };
  readonly targetPersona: TargetPersona;
  readonly bestAngles: ReadonlyArray<AdAngle>;
  readonly branches: ReadonlyArray<Branch>;
  readonly sellingPoints: ReadonlyArray<string>;
  readonly note?: string;
}

/** One angle's historical evergreen-health profile (spec: "Known Evergreen Patterns"). */
export interface EvergreenPatternSeed {
  readonly angle: AdAngle;
  readonly avgDaysHealthy: number;
  readonly topPerformer: boolean;
}

/** The bundle `BusinessKnowledgeBase.loadMobixKnowledge()` returns — step 1 of `createWithFullContext()`'s init sequence. */
export interface MobixKnowledge {
  readonly brand: typeof MOBIX_BRAND;
  readonly locations: ReadonlyArray<LocationProfile>;
  readonly angleUsps: Record<AdAngle, ReadonlyArray<string>>;
  readonly topUnits: ReadonlyArray<UnitProfile>;
}

// ── Brand Identity ──────────────────────────────────────────
export const MOBIX_BRAND = {
  legalName: "PT Digital Sumber Sejahtera Motor (DSS Motor)",
  brandName: "Mobix",
  slogan: "Xtra Aman, Xtra Yakin",
  tagline: "Mobil Bekas Berkualitas dan Harga Terjangkau",
  instagram: "@Mobix_bydssmotor",
  website: "https://mobixbydss.id",
  financePartner: "Dipo Star Finance (mocil.id)",
  usps: [
    "Inspeksi 150+ titik pemeriksaan",
    "Verifikasi independen oleh Otospector",
    "Garansi unit tersedia",
    "Harga transparan, tanpa biaya tersembunyi",
    "Simulasi kredit transparan via mocil.id",
  ],
  paymentOptions: [
    { type: "CASH", label: "Tunai" },
    { type: "KREDIT", label: "Kredit Konvensional" },
    { type: "KREDIT_SYARIAH", label: "Pembiayaan Syariah" },
  ],
} as const;

// ── Locations ───────────────────────────────────────────────
// Spec-consistency note: the spec's own `MOBIX_LOCATIONS` seed references `Branch.PONDOK_BAMBU`,
// which does not exist in `@aos/meta-ads-connector`'s real `Branch` enum (`CINERE | BINTARO |
// BANDUNG | JABODETABEK | BOOST | MULTI | UMUM` — see that package's own docstring for why it's
// closed to exactly those 7). Per the hard constraint against modifying already-shipped,
// independently-verified packages, Pondok Bambu is mapped to `Branch.UMUM` here — semantically
// apt, since its own `note` field ("No dedicated campaign yet — opportunity") already describes
// an unassigned/general branch with no funnel-specific campaign yet.
export const MOBIX_LOCATIONS: LocationProfile[] = [
  {
    branch: Branch.BINTARO,
    fullName: "Mobix Bintaro",
    area: "Tangerang Selatan",
    coverage: ["Bintaro", "Tangerang Selatan", "Serpong", "BSD"],
    bestFunnel: Funnel.CTWA,
    bestPlatform: "instagram",
    avgRphLead: 7059,
    sampleSize: 219,
  },
  {
    branch: Branch.CINERE,
    fullName: "Mobix Cinere",
    area: "Jakarta Selatan",
    coverage: ["Cinere", "Depok", "Limo", "Gandul", "Sawangan"],
    bestFunnel: Funnel.CTWA,
    bestPlatform: "facebook",
    avgRphLead: 6919,
    sampleSize: 227,
  },
  {
    branch: Branch.UMUM, // spec: Branch.PONDOK_BAMBU — see note above
    fullName: "Mobix Pondok Bambu",
    area: "Jakarta Timur",
    coverage: ["Jakarta Timur", "Bekasi", "Pondok Bambu"],
    bestFunnel: Funnel.BRAND_BOOST,
    bestPlatform: "facebook",
    avgRphLead: null,
    sampleSize: 0,
    note: "No dedicated campaign yet — opportunity",
  },
  {
    branch: Branch.BANDUNG,
    fullName: "Mobix Bandung",
    area: "Bandung",
    coverage: ["Bandung", "Cimahi", "Bandung Barat"],
    bestFunnel: Funnel.DM,
    bestPlatform: "facebook",
    avgRphLead: 42621,
    sampleSize: 41,
    note: "High Rp/lead — needs creative + funnel overhaul",
  },
];

// ── USP per Angle ────────────────────────────────────────────
// Spec-consistency note: `AdAngle` gained a 7th member, `WEBSITE_REDIRECT`, as part of this
// supplement (see `AdAngle.ts` docstring) — the spec's own `ANGLE_USP_MAP` literal only covers
// the original 6 members, so an entry for `WEBSITE_REDIRECT` is added here to keep this map a
// total `Record<AdAngle, ...>`.
export const ANGLE_USP_MAP: Record<AdAngle, ReadonlyArray<string>> = {
  [AdAngle.DP_RINGAN]: [
    "DP mulai 10 juta sudah bisa bawa pulang",
    "Simulasi kredit transparan, tanpa biaya tersembunyi",
    "Bekerja sama dengan Dipo Star Finance",
  ],
  [AdAngle.KREDIT_SYARIAH]: [
    "Pembiayaan syariah tersedia — halal, bebas riba",
    "Angsuran tetap, tanpa bunga berbunga",
    "Cocok untuk yang cari ketenangan finansial",
  ],
  [AdAngle.GUDANGNYA]: [
    "Stok puluhan unit ready, pilih langsung di showroom",
    "Inspeksi 150+ titik, bukan tebak-tebakan kondisi",
    "Diverifikasi Otospector — penilaian objektif",
  ],
  [AdAngle.QNA]: [
    "Tanya apa saja — kami jawab jujur",
    "Harga transparan, tidak ada biaya tersembunyi",
    "Garansi tersedia untuk ketenangan pikiran",
  ],
  [AdAngle.DISCOVERY]: [
    "Budget X juta bisa dapat mobil berkualitas",
    "Inspeksi 150+ titik, garansi tersedia",
    "Pilihan lengkap: MPV, Sedan, SUV, city car",
  ],
  [AdAngle.TESTIMONIAL]: [
    "Ribuan unit sudah terjual, ribuan keluarga puas",
    "Xtra Aman, Xtra Yakin — bukan sekadar slogan",
    "Cek review pelanggan kami di Google",
  ],
  [AdAngle.WEBSITE_REDIRECT]: [
    "Katalog lengkap tersedia di mobixbydss.id",
    "Cek semua unit ready tanpa perlu ke showroom dulu",
    "Simulasi kredit online via mocil.id",
  ],
};

// ── Top Unit Profiles ────────────────────────────────────────
export const TOP_UNITS: UnitProfile[] = [
  {
    model: "Xpander",
    brand: "Mitsubishi",
    type: "MPV",
    priceRange: { min: 160_000_000, max: 280_000_000 },
    targetPersona: TargetPersona.PRIMARY_FAMILY,
    bestAngles: [AdAngle.GUDANGNYA, AdAngle.DP_RINGAN, AdAngle.QNA],
    branches: [Branch.BINTARO, Branch.CINERE],
    sellingPoints: ["Kabin lega keluarga", "Bodi kokoh", "Suku cadang murah"],
  },
  {
    model: "Brio",
    brand: "Honda",
    type: "City Car",
    priceRange: { min: 100_000_000, max: 185_000_000 },
    targetPersona: TargetPersona.PRIMARY_FAMILY,
    bestAngles: [AdAngle.DP_RINGAN, AdAngle.KREDIT_SYARIAH, AdAngle.DISCOVERY],
    branches: [Branch.BINTARO, Branch.CINERE, Branch.UMUM], // spec: incl. Branch.PONDOK_BAMBU — see MOBIX_LOCATIONS note
    sellingPoints: ["Irit BBM", "Cocok first car buyer", "Parkir mudah"],
  },
  {
    model: "Avanza",
    brand: "Toyota",
    type: "MPV",
    priceRange: { min: 130_000_000, max: 220_000_000 },
    targetPersona: TargetPersona.PRIMARY_FAMILY,
    bestAngles: [AdAngle.DP_RINGAN, AdAngle.GUDANGNYA, AdAngle.DISCOVERY],
    branches: [Branch.BINTARO, Branch.CINERE, Branch.BANDUNG],
    sellingPoints: ["Raja MPV Indonesia", "Nilai jual kembali tinggi", "Keluarga besar"],
  },
  {
    model: "Raize",
    brand: "Toyota",
    type: "SUV Compact",
    priceRange: { min: 185_000_000, max: 260_000_000 },
    targetPersona: TargetPersona.PRIMARY_FAMILY,
    bestAngles: [AdAngle.DISCOVERY, AdAngle.DP_RINGAN, AdAngle.QNA],
    branches: [Branch.CINERE, Branch.BINTARO],
    sellingPoints: ["SUV terjangkau", "Mesin turbo", "Anak muda aktif"],
  },
  {
    model: "Rush",
    brand: "Toyota",
    type: "SUV",
    priceRange: { min: 200_000_000, max: 300_000_000 },
    targetPersona: TargetPersona.PRIMARY_FAMILY,
    bestAngles: [AdAngle.DP_RINGAN, AdAngle.GUDANGNYA],
    branches: [Branch.BINTARO, Branch.BANDUNG],
    sellingPoints: ["7 penumpang", "Ground clearance tinggi", "Perjalanan jauh"],
  },
  {
    model: "Stargazer",
    brand: "Hyundai",
    type: "MPV",
    priceRange: { min: 210_000_000, max: 290_000_000 },
    targetPersona: TargetPersona.PRIMARY_FAMILY,
    bestAngles: [AdAngle.DISCOVERY, AdAngle.QNA],
    branches: [Branch.CINERE, Branch.BANDUNG],
    sellingPoints: ["MPV modern", "Desain futuristik", "Fitur lengkap"],
    note: "High Rp/D3 on Bandung — needs angle refresh",
  },
];

// ── S1: Known Seed Baselines (from MAAO 2 July 2026) ──────────
// Spec-consistency note: `Branch.BOOST_ORGANIK` (from the spec's literal seed data) does not
// exist in the real `Branch` enum — mapped to `Branch.BOOST`, the real enum member the
// connector's own `BranchExtractor` produces for "Boost"/"boost"-named campaigns (see that
// enum's own docstring), which is the closest real match to "boost organik" reach campaigns.
export const KNOWN_PERFORMANCE_BASELINES: PerformanceBaseline[] = [
  { branch: Branch.BOOST, funnel: Funnel.BRAND_BOOST, avgRphLead: 6499, sampleSize: 2037 },
  { branch: Branch.CINERE, funnel: Funnel.CTWA, avgRphLead: 6919, sampleSize: 227 },
  { branch: Branch.BINTARO, funnel: Funnel.CTWA, avgRphLead: 7059, sampleSize: 219 },
  { branch: Branch.MULTI, funnel: Funnel.BRAND_BOOST, avgRphLead: 17593, sampleSize: 444 },
  { branch: Branch.BANDUNG, funnel: Funnel.DM, avgRphLead: 42621, sampleSize: 41 },
];

export const KNOWN_EVERGREEN_PATTERNS: EvergreenPatternSeed[] = [
  { angle: AdAngle.DP_RINGAN, avgDaysHealthy: 45, topPerformer: true },
  { angle: AdAngle.KREDIT_SYARIAH, avgDaysHealthy: 60, topPerformer: true },
  { angle: AdAngle.GUDANGNYA, avgDaysHealthy: 55, topPerformer: true },
  { angle: AdAngle.QNA, avgDaysHealthy: 30, topPerformer: false },
  { angle: AdAngle.WEBSITE_REDIRECT, avgDaysHealthy: 7, topPerformer: false },
];

const KNOWN_FATIGUE_PATTERN_SEEDS: ReadonlyArray<FatiguePattern> = [
  { funnel: Funnel.CTWA, avgDaysToFatigue: 28 },
  { funnel: Funnel.BRAND_BOOST, avgDaysToFatigue: 21 },
  { funnel: Funnel.DM, avgDaysToFatigue: 35 },
  { funnel: Funnel.WEBSITE_LEAD, avgDaysToFatigue: 14 },
];

/** funnel → avg days before frequency > 3.5 (spec: "Known Fatigue Patterns"). */
export const KNOWN_FATIGUE_PATTERNS: ReadonlyMap<Funnel, number> = toFatiguePatternMap(
  KNOWN_FATIGUE_PATTERN_SEEDS,
);

// ═══════════════════════════════════════════════════════════════════════════════════════
// AAOS-W1D-S3 — Outcome Leads + CTWA defaults (DSS Motor's real strategy: lead clicks ad →
// straight to Jessy on WhatsApp → follow up → HOT → handoff). New additions (coordinator note
// correction #4 — neither constant existed in this file before this supplement).
// ═══════════════════════════════════════════════════════════════════════════════════════

/**
 * DSS Motor's default campaign-creation settings — used by `CreativeBriefBuilder` (and any
 * future Samantha campaign-creation flow) to populate CTWA-specific fields. `ctwaDestination`
 * (per-branch WhatsApp phone numbers) is deliberately NOT included here — coordinator note
 * correction #6: those numbers must come from `MetaAdsAgentConfig.ctwaPhoneNumbers` (itself
 * populated by `apps/aaos-api`'s config layer from real env vars), never hardcoded or read from
 * `process.env` inside this package.
 */
export const AAOS_CAMPAIGN_DEFAULTS = {
  objective: CampaignObjective.OUTCOME_LEADS,
  destinationType: AdDestinationType.WHATSAPP,
  optimizationGoal: "LEAD_GENERATION",
  billingEvent: "IMPRESSIONS",
  callToAction: "SEND_WHATSAPP_MESSAGE",
} as const;

/**
 * Every `CampaignObjective` that is NOT DSS Motor's correct objective — for this package's OWN
 * purposes only (e.g. building human-readable recommendation/digest text; see
 * `GenerateRecommendation`/`DailyDigestBuilder`). Coordinator note correction #1/#4: derived
 * (`!== OUTCOME_LEADS`) rather than a hardcoded partial list, so it automatically stays correct
 * as `CampaignObjective` gains members — same reasoning as `@aos/meta-ads-connector`'s
 * `VerdictEngine.ts` FIX check, which is the actual, independent source of truth for the FIX
 * verdict itself; this constant is NOT imported by connector and does not feed that decision.
 */
export const FIX_OBJECTIVES: ReadonlyArray<CampaignObjective> = Object.values(
  CampaignObjective,
).filter((objective) => objective !== CampaignObjective.OUTCOME_LEADS);
