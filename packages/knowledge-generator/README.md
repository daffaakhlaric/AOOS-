# @aos/knowledge-generator

The AOS Enterprise Knowledge Generator AI Platform — orchestrates AI-assisted generation
of enterprise knowledge assets: knowledge generation, generation sessions, generation
jobs, generation requests, generation results (metadata only), generation metadata,
prompt references, context references, output metadata, generation policies, generation
statistics, generation audit **only**. This package owns ONLY orchestration, lifecycle,
validation pipeline, provider abstraction, and generation metadata. It MUST NEVER call
the OpenAI SDK, Claude SDK, Gemini SDK, Ollama SDK, or any provider SDK; MUST NEVER
implement inference, embeddings, vector search, RAG, memory, or workflow execution — all
real generation work is delegated through `IKnowledgeGenerationProvider`/
`IKnowledgePromptProvider`/`IKnowledgeContextProvider` interfaces this package never
implements. See `docs/PROMPT-005.7K-KNOWLEDGE-GENERATOR.md` for the explicit scope
boundary and `docs/005.7K-KNOWLEDGE-GENERATOR-AI-REPORT.md` for the readiness checklist
handed to the next phase (005.7L Knowledge Quality Engine).

## Public API

`KnowledgeGenerator`, `KnowledgeGeneratorManager`, `KnowledgeGeneratorRegistry`,
`KnowledgeGeneratorResolver`, `KnowledgeGeneratorValidator`, `KnowledgeGeneratorPipeline`,
`KnowledgeGeneratorMiddleware`, `KnowledgeGeneratorFactory`, `KnowledgeGeneratorContext`,
`KnowledgeGeneratorSession`, `KnowledgeGeneratorLifecycle`, `KnowledgeGeneratorStateMachine`,
`KnowledgeGeneratorEvents`, `KnowledgeGeneratorMetrics`, `KnowledgeGeneratorHealth`,
`KnowledgeGeneratorMonitoring`, `KnowledgeGeneratorStatistics`, `KnowledgeGeneratorSystem`
— the 18 names required by the prompt. `src/index.ts` also re-exports the full
Domain/Contracts/Errors/Validator-stage surface a caller needs to actually build and use
them, matching the curation style established by `@aos/knowledge-marketplace`. The
prompt's Public API list names only one `KnowledgeGenerator`, so the façade takes the bare
name and the read-only per-generation domain view is exported separately as
`KnowledgeGenerationRecord`.

## Quick example

```ts
import {
  KnowledgeGenerator,
  KnowledgeGenerationAssetType,
  KnowledgeGenerationMode,
  KnowledgeGenerationProviderType,
  createKnowledgeGeneratorContext,
} from "@aos/knowledge-generator";

const generator = new KnowledgeGenerator(publisher);

// Setup: register a Prompt Reference and a Context Reference (pointers only — never text/content).
generator.registerPrompt({ promptId: "prompt-1", promptVersion: "1.0.0", namespace: "sales" });
generator.registerContext({ contextId: "context-1", tenantId: "tenant-1" });

// The package NEVER ships a Provider — a caller must register one via the
// IKnowledgeGenerationProvider interface before prepare()/start() can proceed.
generator.registerProvider(KnowledgeGenerationProviderType.OPENAI, myProviderAdapter);

const context = createKnowledgeGeneratorContext({ generationId: "g-1", tenantId: "tenant-1" });

const created = await generator.createGeneration({
  context,
  title: "Q3 Sales FAQ",
  assetType: KnowledgeGenerationAssetType.FAQ,
  mode: KnowledgeGenerationMode.CREATE,
  providerType: KnowledgeGenerationProviderType.OPENAI,
  promptReferenceId: "prompt-1",
  contextReferenceId: "context-1",
  requestedBy: "user-1",
});
// created.state === "draft"

await generator.queue({ token: created.token });
await generator.prepare({ token: created.token }); // resolves Context/Prompt/Policy/Provider
const started = await generator.start({ token: created.token }); // invokes myProviderAdapter.generate()
await generator.review({ token: created.token });
const completed = await generator.complete({
  token: created.token,
  result: { providerId: "provider-instance-1", summary: "Generated 12 FAQ entries" },
});
// completed.state === "completed"
```

