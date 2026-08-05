# Planner Contract — Validation Rules (VAL-037 – VAL-048)

Governs: [`planner.contract.md`](../contracts/planner.contract.md) · Schemas: [`planner.schema.yaml`](../schemas/planner.schema.yaml), [`planner.schema.json`](../schemas/planner.schema.json)

| ID      | Rule                                                                                                                            | Severity | Governing Source                    |
| ------- | ------------------------------------------------------------------------------------------------------------------------------- | -------- | ----------------------------------- |
| VAL-037 | `planner_id` MUST match `^planner\.[a-z][a-z0-9_]*$` and MUST NOT change across versions.                                       | Blocking | Planner Contract §1                 |
| VAL-038 | The graph formed by `task`/`sub_task`/`dependency` MUST be a Directed Acyclic Graph — no cycles permitted.                      | Blocking | Planner Contract §4                 |
| VAL-039 | Every `sub_task` MUST reference exactly one of `tool_ref` or `agent_ref` (never both, never neither).                           | Blocking | Planner Contract §4                 |
| VAL-040 | `execution_plan.ordered_steps` MUST be a valid topological ordering consistent with `dependency`.                               | Blocking | Planner Contract §4                 |
| VAL-041 | `success_criteria` MUST contain at least one entry.                                                                             | Blocking | Planner Contract §4                 |
| VAL-042 | `fallback` MUST be non-null when the owning Agent's `security_level = restricted`.                                              | Blocking | Planner Contract §4, Agent Contract |
| VAL-043 | `failure_criteria` MUST contain at least one entry.                                                                             | Blocking | Planner Contract §4                 |
| VAL-044 | `constraints` MUST include at least one entry with `type = cost_ceiling`.                                                       | Blocking | Planner Contract §4, RULE-113       |
| VAL-045 | `priority` MUST be an integer between 1 and 10 inclusive.                                                                       | Blocking | Schema constraint                   |
| VAL-046 | `dependency` entries MUST only reference `task_id`/`sub_task_id` values that exist in `task`/`sub_task`.                        | Blocking | Planner Contract §4                 |
| VAL-047 | `max_replan_attempts` MUST be present and finite (0–10).                                                                        | Blocking | Architecture §18 Failure Scenario   |
| VAL-048 | `version` MUST follow strict SemVer and MUST be strictly greater than the previous published version for the same `planner_id`. | Blocking | Constitution RULE-070               |
