# Tool Contract

**Contract ID:** `contract.tool`
**Version:** 1.0.0
**Status:** Active
**Governs:** Every Tool plugin defined per [`001-ENGINEERING-CONSTITUTION.md`](../docs/001-ENGINEERING-CONSTITUTION.md) §12 (Tool Standards), instantiated as the `Tool` Entity in [`003-DOMAIN-DRIVEN-DESIGN.md`](../docs/003-DOMAIN-DRIVEN-DESIGN.md) §9, and hosted by the Tool Manager container defined in [`002-ENTERPRISE-ARCHITECTURE.md`](../docs/002-ENTERPRISE-ARCHITECTURE.md) §17.
**Schema files:** [`tool.schema.yaml`](../schemas/tool.schema.yaml), [`tool.schema.json`](../schemas/tool.schema.json)
**Examples:** [`tool.valid.json`](../examples/tool.valid.json), [`tool.invalid.json`](../examples/tool.invalid.json)
**Validation Rules:** [`tool.validation.md`](../validation/tool.validation.md) (VAL-013 – VAL-024)

---

## 1. Purpose

This contract is the formal, implementation-independent specification of what a Tool _is_ — the only sanctioned path from any Agent to any external system (Constitution RULE-001, §12.1). No Agent may reach a CRM, WhatsApp/Meta API, ad platform, database, browser, email, SMS gateway, or payment processor except through a Tool that satisfies this contract. Any Tool Manager implementation, code generator, or Agent Registry that loads a Tool manifest failing this contract MUST refuse to register it (Constitution RULE-011, applied to the Tool Registry).

## 2. Field Specification

| Field               | Type                                                                                                           | Required    | Description                                                                                                            | Governing RULE / Section                 |
| ------------------- | -------------------------------------------------------------------------------------------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| `tool_id`           | string (`^tool\.[a-z][a-z0-9_]*$`)                                                                             | Yes         | Globally unique, immutable identifier                                                                                  | §12.1, RULE-001                          |
| `provider`          | object (`name`, `system`, `adapter_type`)                                                                      | Yes         | The external system this Tool wraps (e.g., CRM, WhatsApp Business API) and the adapter category                        | Architecture §17 Tool Manager            |
| `category`          | enum: `crm`\|`messaging`\|`ads_platform`\|`database`\|`browser`\|`email`\|`sms`\|`payment`\|`internal_service` | Yes         | Classifies which external system family this Tool reaches                                                              | §12.1                                    |
| `side_effect_class` | enum: `read-only`\|`reversible-write`\|`irreversible-write`                                                    | Yes         | Mandatory side-effect classification                                                                                   | RULE-007, §12.3                          |
| `authentication`    | object (`method`, `secret_ref`, `scope`)                                                                       | Yes         | How the Tool authenticates to the external system; secrets resolved via Secrets Manager at call time, never embedded   | §12.6, RULE-060                          |
| `authorization`     | object (`requires_policy_approval`, `approval_policy_ref`)                                                     | Yes         | Whether invocation requires an explicit Guardrail/Policy check before execution                                        | §11.7, RULE-007                          |
| `permission_scope`  | array\<string\>                                                                                                | Yes         | RBAC scope tokens consumed by the Permission Contract to gate which Agents/Roles may invoke this Tool                  | Permission Contract, DDD §24             |
| `input_schema`      | JSON Schema ref                                                                                                | Yes         | Schema of the invocation payload, validated by the Tool Manager before execution                                       | §12.2                                    |
| `output_schema`     | JSON Schema ref                                                                                                | Yes         | Schema of the result payload, validated by the Tool Manager after execution                                            | §12.2                                    |
| `timeout`           | duration (ISO 8601, e.g. `PT10S`)                                                                              | Yes         | Maximum single-invocation wall-clock time before the Tool's own timeout fires                                          | §12.5                                    |
| `retry`             | object (`max_attempts`, `backoff_strategy`, `backoff_base_ms`, `idempotency_key_param`)                        | Yes         | Retry behavior; MUST reference the idempotency key input parameter so retries never double-send/double-charge          | §12.4, RULE-004                          |
| `rollback`          | object (`supported`, `rollback_tool_ref`) or `null`                                                            | Conditional | A compensating Tool invocation that reverses this Tool's effect                                                        | §12.3, RULE-028                          |
| `compensation`      | object (`strategy`, `compensation_action_ref`) or `null`                                                       | Conditional | Saga-pattern compensation action invoked by a Workflow when this Tool's effect must be undone after downstream failure | Workflow Contract, RULE-028              |
| `circuit_breaker`   | object (`failure_threshold`, `reset_timeout`, `half_open_max_calls`)                                           | Yes         | Tool-local circuit breaker so a failing external dependency degrades only this Tool                                    | §12.5                                    |
| `rate_limit`        | object (`requests`, `period`)                                                                                  | Yes         | Per-tenant call-rate ceiling enforced by the Tool Manager                                                              | Architecture §17                         |
| `quota`             | object (`amount`, `period`, `scope`)                                                                           | Yes         | Consumption ceiling (calls or spend) per tenant per period                                                             | Architecture §17, RULE-113 (cost family) |
| `health_check`      | object ref → Health Contract                                                                                   | Yes         | Liveness/readiness probe configuration for the underlying adapter                                                      | Health Contract, Architecture §24        |
| `telemetry`         | object (`trace_enabled`, `log_level`, `pii_redaction`)                                                         | Yes         | Tracing/logging configuration; every call logged with input (PII-redacted), output, latency, cost, success/failure     | §12.7, §17                               |
| `metrics`           | array\<string\> (Metric IDs)                                                                                   | Yes         | Metrics this Tool emits, ref Analytics Contract                                                                        | Analytics Contract                       |
| `cost`              | object (`unit_cost`, `currency`, `billing_model`)                                                              | Yes         | Per-call or per-unit cost, feeding tenant cost accounting                                                              | §12.7                                    |
| `version`           | semver string                                                                                                  | Yes         | Immutable per published version                                                                                        | RULE-070                                 |
| `status`            | enum: `draft`\|`active`\|`deprecated`\|`retired`                                                               | Yes         | Tool Registry lifecycle state                                                                                          | §12, Registry Contract                   |

