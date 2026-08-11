import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  createSupabaseClient,
  createSupabaseStorageClient,
} from "../../../src/infrastructure/supabase/SupabaseClient.js";

const config = {
  supabaseUrl: "https://xxxx.supabase.co",
  supabaseServiceKey: "service-key",
  bucketName: "mobix-assets",
  tenantId: "dss-motor",
  imageSizeLimitBytes: 10 * 1024 * 1024,
  videoSizeLimitBytes: 100 * 1024 * 1024,
};

let originalWebSocket: unknown;

// The real `@supabase/supabase-js` client always constructs a Realtime sub-client (even though
// this package never uses Realtime), which requires a global `WebSocket` constructor on Node <
// 22. Mirrors `@aos/lead-store`'s matching test's stub.
beforeEach(() => {
  originalWebSocket = (globalThis as { WebSocket?: unknown }).WebSocket;
  (globalThis as { WebSocket?: unknown }).WebSocket = class FakeWebSocket {};
});

afterEach(() => {
  (globalThis as { WebSocket?: unknown }).WebSocket = originalWebSocket;
});

describe("createSupabaseClient", () => {
  it("builds a Postgrest-capable client", () => {
    const client = createSupabaseClient(config);
    expect(client.from).toBeInstanceOf(Function);
  });
});

describe("createSupabaseStorageClient", () => {
  it("builds a Storage-capable client", () => {
    const storage = createSupabaseStorageClient(config);
    expect(storage.from).toBeInstanceOf(Function);
  });
});
