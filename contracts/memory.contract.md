# Memory Contract

**Contract ID:** `contract.memory`
**Version:** 1.0.0
**Status:** Active
**Governs:** Agent context persistence per [`001-ENGINEERING-CONSTITUTION.md`](../docs/001-ENGINEERING-CONSTITUTION.md) §13 (Memory Standards), instantiated as the `Memory` Entity in [`003-DOMAIN-DRIVEN-DESIGN.md`](../docs/003-DOMAIN-DRIVEN-DESIGN.md) §9, and hosted by the Memory Architecture (Memory Access Gateway, Working/Episodic/Semantic stores) defined in [`002-ENTERPRISE-ARCHITECTURE.md`](../docs/002-ENTERPRISE-ARCHITECTURE.md) §20.
**Schema files:** [`memory.schema.yaml`](../schemas/memory.schema.yaml), [`memory.schema.json`](../schemas/memory.schema.json)
**Examples:** [`memory.valid.json`](../examples/memory.valid.json), [`memory.invalid.json`](../examples/memory.invalid.json)
**Validation Rules:** [`memory.validation.md`](../validation/memory.validation.md) (VAL-073 – VAL-084)

---

## 1. Purpose

This contract is the formal, implementation-independent specification of an Agent's memory configuration — which tiers it reads/writes, how long each tier persists, who owns each tier's data, and how PII is handled within it. It is the schema referenced by `Agent.memory` (Agent Contract §2) and formalizes Constitution §13's split of memory into Working, Episodic (here: Session/Long-Term), and Semantic tiers, mediated exclusively through the Memory Access Gateway (Architecture §20) — no Agent or Tool may open a direct store connection.

## 2. Field Specification

| Field              | Type                                                     | Required | Description                                                                    | Governing RULE / Section             |
| ------------------ | -------------------------------------------------------- | -------- | ------------------------------------------------------------------------------ | ------------------------------------ |
| `id`               | UUID                                                     | Yes      | Globally unique, immutable identifier                                          | RULE-011                             |
| `code`             | string (`^[a-z][a-z0-9_]*$`)                             | Yes      | Machine-readable slug, referenced by `Agent.memory`                            | Constitution §6.1                    |
| `version`          | semver string                                            | Yes      | Immutable per published version                                                | RULE-070                             |
| `description`      | string                                                   | Yes      | What context this memory configuration serves and for which Agent(s)           | §22 Documentation Standards          |
| `working_memory`   | object (Ephemeral Memory Tier)                           | Yes      | Current task/session scratch context; ephemeral                                | Constitution §13.1, §13.3            |
| `session_memory`   | object (Ephemeral Memory Tier)                           | Yes      | Current conversation/session context spanning multiple task invocations        | Constitution §13.1, §13.3            |
| `long_term_memory` | object (Durable Memory Tier)                             | Yes      | Episodic conversation/interaction history per lead/customer                    | Constitution §13.1, §13.3            |
| `knowledge_memory` | object (Durable Memory Tier)                             | No       | Cached Knowledge Contract retrieval context local to this Agent's recent tasks | Architecture §20, §21                |
| `semantic_memory`  | object (Durable Memory Tier)                             | Yes      | Long-term facts/preferences per lead/tenant                                    | Constitution §13.1, ADR-009          |
| `vector_memory`    | object (Vector Memory Tier, extends Durable Memory Tier) | Yes      | Vector-indexed similarity store backing `semantic_memory`                      | Architecture §20 "Why Vector Memory" |
| `cache`            | object (`enabled`, `ttl`, `store_ref`)                   | No       | Non-authoritative read-through cache in front of the durable tiers             | Architecture §20                     |
| `retention_policy` | object (`duration`, `action`)                            | Yes      | Default retention policy applied to any tier that omits its own override       | Constitution §13.3                   |
| `ttl`              | duration (ISO 8601, e.g. `PT30M`)                        | Yes      | Default TTL applied to ephemeral tiers that omit their own override            | Constitution §13.3                   |
| `ownership`        | object (`tenant_id`, `entity_id`, `entity_type`)         | Yes      | Default Ownership applied to any tier that omits its own override              | Constitution §13.2                   |
| `access_gateway`   | string (Memory Access Gateway ref)                       | Yes      | The sole mediation point for all reads/writes to this configuration's tiers    | Architecture §20                     |
| `pii_policy`       | object (`contains_pii`, `erasure_cascade_required`)      | Yes      | Global PII declaration and right-to-erasure cascade flag                       | Constitution §13.5, DDD BR-109       |
| `status`           | enum: `draft`\|`active`\|`deprecated`\|`retired`         | Yes      | Registry lifecycle state                                                       | §9.3 (mirrors Agent Contract)        |
| `owner`            | string (team/individual identifier)                      | Yes      | Accountable owner                                                              | §8.1                                 |
| `tags`             | array\<string\>                                          | No       | Free-form discovery labels                                                     | —                                    |
| `metadata`         | object (free-form key-value)                             | No       | Non-functional annotations                                                     | —                                    |

