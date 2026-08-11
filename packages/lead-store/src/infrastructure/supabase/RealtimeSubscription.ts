import type { BranchId } from "@aos/branch-manager";

import type { IRealtimeSubscription } from "../../contracts/IRealtimeSubscription.js";
import type { Lead } from "../../domain/entities/Lead.js";
import { LeadMapper, type LeadRow } from "../mappers/LeadMapper.js";

import type {
  SupabaseClientLike,
  SupabaseRealtimeChannelLike,
  SupabaseRealtimePayload,
} from "./SupabaseTypes.js";

/**
 * Supabase Realtime implementation of `IRealtimeSubscription` (spec "Supabase Realtime" section).
 * Subscribes to `postgres_changes` UPDATE events on `leads`, filtered to the given branch, and
 * fans out to every registered `onHotLead` callback whenever a row's `status` is (or becomes)
 * `HOT`. Tests mock `.channel().on().subscribe()` and fire the registered callback manually.
 */
export class RealtimeSubscription implements IRealtimeSubscription {
  readonly channelName: string;
  private readonly channel: SupabaseRealtimeChannelLike;
  private readonly callbacks: Array<(lead: Lead) => void> = [];

  constructor(client: SupabaseClientLike, branchId: BranchId) {
    this.channelName = `hot-leads-${branchId.toLowerCase()}`;
    this.channel = client
      .channel(this.channelName)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "leads", filter: `branch_id=eq.${branchId}` },
        (payload) => this.handlePayload(payload),
      )
      .subscribe();
  }

  onHotLead(callback: (lead: Lead) => void): void {
    this.callbacks.push(callback);
  }

  async unsubscribe(): Promise<void> {
    await this.channel.unsubscribe();
  }

  private handlePayload(payload: SupabaseRealtimePayload): void {
    const row = payload.new as unknown as LeadRow;
    if (row.status !== "HOT") {
      return;
    }
    const mapped = LeadMapper.toDomain(row);
    if (!mapped.ok) {
      return;
    }
    for (const callback of this.callbacks) {
      callback(mapped.value);
    }
  }
}
