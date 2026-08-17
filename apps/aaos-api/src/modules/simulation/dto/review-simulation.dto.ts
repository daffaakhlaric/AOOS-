import { z } from "zod";

/**
 * `POST /api/v1/simulation/:id/approve` / `.../reject` bodies — hard scope boundary: this records
 * ONLY the manager's decision on the simulation record (for the history tab). It must NOT execute
 * `/api/verdicts`, must NOT create a Meta campaign, must NOT touch WhatsApp/CAPI — see this
 * module's `simulation.service.ts` class doc.
 */
export const ReviewSimulationBodySchema = z.object({
  decidedBy: z.string().min(1).optional(),
  notes: z.string().min(1).optional(),
});
export type ReviewSimulationBodyDto = z.infer<typeof ReviewSimulationBodySchema>;
