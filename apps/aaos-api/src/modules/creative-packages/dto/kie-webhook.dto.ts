import { z } from "zod";

/**
 * PROMPT 53 — KIE WEBHOOK (Phase 41). The real, confirmed shape of a Kie AI async-job response
 * body — the SAME `{code, msg, data: {taskId, ...}}` envelope `KieApiResponseMapper
 * .TaskStatusResponseSchema` already validates for the polling GET response (this codebase's only
 * other real, confirmed-live evidence of what Kie AI's JSON actually looks like), since Kie AI's
 * real callback is documented to POST the identical job-status payload to `callBackUrl`.
 *
 * Deliberately requires ONLY `data.taskId` — this handler never trusts the callback body for
 * `successFlag`/`videoUrl`/`imageUrl` (see `KieWebhookService`'s own doc for why: a webhook body
 * can't be cryptographically verified the way Meta's signed payloads can, so it is used purely as
 * a "go re-check now" signal; the actual terminal state always comes from the SAME trusted,
 * authenticated `getTaskStatus` GET `TaskPoller` already calls). Every other field is genuinely
 * optional/unused. `.passthrough()` so an unrecognized real field Kie AI adds later never breaks
 * this endpoint.
 */
export const KieWebhookBodySchema = z
  .object({
    code: z.number().optional(),
    msg: z.string().optional(),
    data: z
      .object({
        taskId: z.string().trim().min(1),
      })
      .passthrough(),
  })
  .passthrough();

export type KieWebhookBodyDto = z.infer<typeof KieWebhookBodySchema>;
