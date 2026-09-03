/**
 * `evaluateLogicRules` (AAOS Self-Improving, Phase SI-2) — the real, SAFE, constrained interpreter
 * for `agent_logic.definition`. This is the ENTIRE real "logic engine" this phase builds: a small,
 * pure, synchronous function over a plain data structure. There is NO `eval`, NO `new Function`, NO
 * dynamic `require`/`import()`, and NO scripting sandbox library anywhere in this file or anything
 * it calls — an LLM- or human-authored `definition` payload can only ever select among a fixed,
 * closed vocabulary of comparison operators and a fixed, caller-supplied allowlist of field names;
 * it can never become executable code, and it can never read or touch anything on `input` outside
 * that allowlist (see `evaluateLogicRules`'s own doc for exactly how the field-name check makes
 * that true).
 *
 * SHAPE (per `docs/PROMPT-AAOS-SELF-IMPROVING-FULL.md`'s own real, deliberate design call for this
 * phase): `agent_logic.definition` is an ORDERED array of rules, each with one or more `conditions`
 * (a `field`/`operator`/numeric `value` triple), an optional `combinator` (`"AND"` | `"OR"`,
 * meaningful only when a rule has more than one condition — defaults to `"AND"`), and a `result`
 * string. Rules are evaluated IN ORDER; the first rule whose conditions are satisfied wins — same
 * "ordered, first-match-wins, deterministic precedence" shape
 * `packages/meta-ads-connector/src/domain/services/VerdictEngine.ts`'s own real `evaluateVerdict`
 * already uses (see that file's own doc), just expressed as data instead of TypeScript control
 * flow. No rule matching is an honest, real outcome (`undefined`) — never a fabricated default
 * result guessed at by this interpreter itself; the caller decides what "no override" means for its
 * own real decision point (see `AgentLogicService`'s own doc).
 *
 * DEGRADE DISCIPLINE (same as every other DB/LLM-authored-JSON boundary in this codebase, e.g.
 * `AgentConfigService.get`'s own "never turn a transient/malformed config read into a request
 * failure" doc): malformed input at ANY level — `rules` not an array, a rule missing `conditions`/
 * `result`, a condition naming an operator outside the fixed vocabulary, a condition naming a field
 * outside the caller's allowlist, a non-finite `value` — never throws. The whole malformed RULE is
 * skipped (evaluation continues with the next rule); if nothing in `rules` is well-formed at all,
 * or `rules` itself isn't a real array, the whole call returns `undefined`, the same "fall back to
 * whatever the real caller was already doing" honest degrade `AgentConfigService.get` already
 * establishes for a malformed stored value.
 */

/** The fixed, closed comparison-operator vocabulary — nothing else is ever accepted. */
export const LOGIC_OPERATORS = ["gt", "gte", "lt", "lte", "eq", "neq"] as const;
export type LogicOperator = (typeof LOGIC_OPERATORS)[number];

const LOGIC_OPERATOR_SET: ReadonlySet<string> = new Set(LOGIC_OPERATORS);

/** One real comparison: `input[field] <operator> value`. `field` is checked against the caller's explicit allowlist before it is ever used to read `input` — see `evaluateLogicRules`'s own doc. */
export interface LogicCondition {
  readonly field: string;
  readonly operator: LogicOperator;
  readonly value: number;
}

/**
 * One real, ordered rule. `conditions` is deliberately an array (never a single bare `condition`)
 * so a genuinely multi-field rule — e.g. `rphChatIDR > X AND spendIDR > Y` — is representable
 * without inventing a second, nested rule shape; a single-condition rule is just `conditions.length
 * === 1`, where `combinator` is irrelevant and ignored.
 */
export interface LogicRule {
  readonly conditions: readonly LogicCondition[];
  /** Ignored (treated as `"AND"`) when `conditions.length <= 1`. Defaults to `"AND"` when omitted. */
  readonly combinator?: "AND" | "OR";
  readonly result: string;
}

export type LogicRuleSet = readonly LogicRule[];

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isWellFormedCondition(value: unknown): value is LogicCondition {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate["field"] === "string" &&
    candidate["field"].length > 0 &&
    typeof candidate["operator"] === "string" &&
    LOGIC_OPERATOR_SET.has(candidate["operator"]) &&
    isFiniteNumber(candidate["value"])
  );
}

