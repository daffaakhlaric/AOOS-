# @aos/knowledge-validator

The AOS Enterprise Knowledge Validator AI Platform — orchestrates enterprise validation
of knowledge assets before they are accepted into the Knowledge Platform: validation
requests, validation sessions, validation jobs, validation rules, validation decisions,
validation reports, validation metadata, validation configuration, validation
statistics, validation audit **only**. This package owns ONLY validation orchestration,
validation metadata, validation lifecycle, validation decisions, validation reports,
validation metrics, validation contracts, and provider abstraction. It MUST NEVER
perform AI validation directly, MUST NEVER call any LLM SDK, and MUST NEVER compute a
decision itself, calculate embeddings, or generate/edit/recommend knowledge — all real
validation and decision work is delegated through `IKnowledgeValidationProvider`/
`IKnowledgeValidationRuleProvider`/`IKnowledgeValidationPolicyProvider`/
`IKnowledgeValidationDecisionProvider` interfaces this package never implements. See
`docs/PROMPT-005.7M-KNOWLEDGE-VALIDATOR.md` for the explicit scope boundary and
`docs/005.7M-KNOWLEDGE-VALIDATOR-AI-REPORT.md` for the readiness checklist handed to the
next phase (005.7N Embedding Manager).

## Public API

`KnowledgeValidator`, `KnowledgeValidatorManager`, `KnowledgeValidatorRegistry`,
`KnowledgeValidatorResolver`, `KnowledgeValidatorValidator`, `KnowledgeValidatorPipeline`,
`KnowledgeValidatorMiddleware`, `KnowledgeValidatorFactory`, `KnowledgeValidatorContext`,
`KnowledgeValidatorSession`, `KnowledgeValidatorLifecycle`,
`KnowledgeValidatorStateMachine`, `KnowledgeValidatorEvents`, `KnowledgeValidatorMetrics`,
`KnowledgeValidatorHealth`, `KnowledgeValidatorMonitoring`, `KnowledgeValidatorStatistics`,
`KnowledgeValidatorSystem` — the 18 names required by the prompt. `src/index.ts` also
re-exports the full Domain/Contracts/Errors/Validator-stage surface a caller needs to
actually build and use them, matching the curation style established by
`@aos/knowledge-quality` and `@aos/knowledge-marketplace`.

Two names in that list look confusingly similar on purpose, per the prompt's own
naming: `KnowledgeValidator` is the primary API façade a caller instantiates
(`validation/knowledge-validator.ts`); `KnowledgeValidatorValidator` is the distinct
12-stage internal validator aggregator (`validator/knowledge-validator-validator.ts`)
that the façade's Pipeline drives. They are never the same class — see "Pipeline" below
for the full naming distinction. The read-only per-validation domain view returned by
every operation is exported separately as `KnowledgeValidationRecord`, to avoid a
same-name collision with the façade.

## Quick example

```ts
import {
  KnowledgeValidator,
  KnowledgeValidationCategory,
  KnowledgeValidationDecisionValue,
  createKnowledgeValidatorContext,
} from "@aos/knowledge-validator";

const validator = new KnowledgeValidator(publisher);

// Setup: register a Rule (metadata only — no executable rule logic).
validator.registerRule({
  ruleId: "rule-1",
  name: "Broken reference check",
  tenantId: "tenant-1",
  category: KnowledgeValidationCategory.REFERENCE_VALIDATION,
});

// The package NEVER ships a Provider — a caller must register one via config
// before start() can record any Findings.
const configured = new KnowledgeValidator(publisher, {
  provider: myProviderAdapter, // IKnowledgeValidationProvider
});

const context = createKnowledgeValidatorContext({ validationId: "v-1", tenantId: "tenant-1" });

const created = await validator.createValidation({
  context,
  title: "Q3 FAQ reference validation",
  category: KnowledgeValidationCategory.REFERENCE_VALIDATION,
  targetReference: "kb://faq/q3-2026",
  ruleIds: ["rule-1"],
  requestedBy: "user-1",
});
// created.state === "draft"

await validator.queue({ token: created.token });
await validator.prepare({ token: created.token }); // resolves Rule/Policy/Configuration
const started = await validator.start({ token: created.token }); // invokes myProviderAdapter.validate()
const reviewing = await validator.review({ token: created.token });
// reviewing.state === "reviewing"

// Reviewing fans out into TWO distinct settled outcomes — Approved or Rejected.
const approved = await validator.approve({
  token: created.token,
  decision: {
    value: KnowledgeValidationDecisionValue.APPROVED,
    reportedBy: "reviewer-1",
    confidence: 0.92,
  },
});
// approved.state === "approved"

const { report } = await validator.generateReport({ token: created.token });
```

