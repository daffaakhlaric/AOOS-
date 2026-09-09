import { describe, expect, it } from "vitest";

import { createFakeSupabaseClient } from "../../../test-support/fake-supabase-client.js";

import { OAuthStateRepository, OAuthStateRepositoryError } from "./oauth-state.repository.js";

describe("OAuthStateRepository", () => {
  it("create() persists a new state row", async () => {
    const client = createFakeSupabaseClient();
    const repo = new OAuthStateRepository(client);
    const row = await repo.create({
      tenant_id: "dss-motor",
      state: "abc123",
      redirect_after: null,
      expires_at: "2026-09-09T00:10:00.000Z",
    });
    expect(row.state).toBe("abc123");
    expect(row.tenant_id).toBe("dss-motor");
  });

  it("consume() returns the row and deletes it — single-use", async () => {
    const client = createFakeSupabaseClient();
    client.seed("oauth_states", {
      id: "s-1",
      tenant_id: "dss-motor",
      state: "abc123",
      redirect_after: null,
      expires_at: "2026-09-09T00:10:00.000Z",
      created_at: "2026-09-09T00:00:00.000Z",
    });
    const repo = new OAuthStateRepository(client);
    const now = new Date("2026-09-09T00:05:00.000Z");

    const first = await repo.consume("abc123", now);
    expect(first?.tenant_id).toBe("dss-motor");

    const second = await repo.consume("abc123", now);
    expect(second).toBeUndefined();
  });

  it("consume() returns undefined (but still deletes) for an EXPIRED state", async () => {
    const client = createFakeSupabaseClient();
    client.seed("oauth_states", {
      id: "s-1",
      tenant_id: "dss-motor",
      state: "abc123",
      redirect_after: null,
      expires_at: "2026-09-09T00:10:00.000Z",
      created_at: "2026-09-09T00:00:00.000Z",
    });
    const repo = new OAuthStateRepository(client);
    const now = new Date("2026-09-09T01:00:00.000Z"); // well past expiry

    const result = await repo.consume("abc123", now);
    expect(result).toBeUndefined();

    // Replay with a NOW before expiry must still fail — the row was already deleted.
    const replay = await repo.consume("abc123", new Date("2026-09-09T00:05:00.000Z"));
    expect(replay).toBeUndefined();
  });

  it("consume() returns undefined for an unknown state, never throws", async () => {
    const client = createFakeSupabaseClient();
    const repo = new OAuthStateRepository(client);
    const result = await repo.consume("does-not-exist", new Date());
    expect(result).toBeUndefined();
  });

  it("throws OAuthStateRepositoryError on a forced Supabase error", async () => {
    const client = createFakeSupabaseClient();
    client.forceErrorOnce("oauth_states", "boom");
    const repo = new OAuthStateRepository(client);
    await expect(
      repo.create({
        tenant_id: "dss-motor",
        state: "abc123",
        redirect_after: null,
        expires_at: "2026-09-09T00:10:00.000Z",
      }),
    ).rejects.toThrow(OAuthStateRepositoryError);
  });
});
