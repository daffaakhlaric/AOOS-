# Workflow Contract

**Contract ID:** `contract.workflow`
**Version:** 1.0.0
**Status:** Active
**Governs:** Every Workflow definition per [`001-ENGINEERING-CONSTITUTION.md`](../docs/001-ENGINEERING-CONSTITUTION.md) §10 (Workflow Standards), instantiated as the `Workflow` Entity and its State Machine in [`003-DOMAIN-DRIVEN-DESIGN.md`](../docs/003-DOMAIN-DRIVEN-DESIGN.md) §17.3 and Event Storming §19, and hosted by the Workflow Runtime container defined in [`002-ENTERPRISE-ARCHITECTURE.md`](../docs/002-ENTERPRISE-ARCHITECTURE.md) §15.
**Schema files:** [`workflow.schema.yaml`](../schemas/workflow.schema.yaml), [`workflow.schema.json`](../schemas/workflow.schema.json)
**Examples:** [`workflow.valid.json`](../examples/workflow.valid.json), [`workflow.invalid.json`](../examples/workflow.invalid.json)
**Validation Rules:** [`workflow.validation.md`](../validation/workflow.validation.md) (VAL-025 – VAL-036)

---

## 1. Purpose

This contract is the formal, implementation-independent specification of a Workflow — a declarative definition of steps, transitions, conditions, retries, and compensations stored in the Workflow Registry, never imperative code paths buried in a service (Constitution §10.1). Any Workflow Runtime implementation MUST treat a Workflow definition that fails this contract as unloadable, and MUST NOT execute a Workflow whose `nodes` reference undeclared Tools or Agents.

## 2. Field Specification

| Field                | Type                                                                                                                       | Required    | Description                                                                                                                                                           | Governing RULE / Section |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| `workflow_id`        | string (`^workflow\.[a-z][a-z0-9_]*$`)                                                                                     | Yes         | Globally unique, immutable identifier                                                                                                                                 | §10.1                    |
| `version`            | semver string                                                                                                              | Yes         | Immutable per published version                                                                                                                                       | RULE-070                 |
| `nodes`              | array\<object\> (`node_id`, `type`, `invokes`, `input_schema`, `output_schema`, `timeout`, `retry_policy`, `compensation`) | Yes         | Ordered set of workflow steps; each step declares its Tool/Agent invocation, schemas, timeout, retry, and compensation if it mutates external state                   | §10.2, RULE-028          |
| `edges`              | array\<object\> (`from`, `to`, `condition_ref`)                                                                            | Yes         | Directed transitions between `nodes`, forming the execution graph (DAG for non-cyclic sections, explicit loop nodes for retries)                                      | DDD §17.3                |
| `conditions`         | array\<object\> (`condition_id`, `expression`, `evaluated_on`)                                                             | No          | Named boolean expressions referenced by `edges` for conditional branching                                                                                             | DDD §17.3                |
| `parallel_execution` | object (`enabled`, `max_concurrency`, `join_strategy`)                                                                     | Yes         | Whether sibling nodes may execute concurrently and how results are joined                                                                                             | Architecture §15         |
| `retry_policy`       | object (`max_attempts`, `backoff_strategy`, `backoff_base_ms`)                                                             | Yes         | Workflow-level default retry policy, overridable per node                                                                                                             | §10.2, RULE-049          |
| `rollback`           | object (`supported`, `strategy`)                                                                                           | Yes         | Whether the Workflow as a whole supports rollback and by what strategy (saga vs. checkpoint replay)                                                                   | RULE-028                 |
| `compensation`       | array\<object\> (`node_id`, `compensation_action_ref`)                                                                     | Conditional | Compensating actions for every node that mutates external state                                                                                                       | §10.2, RULE-028          |
| `timeout`            | duration (ISO 8601, e.g. `PT24H`)                                                                                          | Yes         | Maximum total Workflow execution time; exceeding it triggers alert and halt per policy                                                                                | §10.6                    |
| `priority`           | integer 1–10                                                                                                               | Yes         | Scheduling/queue priority for Workflow instances                                                                                                                      | §15 Queue Standards      |
| `events`             | object (`publishes`: array\<string\>, `subscribes`: array\<string\>)                                                       | Yes         | Lifecycle events emitted (`workflow.started`, `workflow.step_completed`, `workflow.failed`, `workflow.completed`) and Domain Events consumed to trigger this Workflow | §10.5, DDD §12           |
| `dependencies`       | array\<string\> (Tool IDs, Agent IDs, other Workflow IDs)                                                                  | No          | Declared external dependencies required for this Workflow to execute                                                                                                  | —                        |
| `state_machine`      | object (`states`, `transitions`, `initial_state`)                                                                          | Yes         | The formal state machine this Workflow instance follows at runtime                                                                                                    | DDD §17.3                |
| `metrics`            | array\<string\> (Metric IDs)                                                                                               | Yes         | Metrics this Workflow emits, ref Analytics Contract                                                                                                                   | Analytics Contract       |
| `cost_budget`        | object (`amount`, `currency`)                                                                                              | Yes         | Maximum cost budget for a single Workflow execution; exceeding it triggers alert/halt per policy                                                                      | §10.6                    |
| `human_checkpoints`  | array\<object\> (`node_id`, `prompt`, `approval_required`)                                                                 | No          | First-class human-in-the-loop checkpoint steps (e.g., "confirm before spending >$X")                                                                                  | §10.7                    |
| `status`             | enum: `draft`\|`active`\|`deprecated`\|`retired`                                                                           | Yes         | Workflow Registry lifecycle state                                                                                                                                     | Registry Contract        |

