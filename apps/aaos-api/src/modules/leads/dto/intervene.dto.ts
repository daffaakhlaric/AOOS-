import { z } from "zod";

/**
 * `POST /api/v1/leads/:id/intervene` body — manager-as-Clara (coordinator note #5). This app has
 * no per-request manager auth/JWT decoding (same "no auth infra beyond the shared `x-api-key`"
 * constraint `SendMessageBodySchema`'s docstring notes) — `managerName` is client-declared,
 * mirroring `salesName` in `SendMessageBodySchema`. Persisted with `sender_type =
 * 'MANAGER_INTERVENTION'`, never `'JESSY'` — the honest correction of the spec's own
 * self-contradictory inline comment (coordinator note #5).
 */
export const InterveneBodySchema = z.object({
  message: z.string().min(1, "message must not be empty"),
  managerName: z.string().min(1).default("Manager"),
});

export type InterveneBodyDto = z.infer<typeof InterveneBodySchema>;