## Architecture

```
KnowledgeGenerator (generator/) — the public façade, composition root
  owns StateMachine + Pipeline + Middleware + Manager + Resolver + Factory + providers map
        │
        ▼
KnowledgeGeneratorPipeline (pipeline/) — 10 fixed stages
  Validation → Context Resolution → Prompt Resolution → Policy Resolution →
  Provider Resolution → Metadata → Metrics → Lifecycle → Audit → Logging
        │
        ▼
KnowledgeGeneratorStateMachine — the only code allowed to mutate KnowledgeGeneration.state
        │
        ▼
KnowledgeGeneratorResolver — resolve Generation/Prompt/Context/Policy/Session
        │
        ▼
KnowledgeGeneratorRegistry (8 generic buckets) + KnowledgeGeneratorManager
                                                  (token-keyed ledger)
        │
        ▼
KnowledgeGeneratorMiddleware — generator.use() extensibility, separate from the Pipeline
        │
        ▼
contracts/ — 12 interface-only extension points + 3 future-readiness contracts,
             zero implementations, zero real generation logic anywhere in this package
```

`KnowledgeGenerator` implements every Generation Operation (createGeneration/queue/
prepare/start/review/complete/fail/cancel/archive/destroy) as: validate → drive the State
Machine to the target state via one atomic 10-stage Pipeline call → record relevant
domain metadata → update statistics → publish the matching event → return the updated
`KnowledgeGenerationRecord`. `start()` is the **only** method that may invoke a
caller-registered `IKnowledgeGenerationProvider`, and only through its `generate()`
interface method — this package contains zero default/fallback "fake AI" implementation.
`KnowledgeGeneratorManager` is a distinct, mid-level class — composing `registry` +
`session` + `statistics` + a private token-keyed execution ledger — mirroring
`@aos/knowledge-marketplace`'s `KnowledgeMarketplace`/`KnowledgeMarketplaceManager` split.

## Domain Model

`KnowledgeGeneration`, `KnowledgeGenerationJob`, `KnowledgeGenerationSession`,
`KnowledgeGenerationRequest`, `KnowledgeGenerationResult`, `KnowledgeGenerationContext`,
`KnowledgeGenerationPromptReference`, `KnowledgeGenerationMetadata`,
`KnowledgeGenerationConfiguration`, `KnowledgeGenerationPolicy`, `KnowledgeGenerationAudit`,
`KnowledgeGenerationStatistics` — the exact 12 aggregates named by the prompt, each backed
by a Zod schema (`domain/knowledge-generation-*.ts`).

**Result-vs-content modeling (judgment call):** `KnowledgeGenerationResult` is metadata
_about_ a caller-supplied provider's output — `resultId`, `generationId`, `providerId`,
`providerType`, `completedAt`, an optional `contentLocation` pointer, an optional
caller-authored `summary`, and a free-form `outputMetadata` bag — it **never** carries the
generated content itself, since this package never generates anything.

**Prompt-vs-text modeling (judgment call):** `KnowledgeGenerationPromptReference` is a
pointer (`promptId`/`promptVersion`/`namespace`) into a prompt owned by
`@aos/prompt-runtime` (contracts only) — never the prompt text.

**Context-vs-Generator-Context naming (judgment call):** `KnowledgeGenerationContext`
(domain aggregate — a registered grounding-context reference a Request may point at) is
named distinctly from `KnowledgeGeneratorContext` (`context/` — the caller-scoped
operational context every Generation Operation runs under), matching the pattern the
prompt's own naming already implies (`KnowledgeGeneratorContext` in "Public API" vs.
`KnowledgeGenerationContext` in "Domain Model").

## Knowledge Types

