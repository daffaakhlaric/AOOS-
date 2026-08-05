# Registry Contract — Validation Rules (VAL-133 – VAL-144)

Governs: [`registry.contract.md`](../contracts/registry.contract.md) · Schemas: [`registry.schema.yaml`](../schemas/registry.schema.yaml), [`registry.schema.json`](../schemas/registry.schema.json)

| ID      | Rule                                                                                                                                                                 | Severity | Governing Source      |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | --------------------- |
| VAL-133 | `registry_type` MUST be one of the 10 defined sub-registry enum values.                                                                                              | Blocking | Constitution §9.1     |
| VAL-134 | `entry_version` MUST match full semantic version `MAJOR.MINOR.PATCH`.                                                                                                | Blocking | Constitution RULE-070 |
| VAL-135 | A given `entry_id` + `entry_version` pair MUST be globally unique across the Registry — no in-place overwrite of a published pair.                                   | Blocking | Constitution RULE-011 |
| VAL-136 | `entry_version` MUST be strictly greater (semver-compared) than any prior published `entry_version` for the same `entry_id`.                                         | Blocking | Constitution §9.4     |
| VAL-137 | Every transition of `status` to `active` MUST emit a `registry.<registry_type>.published` event.                                                                     | Blocking | Constitution RULE-013 |
| VAL-138 | `deprecation_note` MUST be present and non-empty whenever `status = deprecated`.                                                                                     | Blocking | Registry Contract §4  |
| VAL-139 | `changelog` MUST contain at least one entry (the initial publish record).                                                                                            | Blocking | Constitution §9.3     |
| VAL-140 | `payload_ref` MUST be present, non-empty, and MUST resolve to a document that validates against the JSON Schema implied by `registry_type`.                          | Blocking | Constitution §9.2     |
| VAL-141 | `tenant_scope` resolution for reads MUST follow precedence tenant override > plan-tier default > global default; no consumer may apply a different precedence order. | Blocking | Constitution §9.5     |
| VAL-142 | `supersedes`, when present, MUST match pattern `<entry_id>@<version>` and MUST reference an entry with `status` in `deprecated`\|`retired`.                          | Blocking | Registry Contract §4  |
| VAL-143 | Registry reads MUST NOT bypass cache TTL rules to read a hardcoded local copy; `cache_ttl_seconds`, when present, MUST be respected by all consumers.                | Warning  | Constitution §9.7     |
| VAL-144 | `created_at` MUST be a valid ISO 8601 date-time string.                                                                                                              | Blocking | Schema constraint     |
