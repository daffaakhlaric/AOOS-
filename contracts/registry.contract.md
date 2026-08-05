# Registry Contract

**Contract ID:** `contract.registry`
**Version:** 1.0.0
**Status:** Active
**Governs:** Every versioned, queryable source-of-truth entry defined per [`001-ENGINEERING-CONSTITUTION.md`](../docs/001-ENGINEERING-CONSTITUTION.md) §9 (Registry Standards), and provisioned by the Registry infrastructure defined in [`002-ENTERPRISE-ARCHITECTURE.md`](../docs/002-ENTERPRISE-ARCHITECTURE.md) §14 (Registry Architecture).
**Schema files:** [`registry.schema.yaml`](../schemas/registry.schema.yaml), [`registry.schema.json`](../schemas/registry.schema.json)
**Examples:** [`registry.valid.json`](../examples/registry.valid.json), [`registry.invalid.json`](../examples/registry.invalid.json)
**Validation Rules:** [`registry.validation.md`](../validation/registry.validation.md) (VAL-133 – VAL-144)

---

## 1. Purpose

This contract is the formal, implementation-independent specification of a **Registry Entry** — the common envelope shape wrapping every published instance of an Agent, Tool, Workflow, Prompt, Model, Policy, Permission, Skill, Memory-config, or Knowledge-source. It is a "registry of registries": no prompt, workflow definition, tool schema, agent config, or model routing rule may be hardcoded in application code — it MUST be fetched from its Registry entry at runtime (Constitution §9.2). This contract is the root every other Contract is published through (§22 Dependency Graph, `003.5-CONTRACT-FIRST-DESIGN.md`).

## 2. Field Specification

| Field               | Type                                                                                                                                                                                         | Required    | Description                                                                                                                              | Governing RULE / Section |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| `id`                | UUID                                                                                                                                                                                         | Yes         | Globally unique, immutable identifier of this Registry Entry envelope itself                                                             | RULE-011                 |
| `registry_type`     | enum: `AgentRegistry`\|`ToolRegistry`\|`WorkflowRegistry`\|`PromptRegistry`\|`ModelRegistry`\|`PolicyRegistry`\|`PermissionRegistry`\|`SkillRegistry`\|`MemoryRegistry`\|`KnowledgeRegistry` | Yes         | Which of the 10 sub-registries this entry belongs to                                                                                     | Constitution §9.1        |
| `entry_id`          | string (stable domain ID, e.g. an Agent Contract `id`)                                                                                                                                       | Yes         | Identifier of the underlying contract instance this entry wraps                                                                          | Constitution §9.3        |
| `entry_version`     | semver string                                                                                                                                                                                | Yes         | Version of the wrapped instance; immutable once published                                                                                | RULE-011, RULE-070       |
| `status`            | enum: `draft`\|`active`\|`deprecated`\|`retired`                                                                                                                                             | Yes         | Registry lifecycle state of this entry                                                                                                   | Constitution §9.3        |
| `tenant_scope`      | enum: `global`\|`tenant_override_allowed`\|`tenant_only`                                                                                                                                     | Yes         | Resolution scope for this entry                                                                                                          | Constitution §9.5        |
| `owner`             | string (team/individual identifier)                                                                                                                                                          | Yes         | Accountable owner                                                                                                                        | §8.1                     |
| `created_at`        | date-time (ISO 8601)                                                                                                                                                                         | Yes         | Timestamp this entry version was published                                                                                               | Constitution §9.3        |
| `created_by`        | string                                                                                                                                                                                       | Yes         | Author/system identity that published this entry version                                                                                 | Constitution §9.3        |
| `changelog`         | array\<object\> (`version`, `date`, `author`, `notes`)                                                                                                                                       | Yes         | Full version history of the underlying `entry_id`                                                                                        | Constitution §9.4        |
| `payload_ref`       | string (URI/pointer)                                                                                                                                                                         | Yes         | Pointer to the actual Agent/Tool/Workflow/etc. contract instance this entry wraps (e.g. `contracts/agent/lead_scoring_agent@1.2.0.json`) | Constitution §9.2        |
| `supersedes`        | string (`entry_id@entry_version`)                                                                                                                                                            | No          | The prior entry version this one replaces, if any                                                                                        | Constitution §9.4        |
| `deprecation_note`  | string                                                                                                                                                                                       | Conditional | Required when `status = deprecated`; explains reason and replacement path                                                                | Constitution §9.4        |
| `cache_ttl_seconds` | integer                                                                                                                                                                                      | No          | Edge-cache TTL for reads of this entry                                                                                                   | Constitution §9.7        |
| `tags`              | array\<string\>                                                                                                                                                                              | No          | Free-form discovery labels                                                                                                               | —                        |
| `metadata`          | object (free-form key-value)                                                                                                                                                                 | No          | Non-functional annotations                                                                                                               | —                        |

## 3. Lifecycle

```
draft ──validate payload against its own contract schema──▶ active
active ──new entry_version published──▶ deprecated ──deprecation window elapses──▶ retired
```

Registry entries are immutable once published; any edit creates a brand-new `entry_version` value under the same `entry_id`, never mutating history in place (Constitution §9.4, RULE-011).

## 4. Invariants

- Entries are immutable once `status = active`; the ONLY way to change a published entry is to publish a new `entry_version` (RULE-011).
- Every publish (transition into `status = active`) MUST emit a `registry.<registry_type>.published` event on the Event Bus (RULE-013), where `<registry_type>` is the snake_case form of the `registry_type` enum value (e.g. `registry.agent_registry.published`).
- `tenant_scope` resolution precedence when multiple entries exist for the same `entry_id` is strictly: **tenant override > tenant plan-tier default > global default** (Constitution §9.5).
- `payload_ref` MUST resolve to a document that validates successfully against the JSON Schema of the Contract implied by `registry_type` (e.g. `registry_type = AgentRegistry` → `schemas/agent.schema.json`).
- `deprecation_note` MUST be non-null whenever `status = deprecated`.
- `supersedes`, when present, MUST reference an `entry_id@entry_version` pair that itself has `status = deprecated` or `retired`.

## 5. Relationship to Other Contracts

The Registry Contract is the root envelope every other Contract instance (Agent, Tool, Workflow, Prompt, Model, Policy, Permission, Skill, Memory, Knowledge) is published through via `payload_ref`. It never embeds the wrapped contract's fields inline — always by pointer — so each wrapped Contract can version independently of its Registry envelope (Constitution §21 Versioning Strategy). Publish events feed the Event Contract, and every cache invalidation triggered by a new `entry_version` is itself logged per the Logging Contract.
