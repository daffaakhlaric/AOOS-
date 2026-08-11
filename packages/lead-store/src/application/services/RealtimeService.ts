import type { BranchId } from "@aos/branch-manager";

import type { IRealtimeSubscription } from "../../contracts/IRealtimeSubscription.js";
import type { SubscribeToHotLeads } from "../use-cases/SubscribeToHotLeads.js";

/** Facade over realtime use cases — the composition `LeadStoreFactory` wires as `RealtimeService`. */
export class RealtimeService {
  constructor(private readonly subscribeToHotLeads: SubscribeToHotLeads) {}

  subscribeHotLeads(branchId: BranchId): IRealtimeSubscription {
    return this.subscribeToHotLeads.execute({ branchId });
  }
}
