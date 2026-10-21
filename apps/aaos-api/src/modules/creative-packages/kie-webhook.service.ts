import type { ITaskWakeRegistry } from "@aos/creative-connector";
import { Inject, Injectable, Logger, Optional } from "@nestjs/common";


import { TASK_WAKE_REGISTRY } from "../../di-tokens.js";

import type { KieWebhookBodyDto } from "./dto/kie-webhook.dto.js";
import { KaiProductionRepository } from "./infrastructure/kai-production.repository.js";

export interface KieWebhookResult {
  readonly received: true;
  /**
   * `true` when this callback actually woke an in-flight poll (the normal, successful case).
   * `false` is a real, honest, non-crashing outcome for an unknown/already-resolved/duplicate task
   * id — see this class's own doc for exactly when and why, and `KieWebhookSecretGuard` for the
   * cases (missing/invalid secret) that are rejected before ever reaching this service at all.
   */
  readonly handled: boolean;
}

/**
 * PROMPT 53 — KIE WEBHOOK (Phase 41). Handles `POST /api/v1/creative-packages/webhooks/kie`,
 * guarded by `KieWebhookSecretGuard` (see that class's own doc for the real, honest limits of what
 * authenticity verification is possible here — Kie AI's real API has no signature scheme).
 *
 * DELIBERATE DESIGN: this service does NOT parse `successFlag`/`videoUrl`/`imageUrl` out of the
 * webhook body and does NOT call into `CreativePackagesService`/`repository.complete` itself. It
 * only extracts `data.taskId` (already Zod-validated by `KieWebhookBodySchema` at the controller
 * boundary — a malformed body never reaches here) and wakes `TaskWakeRegistry` for it
 * (`@aos/creative-connector`, the SAME registry instance `CreativeConnectorFactory` composed
 * `TaskPoller` with in `app.module.ts`). Waking a poller makes it skip the rest of its current
 * backoff sleep and immediately re-poll Kie AI's own trusted `GET /api/v1/jobs/{taskId}` — the
 * EXACT SAME completion-handling code path (`TaskPoller.handleFlag`/`buildCompletedTask`, then
 * `CreativeOrchestratorService`, then `CreativePackagesService.runGeneration*`'s existing
 * `repository.complete`/`persistGeneratedMedia`/QA logic) that already runs for a normal poll
 * completion — reused verbatim, not duplicated, and never fed untrusted webhook-body data as if it
 * were verified generation output.
 *
 * IDEMPOTENCY: `ITaskWakeRegistry.wake()` is itself idempotent (its own doc: "calling this twice
 * ... is always safe"). A duplicate/replayed Kie AI callback for the same `taskId` either wakes a
 * still-in-flight poller again (harmless — it just re-polls slightly early a second time, still
 * only actually completing the job once, since a completed poll returns and is never re-entered)
 * or finds nothing left to wake (the poll already finished) — either way, `CreativePackagesService`
 * `.repository.complete` is invoked AT MOST ONCE per real generation attempt, exactly as it always
 * was before this phase, because nothing about that completion path changed.
 *
 * `wakeRegistry` is `undefined` on any deployment where the Kai/Kie AI pipeline itself isn't
 * composed (`KAI_AGENT_RUNTIME` undefined — no `KIE_AI_API_KEY`/asset library) — same
 * graceful-degradation discipline as every other optional token in this app. A callback reaching
 * this service on such a deployment is real, honest, logged, and safely dropped.
 */
@Injectable()
export class KieWebhookService {
  private readonly logger = new Logger(KieWebhookService.name);

  constructor(
    @Inject(TASK_WAKE_REGISTRY) private readonly wakeRegistry: ITaskWakeRegistry | undefined,
    @Optional() private readonly productionJobs?: KaiProductionRepository,
  ) {}

  async handleCallback(body: KieWebhookBodyDto, correlationId: string): Promise<KieWebhookResult> {
    const taskId = body.data.taskId;
    if (this.productionJobs && (await this.productionJobs.wakeProviderTask(taskId))) {
      this.logger.log(`KIE callback woke persisted production task ${taskId} (${correlationId}).`);
      this.wakeRegistry?.wake(taskId);
      return { received: true, handled: true };
    }

    if (this.wakeRegistry === undefined) {
      this.logger.warn(
        `KieWebhookService: received a callback for task "${taskId}" (correlationId=${correlationId}) but no TaskWakeRegistry is composed on this deployment (Kai/Kie AI pipeline not configured) — dropping, the existing polling loop (if any) remains authoritative.`,
      );
      return { received: true, handled: false };
    }

    const woke = this.wakeRegistry.wake(taskId);
    if (woke) {
      this.logger.log(
        `KieWebhookService: woke an in-flight poll for task "${taskId}" (correlationId=${correlationId}) — it will re-check Kie AI's real status endpoint immediately instead of waiting out its current backoff.`,
      );
    } else {
      this.logger.warn(
        `KieWebhookService: no in-flight poll is waiting on task "${taskId}" in this process (correlationId=${correlationId}) — already completed, a duplicate/replayed callback, an unknown/wrong id, or a different replica is handling it. Safe, idempotent no-op; the existing polling loop remains authoritative and will complete the job on its own either way.`,
      );
    }
    return { received: true, handled: woke };
  }
}
