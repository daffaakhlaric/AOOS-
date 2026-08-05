# Planner Contract

**Contract ID:** `contract.planner`
**Version:** 1.0.0
**Status:** Active
**Governs:** The Planner component of the AI Runtime Architecture defined in [`002-ENTERPRISE-ARCHITECTURE.md`](../docs/002-ENTERPRISE-ARCHITECTURE.md) §18, which decomposes an Agent's `goal`/`objective` (Agent Contract) into an executable, dependency-ordered plan before any Executor step runs.
**Schema files:** [`planner.schema.yaml`](../schemas/planner.schema.yaml), [`planner.schema.json`](../schemas/planner.schema.json)
**Examples:** [`planner.valid.json`](../examples/planner.valid.json), [`planner.invalid.json`](../examples/planner.invalid.json)
**Validation Rules:** [`planner.validation.md`](../validation/planner.validation.md) (VAL-037 – VAL-048)

---

## 1. Purpose

This contract is the formal, implementation-independent specification of a Planner configuration — how an Agent's goal is decomposed into an inspectable, testable sequence of Tasks and SubTasks before any tool call is made (Architecture §18 rationale: "an explicit Planner makes the decomposition inspectable and testable independent of any one LLM call"). A Planner instance never executes anything itself; it only produces an `ExecutionPlan` consumed by the Executor.

## 2. Field Specification

| Field                 | Type                                                                                      | Required    | Description                                                                                     | Governing RULE / Section                          |
| --------------------- | ----------------------------------------------------------------------------------------- | ----------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| `planner_id`          | string (`^planner\.[a-z][a-z0-9_]*$`)                                                     | Yes         | Globally unique, immutable identifier                                                           | Architecture §18                                  |
| `version`             | semver string                                                                             | Yes         | Immutable per published version                                                                 | RULE-070                                          |
| `goal`                | string                                                                                    | Yes         | The single outcome this Planner is decomposing toward, inherited from the owning Agent's `goal` | Agent Contract §2                                 |
| `objective`           | object (`metric`, `target_value`, `deadline`)                                             | Yes         | Measurable target this plan is optimizing for                                                   | Agent Contract `objective` VO                     |
| `task`                | array\<object\> (`task_id`, `description`, `sub_tasks`)                                   | Yes         | Top-level decomposition units of the goal                                                       | Architecture §18                                  |
| `sub_task`            | array\<object\> (`sub_task_id`, `parent_task_id`, `description`, `tool_ref`, `agent_ref`) | Yes         | Leaf-level decomposition units, each mapped to a single Tool or sub-Agent invocation            | Architecture §18                                  |
| `dependency`          | array\<object\> (`from`, `to`, `type`)                                                    | Yes         | Directed edges between `task`/`sub_task` entries forming a Directed Acyclic Graph               | Architecture §18                                  |
| `priority`            | integer 1–10                                                                              | Yes         | Planning priority relative to other concurrent plans for the same Agent                         | §15 Queue Standards                               |
| `constraints`         | array\<object\> (`constraint_id`, `type`, `expression`)                                   | Yes         | Hard limits the plan MUST respect (cost ceiling, time ceiling, tool allowlist, tenant policy)   | RULE-113, RULE-081                                |
| `execution_plan`      | object (`ordered_steps`: array\<string\> task/sub_task IDs, `graph_ref`)                  | Yes         | The materialized, ordered execution sequence derived from `task`/`sub_task`/`dependency`        | Architecture §18                                  |
| `fallback`            | object (`strategy`, `fallback_plan_ref`) or `null`                                        | Conditional | Alternate plan invoked when the primary `execution_plan` cannot proceed                         | Architecture §18, Agent Contract `security_level` |
| `success_criteria`    | array\<object\> (`criterion_id`, `metric`, `threshold`, `comparator`)                     | Yes         | Conditions under which the plan is considered successfully completed                            | Architecture §18, Reflection Contract             |
| `failure_criteria`    | array\<object\> (`criterion_id`, `metric`, `threshold`, `comparator`)                     | Yes         | Conditions under which the plan is considered failed and must escalate or fall back             | Architecture §18, Reflection Contract             |
| `model_ref`           | string                                                                                    | Yes         | Model Contract reference used for plan generation                                               | Architecture §18, §19 Model Router                |
| `max_replan_attempts` | integer ≥ 0                                                                               | Yes         | Ceiling on re-planning loops to prevent infinite re-plan chasing an unreachable goal            | Architecture §18 Failure Scenario                 |
| `status`              | enum: `draft`\|`active`\|`deprecated`\|`retired`                                          | Yes         | Registry lifecycle state                                                                        | Registry Contract                                 |

## 3. Lifecycle

```
draft ──validate DAG (task/sub_task/dependency) + constraints──▶ active
active ──superseded by new version──▶ deprecated ──deprecation window elapses──▶ retired
```

At runtime (not part of this contract's own lifecycle, but the consuming Agent state per DDD §17.5):

```
[Invoked] ──plan──▶ [Planning] ──plan ready (ExecutionPlan materialized)──▶ [Executing]
[Planning] ──replan (failure_criteria met, attempts remain)──▶ [Planning]
[Planning] ──max_replan_attempts exhausted──▶ [Escalated]
```

## 4. Invariants

- `execution_plan.ordered_steps` MUST be a valid topological ordering of `task`/`sub_task` nodes consistent with `dependency` — the underlying graph MUST be a Directed Acyclic Graph (no cycles).
- Every `sub_task` MUST reference exactly one of `tool_ref` or `agent_ref` (never both, never neither) — a SubTask is a single, unambiguous invocation unit.
- `success_criteria` and `failure_criteria` MUST both be non-empty arrays; a Plan with no declared success or failure condition cannot be validated by the Reflection Contract's confidence evaluation.
- `fallback` MUST be non-null when the owning Agent's `security_level = restricted` (cross-reference Agent Contract §2 `security_level`).
- `constraints` MUST include at least one `type = cost_ceiling` entry, consistent with the owning Agent's `cost_limit` (Agent Contract, RULE-113).
- `max_replan_attempts` MUST be finite (≥ 0); a Planner with no replan ceiling risks the infinite re-plan failure mode documented in Architecture §18.
- `dependency` entries MUST only reference `task_id`/`sub_task_id` values that exist in `task`/`sub_task`.

## 5. Relationship to Other Contracts

Every Agent Contract instance references exactly one Planner via its `planner` field. A Planner's `sub_task` entries reference Tool Contract instances (`tool_ref`) or nested Agent Contract instances (`agent_ref`) — never external systems directly (RULE-001 still applies transitively through the Tool). `success_criteria`/`failure_criteria` are consumed by the Reflection Contract to compute `QualityScore` and drive the retry/escalate decision. `constraints` mirror and MUST NOT exceed the owning Agent's `cost_limit`/`token_limit`. `fallback.fallback_plan_ref` may point to another Planner Contract instance or an Agent escalation path. `model_ref` points to a Model Contract instance used for plan generation via the Model Router.
