import { describe, expect, it } from "vitest";

import { AdDestinationType } from "../../../src/domain/value-objects/AdDestinationType.js";
import { AdStatus } from "../../../src/domain/value-objects/AdStatus.js";
import { Branch } from "../../../src/domain/value-objects/Branch.js";
import {
  CampaignObjective,
  parseCampaignObjective,
} from "../../../src/domain/value-objects/CampaignObjective.js";
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
  it("has exactly the 9 documented members (real bug fix: added the full ODAX objective set + UNKNOWN, see docstring)", () => {
    expect(Object.values(CampaignObjective).sort()).toEqual(
      [
        "LINK_CLICKS",
        "OUTCOME_APP_PROMOTION",
        "OUTCOME_AWARENESS",
        "OUTCOME_ENGAGEMENT",
        "OUTCOME_LEADS",
        "OUTCOME_SALES",
        "OUTCOME_TRAFFIC",
        "UNKNOWN",
        "VISIT_INSTAGRAM_PROFILE",
      ].sort(),
    );
  });
});

describe("parseCampaignObjective", () => {
  it.each([
    "OUTCOME_LEADS",
    "OUTCOME_ENGAGEMENT",
    "OUTCOME_SALES",
    "OUTCOME_AWARENESS",
    "OUTCOME_TRAFFIC",
    "OUTCOME_APP_PROMOTION",
    "LINK_CLICKS",
    "VISIT_INSTAGRAM_PROFILE",
  ])("parses the known objective %s as itself", (value) => {
    expect(parseCampaignObjective(value)).toBe(value);
  });

  it("maps a Meta objective Meta returns but AAOS doesn't have a member for to UNKNOWN, never throwing (real bug: this used to abort the whole campaign-list mapping)", () => {
    expect(parseCampaignObjective("OUTCOME_LOCAL_AWARENESS")).toBe(CampaignObjective.UNKNOWN);
  });

  it("maps a genuinely bogus string to UNKNOWN", () => {
    expect(parseCampaignObjective("NOT_A_REAL_OBJECTIVE")).toBe(CampaignObjective.UNKNOWN);
  });

  it('maps the literal string "UNKNOWN" to UNKNOWN (not treated as a spoofable known value)', () => {
    expect(parseCampaignObjective("UNKNOWN")).toBe(CampaignObjective.UNKNOWN);
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

describe("AdDestinationType (AAOS-W1D-S3)", () => {
  it("has exactly the 4 documented members", () => {
    expect(Object.values(AdDestinationType).sort()).toEqual(
      ["INSTAGRAM", "MESSENGER", "WEBSITE", "WHATSAPP"].sort(),
    );
  });
});
