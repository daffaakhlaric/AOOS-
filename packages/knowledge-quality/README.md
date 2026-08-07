# @aos/knowledge-quality

The AOS Enterprise Knowledge Quality Engine — orchestrates enterprise knowledge quality
assessment: quality assessment metadata, quality jobs, quality sessions, quality reports,
quality findings, quality rules, quality profiles, quality configuration, quality
statistics, quality audit **only**. This package owns ONLY quality orchestration, quality
metadata, quality lifecycle, quality policies, quality reports, quality metrics, quality
contracts, and provider abstraction. It MUST NEVER evaluate AI quality directly, MUST
NEVER call any LLM SDK, and MUST NEVER perform validation, generate knowledge, or modify
knowledge — all real quality evaluation is delegated through `IKnowledgeQualityProvider`/
`IKnowledgeQualityRuleProvider`/`IKnowledgeQualityPolicyProvider`/
`IKnowledgeQualityScoringProvider` interfaces this package never implements. See
`docs/PROMPT-005.7L-KNOWLEDGE-QUALITY.md` for the explicit scope boundary and
`docs/005.7L-KNOWLEDGE-QUALITY-ENGINE-REPORT.md` for the readiness checklist handed to the
next phase (005.7M Knowledge Validator AI).

## Public API

`KnowledgeQuality`, `KnowledgeQualityManager`, `KnowledgeQualityRegistry`,
`KnowledgeQualityResolver`, `KnowledgeQualityValidator`, `KnowledgeQualityPipeline`,
`KnowledgeQualityMiddleware`, `KnowledgeQualityFactory`, `KnowledgeQualityContext`,
`KnowledgeQualitySession`, `KnowledgeQualityLifecycle`, `KnowledgeQualityStateMachine`,
`KnowledgeQualityEvents`, `KnowledgeQualityMetrics`, `KnowledgeQualityHealth`,
`KnowledgeQualityMonitoring`, `KnowledgeQualityStatistics`, `KnowledgeQualitySystem`
— the 18 names required by the prompt. `src/index.ts` also re-exports the full
Domain/Contracts/Errors/Validator-stage surface a caller needs to actually build and use
them, matching the curation style established by `@aos/knowledge-generator` and
`@aos/knowledge-marketplace`. The prompt's Public API list names only one
`KnowledgeQuality`, so the façade takes the bare name and the read-only per-assessment
domain view is exported separately as `KnowledgeQualityAssessmentRecord`.

## Quick example

```ts
import {
  KnowledgeQuality,
  KnowledgeQualityAssessmentMode,
  KnowledgeQualityDimension,
  createKnowledgeQualityContext,
} from "@aos/knowledge-quality";

const quality = new KnowledgeQuality(publisher);

// Setup: register a Rule (metadata only — no executable rule logic).
quality.registerRule({
  ruleId: "rule-1",
  name: "Factual accuracy check",
  tenantId: "tenant-1",
  dimension: KnowledgeQualityDimension.ACCURACY,
});

// The package NEVER ships a Provider — a caller must register one via config
// before start() can record any Findings.
const configured = new KnowledgeQuality(publisher, {
  provider: myProviderAdapter, // IKnowledgeQualityProvider
  scoringProvider: myScoringAdapter, // IKnowledgeQualityScoringProvider
});

const context = createKnowledgeQualityContext({ assessmentId: "g-1", tenantId: "tenant-1" });

const created = await quality.createAssessment({
  context,
  title: "Q3 FAQ quality pass",
  mode: KnowledgeQualityAssessmentMode.FULL_ASSESSMENT,
  targetReference: "kb://faq/q3-2026",
  ruleIds: ["rule-1"],
  requestedBy: "user-1",
});
// created.state === "draft"

await quality.queue({ token: created.token });
await quality.prepare({ token: created.token }); // resolves Rule/Profile/Policy/Configuration
const started = await quality.start({ token: created.token }); // invokes myProviderAdapter.assess()
await quality.review({ token: created.token });
const completed = await quality.complete({ token: created.token });
// completed.state === "completed"

const { report } = await quality.generateReport({ token: created.token });
```

## Architecture