## Architecture

Follows the identical architecture established by every completed AOS Knowledge
package (`@aos/knowledge-generator`, `@aos/knowledge-marketplace`,
`@aos/knowledge-policy`, `@aos/knowledge-quality`): contract-first, metadata-driven,
event-driven, vendor-neutral, and strictly an orchestrator. `KnowledgeValidator`
(the façade) composes:

- **Registry** (`KnowledgeValidatorRegistry`) — 8 in-memory, id-keyed buckets, Map
  lookups only, never scanned.
- **Resolver** (`KnowledgeValidatorResolver`) — 5 resolution dimensions as method
  pairs on one class.
- **Validator** (`KnowledgeValidatorValidator`) — exactly 12 pure-function stages
  aggregating structural issues without short-circuiting.
- **Pipeline** (`KnowledgeValidatorPipeline`) — exactly 10 stages driving one
  Validation Operation end to end: runs the Validator, resolves Rules/Policy/
  Configuration/Decision, stamps Metadata/Metrics, drives the State Machine, and
  appends Audit/Logging.
- **Middleware** (`KnowledgeValidatorMiddleware`) — Koa-style `validator.use(...)`
  chain, async-capable, double-`next()` guarded.
- **State Machine** (`KnowledgeValidatorStateMachine`) + **Lifecycle**
  (`KnowledgeValidatorLifecycle`) — the only code allowed to mutate
  `KnowledgeValidation.state`, plus a read-only companion for introspection.
- **Manager** (`KnowledgeValidatorManager`) — token-keyed execution ledger + Job
  ledger + shared Statistics instance.
- **Session** (`KnowledgeValidatorSession`) — Open/Resume/Close/Cancel/Expire/Renew
  access-window lifecycle.
- **Events** (`KnowledgeValidatorEvents`) — publishes onto the real
  `@aos/event-bus` `IPublisher`, producer `"@aos/knowledge-validator"`.
- **Metrics/Health/Monitoring/Statistics** — the observability quartet, all real
  running computations (never stubs).
- **Factory** (`KnowledgeValidatorFactory`) — 6 named sub-factories composing
  every domain record.

This package NEVER calls an AI SDK, computes a decision, calculates embeddings, or
generates/edits knowledge. Every "Validation Operation" is metadata/lifecycle work:
create a validation request record, drive it through the state machine, and — only
inside `start()` — optionally invoke a caller-supplied `IKnowledgeValidationProvider`
through its interface. `approve()`/`reject()` never compute a Decision; they only
record whatever `KnowledgeValidationDecisionValue` the caller (or the caller's own
`IKnowledgeValidationDecisionProvider`) supplied as input.

## Domain Model

The 12 named domain aggregates from the prompt:

