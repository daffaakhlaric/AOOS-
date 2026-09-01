import { PropertyAdAngle } from "@aos/creative-agent";
import { z } from "zod";

/**
 * `POST /api/v1/creative-packages/property` (K1, `docs/PROMPT-AAOS-PROPERTY-CAMPAIGN-AND-CREATIVE.md`) —
 * a real request to generate a PROPERTY-vertical Kai creative package from a real `listings` row,
 * a genuinely SEPARATE schema/endpoint from `CreatePackageBodySchema` rather than a discriminated
 * union of it.
 *
 * REASONING (per the coordinator's explicit K1 instruction to decide and document this): the two
 * verticals' real fields diverge almost completely — `unit` (scraped `identityKey`),
 * `branch: Branch`, `angle: AdAngle`, and `targetPersona` are all AUTOMOTIVE-only concepts with no
 * PROPERTY equivalent (confirmed directly: `PropertyCreativeBrief` — `contracts/IPropertyPromptBuilder.ts`
 * — carries `listingId`/`propertyType`/`angle: PropertyAdAngle` instead, and has neither `formats`
 * nor `urgency`... but urgency IS still asked of the manager here per the design doc's K1 field
 * list, it just doesn't flow into `PropertyCreativeBrief` itself — `PropertyFormatDecider` derives
 * its own urgency-equivalent tier from `angle` alone). A `z.discriminatedUnion` would also force
 * every EXISTING automotive caller (`ManualBriefForm.tsx`, unmodified in this phase — dashboard
 * wiring is K4, deferred) to start sending a `vertical`/`kind` literal it does not send today,
 * breaking `POST /api/v1/creative-packages` for no real benefit. A separate schema/endpoint is the
 * honest shape: it adds zero risk to the existing AUTOMOTIVE path and doesn't force two structurally
 * unrelated request shapes to pretend they're one union.
 *
 * `angle` is validated with `z.nativeEnum(PropertyAdAngle)` — the real, already-existing 8-member
 * enum `PropertyCopyBuilder`/`PropertyPromptBuilder`/`PropertyFormatDecider` are already exhaustive
 * over — so a fabricated angle is rejected with a 422 before it ever reaches the brief, the same
 * belt-and-braces discipline `CreatePackageBodySchema`'s own docstring establishes for `AdAngle`.
 */
export const PropertyCreatePackageBodySchema = z.object({
  /** The real, tenant-scoped `listings.id` this package is generated from — resolved via `ListingsService.getById`. */
  listingId: z.string().trim().min(1),
  angle: z.nativeEnum(PropertyAdAngle),
  /** Optional free-text primary message from the manager — `PropertyCreativeBrief` has no dedicated field for it, so when given it is recorded on the persisted row for display only, mirroring `reason`'s role. */
  primaryMessage: z.string().trim().min(1).optional(),
  format: z.enum(["VIDEO_AND_IMAGES", "IMAGES_ONLY"]),
  urgency: z.enum(["HIGH", "MEDIUM", "LOW"]).default("MEDIUM"),
  /** Optional display title; defaults to `"<listing.title> · <angle>"` when omitted. */
  title: z.string().trim().min(1).optional(),
  origin: z.enum(["MANUAL", "SAMANTHA"]).default("MANUAL"),
  reason: z.string().trim().min(1).optional(),
  generate: z.boolean().default(false),
});
export type PropertyCreatePackageBodyDto = z.infer<typeof PropertyCreatePackageBodySchema>;