## 3. Lifecycle

Two distinct lifecycles apply: the **definition lifecycle** (Registry-level, governs whether a Workflow _definition_ can be instantiated) and the **execution state machine** (per-instance runtime state, DDD §17.3).

Definition lifecycle:

```
draft ──validate DAG + node schemas──▶ active
active ──superseded by new version──▶ deprecated ──deprecation window elapses──▶ retired
```

Execution state machine (`state_machine`, mirrors DDD §17.3):

```
[Created] ──start──▶ [Running] ──step ok (loop)──▶ [Running]
[Running] ──pause──▶ [Paused] ──resume──▶ [Running]
[Running] ──step fails, no compensation left──▶ [Failed]
[Running] ──all steps complete──▶ [Completed]
[Failed] ──compensation executed──▶ [Compensated]
```

## 4. Invariants

- `nodes` and `edges` MUST form a valid graph reachable from a single entry node; cyclic sections are permitted only when explicitly modeled as retry/loop constructs, never as unbounded implicit cycles.
- Every node whose invoked Tool/Agent has `side_effect_class = irreversible-write` or `reversible-write` (per the referenced Tool Contract) MUST have a corresponding entry in `compensation` (Constitution RULE-028).
- `state_machine.states` MUST be exactly `{Created, Running, Paused, Failed, Completed, Compensated}` and `state_machine.transitions` MUST mirror DDD §17.3 — no Workflow Runtime may introduce undocumented states.
- Every side-effecting node MUST declare or inherit an idempotency key so retries after crash/resume never double-execute (§10.4, RULE-029, RULE-030).
- `timeout` and `cost_budget` MUST both be present and non-null before `status` can transition to `active` (§10.6).
- `human_checkpoints` entries MUST correspond to an existing `node_id` in `nodes`.
- `parallel_execution.enabled = true` REQUIRES `parallel_execution.join_strategy` to be set (cannot default silently).

## 5. Relationship to Other Contracts

A Workflow Contract instance's `nodes` reference Tool Contract instances (by `tool_id`) and Agent Contract instances (by Agent `id`/`code`) for execution; it inherits each Tool's `side_effect_class` to determine `compensation` requirements (RULE-028). `events.publishes`/`subscribes` reference the Event Contract's schema for `workflow.*` lifecycle events. `state_machine` is the formal counterpart of DDD §17.3. The Scheduler Contract may trigger a Workflow on a cron/interval basis; the Queue Contract governs how Workflow instances are dequeued for execution. The Agent Contract's `workflow` array lists which Workflows an Agent may be invoked from, forming the inverse reference.
