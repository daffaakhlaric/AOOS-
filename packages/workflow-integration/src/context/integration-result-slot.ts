import { z } from "zod";

/** The zod shape mirroring `contracts/integration-result.ts`'s `IntegrationResult` — used for every `*Result` slot on `WorkflowIntegrationContext`. */
export const integrationResultSlotSchema = z.object({
  success: z.boolean(),
  output: z.record(z.unknown()).optional(),
  error: z.string().optional(),
});

export type IntegrationResultSlot = z.infer<typeof integrationResultSlotSchema>;
