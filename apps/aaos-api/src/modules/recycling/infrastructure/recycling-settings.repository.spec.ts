import { describe, expect, it } from "vitest";

import { createFakeSupabaseClient } from "../../../test-support/fake-supabase-client.js";

import {
  RecyclingSettingsRepository,
  RecyclingSettingsRepositoryError,
} from "./recycling-settings.repository.js";

describe("RecyclingSettingsRepository", () => {
  it("getAutoMode defaults to true when no row exists yet", async () => {
    const client = createFakeSupabaseClient();
    const repo = new RecyclingSettingsRepository(client);
    expect(await repo.getAutoMode("dss-motor")).toBe(true);
  });

  it("getAutoMode returns the seeded row's value", async () => {
    const client = createFakeSupabaseClient();
    client.seed("recycling_settings", {
      tenant_id: "dss-motor",
      auto_mode: false,
      updated_at: "2026-01-01T00:00:00.000Z",
    });
    const repo = new RecyclingSettingsRepository(client);
    expect(await repo.getAutoMode("dss-motor")).toBe(false);
  });

  it("setAutoMode inserts a row when none exists", async () => {
    const client = createFakeSupabaseClient();
    const repo = new RecyclingSettingsRepository(client);
    await repo.setAutoMode("dss-motor", false);
    expect(await repo.getAutoMode("dss-motor")).toBe(false);
  });

  it("setAutoMode updates an existing row", async () => {
    const client = createFakeSupabaseClient();
    client.seed("recycling_settings", {
      tenant_id: "dss-motor",
      auto_mode: true,
      updated_at: "2026-01-01T00:00:00.000Z",
    });
    const repo = new RecyclingSettingsRepository(client);
    await repo.setAutoMode("dss-motor", false);
    expect(await repo.getAutoMode("dss-motor")).toBe(false);
  });

  it("throws RecyclingSettingsRepositoryError on a forced Supabase error (getAutoMode)", async () => {
    const client = createFakeSupabaseClient();
    client.forceErrorOnce("recycling_settings", "boom");
    const repo = new RecyclingSettingsRepository(client);
    await expect(repo.getAutoMode("dss-motor")).rejects.toThrow(RecyclingSettingsRepositoryError);
  });

  it("throws RecyclingSettingsRepositoryError on a forced Supabase error (setAutoMode)", async () => {
    const client = createFakeSupabaseClient();
    client.forceErrorOnce("recycling_settings", "boom");
    const repo = new RecyclingSettingsRepository(client);
    await expect(repo.setAutoMode("dss-motor", false)).rejects.toThrow(
      RecyclingSettingsRepositoryError,
    );
  });
});
