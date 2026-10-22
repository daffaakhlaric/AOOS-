import { MetaApiClient } from "@aos/meta-ads-connector";
import { expect, it, vi, afterEach } from "vitest";

import { ActionLearningService, validateCampaignLearning } from "./action-learning.service.js";
import type { ActionCommand } from "./action.types.js";
const command = { entityId: "100", adAccountId: "act_1" } as ActionCommand;
const stable = {
  id: "200",
  campaign_id: "100",
  account_id: "1",
  status: "ACTIVE",
  learning_stage_info: { status: "SUCCESS" },
};
afterEach(() => vi.restoreAllMocks());
it("accepts a complete set of stable ad sets", () => {
  expect(() => validateCampaignLearning(command, { data: [stable] })).not.toThrow();
});
it.each(["LEARNING", "LEARNING_LIMITED", "UNKNOWN", undefined])(
  "blocks learning state %s",
  (status) => {
    expect(() =>
      validateCampaignLearning(command, { data: [{ ...stable, learning_stage_info: { status } }] }),
    ).toThrow();
  },
);
it.each([
  { data: [] },
  { data: [stable], paging: { next: "next-page" } },
  { data: [stable, stable] },
  { data: [{ ...stable, account_id: "2" }] },
  { data: [{ ...stable, campaign_id: "101" }] },
])("rejects incomplete or wrong-scope coverage", (result) => {
  expect(() => validateCampaignLearning(command, result)).toThrow();
});
it("uses the canonical read transport and does not treat an API failure as success", async () => {
  const read = vi
    .spyOn(MetaApiClient.prototype, "readGraph")
    .mockResolvedValue({ ok: false } as never);
  await expect(new ActionLearningService().verify(command, "fixture")).rejects.toThrow(
    "LEARNING_UNAVAILABLE",
  );
  expect(read).toHaveBeenCalledWith(
    "100/adsets",
    "fixture",
    "id,campaign_id,account_id,status,learning_stage_info",
  );
});
