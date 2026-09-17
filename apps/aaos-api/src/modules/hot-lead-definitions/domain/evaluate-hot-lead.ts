/** Minimal, structural view of the real fields `evaluateHotLead` needs off a `Lead` — deliberately NOT importing `packages/lead-store`'s `Lead` class itself (this module never touches `@aos/lead-store`, per this phase's scope), just the shape column-for-column with `LeadProps`'s `status`/`score`/`qualification`. */
export interface EvaluatableLead {
  readonly status: string;
  readonly score: number;
  readonly qualification: {
    readonly budget: boolean;
    readonly unit: boolean;
    readonly area: boolean;
    readonly payment: boolean;
    readonly timeline: boolean;
    readonly name: boolean;
  };
}

export type RuleField =
  "budget" | "unit" | "area" | "payment" | "timeline" | "name" | "score" | "status";

export type RuleOperator = "=" | "!=" | "<" | "<=" | ">" | ">=";

export interface HotLeadRule {
  readonly field: RuleField;
  readonly operator: RuleOperator;
  readonly value: boolean | number | string;
}

export interface HotLeadDefinition {
  readonly mode: "LEAD_STATUS" | "RULE_BASED";
  readonly leadStatusValue?: string;
  readonly rules?: readonly HotLeadRule[];
}

const QUALIFICATION_FIELDS: ReadonlySet<RuleField> = new Set([
  "budget",
  "unit",
  "area",
  "payment",
  "timeline",
  "name",
]);

/** Reads the real value a rule's `field` refers to off `lead` — the only 8 fields `HotLeadRule.field`'s type allows (6 real `LeadQualificationFlags` keys + `score` + `status`). */
function fieldValue(lead: EvaluatableLead, field: RuleField): boolean | number | string {
  if (field === "score") {
    return lead.score;
  }
  if (field === "status") {
    return lead.status;
  }
  if (QUALIFICATION_FIELDS.has(field)) {
    return lead.qualification[field as keyof EvaluatableLead["qualification"]];
  }
  /* v8 ignore next -- unreachable: RuleField's type union is exhaustively covered above. */
  return false;
}

function compare(
  actual: boolean | number | string,
  operator: RuleOperator,
  expected: boolean | number | string,
): boolean {
  switch (operator) {
    case "=":
      return actual === expected;
    case "!=":
      return actual !== expected;
    case "<":
      return actual < expected;
    case "<=":
      return actual <= expected;
    case ">":
      return actual > expected;
    case ">=":
      return actual >= expected;
    /* v8 ignore next 2 -- unreachable: RuleOperator's type union is exhaustively covered above. */
    default:
      return false;
  }
}

function evaluateRule(lead: EvaluatableLead, rule: HotLeadRule): boolean {
  const actual = fieldValue(lead, rule.field);
  // A boolean field compared with a non-`<`/`>` operator against a non-boolean `value` (a
  // misconfigured rule — e.g. `{field: "budget", operator: "=", value: "yes"}` instead of
  // `true`) can never truthfully match: `actual`/`expected` have different JS types, so
  // `===`/`<`/etc. degrade to a safe, deterministic `false`/type-coerced comparison rather than
  // throwing. Never silently "fixed up" into a match — an honestly wrong rule stays wrong.
  return compare(actual, rule.operator, rule.value);
}

/**
 * PURE, deterministic (no LLM) hot-lead classifier — EYVRA SAMANTHA V2 Phase 1 Part A. Evaluates a
 * real lead's `status`/`score`/`qualification` against a tenant's stored `HotLeadDefinition`.
 *
 * `RULE_BASED` semantics: ALL rules must pass (AND) — there is no OR/grouping in this phase (the
 * raw spec never asked for boolean grouping, and `rules: HotLeadRule[]` is a flat array). An EMPTY
 * `rules` array always evaluates to `false`, never `true` — "no rules configured" must never
 * silently classify every lead as hot (the same "don't invent a default" discipline
 * `HotLeadDefinitionsService.get()` documents for "tenant hasn't defined anything yet").
 */
export function evaluateHotLead(lead: EvaluatableLead, definition: HotLeadDefinition): boolean {
  if (definition.mode === "LEAD_STATUS") {
    if (definition.leadStatusValue === undefined) {
      return false;
    }
    return lead.status === definition.leadStatusValue;
  }
  const rules = definition.rules ?? [];
  if (rules.length === 0) {
    return false;
  }
  return rules.every((rule) => evaluateRule(lead, rule));
}
