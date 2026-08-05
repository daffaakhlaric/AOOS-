# Permission Contract

**Contract ID:** `contract.permission`
**Version:** 1.0.0
**Status:** Active
**Governs:** Role-Based/Attribute-Based Access Control across every Agent, Tool, Workflow, and human-facing endpoint, per [`001-ENGINEERING-CONSTITUTION.md`](../docs/001-ENGINEERING-CONSTITUTION.md) §20 (Security Standards, RULE-062), and formalizes the Permission Matrix defined in [`003-DOMAIN-DRIVEN-DESIGN.md`](../docs/003-DOMAIN-DRIVEN-DESIGN.md) §24.
**Schema files:** [`permission.schema.yaml`](../schemas/permission.schema.yaml), [`permission.schema.json`](../schemas/permission.schema.json)
**Examples:** [`permission.valid.json`](../examples/permission.valid.json), [`permission.invalid.json`](../examples/permission.invalid.json)
**Validation Rules:** [`permission.validation.md`](../validation/permission.validation.md) (VAL-157 – VAL-168)

---

## 1. Purpose

This contract is the formal, implementation-independent specification of a single Permission Grant — the atomic unit from which the DDD §24 Permission Matrix is assembled. Every check of "can this Role perform this Action on this Resource, in this Tenant, under this Condition" MUST resolve against a Permission Grant satisfying this contract. No Agent, Tool, or API endpoint may infer authorization from anything other than an explicit, resolvable Permission Grant (Constitution RULE-062, "least privilege is the default").

## 2. Field Specification

| Field             | Type                                                                                                        | Required | Description                                                                                                                        | Governing RULE / Section             |
| ----------------- | ----------------------------------------------------------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| `id`              | UUID                                                                                                        | Yes      | Globally unique, immutable identifier for this Permission Grant                                                                    | RULE-011                             |
| `role`            | enum: `ceo_ai`\|`coo_ai`\|`marketing_ai`\|`sales_ai`\|`dealer_admin`\|`sales_staff`\|`admin_ops`\|`manager` | Yes      | The Role (AI permission class or human role) this grant applies to                                                                 | DDD §24 Permission Matrix            |
| `action`          | enum: `C`\|`R`\|`U`\|`A`\|`X`                                                                               | Yes      | Create / Read / Update / Approve-irreversible-execute / Explicitly-Denied, per DDD §24 legend                                      | DDD §24                              |
| `resource`        | string (`^[a-z][a-z0-9_]*$`)                                                                                | Yes      | The Capability/Aggregate this grant governs (e.g., `quotation`, `campaign`, `guardrail_policy`)                                    | DDD §24 rows                         |
| `tenant`          | string (`tenant_id` or `global`)                                                                            | Yes      | The Tenant this grant is scoped to; `global` denotes a platform-wide (AOS-internal) grant                                          | DDD §25 Tenant Isolation             |
| `condition`       | object (ABAC expression, e.g. `{ "scope": "own_records_only" }`)                                            | No       | Attribute-based narrowing of the grant (e.g., Sales staff limited to their own Leads/Appointments per DDD §24 "(own)" annotations) | DDD §24 Notes                        |
| `policy`          | string (Policy Registry slug)                                                                               | No       | Named Policy this grant is derived from/audited against (e.g., `"hot_lead_handoff_policy"`)                                        | DDD §26 Naming Convention (Policies) |
| `granted_by`      | string                                                                                                      | Yes      | Accountable actor/process that issued this grant (human admin, or `system` for seed grants)                                        | Constitution §20.8                   |
| `effective_from`  | date-time (ISO 8601)                                                                                        | Yes      | Timestamp this grant becomes enforceable                                                                                           | —                                    |
| `effective_until` | date-time (ISO 8601)                                                                                        | No       | Optional expiry for time-boxed/break-glass grants                                                                                  | Constitution RULE-066                |
| `break_glass`     | boolean                                                                                                     | Yes      | Whether this is an audited, time-boxed emergency access grant (AOS Admin-ops only)                                                 | Constitution RULE-066                |
| `state`           | enum: `active`\|`suspended`\|`revoked`                                                                      | Yes      | Registry lifecycle state of this grant                                                                                             | §9.3 (Registry pattern)              |
| `audit_ref`       | string                                                                                                      | No       | Pointer to the audit log entry recording issuance (mandatory when `break_glass = true`)                                            | Constitution §20.8                   |

## 3. Lifecycle

```
draft-request ──approved by accountable admin──▶ active
active ──time-boxed expiry (effective_until elapses)──▶ revoked
active ──manual suspension (incident/investigation)──▶ suspended ──cleared──▶ active
active/suspended ──permanently rescinded──▶ revoked
```

A Permission Grant never mutates `role`/`action`/`resource`/`tenant` in place after `active`; a change is modeled as revoking the old grant and issuing a new one (RULE-011, immutability of Registry entries).

## 4. Invariants

- Absence of an explicit `active` grant for a given (`role`, `action`, `resource`, `tenant`) tuple MUST be interpreted as denied — least-privilege default (Constitution §20.4).
- `action = X` (Explicitly Denied) grants take precedence over any other overlapping grant for the same tuple; an explicit deny can never be overridden by a broader allow (DDD §24 Notes).
- Every `permission_scope` token declared by a Tool Contract instance, and every `permissions` reference declared by an Agent Contract instance, MUST resolve to at least one `active` Permission Grant in this contract's Registry — an unresolvable scope reference is a publish-blocking error.
- `action = A` (Approve/execute-irreversible) grants for `sales_staff` MUST carry a `condition` of `{"scope": "own_records_only"}` unless the resource is explicitly listed without an "(own)" qualifier in DDD §24.
- `break_glass = true` REQUIRES `effective_until` to be present (time-boxed, never open-ended) and `audit_ref` to be non-null (Constitution RULE-066).
- `role` in `{ceo_ai, coo_ai}` MUST NOT hold `action = A` on any Sales-pipeline resource (`quotation`, `spk`, `delivery`, `appointment`, `test_drive`) — these strategic Agents have read visibility only into pipeline execution (DDD §24 Notes).
- `tenant` MUST match an existing Tenant Aggregate ID or be the literal `global`; cross-tenant resolution is structurally forbidden (DDD §25).

## 5. Relationship to Other Contracts

Every Agent Contract's `permissions` field and every Tool Contract's `permission_scope` field resolve against Permission Grants defined here. The Registry Contract publishes Permission Grants through its `PermissionRegistry` sub-registry. The Logging Contract's `context` field records the resolved Permission Grant `id` used to authorize any logged action, and the Analytics Contract tags permission-denial events as a dimension for security anomaly reporting (Architecture §23).
