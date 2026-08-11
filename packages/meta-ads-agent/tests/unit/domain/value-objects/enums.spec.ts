import { describe, expect, it } from "vitest";

import { AdAngle } from "../../../../src/domain/value-objects/AdAngle.js";
import { AgentState } from "../../../../src/domain/value-objects/AgentState.js";
import { DecisionType } from "../../../../src/domain/value-objects/DecisionType.js";
import { TargetPersona } from "../../../../src/domain/value-objects/TargetPersona.js";

describe("DecisionType", () => {
  it("has the four spec-mandated members", () => {
    expect(Object.values(DecisionType).sort()).toEqual(
      ["AUTO_EXECUTE", "BRIEF_KAI", "ESCALATE", "NO_ACTION"].sort(),
    );
  });
});

describe("AgentState", () => {
  it("has the four spec-mandated members", () => {
    expect(Object.values(AgentState).sort()).toEqual(
      ["ANALYZING", "EXECUTING", "IDLE", "WAITING_APPROVAL"].sort(),
    );
  });
});

describe("AdAngle", () => {
  it("has the six W1D-base spec-mandated members plus the AAOS-W1D-S1S2 (S1) WEBSITE_REDIRECT addition", () => {
    expect(Object.values(AdAngle).sort()).toEqual(
      [
        "DISCOVERY",
        "DP_RINGAN",
        "GUDANGNYA",
        "KREDIT_SYARIAH",
        "QNA",
        "TESTIMONIAL",
        "WEBSITE_REDIRECT",
      ].sort(),
    );
  });
});

describe("TargetPersona", () => {
  it("has the two spec-mandated members", () => {
    expect(Object.values(TargetPersona).sort()).toEqual(
      ["PRIMARY_FAMILY", "SECONDARY_BUSINESS"].sort(),
    );
  });
});
