import { BranchId } from "@aos/branch-manager";
import { describe, expect, it, vi } from "vitest";

import { RealtimeSubscription } from "../../../src/infrastructure/supabase/RealtimeSubscription.js";
import { makeLeadRow } from "../../fixtures/leadStoreFixtures.js";
import { createFakeSupabaseClient } from "../../helpers/supabase.js";

describe("RealtimeSubscription", () => {
  it("opens a channel named hot-leads-<branch> and subscribes", () => {
    const client = createFakeSupabaseClient();
    const subscription = new RealtimeSubscription(client, BranchId.BINTARO);
    expect(subscription.channelName).toBe("hot-leads-bintaro");
    const channel = client.channels.get("hot-leads-bintaro");
    expect(channel?.subscribeSpy).toHaveBeenCalledTimes(1);
  });

  it("fires the registered onHotLead callback when a HOT lead payload arrives", () => {
    const client = createFakeSupabaseClient();
    const subscription = new RealtimeSubscription(client, BranchId.BINTARO);
    const callback = vi.fn();
    subscription.onHotLead(callback);

    const row = makeLeadRow({ branch_id: BranchId.BINTARO, status: "HOT" });
    client.channels.get("hot-leads-bintaro")?.fire({ new: row, old: {} });

    expect(callback).toHaveBeenCalledTimes(1);
    const [lead] = callback.mock.calls[0] as [{ id: { toString(): string }; status: string }];
    expect(lead.id.toString()).toBe(row.id);
    expect(lead.status).toBe("HOT");
  });

  it("does NOT fire the callback for a non-HOT status payload", () => {
    const client = createFakeSupabaseClient();
    const subscription = new RealtimeSubscription(client, BranchId.BINTARO);
    const callback = vi.fn();
    subscription.onHotLead(callback);

    const row = makeLeadRow({ branch_id: BranchId.BINTARO, status: "WARM" });
    client.channels.get("hot-leads-bintaro")?.fire({ new: row, old: {} });

    expect(callback).not.toHaveBeenCalled();
  });

  it("does NOT fire the callback when the payload fails to map", () => {
    const client = createFakeSupabaseClient();
    const subscription = new RealtimeSubscription(client, BranchId.BINTARO);
    const callback = vi.fn();
    subscription.onHotLead(callback);

    client.channels.get("hot-leads-bintaro")?.fire({ new: { status: "HOT" }, old: {} });

    expect(callback).not.toHaveBeenCalled();
  });

  it("supports multiple registered callbacks", () => {
    const client = createFakeSupabaseClient();
    const subscription = new RealtimeSubscription(client, BranchId.CINERE);
    const first = vi.fn();
    const second = vi.fn();
    subscription.onHotLead(first);
    subscription.onHotLead(second);

    const row = makeLeadRow({ branch_id: BranchId.CINERE, status: "HOT" });
    client.channels.get("hot-leads-cinere")?.fire({ new: row, old: {} });

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("unsubscribe delegates to the underlying channel", async () => {
    const client = createFakeSupabaseClient();
    const subscription = new RealtimeSubscription(client, BranchId.BANDUNG);
    await subscription.unsubscribe();
    expect(client.channels.get("hot-leads-bandung")?.unsubscribeSpy).toHaveBeenCalledTimes(1);
  });
});
