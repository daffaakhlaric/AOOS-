import { Inject, Injectable, Logger, Optional } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";

import type { AaosApiConfig } from "../../config/aaos-api.config.js";
import { AAOS_API_CONFIG } from "../../di-tokens.js";

import { SosmedPostsService } from "./application/sosmed-posts.service.js";
import { ScheduledPostRepository } from "./infrastructure/scheduled-post.repository.js";

/**
 * `@Cron` scheduler for `scheduled_posts` (AAOS-SOSMED-AUTOMATION Phase 3) — the spec's
 * `checkAndPublishScheduled`/`publishPost` pseudocode, using the REAL
 * `ScheduledPostRepository`/`SosmedPostsService` built in Phases 1-3.
 *
 * Deliberately its OWN small `@Cron('* * * * *')`, NOT wired into `SchedulerService`'s
 * `calendar_events` due-window mechanism — the coordinator note's own phase split puts "the
 * scheduler" in Phase 3 and "Kalender integration" (the 4 `SOSMED_*` `calendar_events` event
 * types) in Phase 5; this loop must stay self-contained in `modules/sosmed` until that phase
 * exists, per this session's explicit instruction.
 *
 * Publishing itself is delegated to `SosmedPostsService.publishNow(post.id)` (no `body`) — the
 * SAME method the manager-triggered `POST .../publish-now` endpoint uses, so there is exactly one
 * real "call Meta and update status" implementation, not two. Without a `body`, `publishNow` falls
 * back to whatever `publishTarget` (platform + Page/IG id + access token) was supplied at
 * create/update time via `PendingAccessTokenStore` — see that store's docstring for why nothing is
 * ever persisted to Supabase. A `SCHEDULED` post with no `publishTarget` ever supplied (the common
 * case until OAuth/Phase 4 exists) is honestly marked `FAILED` with a clear, actionable
 * `error_message` rather than silently retried forever or fabricated as `PUBLISHED`.
 */
@Injectable()
export class SosmedSchedulerService {
  private readonly logger = new Logger(SosmedSchedulerService.name);

  constructor(
    @Inject(AAOS_API_CONFIG) private readonly config: AaosApiConfig,
    private readonly repository: ScheduledPostRepository,
    private readonly postsService: SosmedPostsService,
    // `@Optional()` — see `AbTestingService`'s own `now` param doc; a bare `Function`-typed
    // constructor param with only a default value still gets a real DI resolution attempt from
    // Nest without this, crashing bootstrap.
    @Optional() private readonly now: () => Date = () => new Date(),
  ) {}

  /** Checked every minute (spec: `@Cron('* * * * *')`) — every due `SCHEDULED` post is published, detached, so a slow/failed publish never blocks the next tick or the next post. */
  @Cron("* * * * *")
  async checkAndPublishScheduled(): Promise<void> {
    const nowIso = this.now().toISOString();
    const due = await this.repository.listDueScheduled(this.config.AAOS_TENANT_ID, nowIso);
    for (const post of due) {
      await this.publishPost(post.id).catch((caught) => {
        this.logger.error(
          `SosmedSchedulerService.checkAndPublishScheduled: publishPost(${post.id}) rejected: ${String(caught)}`,
        );
      });
    }
  }

  /** Spec's `publishPost` — status transitions (`PUBLISHING` -> `PUBLISHED`/`FAILED`) happen inside `SosmedPostsService.publishNow` itself; this just calls it and lets a failure surface as a rejected promise the cron tick above logs and moves past. */
  async publishPost(postId: string): Promise<void> {
    await this.postsService.publishNow(postId);
  }
}
