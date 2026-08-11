import { z } from "zod";

/**
 * Raw Meta webhook payload shapes plus their Zod validators, covering the two lead types this
 * package processes: native lead-form submissions (`field: "leadgen"`) and click-to-WhatsApp
 * (CTWA) conversations (`field: "ctwa_message"`).
 *
 * Judgment call: Meta's real webhook payload shape differs by product (Messenger `messaging[]`,
 * WhatsApp Cloud API `messages[]`, Lead Ads `changes[]`) and doesn't publish a single unified
 * "CTWA lead" webhook shape. The spec explicitly asks for "the `entry[].changes[]` structure for
 * both CTWA and Form lead types", so both are modeled here as `changes[]` entries distinguished
 * by `field`, using a `ctwa_message` field name for the CTWA case. This is a reasonable, clearly
 * documented normalization — not a literal Meta wire format — and is called out in the README.
 */

export const MetaFormLeadChangeValueSchema = z.object({
  ad_id: z.string(),
  form_id: z.string(),
  leadgen_id: z.string(),
  created_time: z.number(),
  page_id: z.string().optional(),
});
export type MetaFormLeadChangeValue = z.infer<typeof MetaFormLeadChangeValueSchema>;

export const MetaCtwaChangeValueSchema = z.object({
  ad_id: z.string(),
  waba_id: z.string(),
  phone_number: z.string(),
  ctwa_clid: z.string().optional(),
  timestamp: z.number().optional(),
});
export type MetaCtwaChangeValue = z.infer<typeof MetaCtwaChangeValueSchema>;

export const MetaWebhookChangeSchema = z.discriminatedUnion("field", [
  z.object({ field: z.literal("leadgen"), value: MetaFormLeadChangeValueSchema }),
  z.object({ field: z.literal("ctwa_message"), value: MetaCtwaChangeValueSchema }),
]);
export type MetaWebhookChange = z.infer<typeof MetaWebhookChangeSchema>;

export const MetaWebhookEntrySchema = z.object({
  id: z.string(),
  time: z.number().optional(),
  /** Optional — a 0-change entry (spec edge case: "Webhook with 0 leads in payload") is valid. */
  changes: z.array(MetaWebhookChangeSchema).optional(),
});
export type MetaWebhookEntry = z.infer<typeof MetaWebhookEntrySchema>;

export const MetaWebhookPayloadSchema = z.object({
  object: z.string(),
  entry: z.array(MetaWebhookEntrySchema),
});
export type MetaWebhookPayload = z.infer<typeof MetaWebhookPayloadSchema>;