```
KnowledgeQuality (quality/) — the public façade, composition root
  owns StateMachine + Pipeline + Middleware + Manager + Resolver + Factory
        │
        ▼
KnowledgeQualityPipeline (pipeline/) — 10 fixed stages
  Validation → Rule Resolution → Profile Resolution → Policy Resolution →
  Configuration Resolution → Metadata → Metrics → Lifecycle → Audit → Logging
        │
        ▼
KnowledgeQualityStateMachine — the only code allowed to mutate KnowledgeQualityAssessment.state
        │
        ▼
KnowledgeQualityResolver — resolve Assessment/Rule/Profile/Policy/Configuration
        │
        ▼
KnowledgeQualityRegistry (8 generic buckets) + KnowledgeQualityManager
                                                (token-keyed ledger)
        │
        ▼
KnowledgeQualityMiddleware — quality.use() extensibility, separate from the Pipeline
        │
        ▼
contracts/ — 12 interface-only extension points + 2 future-readiness contracts,
             zero implementations, zero real quality evaluation logic anywhere in this package
```

`KnowledgeQuality` implements every Assessment Operation (createAssessment/queue/prepare/
start/review/complete/fail/cancel/archive/destroy) as: validate → drive the State Machine
to the target state via one atomic 10-stage Pipeline call → record relevant domain
metadata → update statistics → publish the matching event → return the updated
`KnowledgeQualityAssessmentRecord`. `start()` is the **only** method that may invoke a
caller-registered `IKnowledgeQualityProvider`/`IKnowledgeQualityScoringProvider`, and only
through their interface methods — this package contains zero default/fallback "fake AI"
implementation and never computes a real quality score itself.
`KnowledgeQualityManager` is a distinct, mid-level class — composing `registry` +
`session` + `statistics` + a private token-keyed execution ledger + a Job ledger —
mirroring `@aos/knowledge-generator`'s `KnowledgeGenerator`/`KnowledgeGeneratorManager`
split.

## Domain Model

`KnowledgeQualityAssessment`, `KnowledgeQualityJob`, `KnowledgeQualitySession`,
`KnowledgeQualityFinding`, `KnowledgeQualityRule`, `KnowledgeQualityProfile`,
`KnowledgeQualityConfiguration`, `KnowledgeQualityMetadata`, `KnowledgeQualityReport`,
`KnowledgeQualityStatistics`, `KnowledgeQualityAudit`, `KnowledgeQualityScoreMetadata` —
the exact 12 aggregates named by the prompt, each backed by a Zod schema
(`domain/knowledge-quality-*.ts`).

**Finding-vs-score modeling (judgment call):** `KnowledgeQualityFinding` is a discrete
issue/observation (Dimension + severity + caller-authored description + optional
location/rule reference), while `KnowledgeQualityScoreMetadata` is metadata ABOUT a
numeric/qualitative score a caller-supplied `IKnowledgeQualityScoringProvider` reported
for one Dimension. Neither is ever computed by this package — both are recorded on
behalf of a caller-supplied provider.

**Rule-vs-Profile modeling:** `KnowledgeQualityRule` is a single named check definition
(metadata only, no executable rule logic); `KnowledgeQualityProfile` bundles Rule ids plus
per-Dimension weights (also metadata only — this package never interprets the weights).

**Context-vs-Quality-Context naming (judgment call):** `KnowledgeQualityContext`
(`context/` — the caller-scoped operational context every Assessment Operation runs
under) is distinct from any Domain-Model "context" concept — this package has no separate
domain-level Context Reference aggregate (unlike `@aos/knowledge-generator`'s
`KnowledgeGenerationContext`), since Quality Assessment always targets an existing
knowledge artifact via `targetReference` rather than a grounding context.

## Quality Dimensions

The exact 12 Quality Dimensions named by the prompt (`KnowledgeQualityDimension`):
Accuracy, Completeness, Consistency, Clarity, Readability, Structure, Freshness,
Compliance, Relevance, Traceability, Confidence, Risk — metadata labels only, attached to
`KnowledgeQualityFinding`/`KnowledgeQualityScoreMetadata`/`KnowledgeQualityRule`/
`KnowledgeQualityProfile`. No scoring implementation anywhere in this package.

## Assessment Modes

The exact 8 Assessment Modes named by the prompt (`KnowledgeQualityAssessmentMode`): Full
Assessment, Quick Assessment, Compliance Review, Editorial Review, Policy Review,
Structural Review, Metadata Review, Custom.

## Provider Abstraction

Providers are never resolved from the Registry (there is no Provider Registry bucket in
the 8-bucket spec) — `IKnowledgeQualityProvider`/`IKnowledgeQualityScoringProvider` are
wired once via `KnowledgeQualityConfig` at construction (`provider`/`scoringProvider`
fields). `start()` is the sole call site that ever invokes them, and only when they are
actually configured — absent one, `start()` still transitions the Assessment to
`Assessing` without recording any Findings/Score Metadata.

## Rule Resolution

