import { z } from "zod";

const text = z.string().trim().min(1).max(4000);
const texts = z.array(text).max(50);
const uuid = z.string().uuid();
export const CreativeOutputSchema = z.object({
  type: z.enum(["IMAGE", "VIDEO", "CAROUSEL"]),
  quantity: z.number().int().min(1).max(10),
  aspectRatios: z
    .array(z.enum(["1:1", "4:5", "9:16", "16:9"]))
    .min(1)
    .max(4),
});
const ClaimSchema = z.object({
  text,
  sourceId: text,
  sourceLocator: text,
  sourceType: z.enum(["LISTING", "KNOWLEDGE"]),
});

/** Versioned Samantha/manual handoff. Empty required fields never qualify as READY. */
export const StructuredCreativeBriefSchema = z
  .object({
    schemaVersion: z.literal(1),
    briefId: uuid,
    tenantId: text,
    sourceType: z.enum(["LISTING", "PRODUCT"]),
    listingId: uuid.optional(),
    productId: text.optional(),
    campaignDraftId: uuid,
    campaignId: text.optional(),
    samanthaDecisionId: text.optional(),
    objective: text,
    optimizationGoal: text,
    targetAudience: z.object({
      segments: texts.min(1),
      geo: z
        .array(z.object({ name: text, radiusKm: z.number().positive().max(100).optional() }))
        .min(1)
        .max(20),
      ageRange: z
        .object({ min: z.number().int().min(18), max: z.number().int().max(100) })
        .optional(),
      interests: z
        .array(z.object({ id: text, name: text }))
        .max(50)
        .optional(),
      buyerIntent: texts.min(1),
      validationStatus: z.literal("DRAFT_NOT_META_VALIDATED"),
    }),
    personas: texts.min(1),
    offer: z.object({
      primaryOffer: text.optional(),
      price: z.number().positive().optional(),
      financing: text.optional(),
      promo: text.optional(),
      verifiedClaims: z.array(ClaimSchema).max(100),
    }),
    creativeStrategy: z.object({
      primaryAngles: texts.min(1),
      secondaryAngles: texts,
      winningPatterns: texts,
      fatiguedPatterns: texts,
      preserve: texts.min(1),
      avoid: texts.min(1),
      explore: texts,
    }),
    formats: z.array(CreativeOutputSchema).min(1).max(3),
    tone: text,
    CTA: z.object({
      label: text,
      destination: text,
      destinationType: z.enum(["WHATSAPP", "LEAD_FORM", "WEBSITE"]),
    }),
    conceptCount: z.number().int().min(1).max(10),
    brandRules: texts.min(1),
    factualClaims: z.array(ClaimSchema).min(1).max(100),
    knowledgeSourceIds: texts,
    simulationPolicy: z.enum(["REQUIRED", "OPTIONAL", "SKIPPED"]),
    createdBy: z.enum(["SAMANTHA", "MANUAL"]),
    strategyMethod: z.enum(["LISTING_RULES", "LLM", "MANUAL"]),
  })
  .superRefine((brief, ctx) => {
    const add = (path: (string | number)[], message: string) =>
      ctx.addIssue({ code: "custom", path, message });
    if (brief.sourceType === "LISTING" && !brief.listingId)
      add(["listingId"], "Listing diperlukan");
    if (brief.sourceType === "PRODUCT" && !brief.productId)
      add(["productId"], "Product diperlukan");
    if (new Set(brief.formats.map((f) => f.type)).size !== brief.formats.length)
      add(["formats"], "Format tidak boleh duplikat");
    if (brief.formats.reduce((sum, f) => sum + f.quantity, 0) !== brief.conceptCount)
      add(["conceptCount"], "Jumlah konsep harus sama dengan jumlah output");
    const age = brief.targetAudience.ageRange;
    if (age && age.min > age.max) add(["targetAudience", "ageRange"], "Rentang usia tidak valid");
    if (
      brief.CTA.destinationType === "WHATSAPP" &&
      !/^\+?[1-9]\d{7,14}$/.test(brief.CTA.destination)
    )
      add(["CTA", "destination"], "Nomor WhatsApp tidak valid");
    if (brief.CTA.destinationType === "WEBSITE") {
      try {
        if (new URL(brief.CTA.destination).protocol !== "https:") throw new Error();
      } catch {
        add(["CTA", "destination"], "URL HTTPS diperlukan");
      }
    }
    for (const [index, claim] of brief.factualClaims.entries()) {
      if (claim.sourceType === "KNOWLEDGE" && !brief.knowledgeSourceIds.includes(claim.sourceId))
        add(["factualClaims", index, "sourceId"], "Sumber knowledge tidak tercantum");
      if (claim.sourceType === "LISTING" && claim.sourceId !== brief.listingId)
        add(["factualClaims", index, "sourceId"], "Klaim bukan dari listing ini");
    }
    for (const [index, claim] of brief.offer.verifiedClaims.entries()) {
      if (
        !brief.factualClaims.some(
          (fact) =>
            fact.text === claim.text &&
            fact.sourceId === claim.sourceId &&
            fact.sourceLocator === claim.sourceLocator &&
            fact.sourceType === claim.sourceType,
        )
      )
        add(
          ["offer", "verifiedClaims", index],
          "Klaim terverifikasi harus memiliki provenance pada factualClaims",
        );
    }
    for (const field of ["promo", "financing"] as const) {
      if (
        brief.offer[field] &&
        !brief.offer.verifiedClaims.some((claim) => claim.text === brief.offer[field])
      )
        add(["offer", field], "Promo/pembiayaan memerlukan klaim terverifikasi dengan sumber");
    }
  });

export type StructuredCreativeBrief = z.infer<typeof StructuredCreativeBriefSchema>;
export type BriefValidation =
  | { status: "READY"; brief: StructuredCreativeBrief; missingFields: [] }
  | { status: "NEEDS_INPUT"; missingFields: string[] };

/** Returns actionable field paths instead of allowing incomplete briefs into production. */
export function validateCreativeBrief(input: unknown): BriefValidation {
  const parsed = StructuredCreativeBriefSchema.safeParse(input);
  return parsed.success
    ? { status: "READY", brief: parsed.data, missingFields: [] }
    : {
        status: "NEEDS_INPUT",
        missingFields: [...new Set(parsed.error.issues.map((i) => i.path.join(".")))],
      };
}
