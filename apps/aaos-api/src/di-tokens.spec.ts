import { describe, expect, it } from "vitest";

import {
  AAOS_API_CONFIG,
  EVENT_PUBLISHER,
  META_ADS_CONNECTOR,
  WEBHOOK_VERIFIER,
  WHATSAPP_CONNECTOR,
  WHATSAPP_CONNECTOR_REGISTRY,
  WHATSAPP_WEBHOOK_VERIFIER,
} from "./di-tokens.js";

const ALL_TOKENS = [
  AAOS_API_CONFIG,
  EVENT_PUBLISHER,
  META_ADS_CONNECTOR,
  WEBHOOK_VERIFIER,
  WHATSAPP_CONNECTOR,
  WHATSAPP_CONNECTOR_REGISTRY,
  WHATSAPP_WEBHOOK_VERIFIER,
];

describe("di-tokens", () => {
  it("are distinct Symbols, never colliding with each other", () => {
    expect(new Set(ALL_TOKENS).size).toBe(ALL_TOKENS.length);
  });

  it("are all Symbol-typed", () => {
    for (const token of ALL_TOKENS) {
      expect(typeof token).toBe("symbol");
    }
  });
});
