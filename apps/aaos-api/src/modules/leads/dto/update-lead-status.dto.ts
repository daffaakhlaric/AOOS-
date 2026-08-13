import { LeadStatus } from "@aos/lead-store";
import { z } from "zod";

/** `PUT /api/v1/leads/:id/status` body. `@aos/lead-store`'s `transitionLeadStatus` rejects `ASSIGNED`/`CLOSED` as a target (those are only reachable via `claim`/closing) — enforced by `UpdateLeadStatus` itself, not re-validated here. */
export const UpdateLeadStatusBodySchema = z.object({
  status: z.nativeEnum(LeadStatus),
});

export type UpdateLeadStatusBodyDto = z.infer<typeof UpdateLeadStatusBodySchema>;
