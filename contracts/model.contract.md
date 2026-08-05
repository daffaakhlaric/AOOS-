# Model Contract

**Contract ID:** `contract.model`
**Version:** 1.0.0
**Status:** Active
**Governs:** Every LLM/AI model registered per [`001-ENGINEERING-CONSTITUTION.md`](../docs/001-ENGINEERING-CONSTITUTION.md) §23 (AI Model Standards), and routed by the Model Router defined in [`002-ENTERPRISE-ARCHITECTURE.md`](../docs/002-ENTERPRISE-ARCHITECTURE.md) §19 (Model Router Architecture).
**Schema files:** [`model.schema.yaml`](../schemas/model.schema.yaml), [`model.schema.json`](../schemas/model.schema.json)
**Examples:** [`model.valid.json`](../examples/model.valid.json), [`model.invalid.json`](../examples/model.invalid.json)
**Validation Rules:** [`model.validation.md`](../validation/model.validation.md) (VAL-145 – VAL-156)

---

## 1. Purpose

This contract is the formal, implementation-independent specification of a Model — a specific LLM/AI provider endpoint that Agents (via their `planner`/`reasoner` contracts) may be routed to. No Agent may call a model directly by hardcoded provider SDK; every model MUST be declared against this contract and resolved through the Model Registry and Model Router (Constitution §23, Architecture §19).

## 2. Field Specification

| Field             | Type                                                                                                                             | Required | Description                                                             | Governing RULE / Section            |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------- | -------- | ----------------------------------------------------------------------- | ----------------------------------- |
| `id`              | UUID                                                                                                                             | Yes      | Globally unique, immutable identifier assigned at first registration    | RULE-011                            |
| `model_id`        | string (`^model\.[a-z0-9_]+\.[a-z0-9_-]+$`)                                                                                      | Yes      | Machine-readable slug, e.g. `model.anthropic.claude-sonnet-5`           | Constitution §6.1                   |
| `version`         | semver string                                                                                                                    | Yes      | Immutable per published version of this Model Contract entry            | RULE-070, RULE-011                  |
| `description`     | string                                                                                                                           | Yes      | What this model is best suited for and known constraints                | §22 Documentation Standards         |
| `state`           | enum: `draft`\|`active`\|`deprecated`\|`retired`                                                                                 | Yes      | Registry lifecycle state                                                | §9.3                                |
| `provider`        | enum: `anthropic`\|`openai`\|`google`\|`meta`\|`mistral`\|`azure_openai`\|`self_hosted`                                          | Yes      | Upstream provider                                                       | Architecture §19                    |
| `model_name`      | string                                                                                                                           | Yes      | Provider's own model identifier (e.g. `claude-sonnet-5-20260115`)       | Architecture §19                    |
| `capabilities`    | array\<enum: `text_generation`\|`function_calling`\|`vision`\|`embedding`\|`code_generation`\|`reasoning`\|`structured_output`\> | Yes      | Declared capability set; at least one required                          | Constitution §23                    |
| `reasoning_level` | enum: `none`\|`low`\|`medium`\|`high`                                                                                            | Yes      | Extended-thinking/reasoning-effort tier supported                       | Constitution §23                    |
| `context_window`  | object (`max_input_tokens`, `max_output_tokens`)                                                                                 | Yes      | Hard token ceilings for this model                                      | Constitution §23                    |
| `cost`            | object (`unit`: enum `per_token`\|`per_call`, `input_cost`, `output_cost`, `currency`)                                           | Yes      | Pricing, tied to Agent Contract's `cost_limit` enforcement              | RULE-081                            |
| `latency`         | object (`p50_ms`, `p95_ms`)                                                                                                      | Yes      | Observed/expected latency profile used by the Router for tier selection | Architecture §19                    |
| `availability`    | object (`sla_percent`, `regions`)                                                                                                | Yes      | Provider SLA and served regions                                         | Architecture §19                    |
| `fallback`        | array\<string\> (Model Contract `model_id` refs, ordered)                                                                        | Yes      | Ordered fallback chain invoked on primary failure/timeout/rate-limit    | RULE-080                            |
| `priority`        | integer 1–10                                                                                                                     | Yes      | Router preference ranking among models of the same tier                 | Architecture §19                    |
| `routing_policy`  | object (`tier`: enum `economy`\|`standard`\|`premium`, `task_type_mapping_ref`: string)                                          | Yes      | Reference to the Model Registry's task-type → model-tier mapping rules  | Architecture §19, Registry Contract |
| `tenant_scope`    | enum: `global`\|`tenant_override_allowed`\|`tenant_only`                                                                         | Yes      | Whether tenants may override this model's Registry entry                | §9.5                                |
| `owner`           | string (team/individual identifier)                                                                                              | Yes      | Accountable owner                                                       | §8.1                                |
| `tags`            | array\<string\>                                                                                                                  | No       | Free-form discovery labels                                              | —                                   |
| `metadata`        | object (free-form key-value)                                                                                                     | No       | Non-functional annotations                                              | —                                   |

## 3. Lifecycle

```
draft ──validate + benchmark──▶ active
active ──superseded by new provider version──▶ deprecated ──deprecation window elapses──▶ retired
```

A Model's `state` transitions only through the Model Registry entry (Registry Contract); no runtime component may mutate `state` directly (RULE-011).

## 4. Invariants

- `fallback` MUST reference `model_id` values of other Model Contract instances, forming a chain; every Agent/task MUST be able to survive provider outages via this chain (RULE-080).
- The `fallback` chain, followed transitively across all referenced Model Contract instances, MUST NOT contain a cycle (a model MUST NOT be reachable from its own fallback chain).
- `cost` MUST be fully specified (`unit`, `input_cost`/`output_cost` or per-call cost, `currency`) — Agent Contract `cost_limit` enforcement depends on this being non-null (RULE-081).
- `capabilities` MUST contain at least one entry; a model with zero declared capabilities cannot be routed to.
- `routing_policy.task_type_mapping_ref` MUST resolve to an active Model Registry mapping entry before `state` can transition to `active`.
- All model calls made against this contract instance MUST be cost-tracked per tenant, per agent, per workflow at call time (RULE-081).

## 5. Relationship to Other Contracts

A Model Contract instance is referenced BY the Agent Contract (indirectly, via `planner`/`reasoner` contract configuration) and directly by the Planner, Reasoner, and Reflection contracts (`contracts/planner.contract.md`, `contracts/reasoner.contract.md`, `contracts/reflection.contract.md`) when selecting which model backs a given reasoning step. `fallback` references other Model Contract instances by `model_id`. Every Model is published through the Registry Contract (`registry_type = ModelRegistry`) and its cost/latency telemetry feeds the Analytics and Logging Contracts (Constitution §21 Versioning Strategy).
