import { describe, expect, it } from "vitest";

import { AdStatus } from "../../../src/domain/value-objects/AdStatus.js";
import { Branch } from "../../../src/domain/value-objects/Branch.js";
import { CampaignObjective } from "../../../src/domain/value-objects/CampaignObjective.js";
import { Funnel } from "../../../src/domain/value-objects/Funnel.js";
import { LeadType } from "../../../src/domain/value-objects/LeadType.js";
import { PublisherPlatform } from "../../../src/domain/value-objects/PublisherPlatform.js";
import { Verdict } from "../../../src/domain/value-objects/Verdict.js";

describe("AdStatus", () => {
  it("has exactly the 4 documented members", () => {
    expect(Object.values(AdStatus).sort()).toEqual(
      ["ACTIVE", "ARCHIVED", "DELETED", "PAUSED"].sort(),
    );
  });
});

describe("CampaignObjective", () => {
  it("has exactly the 4 documented members", () => {
    expect(Object.values(CampaignObjective).sort()).toEqual(
      ["LINK_CLICKS", "OUTCOME_ENGAGEMENT", "OUTCOME_SALES", "VISIT_INSTAGRAM_PROFILE"].sort(),
    );
  });
});

describe("LeadType", () => {
  it("has exactly CTWA and FORM", () => {
    expect(Object.values(LeadType).sort()).toEqual(["CTWA", "FORM"]);
  });
});

describe("PublisherPlatform", () => {
  it("has exactly the 3 documented members with lowercase wire values", () => {
    expect(PublisherPlatform.FACEBOOK).toBe("facebook");
    expect(PublisherPlatform.INSTAGRAM).toBe("instagram");
    expect(PublisherPlatform.THREADS).toBe("threads");
  });
});

describe("Verdict", () => {
  it("has exactly the 6 documented members", () => {
    expect(Object.values(Verdict).sort()).toEqual(
      ["FIX", "KEEP", "PAUSE", "REFRESH", "REVIEW", "SCALE"].sort(),
    );
  });
});

describe("Branch", () => {
  it("has exactly the 7 documented members", () => {
    expect(Object.values(Branch).sort()).toEqual(
      ["BANDUNG", "BINTARO", "BOOST", "CINERE", "JABODETABEK", "MULTI", "UMUM"].sort(),
    );
  });
});

describe("Funnel", () => {
  it("has exactly the 4 documented members", () => {
    expect(Object.values(Funnel).sort()).toEqual(
      ["BRAND_BOOST", "CTWA", "DM", "WEBSITE_LEAD"].sort(),
    );
  });
});
