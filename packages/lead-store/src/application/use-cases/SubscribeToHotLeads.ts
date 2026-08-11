import type { BranchId } from "@aos/branch-manager";

import type { IRealtimeSubscription } from "../../contracts/IRealtimeSubscription.js";

export interface SubscribeToHotLeadsInput {
  readonly branchId: BranchId;
}

/** A factory function that creates a live `IRealtimeSubscription` for one branch — injected so `apps/aaos-crm` can subscribe without depending on Supabase directly. */
export type RealtimeSubscriptionFactory = (branchId: BranchId) => IRealtimeSubscription;

/**
 * Called by `apps/aaos-crm` on load. Returns a subscription handle (spec's "SubscribeToHotLeads" —
 * NOT wrapped in `Result`, matching the spec's literal `Output: RealtimeSubscription` signature,
 * since establishing a Realtime channel subscription is fire-and-forget from the caller's
 * perspective — errors surface asynchronously via the channel, not synchronously here).
 */
export class SubscribeToHotLeads {
  constructor(private readonly createSubscription: RealtimeSubscriptionFactory) {}

  execute(input: SubscribeToHotLeadsInput): IRealtimeSubscription {
    return this.createSubscription(input.branchId);
  }
}
