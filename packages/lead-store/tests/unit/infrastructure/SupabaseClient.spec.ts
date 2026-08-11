import { beforeEach, afterEach, describe, expect, it } from "vitest";

import { createSupabaseClient } from "../../../src/infrastructure/supabase/SupabaseClient.js";

const config = {
  supabaseUrl: "https://xxxx.supabase.co",
  supabaseAnonKey: "anon-key",
  supabaseServiceKey: "service-key",
  tenantId: "dss-motor",
  realtimeEnabled: true,
};

describe("createSupabaseClient", () => {
  let originalWebSocket: unknown;

  beforeEach(() => {
    // See LeadStoreFactory.spec.ts's matching test for why this stub is needed on Node < 22.
    originalWebSocket = (globalThis as { WebSocket?: unknown }).WebSocket;
    (globalThis as { WebSocket?: unknown }).WebSocket = class FakeWebSocket {};
  });

  afterEach(() => {
    (globalThis as { WebSocket?: unknown }).WebSocket = originalWebSocket;
  });

  it("builds a client using the service key by default", () => {
    const client = createSupabaseClient(config);
    expect(client.from).toBeInstanceOf(Function);
    expect(client.channel).toBeInstanceOf(Function);
  });

  it("builds a client using the anon key when useServiceKey=false", () => {
    const client = createSupabaseClient(config, false);
    expect(client.from).toBeInstanceOf(Function);
  });
});
