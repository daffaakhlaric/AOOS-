import { z } from "zod";

/** Raw Meta WhatsApp Cloud API webhook payload shapes plus their Zod validators, per the spec's "Webhook Payload Structure" section. */

export const WaWebhookContactSchema = z.object({
  profile: z.object({ name: z.string() }),
  wa_id: z.string(),
});
export type WaWebhookContact = z.infer<typeof WaWebhookContactSchema>;

export const WaWebhookInteractiveSchema = z.object({
  type: z.enum(["button_reply", "list_reply"]),
  button_reply: z.object({ id: z.string(), title: z.string() }).optional(),
  list_reply: z.object({ id: z.string(), title: z.string() }).optional(),
});
export type WaWebhookInteractive = z.infer<typeof WaWebhookInteractiveSchema>;

export const WaWebhookMessageTypeSchema = z.enum([
  "text",
  "image",
  "audio",
  "document",
  "interactive",
  "button",
]);
export type WaWebhookMessageType = z.infer<typeof WaWebhookMessageTypeSchema>;

export const WaWebhookMessageSchema = z.object({
  from: z.string(),
  id: z.string(),
  timestamp: z.string(),
  type: WaWebhookMessageTypeSchema,
  text: z.object({ body: z.string() }).optional(),
  interactive: WaWebhookInteractiveSchema.optional(),
});
export type WaWebhookMessage = z.infer<typeof WaWebhookMessageSchema>;

export const WaWebhookStatusSchema = z.object({
  id: z.string(),
  status: z.enum(["sent", "delivered", "read", "failed"]),
  timestamp: z.string(),
  recipient_id: z.string(),
  errors: z.array(z.object({ code: z.number(), title: z.string() })).optional(),
});
export type WaWebhookStatus = z.infer<typeof WaWebhookStatusSchema>;

export const WaWebhookValueSchema = z.object({
  messaging_product: z.literal("whatsapp"),
  metadata: z.object({
    display_phone_number: z.string(),
    phone_number_id: z.string(),
  }),
  contacts: z.array(WaWebhookContactSchema).optional(),
  messages: z.array(WaWebhookMessageSchema).optional(),
  statuses: z.array(WaWebhookStatusSchema).optional(),
});
export type WaWebhookValue = z.infer<typeof WaWebhookValueSchema>;

export const WaWebhookChangeSchema = z.object({
  value: WaWebhookValueSchema,
  field: z.literal("messages"),
});
export type WaWebhookChange = z.infer<typeof WaWebhookChangeSchema>;

export const WaWebhookEntrySchema = z.object({
  id: z.string(),
  changes: z.array(WaWebhookChangeSchema),
});
export type WaWebhookEntry = z.infer<typeof WaWebhookEntrySchema>;

export const WaWebhookPayloadSchema = z.object({
  object: z.literal("whatsapp_business_account"),
  entry: z.array(WaWebhookEntrySchema),
});
export type WaWebhookPayload = z.infer<typeof WaWebhookPayloadSchema>;
