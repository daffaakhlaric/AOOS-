# Agent Contract

**Contract ID:** `contract.agent`
**Version:** 1.0.0
**Status:** Active
**Governs:** Every Agent plugin defined per [`001-ENGINEERING-CONSTITUTION.md`](../docs/001-ENGINEERING-CONSTITUTION.md) §11 (Agent Standards), instantiated as the `Agent` Entity in [`003-DOMAIN-DRIVEN-DESIGN.md`](../docs/003-DOMAIN-DRIVEN-DESIGN.md) §9, and hosted by the AI Runtime container defined in [`002-ENTERPRISE-ARCHITECTURE.md`](../docs/002-ENTERPRISE-ARCHITECTURE.md) §18.
**Schema files:** [`agent.schema.yaml`](../schemas/agent.schema.yaml), [`agent.schema.json`](../schemas/agent.schema.json)
**Examples:** [`agent.valid.json`](../examples/agent.valid.json), [`agent.invalid.json`](../examples/agent.invalid.json)
**Validation Rules:** [`agent.validation.md`](../validation/agent.validation.md) (VAL-001 – VAL-012)

---

## 1. Purpose

This contract is the formal, implementation-independent specification of what an Agent _is_ — its identity, capabilities, boundaries, and operating limits — before any Agent is coded. Any AI Runtime implementation, code generator, dashboard, or SDK MUST treat an Agent manifest that fails this contract as unloadable (Constitution RULE-112).

## 2. Field Specification

