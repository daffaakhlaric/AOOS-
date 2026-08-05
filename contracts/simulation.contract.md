# Simulation Contract

**Contract ID:** `contract.simulation`
**Version:** 1.0.0
**Status:** Active
**Governs:** Every scenario run of the Simulation Engine, per [`002-ENTERPRISE-ARCHITECTURE.md`](../docs/002-ENTERPRISE-ARCHITECTURE.md) §30 (Simulation Architecture) — the sandboxed, offline evaluation gate for Agent/Workflow/Prompt/Model versions before promotion to `active`.
**Schema files:** [`simulation.schema.yaml`](../schemas/simulation.schema.yaml), [`simulation.schema.json`](../schemas/simulation.schema.json)
**Examples:** [`simulation.valid.json`](../examples/simulation.valid.json), [`simulation.invalid.json`](../examples/simulation.invalid.json)
**Validation Rules:** [`simulation.validation.md`](../validation/simulation.validation.md) (VAL-205 – VAL-216)

---

## 1. Purpose

This contract is the formal, implementation-independent specification of a single Simulation Scenario run — a candidate Agent/Prompt/Model/Workflow version replayed against a fully sandboxed set of synthetic ("dummy") fixtures standing in for every external system (Dealer CRM, WhatsApp, Meta/Google/TikTok Ads, Sales staff, Customers). It exists so that "ship it and watch" is never the first validation gate for autonomous, spend-capable, customer-facing AI decisions (Architecture §30 rationale). Every field prefixed `dummy_*` is a structurally isolated synthetic fixture; none of them may resolve to a live external system under any configuration.

## 2. Field Specification

| Field               | Type                                                                     | Required | Description                                                                                                                     | Governing RULE / Section      |
| ------------------- | ------------------------------------------------------------------------ | -------- | ------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| `id`                | UUID                                                                     | Yes      | Globally unique identifier for this Simulation run                                                                              | RULE-011                      |
| `scenario`          | object (`scenario_id`, `name`, `description`, `expected_outcome`)        | Yes      | The Scenario Library entry being run; `expected_outcome` is what the Outcome Scorer compares against                            | Architecture §30              |
| `candidate_ref`     | string                                                                   | Yes      | The Agent/Prompt/Model/Workflow Registry entry version under evaluation (`state = draft`)                                       | Architecture §30              |
| `seed`              | integer                                                                  | Yes      | Deterministic random seed; identical seed + scenario MUST reproduce identical synthetic data and identical Agent-facing stimuli | Architecture §30              |
| `dummy_dealer`      | object (`tenant_id`, `branch_ids`, `name`)                               | Yes      | Synthetic Dealer/Tenant fixture, sandboxed, never a real `tenant_id`                                                            | Architecture §30              |
| `dummy_customer`    | array\<object\> (`customer_id`, `profile`, `behavior_script`)            | Yes      | Synthetic Customer fixtures with scripted response behavior                                                                     | Architecture §30              |
| `dummy_sales`       | array\<object\> (`sales_id`, `role`, `behavior_script`)                  | Yes      | Synthetic Sales-staff fixtures standing in for human responders                                                                 | Architecture §30              |
| `dummy_crm`         | object (`adapter_mode`, `seed_records`)                                  | Yes      | Mocked CRM Adapter; `adapter_mode` MUST be `sandboxed`                                                                          | Architecture §30              |
| `dummy_whatsapp`    | object (`adapter_mode`, `seed_conversations`)                            | Yes      | Mocked WhatsApp Adapter; `adapter_mode` MUST be `sandboxed`                                                                     | Architecture §30              |
| `dummy_meta`        | object (`adapter_mode`, `seed_campaigns`)                                | Yes      | Mocked Meta Ads Adapter; `adapter_mode` MUST be `sandboxed`                                                                     | Architecture §30              |
| `dummy_google_ads`  | object (`adapter_mode`, `seed_campaigns`)                                | Yes      | Mocked Google Ads Adapter; `adapter_mode` MUST be `sandboxed`                                                                   | Architecture §30              |
| `dummy_tiktok_ads`  | object (`adapter_mode`, `seed_campaigns`)                                | Yes      | Mocked TikTok Ads Adapter; `adapter_mode` MUST be `sandboxed`                                                                   | Architecture §30              |
| `dummy_leads`       | array\<object\> (`lead_id`, `source`, `initial_state`)                   | Yes      | Synthetic Lead fixtures seeded into the scenario                                                                                | Architecture §30              |
| `dummy_budget`      | object (`currency`, `amount`, `period`)                                  | Yes      | Synthetic spend ceiling the candidate operates under during the run; never debits a real budget                                 | Architecture §30              |
| `replay`            | object (`replayable`, `source_run_id`, `deterministic_hash`)             | Yes      | Whether/how this run reproduces a prior run given the same `seed`                                                               | Architecture §30              |
| `outcome_scorer`    | object (`accuracy`, `cost`, `latency`, `guardrail_trigger_rate`, `pass`) | No       | Populated once the run completes; the scorecard gating promotion                                                                | Architecture §30              |
| `sandbox_isolation` | object (`network_egress_denied`, `adapter_binding`)                      | Yes      | Structural proof this run cannot reach live external systems (`network_egress_denied` MUST be `true`)                           | Architecture §30 Dependencies |
| `state`             | enum: `queued`\|`running`\|`completed`\|`failed`\|`aborted`              | Yes      | Lifecycle state of this Simulation run                                                                                          | —                             |
| `started_at`        | date-time (ISO 8601)                                                     | No       | Run start timestamp                                                                                                             | —                             |
| `completed_at`      | date-time (ISO 8601)                                                     | No       | Run completion timestamp                                                                                                        | —                             |

