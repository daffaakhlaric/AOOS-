import "reflect-metadata";

import { describe, expect, it, vi } from "vitest";

import { LeadsService } from "./leads.service.js";
describe("campaign lead projection", () => {
  it("scopes every branch read and excludes other campaigns and contact details", async () => {
    const execute = vi
      .fn()
      .mockResolvedValue({ ok: true, value: [] })
      .mockResolvedValueOnce({
        ok: true,
        value: [
          {
            id: { toString: () => "one" },
            campaignId: "target",
            status: "HOT",
            temperature: "HOT",
            score: 90,
            createdAt: new Date("2026-09-01"),
            leadPhone: "secret",
          },
          { campaignId: "another" },
        ],
      });
    const service = new LeadsService(
      {} as never,
      { getLeadsByBranch: { execute } } as never,
      {} as never,
      {} as never,
      {} as never,
    );
    const rows = await service.getCampaignLeads("target", "tenant-b");
    expect(rows).toHaveLength(1);
    expect(rows[0]).not.toHaveProperty("leadPhone");
    expect(execute.mock.calls.every((call) => call[1] === "tenant-b")).toBe(true);
  });
  it("propagates failed reads rather than returning an empty funnel", async () => {
    const service = new LeadsService(
      {} as never,
      {
        getLeadsByBranch: {
          execute: vi.fn().mockResolvedValue({ ok: false, error: new Error("offline") }),
        },
      } as never,
      {} as never,
      {} as never,
      {} as never,
    );
    await expect(service.getCampaignLeads("target", "tenant-b")).rejects.toThrow("offline");
  });
});
