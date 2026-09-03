import { describe, expect, it } from "vitest";

import {
  evaluateLogicRules,
  isWellFormedLogicRuleSet,
  type LogicRuleSet,
} from "./logic-interpreter.js";

type Field = "rphChatIDR" | "conversations" | "spendAmount" | "frequency";
const ALLOWED_FIELDS: readonly Field[] = [
  "rphChatIDR",
  "conversations",
  "spendAmount",
  "frequency",
];

describe("evaluateLogicRules", () => {
  describe("every real operator", () => {
    const cases: ReadonlyArray<{
      readonly operator: "gt" | "gte" | "lt" | "lte" | "eq" | "neq";
      readonly actual: number;
      readonly threshold: number;
      readonly matches: boolean;
    }> = [
      { operator: "gt", actual: 10, threshold: 5, matches: true },
      { operator: "gt", actual: 5, threshold: 5, matches: false },
      { operator: "gte", actual: 5, threshold: 5, matches: true },
      { operator: "gte", actual: 4, threshold: 5, matches: false },
      { operator: "lt", actual: 4, threshold: 5, matches: true },
      { operator: "lt", actual: 5, threshold: 5, matches: false },
      { operator: "lte", actual: 5, threshold: 5, matches: true },
      { operator: "lte", actual: 6, threshold: 5, matches: false },
      { operator: "eq", actual: 5, threshold: 5, matches: true },
      { operator: "eq", actual: 6, threshold: 5, matches: false },
      { operator: "neq", actual: 6, threshold: 5, matches: true },
      { operator: "neq", actual: 5, threshold: 5, matches: false },
    ];

    for (const { operator, actual, threshold, matches } of cases) {
      it(`${operator}: ${actual} vs ${threshold} -> ${matches ? "matches" : "no match"}`, () => {
        const rules: LogicRuleSet = [
          { conditions: [{ field: "frequency", operator, value: threshold }], result: "HIT" },
        ];
        const result = evaluateLogicRules(
          rules,
          { rphChatIDR: 0, conversations: 0, spendAmount: 0, frequency: actual },
          ALLOWED_FIELDS,
        );
        expect(result).toBe(matches ? "HIT" : undefined);
      });
    }
  });

  it("multi-condition AND: matches only when every condition matches", () => {
    const rules: LogicRuleSet = [
      {
        conditions: [
          { field: "rphChatIDR", operator: "gt", value: 20_000 },
          { field: "spendAmount", operator: "gt", value: 100_000 },
        ],
        combinator: "AND",
        result: "ESCALATE",
      },
    ];
    const bothMatch = evaluateLogicRules(
      rules,
      { rphChatIDR: 25_000, conversations: 1, spendAmount: 150_000, frequency: 1 },
      ALLOWED_FIELDS,
    );
    expect(bothMatch).toBe("ESCALATE");

    const onlyOneMatches = evaluateLogicRules(
      rules,
      { rphChatIDR: 25_000, conversations: 1, spendAmount: 50_000, frequency: 1 },
      ALLOWED_FIELDS,
    );
    expect(onlyOneMatches).toBeUndefined();
  });

  it("multi-condition OR: matches when any condition matches", () => {
    const rules: LogicRuleSet = [
      {
        conditions: [
          { field: "rphChatIDR", operator: "gt", value: 20_000 },
          { field: "conversations", operator: "eq", value: 0 },
        ],
        combinator: "OR",
        result: "PAUSE",
      },
    ];
    const result = evaluateLogicRules(
      rules,
      { rphChatIDR: 1000, conversations: 0, spendAmount: 100, frequency: 1 },
      ALLOWED_FIELDS,
    );
    expect(result).toBe("PAUSE");
  });

  it("ordered, first-match-wins: an earlier matching rule wins over a later one that would also match", () => {
    const rules: LogicRuleSet = [
      { conditions: [{ field: "frequency", operator: "gte", value: 3 }], result: "FIRST" },
      { conditions: [{ field: "frequency", operator: "gte", value: 1 }], result: "SECOND" },
    ];
    const result = evaluateLogicRules(
      rules,
      { rphChatIDR: 0, conversations: 0, spendAmount: 0, frequency: 5 },
      ALLOWED_FIELDS,
    );
    expect(result).toBe("FIRST");
  });

  it("honest no-match fallback: undefined when no rule's conditions are satisfied", () => {
    const rules: LogicRuleSet = [
      { conditions: [{ field: "frequency", operator: "gt", value: 100 }], result: "NEVER" },
    ];
    const result = evaluateLogicRules(
      rules,
      { rphChatIDR: 0, conversations: 0, spendAmount: 0, frequency: 1 },
      ALLOWED_FIELDS,
    );
    expect(result).toBeUndefined();
  });

  describe("honest degrade on malformed/empty rules — never throws", () => {
    const input = { rphChatIDR: 1, conversations: 1, spendAmount: 1, frequency: 1 };

    it("rules is not an array", () => {
      expect(evaluateLogicRules("not-an-array", input, ALLOWED_FIELDS)).toBeUndefined();
      expect(evaluateLogicRules(null, input, ALLOWED_FIELDS)).toBeUndefined();
      expect(evaluateLogicRules(undefined, input, ALLOWED_FIELDS)).toBeUndefined();
      expect(evaluateLogicRules({ conditions: [] }, input, ALLOWED_FIELDS)).toBeUndefined();
    });

    it("rules is an empty array", () => {
      expect(evaluateLogicRules([], input, ALLOWED_FIELDS)).toBeUndefined();
    });

    it("a rule missing conditions/result is skipped, not thrown", () => {
      const rules = [{ result: "X" }, { conditions: [] }];
      expect(evaluateLogicRules(rules, input, ALLOWED_FIELDS)).toBeUndefined();
    });

    it("a condition naming an unknown operator is skipped", () => {
      const rules = [
        { conditions: [{ field: "frequency", operator: "startsWith", value: 1 }], result: "X" },
      ];
      expect(evaluateLogicRules(rules, input, ALLOWED_FIELDS)).toBeUndefined();
    });

    it("a condition naming a field outside the caller's allowlist is skipped (never dynamic property access on an arbitrary field)", () => {
      const rules: LogicRuleSet = [
        {
          conditions: [{ field: "__proto__", operator: "eq", value: 1 }],
          result: "SHOULD_NEVER_MATCH",
        },
      ];
      const result = evaluateLogicRules(rules, input, ALLOWED_FIELDS);
      expect(result).toBeUndefined();
    });

    it("a condition with a non-finite value is skipped", () => {
      const rules = [
        { conditions: [{ field: "frequency", operator: "gt", value: Number.NaN }], result: "X" },
      ];
      expect(evaluateLogicRules(rules, input, ALLOWED_FIELDS)).toBeUndefined();
    });

    it("one malformed rule doesn't block a later well-formed rule from matching", () => {
      const rules = [
        { conditions: [{ field: "frequency", operator: "bogus", value: 1 }], result: "BAD" },
        { conditions: [{ field: "frequency", operator: "gte", value: 1 }], result: "GOOD" },
      ];
      expect(evaluateLogicRules(rules, input, ALLOWED_FIELDS)).toBe("GOOD");
    });
  });
});

describe("isWellFormedLogicRuleSet", () => {
  it("accepts a real, well-formed rule set", () => {
    const rules: LogicRuleSet = [
      { conditions: [{ field: "x", operator: "gt", value: 1 }], result: "R" },
    ];
    expect(isWellFormedLogicRuleSet(rules)).toBe(true);
  });

  it("rejects a non-array, an empty array, and a structurally malformed entry", () => {
    expect(isWellFormedLogicRuleSet("nope")).toBe(false);
    expect(isWellFormedLogicRuleSet([])).toBe(false);
    expect(isWellFormedLogicRuleSet([{ result: "R" }])).toBe(false);
    expect(isWellFormedLogicRuleSet([{ conditions: [{ field: "x" }], result: "R" }])).toBe(false);
  });
});
