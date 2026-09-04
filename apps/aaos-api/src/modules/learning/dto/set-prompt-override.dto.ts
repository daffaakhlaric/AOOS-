import { z } from "zod";

/**
 * `PUT /api/v1/learning/prompt-overrides/:tenantId/:agent/:promptKey` body — a real, direct,
 * human/coordinator-authored prompt-override write (a legitimate, additive capability gap this
 * phase fills: `PromptOverrideService.applyApproved` already existed as the real
 * deactivate-then-insert write, but its only caller was `LearningDecisionService.approve`, gated
 * behind an LLM-originated `learning_proposals` row — there was no direct "set this override to
 * this content right now" path for a human/coordinator-authored change, unlike `agent_configs`
 * which already has one via `PUT /api/v1/learning/configs` / `AgentConfigService.set`). Mirrors
 * that endpoint's own real shape: `PUT`, not `POST` — idempotent "set this key to this content"
 * semantics, matching `applyApproved`'s own real upsert-by-`(tenantId, agent, promptKey)` behavior
 * (deactivate current active row, insert a new active one at `maxVersion + 1`).
 */
export const SetPromptOverrideBodySchema = z.object({
  content: z.string().min(1),
});
export type SetPromptOverrideBodyDto = z.infer<typeof SetPromptOverrideBodySchema>;
