# Knowledge Contract

**Contract ID:** `contract.knowledge`
**Version:** 1.0.0
**Status:** Active
**Governs:** Static/slow-changing domain knowledge (vehicle catalogs, financing rules, dealer policies, compliance content) per the Knowledge Architecture in [`002-ENTERPRISE-ARCHITECTURE.md`](../docs/002-ENTERPRISE-ARCHITECTURE.md) §21, instantiated as the `Knowledge` Entity in [`003-DOMAIN-DRIVEN-DESIGN.md`](../docs/003-DOMAIN-DRIVEN-DESIGN.md) §9.
**Schema files:** [`knowledge.schema.yaml`](../schemas/knowledge.schema.yaml), [`knowledge.schema.json`](../schemas/knowledge.schema.json)
**Examples:** [`knowledge.valid.json`](../examples/knowledge.valid.json), [`knowledge.invalid.json`](../examples/knowledge.invalid.json)
**Validation Rules:** [`knowledge.validation.md`](../validation/knowledge.validation.md) (VAL-085 – VAL-096)

---

## 1. Purpose

This contract is the formal, implementation-independent specification of a single unit of Knowledge — a chunked/embedded, retrievable, sourced, and versioned artifact distinct from per-lead Memory (Architecture §21). It formalizes what makes a Knowledge Base entry trustworthy enough to inject into an Agent's prompt: a resolvable source, a freshness guarantee, a confidence signal, and an auditable, append-only version history.

## 2. Field Specification

| Field               | Type                                                                       | Required    | Description                                                             | Governing RULE / Section                           |
| ------------------- | -------------------------------------------------------------------------- | ----------- | ----------------------------------------------------------------------- | -------------------------------------------------- |
| `id`                | UUID                                                                       | Yes         | Globally unique, immutable identifier                                   | RULE-011                                           |
| `code`              | string (`^[a-z][a-z0-9_]*$`)                                               | Yes         | Machine-readable slug, referenced by `Agent.knowledge[]`                | Constitution §6.1                                  |
| `title`             | string                                                                     | Yes         | Human-readable title                                                    | —                                                  |
| `knowledge_source`  | object (`type`, `origin`, `ingestion_pipeline_ref`)                        | Yes         | Where this Knowledge came from and how it was ingested                  | Architecture §21 Components                        |
| `document`          | object (`content_ref`, `format`, `language`, `checksum`)                   | Yes         | The underlying content artifact                                         | Architecture §21 Sequence                          |
| `embedding`         | object (`model`, `model_version`, `dimensions`, `vector_ref`, `index_ref`) | Conditional | Vector embedding metadata; required once `lifecycle` reaches `indexed`  | Architecture §21, Model Contract                   |
| `confidence`        | number (0.0–1.0)                                                           | Yes         | Current retrieval-relevance/confidence score for this entry             | DDD §10 Confidence Score VO (applied to retrieval) |
| `ownership`         | object (`tenant_id`, `scope`)                                              | Yes         | Whether this entry is tenant-specific or platform-global                | Architecture §21 Dependencies                      |
| `version`           | semver string                                                              | Yes         | Immutable once `lifecycle = active`; append-only versioning             | Registry Contract §1, §4 below                     |
| `lifecycle`         | enum: `ingested`\|`indexed`\|`active`\|`stale`\|`archived`                 | Yes         | Retrieval-readiness state of this entry                                 | Architecture §21 Sequence                          |
| `max_staleness_sla` | duration (ISO 8601, e.g. `P7D`)                                            | Yes         | Maximum age before this entry is auto-flagged stale                     | Architecture §21 Recovery Strategy                 |
| `last_synced_at`    | date-time                                                                  | Yes         | When this entry's content was last confirmed current against its source | Architecture §21 Recovery Strategy                 |
| `source_citation`   | string                                                                     | Yes         | Citation string injected alongside retrieved snippets for traceability  | Architecture §21 Best Practice                     |
| `customer_facing`   | boolean                                                                    | Yes         | Whether this entry may back customer-facing pricing/inventory claims    | DDD BR-094                                         |
| `owner`             | string (team/individual identifier)                                        | Yes         | Accountable owner                                                       | §8.1                                               |
| `tags`              | array\<string\>                                                            | No          | Free-form discovery labels                                              | —                                                  |
| `metadata`          | object (free-form key-value)                                               | No          | Non-functional annotations                                              | —                                                  |

## 3. Lifecycle

```
ingested ──chunked + embedded──▶ indexed ──passes freshness + relevance check──▶ active
active ──max_staleness_sla exceeded (last_synced_at)──▶ stale ──resynced──▶ active
active | stale ──superseded or withdrawn──▶ archived
```

`stale → active` (resync) is the only permitted backward transition. `archived` is terminal; a content change after archival MUST publish a new Knowledge Contract instance (§4).

## 4. Invariants

- `lifecycle` MUST only progress `ingested → indexed → active → stale → archived`, with `stale → active` as the sole permitted backward transition (Architecture §21 Sequence).
- `embedding` MUST be present before `lifecycle` transitions to `indexed` or `active`.
- `confidence` MUST be within `[0.0, 1.0]` and reflects retrieval relevance, not ingestion certainty.
- `version` is immutable once `lifecycle = active`; any content change MUST publish a new Knowledge Contract instance with an incremented `version` — content is never mutated in place (append-only, mirrors Registry Contract entries).
- `customer_facing = true` entries MUST NOT be surfaced by the Knowledge Retrieval Service for pricing/inventory claims once `last_synced_at` exceeds `max_staleness_sla`, regardless of `lifecycle` still reading `active` in a lagging cache (DDD BR-094).

## 5. Relationship to Other Contracts

An Agent Contract instance references zero or more Knowledge Contract instances via its `knowledge[]` array (Agent Contract §2), always by stable `id`, never embedded inline. The Knowledge Registry sub-registry (Registry Contract §13) is the sole publisher of `lifecycle`/`version` transitions. `embedding.model_version` cross-references the Model Contract. A Reflection Contract's `knowledge_update` field (Reflection Contract §2) proposes new content for the Knowledge Ingestion Pipeline to publish as a new version here — it never mutates an existing entry directly. Retrieved entries are cached transiently in an Agent's `knowledge_memory` tier (Memory Contract §2).