| Aggregate                           | File                                                 | Notes                                                                     |
| ----------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------- |
| `KnowledgeValidation`               | `domain/knowledge-validation.ts`                     | Primary entity envelope, tracked through the 10-state Lifecycle.          |
| `KnowledgeValidationJob`            | `domain/knowledge-validation-job.ts`                 | Schedulable queueing unit; no Registry bucket (Manager-owned ledger).     |
| `KnowledgeValidationSession`        | `domain/knowledge-validation-session.ts`             | Business-level access window; Registry-backed.                            |
| `KnowledgeValidationDecision`       | `domain/knowledge-validation-decision.ts`            | WHICH of the 6 Decision values was reported, by whom, when.               |
| `KnowledgeValidationRule`           | `domain/knowledge-validation-rule.ts`                | Named check definition, metadata only.                                    |
| `KnowledgeValidationMetadata`       | `domain/knowledge-validation-metadata.ts`            | Descriptive metadata for one Validation.                                  |
| `KnowledgeValidationConfiguration`  | `domain/knowledge-validation-configuration.ts`       | Run-tuning metadata handed unmodified to a provider.                      |
| `KnowledgeValidationReport`         | `domain/knowledge-validation-report.ts`              | Aggregates Findings + a Decision id; never renders.                       |
| `KnowledgeValidationFinding`        | `domain/knowledge-validation-finding.ts`             | One issue/observation; Category + severity + description.                 |
| `KnowledgeValidationStatistics`     | `domain/knowledge-validation-statistics-snapshot.ts` | Satisfied via `KnowledgeValidationStatisticsSnapshot`, keyed by Category. |
| `KnowledgeValidationAudit`          | `domain/knowledge-validation-audit.ts`               | One immutable entry appended by the Pipeline's Audit stage.               |
| `KnowledgeValidationResultMetadata` | `domain/knowledge-validation-result-metadata.ts`     | Metadata ABOUT an outcome — never the validated content itself.           |

Supporting (not one of the 12, but required plumbing): `KnowledgeValidationRequest`
(the operation input — category, target reference, declared Rules/Policy/
Configuration), `KnowledgeValidationPolicy` (allow/deny record + real
`evaluateKnowledgeValidationPolicy()` evaluator), `KnowledgeValidationExecution` (the
immutable envelope every stage reads/returns), and `KnowledgeValidationRecord` (the
read-only view a caller receives back).

### Validation Decisions (metadata only — no algorithm)

`KnowledgeValidationDecisionValue`: `Approved`, `Conditionally Approved`,
`Requires Review`, `Requires Revision`, `Rejected`, `Expired`. This package never
computes which value applies — `approve()`/`reject()` only validate that the supplied
value belongs to the correct subset (`APPROVAL_DECISION_VALUES` /
`REJECTION_DECISION_VALUES`) and record it.

### Validation Categories

`KnowledgeValidationCategory`: `Policy Validation`, `Structure Validation`,
`Metadata Validation`, `Reference Validation`, `Compliance Validation`,
`Security Validation`, `Business Validation`, `Quality Validation`,
`Custom Validation` — tags on Rules, Findings, and every Request's primary Category.

## Validation Flow

1. `createValidation()` → **Draft**. Builds `KnowledgeValidation` + `Metadata` +
   `Request`, runs the Pipeline (no state change), registers into the VALIDATION
   bucket, publishes `ValidationCreated`.
2. `queue()` → **Queued**.
3. `prepare()` → **Preparing**. The Pipeline's Rule/Policy/Configuration/Decision
   Resolution stages run here, resolving everything the Request declared.
4. `start()` → **Validating**. Publishes `ValidationStarted`; if a caller registered
   `provider` via config, invokes `provider.validate()` and records every returned
   Finding. No provider means no Findings — never a default "fake AI" implementation.
5. `review()` → **Reviewing**. The checkpoint before a Decision may be recorded.
6. `approve()` / `reject()` → **Approved** / **Rejected**. Records the caller-supplied
   `KnowledgeValidationDecision`, publishes `DecisionCreated` +
   `ValidationCompleted` + (`ValidationApproved` | `ValidationRejected`).
7. `cancel()` → **Cancelled** (legal from Draft through Reviewing).
8. `archive()` → **Archived** (legal from Approved/Rejected/Cancelled).
9. `destroy()` → **Destroyed**, the sole hard-terminal state.

