# Reasoner Contract

**Contract ID:** `contract.reasoner`
**Version:** 1.0.0
**Status:** Active
**Governs:** The reasoning component of the AI Runtime Architecture defined in [`002-ENTERPRISE-ARCHITECTURE.md`](../docs/002-ENTERPRISE-ARCHITECTURE.md) §18, which evaluates evidence and produces an auditable Decision before an Agent's Executor acts on it.
**Schema files:** [`reasoner.schema.yaml`](../schemas/reasoner.schema.yaml), [`reasoner.schema.json`](../schemas/reasoner.schema.json)
**Examples:** [`reasoner.valid.json`](../examples/reasoner.valid.json), [`reasoner.invalid.json`](../examples/reasoner.invalid.json)
**Validation Rules:** [`reasoner.validation.md`](../validation/reasoner.validation.md) (VAL-049 – VAL-060)

---

## 1. Purpose

This contract is the formal, implementation-independent specification of a Reasoner invocation record — the structured trace of a single reasoning act: the problem framed, the evidence weighed, the hypotheses considered, and the decision reached. It exists so that "why did the AI do this" is always reconstructable after the fact (Constitution §11.6), and so that a Decision carrying elevated Risk is gated by a Guardrail check before any Agent acts on it (Constitution §11.7).

## 2. Field Specification

| Field            | Type                                                                                        | Required | Description                                                                              | Governing RULE / Section              |
| ---------------- | ------------------------------------------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------- | ------------------------------------- |
| `reasoner_id`    | string (`^reasoner\.[a-z][a-z0-9_]*$`)                                                      | Yes      | Globally unique, immutable identifier for this Reasoner configuration                    | Architecture §18                      |
| `version`        | semver string                                                                               | Yes      | Immutable per published version                                                          | RULE-070                              |
| `problem`        | object (`problem_id`, `statement`, `problem_type`)                                          | Yes      | The question or decision point being reasoned about                                      | Architecture §18                      |
| `context`        | object (`memory_refs`: array\<string\>, `knowledge_refs`: array\<string\>, `tenant_id`)     | Yes      | Retrieved Memory/Knowledge references that ground the reasoning act, logged per §13.4    | Constitution §13.4                    |
| `evidence`       | array\<object\> (`evidence_id`, `source`, `content_ref`, `weight`)                          | Yes      | Discrete facts/signals considered, each with a traceable source                          | Architecture §18                      |
| `hypothesis`     | array\<object\> (`hypothesis_id`, `statement`, `supported_by`: array\<string\> evidence_id) | Yes      | Candidate explanations/courses of action derived from `evidence`                         | Architecture §18                      |
| `alternatives`   | array\<object\> (`alternative_id`, `description`, `rejected_reason`)                        | Yes      | Options considered and explicitly rejected, for auditability                             | Architecture §18                      |
| `decision`       | object (`decision_id`, `chosen_hypothesis`, `references_alternative`, `rationale`)          | Yes      | The final choice, which MUST reference at least one rejected Alternative                 | Architecture §18                      |
| `confidence`     | number (0.0–1.0)                                                                            | Yes      | Calibrated confidence in `decision`                                                      | Architecture §18, Reflection Contract |
| `risk`           | enum: `low`\|`medium`\|`high`                                                               | Yes      | Risk classification of acting on `decision`                                              | Constitution §11.7                    |
| `recommendation` | object (`action_ref`, `requires_guardrail_approval`)                                        | Yes      | The recommended next action and whether it must pass Guardrail approval before execution | Constitution §11.7                    |
| `model_ref`      | string                                                                                      | Yes      | Model Contract reference used for this reasoning act                                     | Architecture §19 Model Router         |
| `trace_id`       | UUID                                                                                        | Yes      | Correlates this reasoning act to the originating request/workflow                        | §14.5, DDD §12                        |
| `status`         | enum: `draft`\|`active`\|`deprecated`\|`retired`                                            | Yes      | Registry lifecycle state of this Reasoner configuration                                  | Registry Contract                     |

## 3. Lifecycle

```
draft ──validate schema + evidence sourcing──▶ active
active ──superseded by new version──▶ deprecated ──deprecation window elapses──▶ retired
```

Per-invocation reasoning trace lifecycle (not the configuration's own `status`, but the record produced each call):

```
[Framed] ──evidence gathered──▶ [Evaluating] ──hypotheses ranked──▶ [Decided]
[Decided] ──risk = high──▶ [PendingGuardrailApproval] ──approved──▶ [Actionable]
[Decided] ──risk = low|medium──▶ [Actionable]
[PendingGuardrailApproval] ──rejected──▶ [Escalated]
```

## 4. Invariants

- `confidence` MUST be a float in the closed interval [0.0, 1.0].
- `decision.references_alternative` MUST be non-null and MUST reference an entry present in `alternatives` — a Decision that considered zero Alternatives fails auditability (Architecture §18).
- `alternatives` MUST contain at least one entry, and every entry MUST carry a non-empty `rejected_reason`.
- `risk = high` REQUIRES `recommendation.requires_guardrail_approval = true`; an Agent MUST NOT act on a high-risk Decision that has not been routed through Guardrail approval (Constitution §11.7).
- `hypothesis.supported_by` entries MUST reference `evidence_id` values present in `evidence` — a Hypothesis unsupported by any declared Evidence is invalid.
- `decision.chosen_hypothesis` MUST reference a `hypothesis_id` present in `hypothesis`.
- `context.memory_refs`/`knowledge_refs` used to ground the reasoning act MUST be logged (Constitution §13.4) so the Decision is traceable to the context that produced it.

## 5. Relationship to Other Contracts

A Reasoner Contract instance is referenced by an Agent Contract's `reasoner` field when reasoning is distinct from planning. Its `evidence`/`context` draw from the Memory Contract (`memory_refs`) and Knowledge Contract (`knowledge_refs`) via retrieval. Its `confidence` and `risk` outputs feed the Reflection Contract's `QualityScore`/escalation decision. Its `recommendation.action_ref` may point to a Planner Contract's `execution_plan` step or directly to a Tool Contract invocation, gated by the Permission Contract and, when `risk = high`, by Guardrail/Policy approval (Constitution §11.7). `model_ref` points to a Model Contract instance used via the Model Router.
