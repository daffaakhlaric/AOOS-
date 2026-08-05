# Agent Contract — Validation Rules (VAL-001 – VAL-012)

Governs: [`agent.contract.md`](../contracts/agent.contract.md) · Schemas: [`agent.schema.yaml`](../schemas/agent.schema.yaml), [`agent.schema.json`](../schemas/agent.schema.json)

| ID      | Rule                                                                                                                                                    | Severity | Governing Source                                |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ----------------------------------------------- |
| VAL-001 | `id` MUST be a valid UUID and MUST NOT change across versions of the same Agent.                                                                        | Blocking | Agent Contract §1                               |
| VAL-002 | `name` MUST match `^[A-Z][A-Za-z0-9]*Agent$`.                                                                                                           | Blocking | Constitution §6.1                               |
| VAL-003 | `version` MUST be strictly greater than the previous published version for the same `code`.                                                             | Blocking | Constitution RULE-070                           |
| VAL-004 | Every entry in `toolset` MUST reference a Tool Contract instance whose `status = active` at the time this Agent is promoted to `active`.                | Blocking | Agent Contract §4                               |
| VAL-005 | `cost_limit` and `token_limit` MUST both be present and non-null before `state` may be set to `active`.                                                 | Blocking | Constitution RULE-113                           |
| VAL-006 | `token_limit.max_input_tokens` and `max_output_tokens` MUST each be ≥ 1.                                                                                | Blocking | Schema constraint                               |
| VAL-007 | `reflection` MUST be present (non-null) when `state = active`.                                                                                          | Blocking | Agent Contract §4                               |
| VAL-008 | If `execution_mode = scheduled`, `scheduler` MUST be present; if `execution_mode = event_driven`, `events.subscribes` MUST be non-empty.                | Blocking | Agent Contract §4                               |
| VAL-009 | `priority` MUST be an integer between 1 and 10 inclusive.                                                                                               | Blocking | Schema constraint                               |
| VAL-010 | If `security_level = restricted`, `reflection` MUST explicitly set a confidence threshold (not inherit system default).                                 | Blocking | Agent Contract §4                               |
| VAL-011 | `responsibilities` MUST contain at least one entry; an Agent with zero declared responsibilities is invalid (Single Responsibility, Constitution §2.1). | Blocking | Constitution §2.1                               |
| VAL-012 | `tenant_scope = tenant_only` MUST NOT be combined with `category = strategic` (strategic/cross-tenant Agents cannot be tenant-exclusive).               | Warning  | Domain judgment call, confirm via ADR if needed |