`KnowledgeQualityResolver.resolveRule()`/`tryResolveRule()`/`resolveRules()`/
`tryResolveRules()` perform direct `RULE` Registry bucket lookups by `ruleId` — never a
collection scan. The Pipeline's Rule Resolution stage (Stage 2) resolves and attaches
every declared Rule and records Rule Usage metrics; any unresolvable declared Rule id
throws `QualityRuleException`.

## Profile / Policy / Configuration Resolution

`resolveProfile()`/`tryResolveProfile()` look up the `PROFILE` Registry bucket.
`resolvePolicy()`/`tryResolvePolicy()`/`registerPolicy()` use a dedicated in-memory map
on the Resolver (Policy is not one of the spec's 8 Registry buckets).
`resolveConfiguration()`/`tryResolveConfiguration()` look up the `CONFIGURATION` Registry
bucket. The Pipeline's Profile/Policy/Configuration Resolution stages (3/4/5) resolve and
attach each, evaluating real allow/deny Policy logic via `evaluateKnowledgeQualityPolicy()`
— throwing `QualityProfileException`/`QualityPolicyException`/
`QualityConfigurationException` respectively when a declared reference does not resolve
or a Policy denies the Request.

## Lifecycle

10 states, in the prompt's own order: Draft, Queued, Preparing, Assessing, Reviewing,
Completed, Cancelled, Failed, Archived, Destroyed. Only `Destroyed` is hard-terminal
(verified by a dedicated test asserting every state is reachable from `Draft` via BFS over
the transition table, plus a full 10×10 legality matrix test — 100 assertions).
`KnowledgeQualityLifecycle` is a read-only, query-only companion
(`states()`/`transitionsFrom()`/`isTerminal()`/`isSettled()`) to the imperative
`KnowledgeQualityStateMachine`, which is the only code allowed to change
`KnowledgeQualityAssessment.state` — every legal transition appends one immutable history
entry and stamps `startedAt`/`completedAt` on the corresponding transitions.

**Transition-table design (judgment call — the prompt lists states but not edges):**
`Draft -> Queued -> Preparing -> Assessing -> Reviewing -> Completed` is the mainline
path; `Queued`/`Preparing`/`Assessing`/`Reviewing` can additionally fail into `Failed`;
every non-settled state can also be `Cancelled` or `Destroyed` directly; `Completed`/
`Cancelled`/`Failed` all fan into `Archived`; every state has an edge into the
hard-terminal `Destroyed`, including `Archived`. The façade adds a `review()` operation
(`Assessing -> Reviewing`) not explicitly named in the prompt's operation list but
required to reach `Reviewing` before `complete()` (`Reviewing -> Completed`) — a
documented judgment call, mirroring `@aos/knowledge-generator`'s equivalent addition.

## State Machine

`KnowledgeQualityStateMachine.transition()` throws
`IllegalAssessmentTransitionException` for any edge not present in
`KNOWLEDGE_QUALITY_ASSESSMENT_STATE_TRANSITIONS`.

## Registry

One generic `KnowledgeQualityRegistry` class covers the exact 8 required buckets —
Assessment, Session, Finding, Rule, Profile, Statistics, Audit, Configuration — as a
`Map<Bucket, Map<string, Identified>>`. Never scanned: every read is a direct Map lookup
by id through `KnowledgeQualityResolver`; `list()`/`count()` exist only for
Metrics/Health sampling.

## Resolver

`KnowledgeQualityResolver` implements the exact 5 dimensions named by the prompt:
Assessment, Rule, Profile, Policy, Configuration — each with a throwing `resolveX()`
(raising `QualityNotFoundException`) and a non-throwing `tryResolveX()`.

## Validation

A strict 12-stage validator, in the prompt's own order: Identity, Metadata, Assessment,
Rule, Profile, Policy, Configuration, Lifecycle, Dependency, Statistics, Integrity, Audit.
Every stage runs and its issues are aggregated — no short-circuiting within the
Validator. The Dependency stage enforces real cross-field rules (e.g. every non-`Custom`
Assessment Mode requires at least one declared Rule or a Profile; a Policy with
`requireApproval` requires a Configuration record). The Integrity stage cross-checks
`tenantId` consistency between Context and Metadata, and Profile tenantId consistency.

**Validator "Audit" stage vs. Pipeline "Audit" stage (documented distinction):** the
Validator's Stage 12 (Audit) is a **pre-flight** field check — it confirms
`request.requestedBy` (the audit actor) and `request.createdAt` are present/well-formed
**before** an operation runs. The Pipeline's Stage 9 (Audit) is a **post-flight** side
effect — it **appends** the actual `KnowledgeQualityAssessmentAudit` entry (with
`fromState`/`toState`/`occurredAt`) **after** the operation completes, and registers it
in the `AUDIT` Registry bucket. The two never duplicate each other's work.

## Pipeline

Exactly 10 fixed stages, per the prompt:

1. **Validation** — the real 12-stage `KnowledgeQualityValidator`, fed Rule/Profile
   resolvability, resolved Policy/Configuration facts derived live from the Registry →
   throws `AssessmentValidationException`.
2. **Rule Resolution** — resolves/attaches every declared Rule id against the `RULE`
   Registry bucket → throws `QualityRuleException` if any is declared but unresolved.
3. **Profile Resolution** — resolves/attaches the declared `KnowledgeQualityProfile`
   against the `PROFILE` Registry bucket → throws `QualityProfileException`.
4. **Policy Resolution** — resolves the declared `KnowledgeQualityPolicy` and evaluates
   real allow/deny logic via `evaluateKnowledgeQualityPolicy()` → throws
   `QualityPolicyException` on denial or unresolved id.
5. **Configuration Resolution** — resolves/attaches the declared
   `KnowledgeQualityConfiguration` against the `CONFIGURATION` Registry bucket → throws
   `QualityConfigurationException`.
6. **Metadata** — stamps `KnowledgeQualityAssessmentMetadata.updatedAt`.
7. **Metrics** — records the Assessment Count and (when this run resolved them) Rule/
   Profile/Policy/Configuration Usage counters.
8. **Lifecycle** — drives the State Machine to `targetState` (skipped when no
   `targetState` is supplied, or when it already equals the current state).
9. **Audit** — appends a `KnowledgeQualityAssessmentAudit` entry and registers it in the
   `AUDIT` Registry bucket.
10. **Logging** — appends a `KnowledgeQualityAssessmentLogEntry`.

## Middleware

`quality.use(...)` — Koa-style, transport-independent, ordered, async-capable, with a
double-`next()` guard (`KnowledgeQualityMiddleware`).

## Metrics

The exact 8 fields named by the prompt: Assessment Count, Finding Count, Rule Count,
Profile Count, Average Duration, Average Score Metadata, Policy Usage, Configuration
Usage — the duration/score fields computed as real running averages, not stubs. Plus
internal `completedCount`/`failedCount`/`validationCount`/`validationFailureCount` used
for Statistics/Health/Monitoring.

## Monitoring

`KnowledgeQualityMonitoring.sample()` combines a Metrics snapshot and a Health report into
one `KnowledgeQualityDashboard`, deriving domain health from the
`validationCount`/`validationFailureCount` ratio.

## Health

5 statuses (Healthy/Warning/Degraded/Unavailable/Unknown).
`KnowledgeQualityHealth.check()` derives Registry health from bucket occupancy and domain
health from a caller-reported success/failure ratio.

## Statistics

`KnowledgeQualityStatistics` maintains its own private
`Map<KnowledgeQualityAssessmentMode, KnowledgeQualityAssessmentStatisticsSnapshot>`
(`requestedCount`/`completedCount`/`failedCount`/`lastActivityAt`) — keyed by Assessment
Mode rather than Quality Dimension, since a single Assessment always has exactly one Mode
but may span many Dimensions.

## Runtime Token

Every Assessment has a `KnowledgeQualityToken` (`kqua_` prefix — collision-free with every
sibling Knowledge package's prefix, including `kgen_`). `KnowledgeQualityManager` looks up
executions by token in an internal `Map<token, KnowledgeQualityExecution>` — never a
full-collection scan.

## Extension Points

12 interface-only contracts, zero implementations: `IKnowledgeQualityProvider`,
`IKnowledgeQualityRuleProvider`, `IKnowledgeQualityPolicyProvider`,
`IKnowledgeQualityScoringProvider`, `IKnowledgeQualityAuditProvider`,
`IKnowledgeQualityStorage`, `IKnowledgeQualityPublisher`, `IKnowledgeQualityScheduler`,
`IKnowledgeQualityReporter`, `IKnowledgeQualityCostProvider`,
`IKnowledgeQualityStreamingProvider`, `IKnowledgeQualityMetricsProvider`. Optionally wired
via `KnowledgeQualityConfig`; never required by any Assessment Operation except
`IKnowledgeQualityProvider`/`IKnowledgeQualityScoringProvider` inside `start()`. 2
additional future-readiness contracts prepare for downstream phases without implementing
them: `IKnowledgeValidatorAiQuality` (005.7M), `IEmbeddingManagerQuality` (005.7N).

## Folder Structure

| Folder           | Contents                                                                                           |
| ---------------- | -------------------------------------------------------------------------------------------------- |
| `domain/`        | 12 aggregates + Dimension/Mode/State/Session State/Execution types                                 |
| `contracts/`     | 12 interface-only extension points + 2 future-readiness contracts + validator/operations contracts |
| `errors/`        | `KnowledgeQualityException` + 13 concrete subclasses                                               |
| `context/`       | `KnowledgeQualityContext`, `createKnowledgeQualityContext()`                                       |
| `token/`         | `KnowledgeQualityToken` (`kqua_` prefix)                                                           |
| `session/`       | `KnowledgeQualitySession` — Open/Resume/Close/Cancel/Expire/Renew                                  |
| `state-machine/` | `KnowledgeQualityStateMachine` — strict FSM                                                        |
| `lifecycle/`     | `KnowledgeQualityLifecycle` — read-only Lifecycle introspection                                    |
| `registry/`      | `KnowledgeQualityRegistry` (8 generic buckets) + `KnowledgeQualityRegistryEntry`                   |
| `resolver/`      | `KnowledgeQualityResolver` — resolve by 5 dimensions                                               |
| `validator/`     | 12 validator stages + `KnowledgeQualityValidator` aggregator                                       |
| `pipeline/`      | `KnowledgeQualityPipeline` — 10-stage fixed sequence                                               |
| `middleware/`    | `KnowledgeQualityMiddleware` — `quality.use()` chain                                               |
| `factory/`       | `KnowledgeQualityFactory` + 6 sub-factories                                                        |
| `events/`        | `KnowledgeQualityEvents`, `KnowledgeQualityEventType` (10)                                         |
| `metrics/`       | `KnowledgeQualityMetrics`                                                                          |
| `health/`        | `KnowledgeQualityHealth`                                                                           |
| `monitoring/`    | `KnowledgeQualityMonitoring`                                                                       |
| `statistics/`    | `KnowledgeQualityStatistics`                                                                       |
| `manager/`       | `KnowledgeQualityManager` — the mid-level orchestrator                                             |
| `quality/`       | `KnowledgeQuality` (façade) — implements every Assessment Operation                                |
| `bootstrap/`     | `KnowledgeQualitySystem` — implements `@aos/runtime-kernel`'s `IModule`                            |
| `config/`        | `KnowledgeQualityConfig`                                                                           |

## Event Bus namespace

`knowledge.quality.assessment.created`, `.queued`, `.started`, `.completed`, `.failed`,
`.cancelled`, `.archived`, `.destroyed`, plus `knowledge.quality.finding.created` and
`knowledge.quality.report.generated` — the exact 10 events, published via the real
`@aos/event-bus` `IPublisher`.

## Known Limitations

- **All 12 named extension-point contracts have zero implementations** — by design. No
  real scoring/evaluation exists anywhere in this package; they are invoked only when a
  caller supplies one via `KnowledgeQualityConfig` — this package never does so itself.
- **`review()` is a bare Lifecycle transition** — it records no reviewer decision payload;
  a caller wanting richer review metadata should attach it via
  `KnowledgeQualityAssessmentMetadata` before calling `review()`.
- **`KnowledgeQualityResolver` ships zero registered Rules/Profiles/Policies/
  Configurations** — a caller must `registerRule()`/`registerProfile()`/
  `registerPolicy()`/`registerConfiguration()` at least once before any `resolve*()` call
  for that dimension can succeed.
- **`KnowledgeQualitySession` is a separate access-window ledger from the Assessment
  Lifecycle State Machine** — the two are not automatically kept in sync.
- **No cost tracking, no streaming, no caching** are wired by default —
  `IKnowledgeQualityCostProvider`/`IKnowledgeQualityStreamingProvider` exist as extension
  points only.

## Dependency Rules

Allowed: `@aos/kernel`/`@aos/runtime-kernel`, `@aos/shared`/`@aos/common`,
`@aos/events`/`@aos/event-bus`. Read contracts only from `@aos/knowledge-engine`,
`@aos/knowledge-generator`, `@aos/knowledge-policy` — this package never instantiates
another runtime; it also never imports a concrete class from any of those packages at
runtime.

## Persistence

None. `KnowledgeQualityRegistry`/`KnowledgeQualitySession`/`KnowledgeQualityManager`'s
execution ledger are in-memory only.

## Testing

Run `pnpm test`, `pnpm test:coverage`, `pnpm lint`, `pnpm build`, `pnpm typecheck`. See
`docs/005.7L-KNOWLEDGE-QUALITY-ENGINE-REPORT.md` for coverage numbers, known limitations,
and the readiness checklist for the next phase (005.7M Knowledge Validator AI) — **not
implemented in this package**.
