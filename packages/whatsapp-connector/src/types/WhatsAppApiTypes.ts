import { z } from "zod";

/** Raw WhatsApp Cloud API v21.0 response/request shapes plus their Zod validators. */

export const WaSendMessageResponseSchema = z.object({
  messaging_product: z.literal("whatsapp"),
  contacts: z.array(z.object({ input: z.string(), wa_id: z.string() })),
  messages: z.array(z.object({ id: z.string() })),
});
export type WaSendMessageResponse = z.infer<typeof WaSendMessageResponseSchema>;

export const WaErrorResponseSchema = z.object({
  error: z.object({
    message: z.string(),
    type: z.string().optional(),
    code: z.number().optional(),
    error_subcode: z.number().optional(),
    fbtrace_id: z.string().optional(),
  }),
});
export type WaErrorResponse = z.infer<typeof WaErrorResponseSchema>;

export const WaTemplateComponentParameterSchema = z.object({
  type: z.literal("text"),
  text: z.string(),
});
export type WaTemplateComponentParameter = z.infer<typeof WaTemplateComponentParameterSchema>;

export const WaTemplateComponentSchema = z.object({
  type: z.literal("body"),
  parameters: z.array(WaTemplateComponentParameterSchema),
});
export type WaTemplateComponent = z.infer<typeof WaTemplateComponentSchema>;

export const WaInteractiveButtonSchema = z.object({
  type: z.literal("reply"),
  reply: z.object({ id: z.string(), title: z.string() }),
});
export type WaInteractiveButton = z.infer<typeof WaInteractiveButtonSchema>;
