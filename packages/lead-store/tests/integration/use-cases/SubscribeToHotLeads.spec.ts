import { BranchId } from "@aos/branch-manager";
import { describe, expect, it, vi } from "vitest";

import { SubscribeToHotLeads } from "../../../src/application/use-cases/SubscribeToHotLeads.js";
import { RealtimeSubscription } from "../../../src/infrastructure/supabase/RealtimeSubscription.js";
import { makeLeadRow } from "../../fixtures/leadStoreFixtures.js";
import { createFakeSupabaseClient } from "../../helpers/supabase.js";

describe("SubscribeToHotLeads", () => {
  it("returns a subscription handle", () => {
    const client = createFakeSupabaseClient();
    const useCase = new SubscribeToHotLeads(
      (branchId) => new RealtimeSubscription(client, branchId),
    );
    const subscription = useCase.execute({ branchId: BranchId.BINTARO });
    expect(subscription.channelName).toBe("hot-leads-bintaro");
  });

  it("callback fired on a mock realtime event", () => {
    const client = createFakeSupabaseClient();
    const useCase = new SubscribeToHotLeads(
      (branchId) => new RealtimeSubscription(client, branchId),
    );
    const subscription = useCase.execute({ branchId: BranchId.BINTARO });
    const callback = vi.fn();
    subscription.onHotLead(callback);

    const row = makeLeadRow({ branch_id: BranchId.BINTARO, status: "HOT" });
    client.channels.get("hot-leads-bintaro")?.fire({ new: row, old: {} });

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("delegates branch selection to the factory function", () => {
    const client = createFakeSupabaseClient();
    const factory = vi.fn((branchId: BranchId) => new RealtimeSubscription(client, branchId));
    const useCase = new SubscribeToHotLeads(factory);
    useCase.execute({ branchId: BranchId.BANDUNG });
    expect(factory).toHaveBeenCalledWith(BranchId.BANDUNG);
  });
});
