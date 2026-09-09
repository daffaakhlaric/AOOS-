import { describe, expect, it } from "vitest";

import { createFakeSupabaseClient } from "../../../test-support/fake-supabase-client.js";

import {
  TokenRefreshLogRepository,
  TokenRefreshLogRepositoryError,
} from "./token-refresh-log.repository.js";

describe("TokenRefreshLogRepository", () => {
  it("inserts a success row", async () => {
    const client = createFakeSupabaseClient();
    const repo = new TokenRefreshLogRepository(client);
    const row = await repo.insert({
      tenant_id: "dss-motor",
      connection_type: "meta",
      success: true,
      error_message: null,
      new_expires_at: "2026-11-01T00:00:00.000Z",
    });
    expect(row.success).toBe(true);
    expect(row.tenant_id).toBe("dss-motor");
  });

  it("inserts a failure row with an error message", async () => {
    const client = createFakeSupabaseClient();
    const repo = new TokenRefreshLogRepository(client);
    const row = await repo.insert({
      tenant_id: "dss-motor",
      connection_type: "wa",
      success: false,
      error_message: "Meta API error",
      new_expires_at: null,
    });
    expect(row.success).toBe(false);
    expect(row.error_message).toBe("Meta API error");
  });

  it("throws TokenRefreshLogRepositoryError on a forced Supabase error", async () => {
    const client = createFakeSupabaseClient();
    client.forceErrorOnce("token_refresh_log", "boom");
    const repo = new TokenRefreshLogRepository(client);
    await expect(
      repo.insert({
        tenant_id: "dss-motor",
        connection_type: "meta",
        success: false,
        error_message: "x",
        new_expires_at: null,
      }),
    ).rejects.toThrow(TokenRefreshLogRepositoryError);
  });
});
