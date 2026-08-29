import { AdAngle, TargetPersona } from "@aos/meta-ads-agent";
import { Branch } from "@aos/meta-ads-connector";
import { z } from "zod";

/**
 * `POST /api/v1/creative-packages` — a brief a HUMAN composed (Tab "Buat Manual") or a
 * Samantha-recommended brief a HUMAN approved (Tab "Rekomendasi Samantha"). Both paths land here;
 * `origin` records which.
 *
 * Every enum below is the REAL enum, validated with `z.nativeEnum` so a fabricated member is
 * rejected with a 422 rather than persisted:
 * - `angle` → `@aos/meta-ads-agent`'s `AdAngle` (7 members, including the real `WEBSITE_REDIRECT`;
 *   there is no `PROMO` member in this codebase).
 * - `branch` → `@aos/meta-ads-connector`'s `Branch`.
 * - `format` → `@aos/creative-agent`'s real `CreativeFormat`, a package-level two-value decision
 *   ("Video + Gambar" vs "Gambar saja"). The per-asset `VIDEO_15S`/`IMAGE_SQUARE`/... tags are an
 *   internal `CreativeBrief.formats` detail (`FormatDecider` reads them to pick duration/aspect
 *   ratio); `creative-brief.factory.ts` maps this two-value choice onto them.
 *
 * `generate: true` means "a human pressed 'Kirim ke Kai — Generate Sekarang'" and is the ONLY way
 * real Kie AI spend is ever incurred. Omitted/false persists a `DRAFT` and calls nothing.
 */
export const CreatePackageBodySchema = z.object({
  /**
   * The scraped unit's `identityKey` — the exact value `assets.unit_id` holds and therefore the
   * exact key `@aos/asset-library`'s `GetAssetsByUnit` (which Kai calls) matches on. The dashboard
   * picks this from `GET /api/v1/scraper/stock`, never free text, so the photos shown in the
   * picker are the same photos Kai will really find.
   */
  unit: z.string().trim().min(1),
  /** Human-readable model for display only (`scraped_units.model`). */
  unitModel: z.string().trim().min(1).optional(),
  branch: z.nativeEnum(Branch),
  angle: z.nativeEnum(AdAngle),
  targetPersona: z.nativeEnum(TargetPersona).default(TargetPersona.PRIMARY_FAMILY),
  primaryMessage: z.string().trim().min(1),
  format: z.enum(["VIDEO_AND_IMAGES", "IMAGES_ONLY"]),
  urgency: z.enum(["HIGH", "MEDIUM", "LOW"]).default("MEDIUM"),
  /** Optional display title; defaults to `"<unitModel|unit> <branch> · <angle>"` when omitted. */
  title: z.string().trim().min(1).optional(),
  origin: z.enum(["MANUAL", "SAMANTHA"]).default("MANUAL"),
  /** Real Meta ad id + `#C`-style stable id, set only for a Samantha REFRESH-verdict brief. */
  adId: z.string().trim().min(1).optional(),
  stableId: z.string().trim().min(1).optional(),
  /** Why this creative is being made — free text from the manager, or Samantha's real REFRESH reason. */
  reason: z.string().trim().min(1).optional(),
  generate: z.boolean().default(false),
});
export type CreatePackageBodyDto = z.infer<typeof CreatePackageBodySchema>;

/** `GET /api/v1/creative-packages?status=&limit=` — omitting `status` lists every package. */
export const GetPackagesQuerySchema = z.object({
  status: z.enum(["DRAFT", "GENERATING", "PENDING", "APPROVED", "REJECTED", "FAILED"]).optional(),
  limit: z.coerce.number().int().positive().max(200).default(100),
});
export type GetPackagesQueryDto = z.infer<typeof GetPackagesQuerySchema>;

/** `GET /api/v1/creative-packages/logs?packageId=&eventType=&sinceHours=&limit=` */
export const GetLogsQuerySchema = z.object({
  packageId: z.string().uuid().optional(),
  eventType: z
    .enum(["BRIEF_SENT", "GENERATE", "COMPLETE", "ERROR", "APPROVED", "REJECTED"])
    .optional(),
  /** Relative lower bound in hours (24 = "Hari ini", 168 = "7 hari"). Omitted = no bound. */
  sinceHours: z.coerce.number().int().positive().max(8760).optional(),
  limit: z.coerce.number().int().positive().max(500).default(100),
});
export type GetLogsQueryDto = z.infer<typeof GetLogsQuerySchema>;
