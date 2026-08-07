import { z } from "zod";

/** Log entry recorded by the Pipeline's Logging stage. */
export const marketplaceLogEntrySchema = z.object({
  sequence: z.number().int().min(0),
  level: z.string().min(1),
  operation: z.string().min(1),
  message: z.string().min(1),
  occurredAt: z.string().datetime(),
});

export type MarketplaceLogEntry = z.infer<typeof marketplaceLogEntrySchema>;
