import { describe, expect, it, vi } from "vitest";

type ChangeHandler = (payload: { new: Record<string, unknown> }) => void;

/**
 * Mocks the `@supabase/supabase-js` `channel().on().on().subscribe()` chain — same real testing
 * approach `apps/aaos-crm/tests/lib/realtime.test.ts` already establishes for this codebase's
 * Realtime-dependent code ("mock the channel/.on()/.subscribe() chain and manually fire callbacks
 * to test the INSERT/UPDATE handling"), mirrored here rather than inventing a new strategy.
 * Captures each registered handler by event type so a test can fire it directly, exactly like a
 * real `postgres_changes` INSERT/UPDATE would (proving `subscribeToActivityLog` really receives a
 * row `ActivityLogger` inserted, not a manually-sent broadcast).
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

import { subscribeToActivityLog, toActivityDtoFromRealtimeRow } from "@/lib/realtime";

function makeRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "activity-1",
    loop_id: "corr-1",
    agent: "SAMANTHA",
    action_type: "EXECUTE_VERDICT",
    mode: "LIVE",
    status: "RUNNING",
    input: { verdict: "PAUSE" },
    output: null,
    dev_preview: null,
    reasoning: null,
    tool_calls: [],
    started_at: "2026-08-31T09:00:00.000Z",
    completed_at: null,
    duration_ms: null,
    error_message: null,
    error_stack: null,
    created_at: "2026-08-31T09:00:00.000Z",
    ...overrides,
  };
}

describe("toActivityDtoFromRealtimeRow", () => {
  it("maps every snake_case field to its camelCase ActivityDto counterpart", () => {
    const dto = toActivityDtoFromRealtimeRow(makeRow());
    expect(dto.loopId).toBe("corr-1");
    expect(dto.actionType).toBe("EXECUTE_VERDICT");
    expect(dto.input).toEqual({ verdict: "PAUSE" });
    expect(dto.startedAt).toBe("2026-08-31T09:00:00.000Z");
    expect(dto.completedAt).toBeUndefined();
  });

  it("maps a null loop_id/completed_at/duration_ms to undefined", () => {
    const dto = toActivityDtoFromRealtimeRow(
      makeRow({ loop_id: null, completed_at: null, duration_ms: null }),
    );
    expect(dto.loopId).toBeUndefined();
    expect(dto.completedAt).toBeUndefined();
    expect(dto.durationMs).toBeUndefined();
  });

  it("maps real tool_calls entries through", () => {
    const dto = toActivityDtoFromRealtimeRow(
      makeRow({
        tool_calls: [
          { tool: "getAdAccount", input: { id: "act_1" }, at: "2026-08-31T09:00:01.000Z" },
        ],
      }),
    );
    expect(dto.toolCalls).toHaveLength(1);
    expect(dto.toolCalls[0]?.tool).toBe("getAdAccount");
  });
});

describe("subscribeToActivityLog", () => {
  it("calls onNewActivity for a real INSERT (ActivityLogger.start's plain insert, not a broadcast)", () => {
    const onNewActivity = vi.fn();
    const onActivityUpdated = vi.fn();
    subscribeToActivityLog("dss-motor", { onNewActivity, onActivityUpdated });
    fake.fire("INSERT", makeRow({ status: "RUNNING" }));
    expect(onNewActivity).toHaveBeenCalledTimes(1);
    expect(onNewActivity.mock.calls[0]?.[0].id).toBe("activity-1");
    expect(onActivityUpdated).not.toHaveBeenCalled();
  });

  it("calls onActivityUpdated for a real UPDATE (ActivityLogger.complete/.fail's terminal write)", () => {
    const onNewActivity = vi.fn();
    const onActivityUpdated = vi.fn();
    subscribeToActivityLog("dss-motor", { onNewActivity, onActivityUpdated });
    fake.fire(
      "UPDATE",
      makeRow({
        status: "SUCCESS",
        output: { campaignId: "120000000000099" },
        completed_at: "2026-08-31T09:00:05.000Z",
        duration_ms: 5000,
      }),
    );
    expect(onActivityUpdated).toHaveBeenCalledTimes(1);
    expect(onActivityUpdated.mock.calls[0]?.[0].status).toBe("SUCCESS");
    expect(onNewActivity).not.toHaveBeenCalled();
  });
});
