import { BranchId } from "@aos/branch-manager";
import { z } from "zod";

/** `GET /api/v1/leads` query — filters by branch, per `docs/PROMPT-AAOS-W2E-LEAD-STORE.md`'s `GetLeadsByBranch` use case. */
export const GetLeadsQuerySchema = z.object({
  branchId: z.nativeEnum(BranchId),
});

export type GetLeadsQueryDto = z.infer<typeof GetLeadsQuerySchema>;
