# Reasoner Contract — Validation Rules (VAL-049 – VAL-060)

Governs: [`reasoner.contract.md`](../contracts/reasoner.contract.md) · Schemas: [`reasoner.schema.yaml`](../schemas/reasoner.schema.yaml), [`reasoner.schema.json`](../schemas/reasoner.schema.json)

| ID      | Rule                                                                                                                             | Severity | Governing Source                       |
| ------- | -------------------------------------------------------------------------------------------------------------------------------- | -------- | -------------------------------------- |
| VAL-049 | `reasoner_id` MUST match `^reasoner\.[a-z][a-z0-9_]*$` and MUST NOT change across versions.                                      | Blocking | Reasoner Contract §1                   |
| VAL-050 | `decision.references_alternative` MUST be non-null and MUST reference an `alternative_id` present in `alternatives`.             | Blocking | Architecture §18, Reasoner Contract §4 |
| VAL-051 | `alternatives` MUST contain at least one entry, each with a non-empty `rejected_reason`.                                         | Blocking | Reasoner Contract §4                   |
| VAL-052 | `confidence` MUST be a float within the closed interval [0.0, 1.0].                                                              | Blocking | Schema constraint                      |
| VAL-053 | If `risk = high`, `recommendation.requires_guardrail_approval` MUST be `true`.                                                   | Blocking | Constitution §11.7                     |
| VAL-054 | `evidence` MUST contain at least one entry with a resolvable `content_ref`.                                                      | Blocking | Reasoner Contract §4                   |
| VAL-055 | Every `hypothesis[].supported_by` entry MUST reference an `evidence_id` present in `evidence`.                                   | Blocking | Reasoner Contract §4                   |
| VAL-056 | `decision.chosen_hypothesis` MUST reference a `hypothesis_id` present in `hypothesis`.                                           | Blocking | Reasoner Contract §4                   |
| VAL-057 | `context.memory_refs`/`knowledge_refs` used to ground the reasoning act MUST be logged and traceable.                            | Blocking | Constitution §13.4                     |
| VAL-058 | `risk` MUST be one of `low`, `medium`, `high`.                                                                                   | Blocking | Schema constraint                      |
| VAL-059 | `trace_id` MUST be a valid UUID propagated from the originating request/workflow.                                                | Blocking | Constitution §14.5                     |
| VAL-060 | `version` MUST follow strict SemVer and MUST be strictly greater than the previous published version for the same `reasoner_id`. | Blocking | Constitution RULE-070                  |