The exact 20 Knowledge Types named by the prompt (`KnowledgeGenerationAssetType`): SOP,
FAQ, Product Knowledge, Sales Script, Marketing Content, HR Policy, Job Description,
Documentation, API Documentation, Technical Specification, Business Process, Workflow
Documentation, User Guide, Knowledge Base Article, Meeting Summary, Research Summary,
Proposal, Contract Template, Email Template, Custom Knowledge. Metadata labels only,
attached to a `KnowledgeGenerationRequest`.

## Generation Providers

The exact 10 Generation Providers named by the prompt (`KnowledgeGenerationProviderType`):
OpenAI, Claude, Gemini, Ollama, Azure OpenAI, AWS Bedrock, Vertex AI, OpenRouter,
LiteLLM, Custom Provider. This package ships **zero** implementations for any of them —
the enum is only a metadata tag identifying which caller-registered
`IKnowledgeGenerationProvider` handles a given Provider Type
(`generator.registerProvider(type, provider)`).

## Generation Modes

The exact 12 Generation Modes named by the prompt (`KnowledgeGenerationMode`): Create,
Rewrite, Expand, Summarize, Improve, Translate, Convert, Explain, Refactor, Merge, Split,
Custom.

## Provider Abstraction

Providers are never resolved from the Registry (there is no Provider Registry bucket in
the 8-bucket spec) — they live in a private `Map<KnowledgeGenerationProviderType,
IKnowledgeGenerationProvider>` on the façade, populated via `KnowledgeGeneratorConfig`'s
`providers` field at construction or `registerProvider()` afterward. The Pipeline's
Provider Resolution stage (Stage 5) only checks **availability** — it never invokes the
Provider. `start()` is the sole call site that ever invokes `provider.generate(request)`,
and only when a Provider is actually registered for the Request's declared
`providerType`; absent one, `start()` still transitions the Generation to `Generating`
without recording a `KnowledgeGenerationResult`.

## Prompt Resolution

`KnowledgeGeneratorResolver.resolvePrompt()`/`tryResolvePrompt()` performs a direct
`PROMPT` Registry bucket lookup by `promptId` — never a collection scan, never
constructing prompt text. The Pipeline's Prompt Resolution stage (Stage 3) resolves and
attaches the `KnowledgeGenerationPromptReference` onto the execution and records Prompt
Usage metrics; an unresolvable declared reference throws `GenerationPromptException`.

## Context Resolution

`KnowledgeGeneratorResolver.resolveContext()`/`tryResolveContext()` performs a direct
`CONTEXT` Registry bucket lookup by `contextId`. The Pipeline's Context Resolution stage
(Stage 2) resolves and attaches the `KnowledgeGenerationContext` reference and records
Context Usage metrics; an unresolvable declared reference throws
`GenerationContextException`. No embeddings, no vector search, no retrieval — metadata
presence only.

## Lifecycle

10 states, in the prompt's own order: Draft, Queued, Preparing, Generating, Reviewing,
Completed, Cancelled, Failed, Archived, Destroyed. Only `Destroyed` is hard-terminal
(verified by a dedicated test asserting every state is reachable from `Draft` via BFS over
the transition table, plus a full 10×10 legality matrix test — 100 assertions).
`KnowledgeGeneratorLifecycle` is a read-only, query-only companion
(`states()`/`transitionsFrom()`/`isTerminal()`/`isSettled()`) to the imperative
`KnowledgeGeneratorStateMachine`, which is the only code allowed to change
`KnowledgeGeneration.state` — every legal transition appends one immutable history entry
and stamps `startedAt`/`completedAt` on the corresponding transitions.

**Transition-table design (judgment call — the prompt lists states but not edges):**
`Draft -> Queued -> Preparing -> Generating -> Reviewing -> Completed` is the mainline
path; `Queued`/`Preparing`/`Generating`/`Reviewing` can additionally fail into `Failed`;
every non-settled state can also be `Cancelled` or `Destroyed` directly; `Completed`/
`Cancelled`/`Failed` all fan into `Archived`; every state has an edge into the
hard-terminal `Destroyed`, including `Archived`. The façade adds a `review()` operation
(`Generating -> Reviewing`) not explicitly named in the prompt's operation list but
required to reach `Reviewing` before `complete()` (`Reviewing -> Completed`) — a
documented judgment call, mirroring how `@aos/knowledge-marketplace` added setup helpers
beyond its named Marketplace Operations.