| Field              | Type                                                                                                        | Required | Description                                                                        | Governing RULE / Section          |
| ------------------ | ----------------------------------------------------------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------- | --------------------------------- |
| `id`               | UUID                                                                                                        | Yes      | Globally unique, immutable identifier assigned at first registration               | RULE-011                          |
| `code`             | string (`^[a-z][a-z0-9_]*$`)                                                                                | Yes      | Machine-readable slug, unique per tenant scope, used in logs/events                | Constitution §6.1                 |
| `name`             | string                                                                                                      | Yes      | Internal engineering name, PascalCase, suffixed `Agent` (e.g., `LeadScoringAgent`) | Constitution §6.1                 |
| `display_name`     | string                                                                                                      | Yes      | Human-readable name shown in Dashboard                                             | —                                 |
| `version`          | semver string                                                                                               | Yes      | Immutable per published version                                                    | RULE-070, RULE-011                |
| `description`      | string                                                                                                      | Yes      | What this Agent does and does not do                                               | §22 Documentation Standards       |
| `category`         | enum: `lead_intelligence`\|`nurturing`\|`campaign_ops`\|`content`\|`conversation`\|`analytics`\|`strategic` | Yes      | Product module alignment                                                           | DDD §3 Business Capabilities      |
| `role`             | string                                                                                                      | Yes      | The business role this Agent plays (e.g., "Lead Qualifier")                        | DDD §11 Domain Services alignment |
| `goal`             | string                                                                                                      | Yes      | The single outcome this Agent exists to achieve                                    | §11.1 single responsibility       |
| `objective`        | object (`Objective` VO, see Planner Contract)                                                               | Yes      | Measurable target tied to a KPI from DDD §28                                       | —                                 |
| `responsibilities` | array\<string\>                                                                                             | Yes      | Enumerated scope boundaries (what it does)                                         | RULE-005                          |
| `input_schema`     | JSON Schema ref                                                                                             | Yes      | Schema of the Task/invocation payload accepted                                     | §11.2                             |
| `output_schema`    | JSON Schema ref                                                                                             | Yes      | Schema of the Action/result payload produced                                       | §11.2                             |
| `planner`          | object ref → Planner Contract                                                                               | Yes      | Planning strategy configuration                                                    | Architecture §18                  |
| `reasoner`         | object ref → Reasoner Contract                                                                              | No       | Reasoning strategy configuration, if distinct from Planner                         | Architecture §18                  |
| `reflection`       | object ref → Reflection Contract                                                                            | Yes      | Post-action evaluation configuration                                               | RULE-083                          |
| `memory`           | object ref → Memory Contract                                                                                | Yes      | Which memory tiers this Agent reads/writes                                         | §13                               |
| `knowledge`        | array\<object ref → Knowledge Contract\>                                                                    | No       | Knowledge sources this Agent may retrieve from                                     | §21                               |
| `workflow`         | array\<string\> (Workflow IDs)                                                                              | No       | Workflows this Agent may be invoked from                                           | §10                               |
| `toolset`          | array\<string\> (Tool IDs)                                                                                  | Yes      | Declared permitted Tools — exhaustive allowlist                                    | RULE-001, RULE-009                |
| `permissions`      | object ref → Permission Contract                                                                            | Yes      | RBAC scope this Agent operates under                                               | §25                               |
| `scheduler`        | object ref → Scheduler Contract                                                                             | No       | If this Agent is scheduler-triggered rather than event-triggered                   | §16                               |
| `retry_policy`     | object (`max_attempts`, `backoff_strategy`, `backoff_base_ms`)                                              | Yes      | Retry behavior on transient failure                                                | RULE-049                          |
| `timeout`          | duration (ISO 8601, e.g. `PT30S`)                                                                           | Yes      | Maximum single-invocation wall-clock time                                          | §26.1                             |
| `priority`         | integer 1–10                                                                                                | Yes      | Scheduling/queue priority                                                          | §15 Queue Standards               |
| `cost_limit`       | object (`Money` VO + `period`)                                                                              | Yes      | Hard spend ceiling per invocation and per period                                   | RULE-113                          |
| `token_limit`      | object (`max_input_tokens`, `max_output_tokens`)                                                            | Yes      | Hard LLM token ceiling per invocation                                              | RULE-081                          |
| `execution_mode`   | enum: `sync`\|`async`\|`scheduled`\|`event_driven`                                                          | Yes      | How this Agent is invoked                                                          | §7 Runtime Architecture           |
| `state`            | enum: `draft`\|`active`\|`deprecated`\|`retired`\|`quarantined`                                             | Yes      | Registry lifecycle state                                                           | §9.3                              |
| `health`           | object ref → Health Contract                                                                                | Yes      | Health check configuration                                                         | §18                               |
| `metrics`          | array\<string\> (Metric IDs)                                                                                | Yes      | Metrics this Agent emits, ref Analytics Contract                                   | §25 Monitoring Standards          |
| `logging`          | object ref → Logging Contract                                                                               | Yes      | Logging configuration                                                              | §17                               |
| `events`           | object (`publishes`: array\<string\>, `subscribes`: array\<string\>)                                        | Yes      | Domain Events this Agent emits/consumes                                            | §14, DDD §12                      |
| `dependencies`     | array\<string\> (other Agent/Service IDs)                                                                   | No       | Soft dependencies for orchestration ordering                                       | —                                 |
| `configuration`    | object (free-form, schema-validated per Agent category)                                                     | No       | Category-specific tunables                                                         | —                                 |
| `tenant_scope`     | enum: `global`\|`tenant_override_allowed`\|`tenant_only`                                                    | Yes      | Whether tenants may override this Agent's Registry entry                           | §9.5                              |
| `security_level`   | enum: `standard`\|`elevated`\|`restricted`                                                                  | Yes      | Drives which Guardrail policies apply                                              | §25 Security Standards            |
| `owner`            | string (team/individual identifier)                                                                         | Yes      | Accountable owner                                                                  | §8.1                              |
| `tags`             | array\<string\>                                                                                             | No       | Free-form discovery labels                                                         | —                                 |
| `metadata`         | object (free-form key-value)                                                                                | No       | Non-functional annotations                                                         | —                                 |

## 3. Lifecycle

```
draft ──validate + simulate (Simulation Contract)──▶ active
active ──superseded by new version──▶ deprecated ──deprecation window elapses──▶ retired
active/draft ──fails contract/manifest validation──▶ quarantined
```

An Agent manifest transitions `state` only through the Agent Registry (Registry Contract); no runtime component may mutate `state` directly (RULE-011).

## 4. Invariants

- `toolset` MUST be a subset of Tools whose `status` is `active` in the Tool Registry at publish time.
- `cost_limit` and `token_limit` MUST be non-null before `state` can transition to `active` (RULE-113, mirrors BR-096).
- `security_level = restricted` REQUIRES `reflection.confidence_threshold` to be explicitly set (cannot use system default).
- `execution_mode = scheduled` REQUIRES `scheduler` to be present; `execution_mode = event_driven` REQUIRES `events.subscribes` to be non-empty.

## 5. Relationship to Other Contracts

An Agent Contract instance composes, by reference, the Planner, Reasoner, Reflection, Memory, Toolset (Tool Contracts), Permission, Scheduler, Health, Logging, and Events contracts. It never embeds their full definitions inline — always by stable ID reference, enabling each to version independently (Constitution §21 Versioning Strategy).
