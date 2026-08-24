import { Injectable } from "@nestjs/common";

/** Matches `PublishTargetSchema` (`dto/scheduled-post.dto.ts`) field-for-field. */
export type PendingPublishTarget =
  | { readonly platform: "FACEBOOK"; readonly pageId: string; readonly accessToken: string }
  | { readonly platform: "INSTAGRAM"; readonly igUserId: string; readonly accessToken: string };

/**
 * In-process-memory-ONLY holding spot for a manager-pasted Meta access token attached to a
 * `SCHEDULED` post at create/update time (AAOS-SOSMED-AUTOMATION Phase 3), so
 * `SosmedSchedulerService`'s `@Cron` loop has something to publish with before OAuth exists
 * (Phase 4).
 *
 * Deliberately NEVER written to Supabase or any other durable store, and NEVER logged:
 * `scheduled_posts` (see `supabase/migrations/014_sosmed.sql`) has no `access_token` column, and
 * adding one would reopen the exact credential-custody question the coordinator note flags for
 * `sosmed_accounts.access_token` (encrypted at rest? plaintext relying on Supabase's own
 * encryption? — verified against neither before assuming) for a table this phase deliberately
 * keeps out of that discussion. A plain in-memory `Map`, scoped to this one Nest provider
 * instance, is the smallest capability that (a) lets the scheduler actually call
 * `SosmedPublishingService` for a token supplied ahead of time, and (b) guarantees the credential
 * never touches disk, a log line, or a second process — it is lost on every restart/redeploy,
 * which is an acceptable, correct trade-off for a manually-pasted token whose real, durable
 * replacement is Phase 4's OAuth flow.
 *
 * Single-instance-only limitation, same as every other in-memory/single-composition-root
 * assumption this session (coordinator note point 3): this app composes for exactly ONE
 * tenant/ONE process at bootstrap, so a plain in-memory map is not the correctness gap it would be
 * in a horizontally-scaled deployment.
 */
@Injectable()
export class PendingAccessTokenStore {
  private readonly targets = new Map<string, PendingPublishTarget>();

  set(postId: string, target: PendingPublishTarget): void {
    this.targets.set(postId, target);
  }

  get(postId: string): PendingPublishTarget | undefined {
    return this.targets.get(postId);
  }

  delete(postId: string): void {
    this.targets.delete(postId);
  }
}