## State Machine

`KnowledgeGeneratorStateMachine.transition()` throws
`IllegalGenerationTransitionException` for any edge not present in
`KNOWLEDGE_GENERATION_STATE_TRANSITIONS`.

## Registry

One generic `KnowledgeGeneratorRegistry` class covers the exact 8 required buckets —
Generation, Session, Job, Prompt, Context, Policy, Statistics, Audit — as a
`Map<Bucket, Map<string, Identified>>`. Never scanned: every read is a direct Map lookup
by id through `KnowledgeGeneratorResolver`; `list()`/`count()` exist only for
Metrics/Health sampling.

## Resolver

`KnowledgeGeneratorResolver` implements the exact 5 dimensions named by the prompt:
Generation, Prompt, Context, Policy, Session — each with a throwing `resolveX()` (raising
`GeneratorNotFoundException`) and a non-throwing `tryResolveX()`.

## Validation

A strict 12-stage validator, in the prompt's own order: Identity, Metadata, Request,
Context, Prompt, Policy, Provider, Configuration, Lifecycle, Dependency, Integrity, Audit.
Every stage runs and its issues are aggregated — no short-circuiting within the
Validator. The Dependency stage enforces real cross-field rules (e.g. every non-`Custom`
Generation Mode requires a declared Prompt Reference; a Policy with `requireApproval`
requires a Configuration record). The Integrity stage cross-checks `tenantId` consistency
between Context and Metadata, and `providerType` consistency between Request and a
resolved Configuration.

