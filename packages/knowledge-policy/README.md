# @aos/knowledge-policy

The AOS Enterprise Knowledge Policy Platform — defines, validates, evaluates, and
enforces (at the metadata level) every policy governing Knowledge Assets inside AOS:
policy lifecycle, policy rules, policy evaluation, policy resolution, policy assignment,
policy scope, policy conditions, policy actions, policy metadata, policy registry, policy
statistics, and policy audit metadata **only**. This package implements no retrieval, no
runtime, no synchronization, no versioning, no provider, no embedding, no vector search,
no AI, no LLM, no workflow runtime, no agent runtime, no memory runtime, no business
execution, and no access enforcement — every algorithmic capability (real compliance
checks, real condition/action resolution, real conflict resolution, real durable storage)
is deferred to one of the 10 interface-only Extension Points. See
`docs/PROMPT-005.7I-KNOWLEDGE-POLICY.md` for the explicit scope boundary and
`docs/005.7I-KNOWLEDGE-POLICY-REPORT.md` for the readiness checklist handed to the next
Knowledge Marketplace phase.

## Public API

`KnowledgePolicy`, `KnowledgePolicyManager`, `KnowledgePolicyRegistry`,
`KnowledgePolicyResolver`, `KnowledgePolicyValidator`, `KnowledgePolicyPipeline`,
`KnowledgePolicyMiddleware`, `KnowledgePolicyFactory`, `KnowledgePolicyContext`,
`KnowledgePolicySession`, `KnowledgePolicyLifecycle`, `KnowledgePolicyStateMachine`,
`KnowledgePolicyEvents`, `KnowledgePolicyMetrics`, `KnowledgePolicyHealth`,
`KnowledgePolicyMonitoring`, `KnowledgePolicyStatistics`, `KnowledgePolicySystem` — the 18
names required by the prompt. `src/index.ts` also re-exports the full
Domain/Contracts/Errors/Validator-stage surface a caller needs to actually build and use
them, matching the curation style of `@aos/knowledge-versioning`/`@aos/knowledge-provider`.
The prompt's Public API list names only one `KnowledgePolicy` (unlike
`@aos/knowledge-versioning`, which has both `KnowledgeVersioning` and `KnowledgeVersion`),
so the façade takes the bare name `KnowledgePolicy` and the read-only per-policy domain
view is exported separately as `KnowledgePolicyRecord`.

## Quick example

```ts
import {
  KnowledgePolicy,
  KnowledgePolicyType,
  KnowledgePolicyScopeType,
  createKnowledgePolicyContext,
} from "@aos/knowledge-policy";

const policy = new KnowledgePolicy(publisher);

const context = createKnowledgePolicyContext({
  policyId: "policy-1",
  tenantId: "tenant-1",
});

const metadata = policy.factory.metadata.create({
  policyId: "policy-1",
  policyName: "Restrict External Sharing",
  policyType: KnowledgePolicyType.SHARING,
  tenantId: "tenant-1",
});

const configuration = policy.factory.configuration.create({ policyId: "policy-1" });

const created = await policy.createPolicy({ metadata, configuration, context });
// created.state === "created"

await policy.validatePolicy({ token: created.token });
const active = await policy.activatePolicy({ token: created.token });
// active.state === "active"

const { evaluation } = await policy.evaluatePolicy({
  token: created.token,
  targetId: "asset-42",
});
// evaluation.result === "pass" | "fail" | "warning" | "skip"
```

## Architecture

```
KnowledgePolicy (policy/) — the public façade, composition root
  owns StateMachine + Pipeline + Middleware + Manager + Resolver + Permission
        │
        ▼
KnowledgePolicyPipeline (pipeline/) — 8 fixed stages
  Validation → Policy Resolution → Scope Resolution → Assignment Resolution →
  Metrics → Lifecycle → Audit → Logging
        │
        ▼
KnowledgePolicyStateMachine — the only code allowed to mutate KnowledgePolicyInstance.state
        │
        ▼
KnowledgePolicyResolver — resolve Policy/Rule/Scope/Assignment/Evaluation
        │
        ▼
KnowledgePolicyRegistry (7 generic buckets) + KnowledgePolicyManager (token-keyed ledger)
        │
        ▼
KnowledgePolicyMiddleware — policy.use() extensibility, separate from the Pipeline
        │
        ▼
contracts/ — 10 interface-only extension points, zero implementations
```

