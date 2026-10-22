import { expect, it } from "vitest";

import {
  verifyHierarchy,
  type FrozenHierarchy,
  type HierarchyReadBack,
} from "./action-verification.service.js";

const plan: FrozenHierarchy = {
  campaignId: "c",
  adAccountId: "act_1",
  adSets: [{ id: "s" }],
  creatives: [{ id: "v" }],
  ads: [{ id: "a", adSetId: "s", creativeId: "v" }],
  expectedAdSetCount: 1,
  expectedCreativeCount: 1,
  expectedAdCount: 1,
  configuredStatus: "PAUSED",
};
const actual: HierarchyReadBack = {
  campaign: { id: "c", accountId: "1", status: "PAUSED" },
  adSets: [{ id: "s", accountId: "1", campaignId: "c", status: "PAUSED" }],
  creatives: [{ id: "v", accountId: "1" }],
  ads: [
    { id: "a", accountId: "1", campaignId: "c", adSetId: "s", creativeId: "v", status: "PAUSED" },
  ],
};
it("verifies full hierarchy and rejects zero ads or partial children", () => {
  expect(verifyHierarchy(plan, actual).verified).toBe(true);
  expect(verifyHierarchy(plan, { ...actual, ads: [] }).verified).toBe(false);
  expect(
    verifyHierarchy({ ...plan, ads: [], expectedAdCount: 0 }, { ...actual, ads: [] }).verified,
  ).toBe(false);
});
it("rejects wrong account, parent, creative mapping, and configured status", () => {
  for (const change of [
    { accountId: "2" },
    { campaignId: "other" },
    { creativeId: "other" },
    { status: "ACTIVE" },
  ]) {
    expect(
      verifyHierarchy(plan, { ...actual, ads: [{ ...actual.ads[0]!, ...change }] }).verified,
    ).toBe(false);
  }
});
