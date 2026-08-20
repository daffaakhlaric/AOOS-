import { BranchId } from "@aos/branch-manager";
import { describe, expect, it } from "vitest";

import { PropertyHandoffPackage } from "../../../../src/domain/entities/PropertyHandoffPackage.js";
import type { PropertyListing } from "../../../../src/domain/entities/PropertyListing.js";
import { LeadScore } from "../../../../src/domain/value-objects/LeadScore.js";
import { QualificationStatus } from "../../../../src/domain/value-objects/QualificationStatus.js";
import { unwrap } from "../../../helpers/result.js";

const LISTING: PropertyListing = {
  id: "l1",
  title: "Rumah Bintaro",
  propertyType: "RUMAH",
  price: 1_500_000_000,
};

describe("PropertyHandoffPackage", () => {
  it("create() exposes every field", () => {
    const pkg = PropertyHandoffPackage.create({
      leadPhone: "+6281200000001",
      branchId: BranchId.CINERE,
      conversationSummary: "Lead serius soal properti.",
      score: unwrap(LeadScore.create(90)),
      qualifiedCriteria: [QualificationStatus.BUDGET],
      extractedInfo: { budget: "1.5 miliar" },
      recommendedAction: "Hubungi sekarang, siap survey lokasi",
      matchedListings: [LISTING],
      conversationHighlights: ["ada rumah di bintaro gak kak?"],
    });

    expect(pkg.leadPhone).toBe("+6281200000001");
    expect(pkg.branchId).toBe(BranchId.CINERE);
    expect(pkg.conversationSummary).toContain("properti");
    expect(pkg.score.toNumber()).toBe(90);
    expect(pkg.qualifiedCriteria).toEqual([QualificationStatus.BUDGET]);
    expect(pkg.extractedInfo.budget).toBe("1.5 miliar");
    expect(pkg.recommendedAction).toContain("survey lokasi");
    expect(pkg.matchedListings).toEqual([LISTING]);
    expect(pkg.conversationHighlights).toEqual(["ada rumah di bintaro gak kak?"]);
  });

  it("create() defensively copies its array fields", () => {
    const matchedListings = [LISTING];
    const pkg = PropertyHandoffPackage.create({
      leadPhone: "+6281200000001",
      branchId: BranchId.CINERE,
      conversationSummary: "x",
      score: LeadScore.zero(),
      qualifiedCriteria: [],
      extractedInfo: {},
      recommendedAction: "x",
      matchedListings,
      conversationHighlights: [],
    });
    matchedListings.push(LISTING);
    expect(pkg.matchedListings).toHaveLength(1);
  });
});