## 3. Lifecycle

```
draft ──validate schema + secrets resolvable──▶ active
active ──superseded by new version──▶ deprecated ──deprecation window elapses──▶ retired
```

A Tool manifest transitions `status` only through the Tool Registry; no Agent Runtime component may mutate `status` directly (RULE-011, applied to the Tool Registry). An Agent's `toolset` (Agent Contract) MUST be a subset of Tools whose `status = active`.

## 4. Invariants

- `side_effect_class = irreversible-write` REQUIRES `authorization.requires_policy_approval = true` (Constitution §12.3, RULE-007).
- `side_effect_class = reversible-write` REQUIRES `rollback` to be non-null and `rollback.supported = true`, OR `compensation` to be non-null (RULE-028 saga pattern).
- `side_effect_class = irreversible-write` REQUIRES `compensation` to be non-null describing the best-effort remediation (e.g., a corrective follow-up action), even though the primary effect cannot be truly rolled back (RULE-028).
- `side_effect_class = read-only` MUST NOT require `rollback` or `compensation` (both MUST be `null`).
- `retry.idempotency_key_param` MUST name a parameter present in `input_schema` (Constitution §12.4, RULE-004).
- `permission_scope` MUST be non-empty; a Tool with no declared scope cannot be granted to any Agent (Permission Contract dependency).
- `status = active` REQUIRES `authentication.secret_ref` to resolve against the Secrets Manager at publish-validation time (§12.6, RULE-060) — never embedded credentials.
- `circuit_breaker.failure_threshold` MUST be a positive integer; a Tool without a functioning circuit breaker MUST NOT reach `status = active` (§12.5).

## 5. Relationship to Other Contracts

An Agent Contract references Tools by `tool_id` in its `toolset` array (read-only, exhaustive allowlist per RULE-009). A Workflow Contract's `nodes` invoke Tools by `tool_id` and inherit the Tool's `side_effect_class` to determine whether the owning Workflow node requires `compensation` (RULE-028). The Permission Contract consumes `permission_scope` to resolve which Roles/Agents may invoke a given Tool. The Health Contract is referenced by `health_check`. The Analytics Contract is referenced by `metrics`. The Model Contract is not referenced — Tools are non-LLM external-system adapters, distinct from Model routing.