## 3. Lifecycle

```
queued ──sandbox provisioned + adapters bound to dummy_* fixtures──▶ running
running ──Outcome Scorer produces scorecard──▶ completed
running ──unrecoverable sandbox error──▶ failed
queued/running ──operator cancellation──▶ aborted
```

`completed` with `outcome_scorer.pass = true` is the sole mechanism by which a candidate Registry entry may transition from `draft` to `active` (Architecture §30 Sequence); no other pathway to `active` exists for Agent/Workflow/Prompt/Model Registry entries.

## 4. Invariants

- `seed` MUST be a non-negative integer; identical (`seed`, `scenario.scenario_id`) pairs MUST deterministically reproduce identical synthetic stimuli — this is what makes `replay` possible.
- Every `dummy_*` field's `adapter_mode` (where applicable) MUST be `sandboxed`; `sandbox_isolation.network_egress_denied` MUST be `true` for the entire run — this is the critical safety invariant: Simulation Engine adapters are structurally isolated from real Tool Adapters and MUST NOT be able to reach real external systems (Architecture §30 Dependencies), never merely configured not to.
- `scenario.expected_outcome` MUST be non-null before a run may transition to `running` — the Outcome Scorer cannot score a run against an undefined expectation.
- `replay.replayable = true` REQUIRES `replay.deterministic_hash` to be present and REQUIRES `seed` to be non-null; a non-deterministic run (e.g., one that called a live, unmocked timestamp/random source) MUST set `replay.replayable = false`.
- `candidate_ref` MUST resolve to a Registry entry with `state = draft`; simulation of an already-`active` entry is only valid as a regression re-check, never as the sole gate for a first-time promotion.
- `dummy_budget` MUST NOT be capable of resolving to any real Money movement — the Tool Manager's real payment/spend Adapters MUST be entirely absent from the sandbox's adapter binding table, not merely mocked to a zero-cost response.
- `state = completed` REQUIRES `outcome_scorer` to be non-null with `pass` explicitly `true` or `false` (never left ambiguous).

## 5. Relationship to Other Contracts

A Simulation run's `candidate_ref` points at a `draft`-state Agent, Workflow, Model, or Registry Prompt entry; a `completed` run with `outcome_scorer.pass = true` is the Registry Contract's required precondition for promoting that entry to `active` (mirroring the Agent Contract §3 Lifecycle's "validate + simulate" transition). `dummy_crm`/`dummy_whatsapp`/`dummy_meta`/`dummy_google_ads`/`dummy_tiktok_ads` are sandboxed stand-ins for the real Tool Contract Adapters those Tools would otherwise bind to — the Simulation Contract is, per Architecture §22 Dependency Graph, the only Contract that depends on others purely for read-only sandboxed validation with no other Contract depending back on it. Simulation run logs and metrics are still emitted through the Logging and Analytics Contracts, tagged with a synthetic `tenant_id` (`dummy_dealer.tenant_id`) so simulated data can never comingle with real tenant analytics (DDD §25 Tenant Isolation applies even to sandboxed fixtures).
