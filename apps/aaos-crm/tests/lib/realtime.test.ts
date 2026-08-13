import { describe, expect, it, vi } from "vitest";

type ChangeHandler = (payload: { new: Record<string, unknown> }) => void;

/**
 * Mocks the `@supabase/supabase-js` `channel().on().on().subscribe()` chain (spec's testing
 * requirement: "mock the @supabase/supabase-js channel/.on()/.subscribe() chain and manually
 * fire callbacks to test the INSERT/UPDATE handling"). Captures each registered handler by event
 * type so the test can fire it directly, exactly like a real Postgres change would.
 */
function buildFakeSupabaseClient() {
  const handlers: Record<string, ChangeHandler> = {};
  const channel = {
    on: (_type: string, filter: { event: string }, handler: ChangeHandler) => {
      handlers[filter.event] = handler;
      return channel;
    },
    subscribe: () => channel,
    unsubscribe: async () => "ok" as const,
  };
  return {
    client: { channel: () => channel },
    fire: (event: "INSERT" | "UPDATE", row: Record<string, unknown>) => {
      handlers[event]?.({ new: row });
    },
  };
}

const fake = buildFakeSupabaseClient();

vi.mock("@/lib/supabase", () => ({
  createSupabaseBrowserClient: () => fake.client,
}));

import { subscribeToHotLeads, toLeadDtoFromRealtimeRow } from "@/lib/realtime";

function makeRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "lead-1",
    lead_phone: "+6281234567890",
    lead_name: "Pak Andi",
    branch_id: "CINERE",
    status: "HOT",
    temperature: "HOT",
    score: 85,
    qual_budget: true,
    qual_unit: true,
    qual_area: true,
    qual_payment: true,
    qual_timeline: true,
    qual_name: true,
    assigned_sales_id: null,
    assigned_at: null,
    created_at: "2026-08-13T09:00:00.000Z",
    updated_at: "2026-08-13T09:00:00.000Z",
    ...overrides,
  };
}

describe("toLeadDtoFromRealtimeRow", () => {
  it("maps every snake_case field to its camelCase LeadDto counterpart", () => {
    const dto = toLeadDtoFromRealtimeRow(makeRow());
    expect(dto.leadPhone).toBe("+6281234567890");
    expect(dto.leadName).toBe("Pak Andi");
    expect(dto.qualification).toEqual({
      budget: true,
      unit: true,
      area: true,
      payment: true,
      timeline: true,
      name: true,
    });
    expect(dto.assignedSalesId).toBeUndefined();
  });

  it("maps a null lead_name/assigned_sales_id to undefined", () => {
    const dto = toLeadDtoFromRealtimeRow(makeRow({ lead_name: null }));
    expect(dto.leadName).toBeUndefined();
  });
});

describe("subscribeToHotLeads", () => {
  it("calls onNewLead for an INSERT with status HOT", () => {
    const onNewLead = vi.fn();
    const onLeadClaimed = vi.fn();
    subscribeToHotLeads("CINERE", { onNewLead, onLeadClaimed });
    fake.fire("INSERT", makeRow({ status: "HOT" }));
    expect(onNewLead).toHaveBeenCalledTimes(1);
    expect(onNewLead.mock.calls[0]?.[0].id).toBe("lead-1");
  });

  it("does NOT call onNewLead for an INSERT that is not HOT", () => {
    const onNewLead = vi.fn();
    const onLeadClaimed = vi.fn();
    subscribeToHotLeads("CINERE", { onNewLead, onLeadClaimed });
    fake.fire("INSERT", makeRow({ status: "WARM" }));
    expect(onNewLead).not.toHaveBeenCalled();
  });

  it("calls onLeadClaimed for an UPDATE that now has an assigned_sales_id", () => {
    const onNewLead = vi.fn();
    const onLeadClaimed = vi.fn();
    subscribeToHotLeads("CINERE", { onNewLead, onLeadClaimed });
    fake.fire("UPDATE", makeRow({ assigned_sales_id: "sales-rina" }));
    expect(onLeadClaimed).toHaveBeenCalledWith("lead-1");
  });

  it("does NOT call onLeadClaimed for an UPDATE with no assignment yet", () => {
    const onNewLead = vi.fn();
    const onLeadClaimed = vi.fn();
    subscribeToHotLeads("CINERE", { onNewLead, onLeadClaimed });
    fake.fire("UPDATE", makeRow({ assigned_sales_id: null }));
    expect(onLeadClaimed).not.toHaveBeenCalled();
  });
});