`KnowledgePolicy` implements each of the 10 Policy Operations
(CreatePolicy/ValidatePolicy/ActivatePolicy/SuspendPolicy/ArchivePolicy/RestorePolicy/
DestroyPolicy/AssignPolicy/UnassignPolicy/EvaluatePolicy) as: check permission (via
`KnowledgePolicyPermission`, metadata-driven only — no real access enforcement) → drive
the State Machine to the target state via one atomic 8-stage Pipeline call → update
statistics/metrics → publish the matching event → return the updated
`KnowledgePolicyRecord`. `KnowledgePolicyManager` is a distinct, mid-level class —
composing `registry` + `session` + `statistics` + a private token-keyed execution
ledger — mirroring `@aos/knowledge-versioning`'s `KnowledgeVersioning`/
`KnowledgeVersionManager` split.

## Domain Model

`KnowledgePolicy`, `KnowledgePolicyRule`, `KnowledgePolicyScope`,
`KnowledgePolicyCondition`, `KnowledgePolicyAction`, `KnowledgePolicyAssignment`,
`KnowledgePolicyEvaluation`, `KnowledgePolicyMetadata`, `KnowledgePolicyConfiguration`,
`KnowledgePolicyPermission`, `KnowledgePolicyAudit` — the exact 11 aggregates named by the
prompt. `KnowledgePolicyRecord` is the concrete, read-only view class implementing the
`IKnowledgePolicy` domain-model contract; `KnowledgePolicyConfiguration` (in `policy/`) is
a real, enforced runtime guard over `KnowledgePolicyConfigurationRecord`;
`KnowledgePolicyPermission` (in `policy/`) is a real, grant-based evaluator over
`KnowledgePolicyPermissionGrant`.

## Policy Types

The exact 10 types named by the prompt: Access, Classification, Retention, Lifecycle,
Version, Synchronization, Visibility, Sharing, Compliance, Custom
(`KnowledgePolicyType`).

## Scope Types

The exact 9 types named by the prompt: Global, Organization, Workspace, Project,
Knowledge Base, Namespace, Folder, Asset, Version (`KnowledgePolicyScopeType`).

## Rule Engine

5 rule types, per the prompt: Allow, Deny, Require, Optional, Conditional
(`KnowledgePolicyRuleType`). A `KnowledgePolicyRule` carries an ordered list of condition
ids and action ids (both resolved through the interface-only
`IKnowledgeConditionResolver`/`IKnowledgeActionResolver` Extension Points — this package
never evaluates a condition expression or executes an action itself).
`KnowledgePolicy.evaluatePolicy()` runs a real, minimal built-in check: every **enabled**
rule with `ruleType: "deny"` on the policy produces a violation and forces the evaluation
result to `FAIL`; all other rule types are metadata-only for this phase — real
condition-driven Allow/Require/Optional/Conditional evaluation is deferred to a caller
that wires in `IKnowledgePolicyEvaluator`.

## Lifecycle

9 states, in the prompt's own order: Draft, Created, Validated, Active, Suspended,
Deprecated, Archived, Restored, Destroyed. Only `Destroyed` is hard-terminal (verified by
a dedicated test asserting every non-terminal state has a `Destroyed` edge).
`KnowledgePolicyLifecycle` is a read-only, query-only companion
(`states()`/`transitionsFrom()`/`isTerminal()`/`isSettled()`) to the imperative
`KnowledgePolicyStateMachine`, which is the only code allowed to change
`KnowledgePolicyInstance.state` — every legal transition appends one immutable history
entry and stamps `activatedAt`/`destroyedAt` on the corresponding transitions.

## State Machine

`KnowledgePolicyStateMachine.transition()` throws `IllegalPolicyTransitionException` for
any edge not present in `KNOWLEDGE_POLICY_STATE_TRANSITIONS`. The transition table — not
specified edge-by-edge in the prompt — was designed as: `Draft -> Created -> Validated ->
Active` is the mainline authoring path; `Active` fans out to
`Suspended`/`Deprecated`/`Archived`; `Suspended`/`Deprecated`/`Archived` can all
`Restore`; a `Restored` policy may re-`Activate` or `Archive`; every non-terminal state
has a direct edge to `Destroyed`.

## Registry

One generic `KnowledgePolicyRegistry` class covers the exact 7 required buckets — Policy,
Rule, Scope, Assignment, Evaluation, Statistics, Session — as a
`Map<Bucket, Map<string, Identified>>`. Never scanned: every read is a direct Map lookup
by id through `KnowledgePolicyResolver`; `list()`/`count()` exist only for Metrics/Health
sampling.

## Resolver

`KnowledgePolicyResolver` implements the exact 5 dimensions named by the prompt: Policy,
Rule, Scope, Assignment, Evaluation — each with a throwing `resolveX()` and a
non-throwing `tryResolveX()`.

