import { BranchId } from "@aos/branch-manager";
import { describe, expect, it } from "vitest";

import { RealtimeService } from "../../../src/application/services/RealtimeService.js";
import { SubscribeToHotLeads } from "../../../src/application/use-cases/SubscribeToHotLeads.js";
import { RealtimeSubscription } from "../../../src/infrastructure/supabase/RealtimeSubscription.js";
import { createFakeSupabaseClient } from "../../helpers/supabase.js";

describe("RealtimeService facade", () => {
  it("subscribeHotLeads() delegates to SubscribeToHotLeads", () => {
    const client = createFakeSupabaseClient();
    const service = new RealtimeService(
      new SubscribeToHotLeads((branchId) => new RealtimeSubscription(client, branchId)),
    );
    const subscription = service.subscribeHotLeads(BranchId.CINERE);
    expect(subscription.channelName).toBe("hot-leads-cinere");
  });
});