### 2.1 Memory Tier Shapes (referenced above)

**Ephemeral Memory Tier** (`working_memory`, `session_memory`): `enabled` (bool), `store_ref` (string), `ttl` (duration, **required**), `ownership` (Ownership VO, **required**), `pii` (`contains_pii`, `erasure_cascade_required`, **required**).

**Durable Memory Tier** (`long_term_memory`, `knowledge_memory`, `semantic_memory`): `enabled` (bool), `store_ref` (string), `retention_policy` (`duration`, `action`, **required**), `ownership` (Ownership VO, **required**), `pii` (**required**).

**Vector Memory Tier** (`vector_memory`, extends Durable Memory Tier): adds `embedding_model` (string), `embedding_model_version` (string, **required**), `dimensions` (positive integer), `index_ref` (string).

**Ownership VO**: `tenant_id` (UUID), `entity_id` (string), `entity_type` (enum: `lead`\|`conversation`\|`customer`\|`tenant`\|`agent`\|`dealer`).

## 3. Lifecycle

```
draft ──validate + simulate (Simulation Contract)──▶ active
active ──superseded by new version──▶ deprecated ──deprecation window elapses──▶ retired
```

A Memory Contract instance transitions `status` only through the Memory Registry sub-registry (Registry Contract §13); no Agent runtime may mutate `status` directly.

## 4. Invariants

- Every tier object (`working_memory`, `session_memory`, `long_term_memory`, `knowledge_memory`, `semantic_memory`, `vector_memory`) MUST declare its own `ownership.tenant_id` and `ownership.entity_id`, either explicitly or by inheriting the top-level `ownership` default; a null `tenant_id` at resolution time is rejected (Constitution §13.2 tenant partitioning, enforced at the query layer).
- `working_memory.ttl` and `session_memory.ttl` MUST be present (ephemeral tiers never persist indefinitely by default, Constitution §13.3).
- `long_term_memory.retention_policy` and `semantic_memory.retention_policy` MUST be present (durable tiers require an explicit retention/expiry action, Constitution §13.3).
- Any tier with `pii.contains_pii = true` MUST set `pii.erasure_cascade_required = true` and that tier MUST be included in a Customer's right-to-erasure cascade (DDD BR-109).
- `vector_memory.embedding_model_version` MUST be present and MUST resolve to a published Model Contract entry, so similarity retrieval remains valid after a model upgrade (Architecture §20 "Why Vector Memory").
- No Agent or Tool may bypass `access_gateway` for a direct store connection (Architecture §20 mediation pattern, mirrors Tool Manager's RULE-001 mediation).

## 5. Relationship to Other Contracts

An Agent Contract instance references exactly one Memory Contract configuration via its `memory` field (Agent Contract §2). `knowledge_memory` caches retrieval results whose source of truth is the Knowledge Contract. `vector_memory.embedding_model_version` cross-references the Model Contract. Retention/erasure actions publish through the Event Contract (`memory.erasure_cascade_completed`-class events). The Memory Registry sub-registry of the Registry Contract is the sole publisher of `status` transitions.
