import { z } from "zod";

/** `POST /api/v1/simulation/:id/rollback` body — optional operator notes only, no confirmation-text gate (rollback is the safety net, not the risky action; the risky action already required "GO LIVE"). */
export const RollbackBodySchema = z.object({
  notes: z.string().min(1).optional(),
});
export type RollbackBodyDto = z.infer<typeof RollbackBodySchema>;
