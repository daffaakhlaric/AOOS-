import "reflect-metadata";

import { describe, expect, it } from "vitest";

import { OAuthStateStore } from "./oauth-state-store.js";

describe("OAuthStateStore", () => {
  it("issue() returns a high-entropy (64 hex chars = 256 bits) state token", () => {
    const store = new OAuthStateStore();
    const state = store.issue({ kind: "OFFICIAL" });
    expect(state).toMatch(/^[0-9a-f]{64}$/);
  });

  it("consume() returns the flow that was issued for a valid, unexpired state", () => {
    const store = new OAuthStateStore();
    const state = store.issue({
      kind: "SALES_PERSONAL",
      connectTokenId: "token-1",
      salesHumanId: "sales-1",
    });
    const flow = store.consume(state);
    expect(flow).toEqual({
      kind: "SALES_PERSONAL",
      connectTokenId: "token-1",
      salesHumanId: "sales-1",
    });
  });

  it("consume() is single-use — a second consume() of the same state returns undefined", () => {
    const store = new OAuthStateStore();
    const state = store.issue({ kind: "OFFICIAL" });
    expect(store.consume(state)).toEqual({ kind: "OFFICIAL" });
    expect(store.consume(state)).toBeUndefined();
  });

  it("consume() returns undefined for a state that was never issued (forged/guessed)", () => {
    const store = new OAuthStateStore();
    expect(store.consume("never-issued-state")).toBeUndefined();
  });

  it("consume() returns undefined once the state has expired, and still deletes the entry", () => {
    let now = new Date("2026-08-24T10:00:00.000Z");
    const store = new OAuthStateStore(() => now, 60_000); // 60s TTL
    const state = store.issue({ kind: "OFFICIAL" });

    now = new Date("2026-08-24T10:01:01.000Z"); // 61s later — past the 60s TTL
    expect(store.consume(state)).toBeUndefined();
    // Single-use even on the expired path — a second consume (even if clock rewound) still fails.
    now = new Date("2026-08-24T10:00:00.000Z");
    expect(store.consume(state)).toBeUndefined();
  });
});
