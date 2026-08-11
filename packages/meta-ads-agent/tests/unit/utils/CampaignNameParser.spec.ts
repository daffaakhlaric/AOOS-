import { Branch, Funnel } from "@aos/meta-ads-connector";
import { describe, expect, it } from "vitest";

import { CampaignNameParser } from "../../../src/utils/CampaignNameParser.js";

describe("CampaignNameParser", () => {
  it("parses a CTWA Bintaro campaign name", () => {
    const parsed = CampaignNameParser.parse("Meta-CTWA-Leads-Mobix-Bintaro");
    expect(parsed.funnel).toBe(Funnel.CTWA);
    expect(parsed.branch).toBe(Branch.BINTARO);
  });

  it("parses a Boost/content post name", () => {
    const parsed = CampaignNameParser.parse("Post: Xpander Boost diskon akhir tahun");
    expect(parsed.funnel).toBe(Funnel.BRAND_BOOST);
    expect(parsed.branch).toBe(Branch.BOOST);
  });
});