`recordFinding()` is legal while Validating or Reviewing. `generateReport()` builds a
`KnowledgeValidationReport` from whatever Findings/Decision have already been
recorded — it never validates or decides anything itself.

## Decision Lifecycle

Ten states, in the prompt's own order: `Draft → Queued → Preparing → Validating →
Reviewing → Approved | Rejected → Archived`, plus `Cancelled` (reachable from every
non-settled state) and `Destroyed` (the sole hard-terminal state, reachable from every
settled state). Unlike every prior sibling package — which has a single "success"
terminal-adjacent state (e.g. `Completed`) — this Lifecycle has **two** independent
settled outcomes fanning out of Reviewing: `Approved` and `Rejected`. Both are
"settled" (no longer actively progressing) but neither is the hard terminal state;
only `Destroyed` is. `KnowledgeValidatorLifecycle.isSettled()` returns `true` for
`Approved`, `Rejected`, `Cancelled`, `Archived`, and `Destroyed`;
`KnowledgeValidatorLifecycle.isTerminal()` returns `true` only for `Destroyed`.

The `KnowledgeValidatorStateMachine` is the only code allowed to mutate
`KnowledgeValidation.state`. It stamps `startedAt` on the transition into `Validating`
and `settledAt` on the transition into either `Approved` or `Rejected`.

## Registry

Eight buckets, exactly as named in the prompt: `VALIDATION`, `SESSION`, `RULE`,
`DECISION`, `CONFIGURATION`, `STATISTICS`, `AUDIT`, `FINDING`. `JOB` and `POLICY` are
NOT Registry buckets — the spec's 8 names do not include them, so Jobs live in a
dedicated `KnowledgeValidatorManager` ledger and Policies in a dedicated
`KnowledgeValidatorResolver` map, matching the `@aos/knowledge-quality` precedent.
Every read is a direct `Map` lookup by id — "Never scan collections."

## Validation Rules

`KnowledgeValidationRule` is metadata only — a named check definition tagged with a
Validation Category and a severity, never executable logic. This package NEVER
evaluates a Rule itself; a caller-supplied `IKnowledgeValidationRuleProvider` owns
that entirely. The Pipeline's Rule Resolution stage (Stage 2) only resolves declared
Rule ids against the RULE Registry bucket and records usage.

## Policy Integration

`KnowledgeValidationPolicy` is an allow/deny record (not one of the 12 aggregates, no
dedicated Registry bucket) tracked in a `KnowledgeValidatorResolver`-owned map.
`evaluateKnowledgeValidationPolicy()` performs real evaluation: an inactive Policy
denies everything; an empty `allowedCategories` list means "no restriction"
(permissive by omission, matching `@aos/knowledge-policy`'s evaluators); otherwise
both the Request's primary Category and every resolved Rule's Category must appear in
the allow-list. A caller may override this built-in evaluator with a richer,
externally-governed engine via the `IKnowledgeValidationPolicyProvider` extension
point.

## Pipeline

Exactly 10 stages, in this fixed order:

1. **Validation** — runs the entire 12-stage `KnowledgeValidatorValidator`
   aggregator; a failure here halts the Pipeline with `ValidationCheckException`.
2. **Rule Resolution** — resolves declared Rule ids against the RULE bucket.
3. **Policy Resolution** — resolves the declared Policy and evaluates allow/deny.
4. **Configuration Resolution** — resolves/validates the declared Configuration
   against the CONFIGURATION bucket.
5. **Decision Resolution** — if a Decision has already been recorded (or is being
   recorded by this operation), validates it is one of the 6 legal values; when none
   is present, this stage is a documented no-op (same spirit as
   `@aos/knowledge-generator`'s "structural no-op" stages).
6. **Metadata** — stamps `updatedAt`.
7. **Metrics** — records the named `Validation Count` counter.
8. **Lifecycle** — advances the State Machine to `targetState`, when supplied.
9. **Audit** — appends a `KnowledgeValidationAudit` entry to the AUDIT bucket.
10. **Logging** — appends one structured, in-memory log entry.

### The triple "Validation" naming distinction

Three different things in this package are named "Validation," deliberately, per the
spec's own naming — kept clearly separated in code comments throughout:

1. **Pipeline Stage 1 "Validation"** (`pipeline/knowledge-validator-pipeline.ts`) —
   runs the entire 12-stage `KnowledgeValidatorValidator` aggregator.
2. **The 12-stage aggregator's own Stage 3, also named "Validation"**
   (`validator/validation-validator.ts`, class `ValidationValidator`) — checks that
   the validation **Request itself** (not the knowledge being validated) has
   well-formed required fields: category, target reference, requestId, requestedBy.
3. **The aggregator class itself**, `KnowledgeValidatorValidator`
   (`validator/knowledge-validator-validator.ts`) — a Public API export in its own
   right, distinct from the `KnowledgeValidator` façade.

## Metrics

Eight named counters (`KnowledgeValidatorMetrics`, all real running computations):
`Validation Count`, `Approved Count`, `Rejected Count`, `Decision Count`,
`Rule Usage`, `Policy Usage`, `Average Duration`, `Average Confidence Metadata`
(a real running average of every recorded `Decision.confidence`). Plus internal
bookkeeping (`configurationUsageCount`, `findingCount`, `checkCount`/
`checkFailureCount`) that feeds Health/Monitoring without polluting the 8 named
metrics.

## Monitoring

`KnowledgeValidatorMonitoring.sample()` combines a live `KnowledgeValidatorMetrics`
snapshot with a `KnowledgeValidatorHealth.check()` report (Registry occupancy +
domain failure-ratio, 5 statuses: healthy/warning/degraded/unavailable/unknown) into
one `KnowledgeValidatorDashboard`.

## Statistics

`KnowledgeValidatorStatistics` tracks `requestedCount`/`approvedCount`/
`rejectedCount`/`lastActivityAt` per `KnowledgeValidationCategory` — keyed by the
Request's primary declared Category (a Validation always has exactly one, though it
may span many Rule Categories), mirroring how `@aos/knowledge-quality` keyed its
Statistics by Assessment Mode.

## Extension Points (interfaces only — never implemented here)

`IKnowledgeValidationProvider`, `IKnowledgeValidationRuleProvider`,
`IKnowledgeValidationPolicyProvider`, `IKnowledgeValidationDecisionProvider`,
`IKnowledgeValidationAuditProvider`, `IKnowledgeValidationStorage`,
`IKnowledgeValidationPublisher`, `IKnowledgeValidationScheduler`,
`IKnowledgeValidationReporter`, `IKnowledgeValidationCostProvider`,
`IKnowledgeValidationStreamingProvider`, `IKnowledgeValidationMetricsProvider` — the
12 required Extension Points, plus 2 Future Readiness contracts
(`IEmbeddingManagerValidator` for 005.7N, `IKnowledgeGraphValidator` for 005.7O).
None are implemented in this package; `KnowledgeValidatorConfig` registers NEITHER
`provider` NOR `decisionProvider` by default.

## Token

Prefix `kval_` (Knowledge VALidator), collision-free with every existing AOS token
prefix (`ptok_`, `stok_`, `ksrc_`, `kver_`, `kpol_`, `kmkt_`, `kgen_`, `kqua_`, `ktok_`,
`rtok_`).

## Testing

655 tests across 33 spec files. Coverage: 100% statements / 100% branches / 100%
functions / 100% lines (thresholds: ≥95/90/95/95). Run:

```sh
pnpm --filter @aos/knowledge-validator test
pnpm --filter @aos/knowledge-validator test:coverage
```

See `docs/005.7M-KNOWLEDGE-VALIDATOR-AI-REPORT.md` for the full non-obvious design
judgment-call log and the Readiness Checklist handed to 005.7N.
