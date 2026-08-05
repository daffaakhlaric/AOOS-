# Reflection Contract — Validation Rules (VAL-061 – VAL-072)

Governs: [`reflection.contract.md`](../contracts/reflection.contract.md) · Schemas: [`reflection.schema.yaml`](../schemas/reflection.schema.yaml), [`reflection.schema.json`](../schemas/reflection.schema.json)

| ID      | Rule                                                                                                                                                            | Severity | Governing Source            |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | --------------------------- |
| VAL-061 | `quality_score` MUST be a number between 0.0 and 1.0 inclusive.                                                                                                 | Blocking | DDD §10 Confidence Score VO |
| VAL-062 | `confidence_threshold` MUST be a number between 0.0 and 1.0 inclusive.                                                                                          | Blocking | DDD §10 Confidence Score VO |
| VAL-063 | If `quality_score < confidence_threshold`, `escalation.triggered` MUST be `true` and `status` MUST be `escalated`; it MUST NOT be `completed`.                  | Blocking | Constitution RULE-083       |
| VAL-064 | `escalation.triggered = true` REQUIRES both `escalation.escalated_to` and `escalation.reason` to be present and non-empty.                                      | Blocking | Reflection Contract §4      |
| VAL-065 | `failure_analysis` MUST be present when `status = escalated` or `quality_score` is below the tenant-configured "needs_review" threshold.                        | Blocking | Reflection Contract §4      |
| VAL-066 | `knowledge_update.knowledge_id`, if present, MUST reference an existing Knowledge Contract instance id.                                                         | Blocking | Knowledge Contract §1       |
| VAL-067 | `knowledge_update` MUST NOT set or imply a direct mutation of a Knowledge Contract instance's `version`; Knowledge versioning is append-only.                   | Blocking | Knowledge Contract §4       |
| VAL-068 | `status = completed` MUST NOT co-occur with `escalation.triggered = true` in the same record.                                                                   | Blocking | Reflection Contract §4      |
| VAL-069 | `task_review.actual_outcome` MUST be a non-empty string.                                                                                                        | Blocking | Schema constraint           |
| VAL-070 | `version` MUST follow semver and MUST NOT change once a Reflection record's `status = archived`.                                                                | Blocking | Constitution RULE-070       |
| VAL-071 | `learning` entries with `applicability_scope = global` MUST include a `confidence` value ≥ 0.7, preventing weak generalizations from polluting global learning. | Warning  | Domain judgment call        |
| VAL-072 | `feedback.rating`, if present, MUST be an integer between 1 and 5 inclusive.                                                                                    | Blocking | Schema constraint           |
