import { describe, expect, it } from "vitest";

import {
  evaluateHotLead,
  type EvaluatableLead,
  type HotLeadDefinition,
} from "./evaluate-hot-lead.js";

function makeLead(overrides: Partial<EvaluatableLead> = {}): EvaluatableLead {
  return {
    status: "WARM",
    score: 40,
    qualification: {
      budget: false,
      unit: false,
      area: false,
      payment: false,
      timeline: false,
      name: false,
    },
    ...overrides,
  };
}

describe("evaluateHotLead", () => {
  describe("LEAD_STATUS mode", () => {
    it("returns true when the lead's status matches leadStatusValue", () => {
      const def: HotLeadDefinition = { mode: "LEAD_STATUS", leadStatusValue: "HOT" };
      expect(evaluateHotLead(makeLead({ status: "HOT" }), def)).toBe(true);
    });

    it("returns false when the lead's status does not match", () => {
      const def: HotLeadDefinition = { mode: "LEAD_STATUS", leadStatusValue: "HOT" };
      expect(evaluateHotLead(makeLead({ status: "WARM" }), def)).toBe(false);
    });

    it("supports a tenant choosing WARM (not just HOT) to count", () => {
      const def: HotLeadDefinition = { mode: "LEAD_STATUS", leadStatusValue: "WARM" };
      expect(evaluateHotLead(makeLead({ status: "WARM" }), def)).toBe(true);
      expect(evaluateHotLead(makeLead({ status: "COLD" }), def)).toBe(false);
    });

    it("returns false (never throws) when leadStatusValue is missing — a misconfigured definition", () => {
      const def = { mode: "LEAD_STATUS" } as HotLeadDefinition;
      expect(evaluateHotLead(makeLead({ status: "HOT" }), def)).toBe(false);
    });
  });

  describe("RULE_BASED mode", () => {
    it("returns false for an empty rules array — 'no rules' must never mean 'always hot'", () => {
      const def: HotLeadDefinition = { mode: "RULE_BASED", rules: [] };
      expect(evaluateHotLead(makeLead({ score: 100, status: "HOT" }), def)).toBe(false);
    });

    it("returns false when rules is undefined — same 'no rules configured' case as an empty array", () => {
      const def = { mode: "RULE_BASED" } as HotLeadDefinition;
      expect(evaluateHotLead(makeLead({ score: 100 }), def)).toBe(false);
    });

    it("evaluates a single score >= rule", () => {
      const def: HotLeadDefinition = {
        mode: "RULE_BASED",
        rules: [{ field: "score", operator: ">=", value: 65 }],
      };
      expect(evaluateHotLead(makeLead({ score: 70 }), def)).toBe(true);
      expect(evaluateHotLead(makeLead({ score: 60 }), def)).toBe(false);
    });

    it("evaluates a boolean qualification field with '='", () => {
      const def: HotLeadDefinition = {
        mode: "RULE_BASED",
        rules: [{ field: "budget", operator: "=", value: true }],
      };
      expect(
        evaluateHotLead(
          makeLead({ qualification: { ...makeLead().qualification, budget: true } }),
          def,
        ),
      ).toBe(true);
      expect(evaluateHotLead(makeLead(), def)).toBe(false);
    });

    it("evaluates a status field with '!='", () => {
      const def: HotLeadDefinition = {
        mode: "RULE_BASED",
        rules: [{ field: "status", operator: "!=", value: "CLOSED" }],
      };
      expect(evaluateHotLead(makeLead({ status: "HOT" }), def)).toBe(true);
      expect(evaluateHotLead(makeLead({ status: "CLOSED" }), def)).toBe(false);
    });

    it("ALL rules must pass (AND) — a single failing rule fails the whole definition", () => {
      const def: HotLeadDefinition = {
        mode: "RULE_BASED",
        rules: [
          { field: "score", operator: ">=", value: 65 },
          { field: "budget", operator: "=", value: true },
        ],
      };
      const scoreOnlyLead = makeLead({ score: 70 });
      expect(evaluateHotLead(scoreOnlyLead, def)).toBe(false);

      const bothLead = makeLead({
        score: 70,
        qualification: { ...scoreOnlyLead.qualification, budget: true },
      });
      expect(evaluateHotLead(bothLead, def)).toBe(true);
    });

    it("evaluates every real LeadQualificationFlags key", () => {
      const fields = ["budget", "unit", "area", "payment", "timeline", "name"] as const;
      for (const field of fields) {
        const def: HotLeadDefinition = {
          mode: "RULE_BASED",
          rules: [{ field, operator: "=", value: true }],
        };
        const trueLead = makeLead({
          qualification: { ...makeLead().qualification, [field]: true },
        });
        expect(evaluateHotLead(trueLead, def)).toBe(true);
        expect(evaluateHotLead(makeLead(), def)).toBe(false);
      }
    });

    it("a misconfigured rule (type-mismatched value) deterministically evaluates false, never throws", () => {
      const def: HotLeadDefinition = {
        mode: "RULE_BASED",
        rules: [{ field: "budget", operator: "=", value: "yes" }],
      };
      expect(() =>
        evaluateHotLead(
          makeLead({ qualification: { ...makeLead().qualification, budget: true } }),
          def,
        ),
      ).not.toThrow();
      expect(
        evaluateHotLead(
          makeLead({ qualification: { ...makeLead().qualification, budget: true } }),
          def,
        ),
      ).toBe(false);
    });

    it("evaluates '<' and '<=' operators on score", () => {
      const ltDef: HotLeadDefinition = {
        mode: "RULE_BASED",
        rules: [{ field: "score", operator: "<", value: 50 }],
      };
      expect(evaluateHotLead(makeLead({ score: 40 }), ltDef)).toBe(true);
      expect(evaluateHotLead(makeLead({ score: 50 }), ltDef)).toBe(false);

      const lteDef: HotLeadDefinition = {
        mode: "RULE_BASED",
        rules: [{ field: "score", operator: "<=", value: 50 }],
      };
      expect(evaluateHotLead(makeLead({ score: 50 }), lteDef)).toBe(true);
    });

    it("evaluates '>' operator on score", () => {
      const def: HotLeadDefinition = {
        mode: "RULE_BASED",
        rules: [{ field: "score", operator: ">", value: 50 }],
      };
      expect(evaluateHotLead(makeLead({ score: 51 }), def)).toBe(true);
      expect(evaluateHotLead(makeLead({ score: 50 }), def)).toBe(false);
    });
  });
});
