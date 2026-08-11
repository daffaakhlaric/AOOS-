import { describe, expect, it } from "vitest";

import { AdAccount } from "../../../../src/domain/entities/AdAccount.js";
import { AdAccountId } from "../../../../src/domain/value-objects/AdAccountId.js";
import { unwrap, unwrapErr } from "../../../helpers/result.js";

function validProps(overrides: Partial<Parameters<typeof AdAccount.create>[0]> = {}) {
  return {
    id: unwrap(AdAccountId.create("act_752604553578354")),
    name: "DSS Motor Mobix",
    businessManagerId: "bm_1",
    currency: "IDR" as const,
    timezone: "Asia/Jakarta" as const,
    campaigns: [],
    syncedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

describe("AdAccount", () => {
  it("constructs a valid AdAccount", () => {
    const account = unwrap(AdAccount.create(validProps()));
    expect(account.name).toBe("DSS Motor Mobix");
    expect(account.campaigns).toEqual([]);
  });

  it("rejects an empty name", () => {
    expect(unwrapErr(AdAccount.create(validProps({ name: "" }))).message).toMatch(/name/);
  });

  it("rejects an empty businessManagerId", () => {
    expect(unwrapErr(AdAccount.create(validProps({ businessManagerId: "" }))).message).toMatch(
      /businessManagerId/,
    );
  });

  it("rejects a currency other than IDR", () => {
    expect(unwrapErr(AdAccount.create(validProps({ currency: "USD" as "IDR" }))).message).toMatch(
      /currency/,
    );
  });

  it("rejects a timezone other than Asia/Jakarta", () => {
    expect(
      unwrapErr(AdAccount.create(validProps({ timezone: "UTC" as "Asia/Jakarta" }))).message,
    ).toMatch(/timezone/);
  });

  it("defensively copies the campaigns array on construction", () => {
    const campaigns: never[] = [];
    const account = unwrap(AdAccount.create(validProps({ campaigns })));
    (campaigns as unknown[]).push({});
    expect(account.campaigns.length).toBe(0);
  });

  it("withCampaigns returns a new immutable instance", () => {
    const account = unwrap(AdAccount.create(validProps()));
    const updated = account.withCampaigns([]);
    expect(updated).toBeInstanceOf(AdAccount);
    expect(updated).not.toBe(account);
  });

  it("exposes every documented getter", () => {
    const account = unwrap(AdAccount.create(validProps()));
    expect(account.id.toString()).toBe("act_752604553578354");
    expect(account.businessManagerId).toBe("bm_1");
    expect(account.currency).toBe("IDR");
    expect(account.timezone).toBe("Asia/Jakarta");
    expect(account.syncedAt).toBeInstanceOf(Date);
  });
});
