import { randomBytes } from "node:crypto";

import { Injectable, Optional } from "@nestjs/common";

const STATE_BYTES = 32;
const DEFAULT_TTL_MS = 10 * 60 * 1000; // 10 minutes — the real time budget of one interactive OAuth redirect round-trip.

export type OAuthFlowKind =
  | { readonly kind: "OFFICIAL" }
  | {
      readonly kind: "SALES_PERSONAL";
      readonly connectTokenId: string;
      readonly salesHumanId: string;
    };

interface PendingState {
  readonly flow: OAuthFlowKind;
  readonly expiresAt: number;
}

/**
 * In-process-memory CSRF `state`-param store for the OAuth authorization-code dance (AAOS-SOSMED-
 * AUTOMATION Phase 4). Deliberately real, single-use, and expiring — the coordinator note is
 * explicit that a real `state` param (not a decorative one) is required for CSRF protection on
 * both the official-account and sales-personal-account flows.
 *
 * Scoped narrowly and correctly: this store holds ONLY the short interactive window between
 * "redirect the browser to Meta's consent screen" and "Meta redirects back to our callback with
 * `code`+`state`" — realistically seconds to a couple of minutes, never the hours/days a sales
 * connect-link itself may sit unused (that durability need is `SosmedConnectTokenRepository`'s
 * job, a real DB row, precisely because THAT window is long). An in-memory `Map`, same pattern as
 * `PendingAccessTokenStore` (Phase 3), is the right tool here: losing an in-flight `state` on a
 * restart just means the user's OAuth attempt fails harmlessly and they retry from the start
 * (same single-process/single-tenant-composition assumption every other in-memory store this
 * session relies on — coordinator note point 3).
 *
 * `state` itself is 32 random bytes (256 bits) hex-encoded — deliberately higher entropy than a
 * UUID v4's 122 bits, since this value is the ONLY thing standing between a legitimate OAuth
 * callback and an attacker-forged one (classic OAuth CSRF: an attacker who can get their own
 * authorization code into the victim's browser, without a real unpredictable `state` bound to the
 * victim's original request, could link the attacker's own Meta account to the victim's session).
 */
@Injectable()
export class OAuthStateStore {
  private readonly pending = new Map<string, PendingState>();

  constructor(
    // `@Optional()` — see `PendingAccessTokenStore`'s doc / `SosmedPostsService`'s `now` param for
    // why a bare function-typed constructor param needs this to avoid a native DI crash.
    @Optional() private readonly now: () => Date = () => new Date(),
    @Optional() private readonly ttlMs: number = DEFAULT_TTL_MS,
  ) {}

  /** Generates and records a fresh single-use state token for one OAuth attempt. */
  issue(flow: OAuthFlowKind): string {
    const state = randomBytes(STATE_BYTES).toString("hex");
    this.pending.set(state, { flow, expiresAt: this.now().getTime() + this.ttlMs });
    return state;
  }

  /**
   * Validates and consumes a `state` value from a callback. Single-use by construction: whether
   * this returns a match or not, the entry (if any) is deleted, so a replayed/guessed `state` can
   * never succeed twice — closing the same class of replay gap `PublishNowBodySchema`'s one-off
   * fresh-token discipline (Phase 3) already established for a different credential.
   */
  consume(state: string): OAuthFlowKind | undefined {
    const entry = this.pending.get(state);
    this.pending.delete(state);
    if (entry === undefined) {
      return undefined;
    }
    if (entry.expiresAt < this.now().getTime()) {
      return undefined;
    }
    return entry.flow;
  }
}