## Validation

A strict 10-stage validator, in the prompt's own order: Identity, Metadata, Scope, Rules,
Conditions, Assignment, Policy Type, Configuration, Dependency, Integrity. Every stage
runs and its issues are aggregated — no short-circuiting within the Validator. The
Integrity stage additionally re-checks lifecycle-transition legality against the same
`KNOWLEDGE_POLICY_STATE_TRANSITIONS` table the State Machine enforces, so an illegal
transition is caught before the Pipeline's Lifecycle stage ever calls the State Machine.

## Pipeline

Exactly 8 fixed stages, per the prompt:

1. **Validation** — the real 10-stage `KnowledgePolicyValidator` → throws
   `PolicyValidationException`.
2. **Policy Resolution** — no-op in this package (this package registers Policies
   directly; it never dereferences a Policy id it doesn't already hold).
3. **Scope Resolution** — no-op (same rationale as Policy Resolution).
4. **Assignment Resolution** — no-op (same rationale).
5. **Metrics** — records a Policy-Count and Validation-Count sample.
6. **Lifecycle** — drives the State Machine to `targetState` (skipped when no
   `targetState` is supplied, or when it already equals the current state).
7. **Audit** — appends a `KnowledgePolicyAuditEntry`.
8. **Logging** — appends a `KnowledgePolicyLogEntry`.

Tracing (stamping a `KnowledgePolicyTrace`) also runs whenever `context.correlationId` is
present. A judgment call: stages 2–4 (Policy/Scope/Assignment Resolution) are named by the
prompt but this package owns no external Policy/Scope/Assignment store to dereference
against — every Policy/Scope/Assignment this package operates on is already fully
materialized on the `KnowledgePolicyExecution` passed in, so those three stages are
present as explicit, commented pipeline positions (preserving the exact 8-stage count and
order) rather than as dead work.

## Metrics

The exact 7 fields named by the prompt: Policy Count, Active Policy Count, Assignment
Count, Evaluation Count, Validation Count, Archive Count, Restore Count — plus an
internal `validationFailureCount` used only to derive domain Health, never exposed as an
8th "named" metric.

## Monitoring

`KnowledgePolicyMonitoring.sample()` — exact name `KnowledgePolicyMonitoring`, per the
prompt's Public API list — combines a Metrics snapshot and a Health report into one
`KnowledgePolicyDashboard`, deriving domain health from the
`validationCount`/`validationFailureCount` ratio.

## Health

5 statuses (Healthy/Warning/Degraded/Unavailable/Unknown). `KnowledgePolicyHealth.check()`
derives Registry health from bucket occupancy and domain health from a caller-reported
success/failure ratio.

## Statistics

`KnowledgePolicyStatistics` maintains its own private
`Map<KnowledgePolicyType, KnowledgePolicyStatisticsSnapshot>` (createdCount/
activatedCount/lastActivityAt) — separate from the Registry's `STATISTICS` bucket, which
exists for callers registering their own externally computed statistics providers.

## Runtime Token

Every Policy has a `KnowledgePolicyToken` (`kpol_` prefix — collision-free with every
sibling Knowledge package's prefix). `KnowledgePolicyManager` looks up executions by
token in an internal `Map<token, KnowledgePolicyExecution>` — never a full-collection
scan.

## Extension Points

10 interface-only contracts, zero implementations: `IKnowledgePolicyEvaluator`,
`IKnowledgePolicyProvider`, `IKnowledgeComplianceProvider`, `IKnowledgeConditionResolver`,
`IKnowledgeActionResolver`, `IKnowledgeScopeResolver`, `IKnowledgePolicyStorage`,
`IKnowledgePolicyPublisher`, `IKnowledgePolicyAuditProvider`,
`IKnowledgePolicyConflictResolver`. Optionally wired via `KnowledgePolicyConfig`; never
required by any Policy Operation. 4 additional future-readiness contracts prepare for
downstream phases without implementing them: `IKnowledgeMarketplacePolicy` (005.7J),
`IKnowledgeGeneratorPolicy` (005.7K), `IKnowledgeQualityPolicy` (005.7L),
`IKnowledgeValidatorAiPolicy` (005.7M).

## Folder Structure

| Folder           | Contents                                                                                           |
| ---------------- | -------------------------------------------------------------------------------------------------- |
| `domain/`        | 11 aggregates + Lifecycle State/Policy Type/Scope Type/Rule Type/Execution types                   |
| `contracts/`     | 10 interface-only extension points + 4 future-readiness contracts + validator/operations contracts |
| `errors/`        | `KnowledgePolicyException` + 14 concrete subclasses                                                |
| `context/`       | `KnowledgePolicyContext`, `createKnowledgePolicyContext()`                                         |
| `token/`         | `KnowledgePolicyToken` (`kpol_` prefix)                                                            |
| `session/`       | `KnowledgePolicySession` — Open/Resume/Close/Cancel/Expire/Renew                                   |
| `state-machine/` | `KnowledgePolicyStateMachine` — strict FSM                                                         |
| `lifecycle/`     | `KnowledgePolicyLifecycle` — read-only Lifecycle introspection                                     |
| `registry/`      | `KnowledgePolicyRegistry` (7 generic buckets) + `PolicyRegistryEntry`                              |
| `resolver/`      | `KnowledgePolicyResolver` — resolve by 5 dimensions                                                |
| `validator/`     | 10 validator stages + `KnowledgePolicyValidator` aggregator                                        |
| `pipeline/`      | `KnowledgePolicyPipeline` — 8-stage fixed sequence                                                 |
| `middleware/`    | `KnowledgePolicyMiddleware` — `policy.use()` chain                                                 |
| `factory/`       | `KnowledgePolicyFactory` + 6 sub-factories                                                         |
| `events/`        | `KnowledgePolicyEvents`, `KnowledgePolicyEventType` (10)                                           |
| `metrics/`       | `KnowledgePolicyMetrics`                                                                           |
| `health/`        | `KnowledgePolicyHealth`                                                                            |
| `monitoring/`    | `KnowledgePolicyMonitoring`                                                                        |
| `statistics/`    | `KnowledgePolicyStatistics`                                                                        |
| `manager/`       | `KnowledgePolicyManager` — the mid-level orchestrator                                              |
| `policy/`        | `KnowledgePolicy` (façade), `KnowledgePolicyPermission`, `KnowledgePolicyConfiguration`            |
| `bootstrap/`     | `KnowledgePolicySystem` — implements `@aos/runtime-kernel`'s `IModule`                             |
| `config/`        | `KnowledgePolicyConfig`                                                                            |

## Event Bus namespace

`knowledge.policy.created`, `.validated`, `.activated`, `.suspended`, `.archived`,
`.restored`, `.destroyed`, `.assigned`, `.unassigned`, `.evaluated` — the exact 10
events, published via the real `@aos/event-bus` `IPublisher`.

## Known Limitations

- **All 10 named extension-point contracts have zero implementations** — by design. No
  real compliance check, no real condition/action resolution, no real conflict
  resolution, and no real durable storage exists anywhere in this package;
  `IKnowledgePolicyEvaluator`/`IKnowledgeComplianceProvider`/`IKnowledgeConditionResolver`/
  `IKnowledgeActionResolver`/`IKnowledgeScopeResolver`/`IKnowledgePolicyStorage`/
  `IKnowledgePolicyPublisher`/`IKnowledgePolicyAuditProvider`/
  `IKnowledgePolicyConflictResolver` are invoked only when a caller supplies one via
  `KnowledgePolicyConfig` — this package never does so itself.
- **`evaluatePolicy()` only checks enabled Deny rules** — Allow/Require/Optional/
  Conditional rule types are recorded but never actually evaluated; real
  condition-driven evaluation is deferred to `IKnowledgePolicyEvaluator`.
- **`KnowledgePolicyResolver` ships zero registered Policies** — a caller must
  `createPolicy()` at least once before any `resolve*()` call can return results.
- **`KnowledgePolicySession` is a separate access-window ledger from the Policy
  Lifecycle State Machine** — the two are not automatically kept in sync.
- **`KnowledgePolicyPermission` is metadata-driven only** — "deny always wins, permissive
  by default when no grant matches" is enforced consistently, but there is no real
  authentication/authorization integration; this is not the "Access Enforcement" the
  prompt explicitly excludes.

## Dependency Rules

Allowed: `@aos/kernel`/`@aos/runtime-kernel`, `@aos/shared`/`@aos/common`,
`@aos/events`/`@aos/event-bus`, `@aos/knowledge-engine`. Read-only contracts only — never
another runtime's implementation classes, never a circular dependency.

## Persistence

None. `KnowledgePolicyRegistry`/`KnowledgePolicySession`/`KnowledgePolicyManager`'s
execution ledger are in-memory only.

## Testing

Run `pnpm test`, `pnpm test:coverage`, `pnpm lint`, `pnpm build`, `pnpm typecheck`. See
`docs/005.7I-KNOWLEDGE-POLICY-REPORT.md` for coverage numbers, known limitations, and the
readiness checklist for the next Knowledge Marketplace phase — **not implemented in this
package**.
