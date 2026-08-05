# Model Contract — Validation Rules (VAL-145 – VAL-156)

Governs: [`model.contract.md`](../contracts/model.contract.md) · Schemas: [`model.schema.yaml`](../schemas/model.schema.yaml), [`model.schema.json`](../schemas/model.schema.json)

| ID      | Rule                                                                                                                                                                         | Severity | Governing Source      |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | --------------------- |
| VAL-145 | `model_id` MUST match `^model\.[a-z0-9_]+\.[a-z0-9_-]+$`.                                                                                                                    | Blocking | Constitution §6.1     |
| VAL-146 | `capabilities` MUST contain at least one entry.                                                                                                                              | Blocking | Model Contract §4     |
| VAL-147 | `reasoning_level` MUST be one of `none`\|`low`\|`medium`\|`high`.                                                                                                            | Blocking | Constitution §23      |
| VAL-148 | `context_window.max_input_tokens` and `max_output_tokens` MUST each be ≥ 1.                                                                                                  | Blocking | Schema constraint     |
| VAL-149 | `fallback` MUST NOT include this model's own `model_id`, and the fallback chain traced transitively across all referenced Model Contract instances MUST NOT contain a cycle. | Blocking | Constitution RULE-080 |
| VAL-150 | `cost` MUST fully specify `unit` and `currency`, and at least one of `input_cost`/`output_cost` (when `unit = per_token`) or `per_call_cost` (when `unit = per_call`).       | Blocking | Constitution RULE-081 |
| VAL-151 | `availability` MUST be present with `sla_percent` and at least one entry in `regions` before `state` may be set to `active`.                                                 | Blocking | Model Contract §2     |
| VAL-152 | `priority` MUST be an integer between 1 and 10 inclusive.                                                                                                                    | Blocking | Schema constraint     |
| VAL-153 | `routing_policy.tier` MUST be one of `economy`\|`standard`\|`premium`.                                                                                                       | Blocking | Schema constraint     |
| VAL-154 | `routing_policy.task_type_mapping_ref` MUST resolve to an active Model Registry mapping entry before `state = active`.                                                       | Blocking | Model Contract §4     |
| VAL-155 | Every model call against this contract instance MUST be cost-tracked per tenant, per agent, and per workflow.                                                                | Blocking | Constitution RULE-081 |
| VAL-156 | `fallback`, when non-empty, MUST reference `model_id` values that resolve to Model Registry entries with `status` in `active`\|`deprecated` (never `retired`).               | Warning  | Constitution RULE-080 |
