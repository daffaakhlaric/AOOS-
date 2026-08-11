import { BranchId } from "@aos/branch-manager";
import { describe, expect, it } from "vitest";

import { HandoffPackage } from "../../../../src/domain/entities/HandoffPackage.js";
import { LeadScore } from "../../../../src/domain/value-objects/LeadScore.js";
import { QualificationStatus } from "../../../../src/domain/value-objects/QualificationStatus.js";
import { unwrap } from "../../../helpers/result.js";

describe("HandoffPackage", () => {
  it("create() exposes every field", () => {
    const pkg = HandoffPackage.create({
      leadPhone: "+6281200000001",
      branchId: BranchId.CINERE,
      conversationSummary: "Lead serius soal Xpander.",
      score: unwrap(LeadScore.create(90)),
      qualifiedCriteria: [QualificationStatus.BUDGET, QualificationStatus.UNIT],
      extractedInfo: { budget: "200 juta", unit: "Xpander" },
      recommendedAction: "Hubungi sekarang, siap test drive",
      matchedUnits: [],
      conversationHighlights: ["ada xpander gak kak?"],
    });

    expect(pkg.leadPhone).toBe("+6281200000001");
    expect(pkg.branchId).toBe(BranchId.CINERE);
    expect(pkg.conversationSummary).toContain("Xpander");
    expect(pkg.score.toNumber()).toBe(90);
    expect(pkg.qualifiedCriteria).toEqual([QualificationStatus.BUDGET, QualificationStatus.UNIT]);
    expect(pkg.extractedInfo.budget).toBe("200 juta");
    expect(pkg.recommendedAction).toContain("test drive");
    expect(pkg.matchedUnits).toEqual([]);
    expect(pkg.conversationHighlights).toEqual(["ada xpander gak kak?"]);
  });

  it("create() defensively copies its array fields", () => {
    const qualifiedCriteria = [QualificationStatus.BUDGET];
    const pkg = HandoffPackage.create({
      leadPhone: "+6281200000001",
      branchId: BranchId.CINERE,
      conversationSummary: "x",
      score: LeadScore.zero(),
      qualifiedCriteria,
      extractedInfo: {},
      recommendedAction: "x",
      matchedUnits: [],
      conversationHighlights: [],
    });
    qualifiedCriteria.push(QualificationStatus.UNIT);
    expect(pkg.qualifiedCriteria).toHaveLength(1);
  });
});