function isWellFormedRule(value: unknown): value is LogicRule {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  if (typeof candidate["result"] !== "string" || candidate["result"].length === 0) {
    return false;
  }
  if (!Array.isArray(candidate["conditions"]) || candidate["conditions"].length === 0) {
    return false;
  }
  if (!candidate["conditions"].every(isWellFormedCondition)) {
    return false;
  }
  const combinator = candidate["combinator"];
  return combinator === undefined || combinator === "AND" || combinator === "OR";
}

/**
 * Structural-only validation — never checks `condition.field` against any particular agent's real
 * allowlist (that is `evaluateLogicRules`'s own job, since only a real caller knows its own real
 * allowlist). Used by `AgentLogicService`/`LogicApplierService` to reject a malformed
 * `agent_logic.definition` (a bad LLM write, a hand-edited row, a stale schema) before it is ever
 * persisted or trusted as a real ruleset — same "validate at the DB/LLM boundary, never trust JSONB
 * shape blindly" discipline this codebase's other JSONB columns (e.g.
 * `learning_proposals.improvements`) already establish via Zod.
 */
export function isWellFormedLogicRuleSet(value: unknown): value is LogicRuleSet {
  return Array.isArray(value) && value.length > 0 && value.every(isWellFormedRule);
}

function compare(operator: LogicOperator, actual: number, expected: number): boolean {
  switch (operator) {
    case "gt":
      return actual > expected;
    case "gte":
      return actual >= expected;
    case "lt":
      return actual < expected;
    case "lte":
      return actual <= expected;
    case "eq":
      return actual === expected;
    case "neq":
      return actual !== expected;
    /* v8 ignore next 2 */
    default:
      return false; // Unreachable: `operator` is typed `LogicOperator`, already validated upstream.
  }
}

/**
 * Evaluates `rules` (untyped — real caller input is a DB `JSONB` column or LLM-authored JSON text,
 * never trusted as already being a real `LogicRuleSet`) against `input`, returning the `result` of
 * the first well-formed, matching rule, or `undefined` when nothing matches, when `rules` isn't a
 * real non-empty array at all, or when every entry in it is individually malformed (see this
 * module's own header doc for the full degrade discipline — one malformed rule is skipped, never
 * enough to invalidate the rest of an otherwise real ruleset).
 *
 * SAFETY: `allowedFields` is a real, explicit, hardcoded array the CALLER controls (never derived
 * from `rules` itself) — a condition naming any field outside this exact set is treated as
 * malformed (its whole rule is skipped), so `input`'s properties are only ever read through this
 * closed allowlist, never through an arbitrary LLM-authored string. This is the one, sole point
 * anywhere in this interpreter where a `definition`-authored string reaches a property lookup, and
 * it can only ever select a real, statically-known field this specific call site already agreed to
 * expose — never `__proto__`/`constructor`/an inherited property (this function only ever reads via
 * `Object.prototype.hasOwnProperty.call`, never bare `in`/index access on an unchecked key), and
 * never anything resembling code execution.
 */
export function evaluateLogicRules<TField extends string>(
  rules: unknown,
  input: Readonly<Record<TField, number>>,
  allowedFields: readonly TField[],
): string | undefined {
  try {
    if (!Array.isArray(rules) || rules.length === 0) {
      return undefined;
    }
    const allowedFieldSet: ReadonlySet<string> = new Set(allowedFields);

    for (const candidate of rules) {
      if (!isWellFormedRule(candidate)) {
        continue; // Honest degrade: skip this one malformed rule, keep evaluating the rest.
      }
      const rule = candidate;
      const combinator = rule.conditions.length > 1 ? (rule.combinator ?? "AND") : "AND";
      const evaluated: boolean[] = [];
      let ruleIsWellFormedForThisInput = true;

      for (const condition of rule.conditions) {
        if (
          !allowedFieldSet.has(condition.field) ||
          !Object.prototype.hasOwnProperty.call(input, condition.field)
        ) {
          ruleIsWellFormedForThisInput = false;
          break;
        }
        const actual = (input as Record<string, number>)[condition.field];
        if (!isFiniteNumber(actual)) {
          ruleIsWellFormedForThisInput = false;
          break;
        }
        evaluated.push(compare(condition.operator, actual, condition.value));
      }

      if (!ruleIsWellFormedForThisInput) {
        continue; // Honest degrade: skip this one malformed/unresolvable rule, keep evaluating the rest.
      }

      const matched = combinator === "OR" ? evaluated.some(Boolean) : evaluated.every(Boolean);
      if (matched) {
        return rule.result;
      }
    }
    return undefined;
  } catch {
    // Never throw on a real, unforeseen malformed-input shape — same discipline this module's own
    // header doc documents for every other malformed-JSON case.
    return undefined;
  }
}
