import { z } from "zod";

/** `POST /api/v1/leads/:id/claim` body — the sales human claiming this lead. `branchId`/`assignmentMode` are NOT client input: the service derives `branchId` from the fetched `Lead` and always uses `AssignmentMode.MANUAL` (AAOS-W4B coordinator note #3 — no `@aos/branch-manager` involvement). */
export const ClaimLeadBodySchema = z.object({
  salesHumanId: z.string().min(1, "salesHumanId must not be empty"),
});

export type ClaimLeadBodyDto = z.infer<typeof ClaimLeadBodySchema>;