**Validator "Audit" stage vs. Pipeline "Audit" stage (documented distinction, mirroring
005.7F's Configuration-stage/Validator-stage overlap):** the Validator's Stage 12 (Audit)
is a **pre-flight** field check — it confirms `request.requestedBy` (the audit actor) and
`request.createdAt` are present/well-formed **before** an operation runs. The Pipeline's
Stage 9 (Audit) is a **post-flight** side effect — it **appends** the actual
`KnowledgeGenerationAudit` entry (with `fromState`/`toState`/`occurredAt`) **after** the
operation completes, and registers it in the `AUDIT` Registry bucket. The two never
duplicate each other's work.

## Pipeline

Exactly 10 fixed stages, per the prompt:

1. **Validation** — the real 12-stage `KnowledgeGeneratorValidator`, fed
   Context/Prompt-resolvability, resolved Policy, and (only when the operation flags
   `requireProvider`) Provider-availability facts derived live from the Registry/provider
   map → throws `GenerationValidationException`.
2. **Context Resolution** — resolves/attaches the declared `KnowledgeGenerationContext`
   reference against the `CONTEXT` Registry bucket (metadata presence check only) →
   throws `GenerationContextException` if declared but unresolved.
3. **Prompt Resolution** — resolves/attaches the declared `KnowledgeGenerationPromptReference`
   against the `PROMPT` Registry bucket (never constructs prompt text) → throws
   `GenerationPromptException` if declared but unresolved.
4. **Policy Resolution** — resolves the declared `KnowledgeGenerationPolicy` and evaluates
   real allow/deny logic via `evaluateKnowledgeGenerationPolicy()` → throws
   `GenerationPolicyException` on denial.
5. **Provider Resolution** — resolves **which** registered `IKnowledgeGenerationProvider`
   would handle the Request by Provider Type; never calls it. Only mandatory
   (`GenerationProviderException` if absent) when the calling operation flags
   `requireProvider` (`prepare()`/`start()`).
6. **Metadata** — stamps `KnowledgeGenerationMetadata.updatedAt`.
7. **Metrics** — records the Generation Count and (when this run resolved them) Prompt/
   Context/Policy/Provider Usage counters.
8. **Lifecycle** — drives the State Machine to `targetState` (skipped when no
   `targetState` is supplied, or when it already equals the current state).
9. **Audit** — appends a `KnowledgeGenerationAudit` entry and registers it in the `AUDIT`
   Registry bucket.
10. **Logging** — appends a `KnowledgeGenerationLogEntry`.

## Middleware

`generator.use(...)` — Koa-style, transport-independent, ordered, async-capable, with a
double-`next()` guard (`KnowledgeGeneratorMiddleware`).

## Metrics

The exact 8 fields named by the prompt: Generation Count, Completed Count, Failed Count,
Prompt Usage, Context Usage, Policy Usage, Provider Usage, Average Duration — the last
computed as a real running average over `startedAt`/`completedAt` deltas recorded by
`complete()`, not a stub. Plus internal `validationCount`/`validationFailureCount` used
only to derive domain Health.

## Monitoring

`KnowledgeGeneratorMonitoring.sample()` combines a Metrics snapshot and a Health report
into one `KnowledgeGeneratorDashboard`, deriving domain health from the
`validationCount`/`validationFailureCount` ratio.

## Health

5 statuses (Healthy/Warning/Degraded/Unavailable/Unknown).
`KnowledgeGeneratorHealth.check()` derives Registry health from bucket occupancy and
domain health from a caller-reported success/failure ratio.

## Statistics

`KnowledgeGeneratorStatistics` maintains its own private
`Map<KnowledgeGenerationAssetType, KnowledgeGenerationStatisticsSnapshot>`
(requestedCount/completedCount/failedCount/lastActivityAt) — separate from the Registry's
`STATISTICS` bucket, which exists for callers registering their own externally computed
statistics providers.

## Runtime Token

Every Generation has a `KnowledgeGeneratorToken` (`kgen_` prefix — collision-free with
every sibling Knowledge package's prefix: `ptok_`, `stok_`, `ksrc_`, `kver_`, `kpol_`,
`kmkt_`). `KnowledgeGeneratorManager` looks up executions by token in an internal
`Map<token, KnowledgeGeneratorExecution>` — never a full-collection scan.

## Extension Points

12 interface-only contracts, zero implementations: `IKnowledgeGenerationProvider`,
`IKnowledgePromptProvider`, `IKnowledgeContextProvider`, `IKnowledgeGenerationPolicy`,
`IKnowledgeGenerationOptimizer`, `IKnowledgeGenerationCache`, `IKnowledgeGenerationStorage`,
`IKnowledgeGenerationPublisher`, `IKnowledgeGenerationAuditor`,
`IKnowledgeGenerationScheduler`, `IKnowledgeGenerationCostProvider`,
`IKnowledgeGenerationStreamingProvider`. Optionally wired via `KnowledgeGeneratorConfig`;
never required by any Generation Operation except `IKnowledgeGenerationProvider` when
`requireProvider` is flagged. 3 additional future-readiness contracts prepare for
downstream phases without implementing them: `IKnowledgeQualityEngineGenerator` (005.7L),
`IKnowledgeValidatorAiGenerator` (005.7M), `IEmbeddingManagerGenerator` (005.7N).

## Folder Structure

| Folder           | Contents                                                                                           |
| ---------------- | -------------------------------------------------------------------------------------------------- |
| `domain/`        | 12 aggregates + Asset Type/Provider Type/Mode/State/Session State/Execution types                  |
| `contracts/`     | 12 interface-only extension points + 3 future-readiness contracts + validator/operations contracts |
| `errors/`        | `KnowledgeGeneratorException` + 13 concrete subclasses                                             |
| `context/`       | `KnowledgeGeneratorContext`, `createKnowledgeGeneratorContext()`                                   |
| `token/`         | `KnowledgeGeneratorToken` (`kgen_` prefix)                                                         |
| `session/`       | `KnowledgeGeneratorSession` — Open/Resume/Close/Cancel/Expire/Renew                                |
| `state-machine/` | `KnowledgeGeneratorStateMachine` — strict FSM                                                      |
| `lifecycle/`     | `KnowledgeGeneratorLifecycle` — read-only Lifecycle introspection                                  |
| `registry/`      | `KnowledgeGeneratorRegistry` (8 generic buckets) + `KnowledgeGeneratorRegistryEntry`               |
| `resolver/`      | `KnowledgeGeneratorResolver` — resolve by 5 dimensions                                             |
| `validator/`     | 12 validator stages + `KnowledgeGeneratorValidator` aggregator                                     |
| `pipeline/`      | `KnowledgeGeneratorPipeline` — 10-stage fixed sequence                                             |
| `middleware/`    | `KnowledgeGeneratorMiddleware` — `generator.use()` chain                                           |
| `factory/`       | `KnowledgeGeneratorFactory` + 6 sub-factories                                                      |
| `events/`        | `KnowledgeGeneratorEvents`, `KnowledgeGeneratorEventType` (8)                                      |
| `metrics/`       | `KnowledgeGeneratorMetrics`                                                                        |
| `health/`        | `KnowledgeGeneratorHealth`                                                                         |
| `monitoring/`    | `KnowledgeGeneratorMonitoring`                                                                     |
| `statistics/`    | `KnowledgeGeneratorStatistics`                                                                     |
| `manager/`       | `KnowledgeGeneratorManager` — the mid-level orchestrator                                           |
| `generator/`     | `KnowledgeGenerator` (façade) — implements every Generation Operation                              |
| `bootstrap/`     | `KnowledgeGeneratorSystem` — implements `@aos/runtime-kernel`'s `IModule`                          |
| `config/`        | `KnowledgeGeneratorConfig`                                                                         |

## Event Bus namespace

`knowledge.generation.created`, `.queued`, `.started`, `.completed`, `.failed`,
`.cancelled`, `.archived`, `.destroyed` — the exact 8 events, published via the real
`@aos/event-bus` `IPublisher`.

## Known Limitations

- **All 12 named extension-point contracts have zero implementations** — by design. No
  real inference, embeddings, vector search, memory, or workflow execution exists
  anywhere in this package; they are invoked only when a caller supplies one via
  `KnowledgeGeneratorConfig`/`registerProvider()` — this package never does so itself.
- **`review()` is a bare Lifecycle transition** — it records no reviewer decision payload
  (unlike `@aos/knowledge-marketplace`'s `review()`, which records approve/reject); a
  caller wanting richer review metadata should attach it via `KnowledgeGenerationMetadata`
  before calling `review()`.
- **`KnowledgeGeneratorResolver` ships zero registered Prompts/Contexts/Policies** — a
  caller must `registerPrompt()`/`registerContext()`/`registerPolicy()` at least once
  before any `resolve*()` call for that dimension can succeed.
- **`KnowledgeGeneratorSession` is a separate access-window ledger from the Generation
  Lifecycle State Machine** — the two are not automatically kept in sync.
- **No cost tracking, no streaming, no caching** are wired by default —
  `IKnowledgeGenerationCostProvider`/`IKnowledgeGenerationStreamingProvider`/
  `IKnowledgeGenerationCache` exist as extension points only.

## Dependency Rules

Allowed: `@aos/kernel`/`@aos/runtime-kernel`, `@aos/shared`/`@aos/common`,
`@aos/events`/`@aos/event-bus`. Read contracts only from `@aos/knowledge-engine`,
`@aos/knowledge-policy`, `@aos/knowledge-versioning`, `@aos/prompt-runtime` — this package
never instantiates another runtime; in this phase it also never imports a concrete class
from any of those packages (see the report's "Dependency mapping" judgment call —
including whether `@aos/prompt-runtime` exists as a real workspace package today).

## Persistence

None. `KnowledgeGeneratorRegistry`/`KnowledgeGeneratorSession`/
`KnowledgeGeneratorManager`'s execution ledger are in-memory only.

## Testing

Run `pnpm test`, `pnpm test:coverage`, `pnpm lint`, `pnpm build`, `pnpm typecheck`. See
`docs/005.7K-KNOWLEDGE-GENERATOR-AI-REPORT.md` for coverage numbers, known limitations,
and the readiness checklist for the next phase (005.7L Knowledge Quality Engine) — **not
implemented in this package**.
