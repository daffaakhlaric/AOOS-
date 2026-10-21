import { afterEach, describe, expect, it, vi } from "vitest";

import { MetaApiClient } from "../../../src/infrastructure/meta-api/MetaApiClient.js";
import {
  CURRENCY_READINESS,
  fromProviderMoney,
  toProviderMoney,
} from "../../../src/utils/MetaMoney.js";
afterEach(() => vi.unstubAllEnvs());
describe("Meta write safety", () => {
  it("blocks before network while kill switch is off", async () => {
    vi.stubEnv("META_REAL_WRITES_ENABLED", "false");
    const fetcher = vi.fn();
    const result = await new MetaApiClient({ fetchImpl: fetcher }).pauseAd("123", "fixture");
    expect(result).toMatchObject({ ok: false, error: { normalizedCode: "META_WRITE_DISABLED" } });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("requires executor context even when switch is enabled", async () => {
    vi.stubEnv("META_REAL_WRITES_ENABLED", "true");
    const fetcher = vi.fn();
    const result = await new MetaApiClient({ fetchImpl: fetcher }).pauseAd("123", "fixture");
    expect(result).toMatchObject({
      ok: false,
      error: { normalizedCode: "META_WRITE_CONTEXT_REQUIRED" },
    });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("does not retry uncertain writes", async () => {
    vi.stubEnv("META_REAL_WRITES_ENABLED", "true");
    const fetcher = vi.fn().mockRejectedValue(new Error("fixture network loss"));
    const result = await new MetaApiClient({
      fetchImpl: fetcher,
      authorizeWrite: async () => true,
      persistReceipt: async () => {},
    }).pauseAd("123", "fixture");
    expect(result).toMatchObject({
      ok: false,
      error: { normalizedCode: "META_WRITE_UNCERTAIN", retryable: false },
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("records an accepted response as unverified", async () => {
    vi.stubEnv("META_REAL_WRITES_ENABLED", "true");
    const receipt = vi.fn();
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true })));
    await new MetaApiClient({
      fetchImpl: fetcher,
      authorizeWrite: async () => true,
      persistReceipt: receipt,
    }).pauseAd("123", "fixture");
    expect(receipt).toHaveBeenCalledWith(
      expect.objectContaining({
        normalizedResult: "ACCEPTED_UNVERIFIED",
        verificationRequired: true,
      }),
    );
  });
  it("blocks budgets without provider evidence", async () => {
    vi.stubEnv("META_REAL_WRITES_ENABLED", "true");
    const fetcher = vi.fn();
    const result = await new MetaApiClient({
      fetchImpl: fetcher,
      authorizeWrite: async () => true,
      persistReceipt: async () => {},
    }).scaleAdSetBudget("123", 10000, "fixture");
    expect(result).toMatchObject({
      ok: false,
      error: { normalizedCode: "BUDGET_WRITE_UNVERIFIED" },
    });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("rejects read-back belonging to another account", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ id: "123", account_id: "999", status: "PAUSED" })),
      );
    const result = await new MetaApiClient({ fetchImpl: fetcher }).verifyCampaignState(
      "123",
      "act_456",
      { status: "PAUSED" },
      "fixture",
    );
    expect(result.status).toBe("MISMATCH");
  });
  it.each(["IDR", "USD"])("keeps %s production budgets unverified", (currency) => {
    expect(() => toProviderMoney({ amount: 100, currency }, CURRENCY_READINESS[currency]!)).toThrow(
      "BUDGET_WRITE_UNVERIFIED",
    );
    const fixture = {
      currency,
      providerUnitsPerMajor: 100,
      status: "BUDGET_WRITE_VERIFIED" as const,
      evidenceId: "unit-test-only",
    };
    expect(
      fromProviderMoney(toProviderMoney({ amount: 123.45, currency }, fixture), fixture).amount,
    ).toBe(123.45);
  });
});
