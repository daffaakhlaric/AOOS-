import { describe, expect, it } from "vitest";

import { parseLeadStoreConfig } from "../../../src/config/LeadStoreConfig.js";

describe("parseLeadStoreConfig", () => {
  it("parses a valid config", () => {
    const result = parseLeadStoreConfig({
      supabaseUrl: "https://xxxx.supabase.co",
      supabaseAnonKey: "anon-key",
      supabaseServiceKey: "service-key",
      tenantId: "dss-motor",
      realtimeEnabled: true,
    });
    expect(result.ok).toBe(true);
  });

  it("defaults tenantId to dss-motor and realtimeEnabled to true", () => {
    const result = parseLeadStoreConfig({
      supabaseUrl: "https://xxxx.supabase.co",
      supabaseAnonKey: "anon-key",
      supabaseServiceKey: "service-key",
    });
    expect(result.ok && result.value.tenantId).toBe("dss-motor");
    expect(result.ok && result.value.realtimeEnabled).toBe(true);
  });

  it("rejects a non-URL supabaseUrl", () => {
    const result = parseLeadStoreConfig({
      supabaseUrl: "not-a-url",
      supabaseAnonKey: "a",
      supabaseServiceKey: "b",
    });
    expect(result.ok).toBe(false);
  });

  it("rejects an empty supabaseAnonKey", () => {
    const result = parseLeadStoreConfig({
      supabaseUrl: "https://xxxx.supabase.co",
      supabaseAnonKey: "",
      supabaseServiceKey: "b",
    });
    expect(result.ok).toBe(false);
  });

  it("rejects an empty supabaseServiceKey", () => {
    const result = parseLeadStoreConfig({
      supabaseUrl: "https://xxxx.supabase.co",
      supabaseAnonKey: "a",
      supabaseServiceKey: "",
    });
    expect(result.ok).toBe(false);
  });

  it("rejects a completely malformed input", () => {
    const result = parseLeadStoreConfig("not an object");
    expect(result.ok).toBe(false);
  });
});
