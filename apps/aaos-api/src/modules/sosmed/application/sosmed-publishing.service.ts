import type { Result } from "@aos/common";
import {
  MetaOrganicConnectorFactory,
  type InstagramMediaSpec,
  type MetaGraphApiError,
  type MetaOrganicConnector,
  type PublishFacebookPostOutput,
  type PublishInstagramMediaOutput,
} from "@aos/meta-organic-connector";
import { Injectable } from "@nestjs/common";

export interface PublishFacebookPostRequest {
  readonly pageId: string;
  readonly message: string;
  readonly link?: string;
  /** A valid Page access token, supplied by the caller. No OAuth flow exists yet to populate a token source safely (AAOS-SOSMED-AUTOMATION Phase 2 — see coordinator note point 2 on `docs/PROMPT-AAOS-SOSMED-AUTOMATION.md`). */
  readonly accessToken: string;
}

export interface PublishInstagramPostRequest {
  readonly igUserId: string;
  readonly media: InstagramMediaSpec;
  readonly caption?: string;
  /** A valid IG-scoped user access token, supplied by the caller — same rule as `PublishFacebookPostRequest.accessToken`. */
  readonly accessToken: string;
}

/**
 * `modules/sosmed` (AAOS-SOSMED-AUTOMATION Phase 2) — the `PublishPost`-shaped entry point this
 * module exposes into `@aos/meta-organic-connector`'s real Meta Graph API publishing client.
 * Deliberately NOT wired to a controller endpoint yet: every checklist endpoint that would call
 * this (`POST /api/v1/sosmed/posts`, `.../posts/:id/publish-now`) needs a real per-tenant
 * `sosmed_accounts.access_token` lookup to be honest, and no OAuth flow exists yet to populate
 * that table safely (coordinator note point 2) — that wiring is Phase 3's job (the scheduler
 * phase, which is where a real token source makes sense; manual/pasted tokens can unblock testing
 * before OAuth exists per the coordinator note's phase-3 scope). This service exists now so Phase
 * 3 has a stable, already-tested seam to call into rather than reaching into
 * `@aos/meta-organic-connector` directly.
 *
 * Constructs its own `MetaOrganicConnector` via the factory (no config/DI token required — see
 * `MetaOrganicConnectorFactory`'s docstring for why) rather than a Nest-injected dependency,
 * mirroring how simple this composition is: unlike `META_ADS_CONNECTOR` (provided globally in
 * `app.module.ts`, config-driven, one shared ad-account rate limiter), this connector has no
 * per-tenant config to compose and every call is already parameterized by its target
 * Page/IG-user id and access token.
 */
@Injectable()
export class SosmedPublishingService {
  private readonly connector: MetaOrganicConnector;

  constructor() {
    this.connector = MetaOrganicConnectorFactory.create();
  }

  /** Delegates to `PublishFacebookPost` — `POST /{page-id}/feed`. */
  async publishFacebookPost(
    request: PublishFacebookPostRequest,
  ): Promise<Result<PublishFacebookPostOutput, MetaGraphApiError>> {
    return this.connector.publishFacebookPost.execute(request);
  }

  /** Delegates to `PublishInstagramMedia` — the real two-step `POST /{ig-user-id}/media` + `POST /{ig-user-id}/media_publish` flow. */
  async publishInstagramPost(
    request: PublishInstagramPostRequest,
  ): Promise<Result<PublishInstagramMediaOutput, MetaGraphApiError>> {
    return this.connector.publishInstagramMedia.execute(request);
  }
}
