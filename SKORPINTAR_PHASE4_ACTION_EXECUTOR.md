# Phase 4 — Action Executor implementation checkpoint

Status: **IN PROGRESS. Not production-ready. Not ready for Phase 5.**

## Architecture implemented so far

`apps/aaos-api/src/modules/actions/` contains the deterministic execution core, a tenant-scoped
Supabase repository, typed action/decision routing, exact hierarchy verification and read-only
reconciliation. The ActionsModule query surface is registered in Nest; mutations are not yet wired into legacy writers.
The provider/policy ports are contracts, not live implementations. No new Meta write path is enabled.

Commands include identity, integration and credential version, policy/evidence identity, target,
before-state and frozen step intents. Approval hashes bind all of those fields. The database rejects
command/step identity edits; changing an approved proposal must eventually use a new revision.
The revision/edit workflow itself is still outstanding.

## Database

Additive migration: `apps/aaos-api/supabase/migrations/075_action_execution_ledger.sql`.
Adds `action_executions` and `action_steps`, links executions to existing `pending_agent_actions`,
and keeps migration 070 unchanged. Existing rows are not replayed or backfilled automatically.
RLS is enabled with no browser-role access. Service role owns persistence.
Migration was executed twice in a local PGlite PostgreSQL test. User confirmed manual application;
both remote tables were independently verified readable through the backend service credential (HTTP 200).

## Execution and reconciliation

- A tenant-scoped APPROVED → CLAIMED compare-and-set elects one execution.
- Step intent is persisted before submit; receipt/ID before read-back; read-back before VERIFIED.
- Lost response, receipt persistence failure, or mismatching read-back leaves UNCERTAIN.
- Re-executing an uncertain command does not claim it again.
- Reconciliation uses stored provider IDs or an exact-reference candidate lookup port. Zero/multiple
  candidates stay uncertain; this does not authorize retries.
- Complete verified steps plus successful hierarchy verification are required for VERIFIED.
- Reconciliation can confirm steps without writing to the provider. Resuming remaining steps,
  stale-worker fencing/recovery scheduling, and live candidate lookup are not wired yet.

## Hierarchy and targeting

The new verifier checks explicit positive expected counts, unique IDs, account ownership,
campaign/adset/ad relationships, creative mapping and configured status. Zero ads cannot pass this
verifier. This verifier is not yet connected to the legacy publish path: its false-success risk remains.
Configured ACTIVE is not labeled LIVE by this contract.

Property targeting now preserves all resolved cities (removed first-city truncation). Any unresolved
city or radius outside the adapter's existing supported range fails preflight instead of silently
changing approved intent. This does not certify that range for every Meta account/category.

## Validation

- 17 focused tests passed: registry/hash (2), executor/reconciliation (9), hierarchy (2), targeting (2),
  PostgreSQL migration/race/isolation/immutability (1), and the changed CampaignsService targeting
  regression (1 selected test; the other 36 in that file were not run).
- Final API TypeScript check and lint on the new action/targeting modules passed.
- No live Meta writes performed. Global write switch remains disabled; budget readiness remains blocked.
- No claim of complete repository regression coverage.

## Canonical writer and UI status

Legacy Campaigns, GoLive, AB testing and other mutation callers still require consolidation/explicit
retirement. Existing Phase 3 transport gating remains in force. Remaining bypass count has not yet
been re-audited; do not report zero. PendingActions approval has not yet been routed into this core.
Campaign Operations UI, evidence/edit drawer and real action-history endpoints are still outstanding.

## Next implementation order / remaining P0 and P1

1. Install and confirm 075; wire atomic command revision/approval, safe durable step initialization
   and canonical action transition constraints. Do not reinterpret existing APPROVED rows as permission.
2. Bind fresh membership, integration/version, capability, before-state and GrowthPolicy validation
   to the execution ports. Preserve Phase 3 blocked capabilities and stale approval rejection.
3. Bind MetaApiClient receipt callbacks and account-scoped read-back, activity/audit persistence,
   status no-op semantics and per-action timeout handling.
4. Route PendingActions through the typed registry and expose propose/approve/edit/execute/detail APIs.
5. Freeze CampaignCreation plans, seed exact dependency steps, implement restart fencing and resumable
   missing-child execution. Reroute/disable legacy writers; connect hierarchy verifier to publish.
6. Enforce exact-artifact QA gate; legacy image QA alone must not authorize publishing.
7. Connect CampaignWorkspace/Detail, BFF routes, evidence, edits, progress, receipts, history and rollback.
8. Add scheduler reconciliation hook and full regression/fault tests; conduct explicitly scoped live
   acceptance only when Phase 3 capabilities allow it. WhatsApp/token regeneration remains deferred.

Phase 5 strategy redesign and Phase 6 Kai rebuild have not started.

## Continuation after remote migration confirmation

- Added tenant-scoped `GET /api/v1/actions` (latest 50) and `GET /api/v1/actions/:id`.
  These expose persisted states/step progress, not inferred provider success. Claim tokens,
  arbitrary intent/payload and raw provider responses are omitted from the public DTO.
- Existing approve/reject controllers now use the trusted session user ID, ignoring body.decidedBy.
- 18 action/actor tests passed in this continuation; API typecheck passed.
- At this checkpoint runtime bindings were pending; see the subsequent execution update below.

## 22 October 2026 — explicit ledger approval

- Added `POST /api/v1/actions/:id/approve` for existing frozen status/budget commands. Request carries
  the exact command hash; actor and workspace come from trusted session context.
- Approval checks command hash, tenant/workspace, evidence reference, policy revision/kill switch/
  action permission, integration identity, credential version and single selected account. Provider
  before-state is read back; policy/integration are rechecked before the atomic approval update.
- Response explicitly requires execution preflight (`EXECUTION_PREFLIGHT_REQUIRED`). Approval does not
  invoke Meta mutations, claim execution, or lift budget/WhatsApp restrictions.
- Campaign create/publish approval is not exposed by this endpoint. Proposal creation, editing and
  the PendingActions queue bridge still need implementation. The evidence reference is required but
  its underlying assessment lookup and full execution policy evidence checks remain outstanding.
- Running API query route was smoke-tested without credentials: JSON 401, not a 404 page.
- Continuation validation: 23 focused tests passed; API typecheck, actions lint and build passed.

## 22 October 2026 — guarded status execution and Campaign approval panel

- Bound the canonical executor to MetaApiClient for human campaign pause: current membership,
  policy version, kill switch, connection identity, credential version, selected account, capability
  freshness and explicitly allowed execution tiers are rechecked. Unknown tiers and WRITE_TESTING
  cannot execute through this production endpoint. The server write switch remains mandatory.
- Added `POST /api/v1/actions/:id/execute`. Provider receipts are persisted and state is read back.
  An already-paused campaign is verified without another write. A lost write response remains
  UNCERTAIN and cannot be retried through approval/execution.
- Added the Campaigns approval panel, detail drawer and authenticated BFF routes. Approval and
  execution are sequential; errors never become success optimistically. Origin, role, payload and
  trusted tenant forwarding are covered by route tests. Evidence is still a reference, not a full
  assessment display. No automatic recommendation ingestion is implied by the empty queue.
- Validation: 33 focused backend action tests and 6 BFF security tests passed. Both API and dashboard
  TypeScript checks passed. These are fixture tests, not proof of live Meta writes or visual QA.
- Resume remains blocked pending tracking/learning evidence. Budget changes, hierarchy creation/
  publishing, automatic proposals, revision editing, legacy writer consolidation, Activity wiring
  and scheduled reconciliation remain incomplete. Phase 4 is IN PROGRESS. No Meta writes enabled.

## Scheduler recommendation bridge (incremental)

- `PendingActionsService.enqueueRecommendation` now passes the persisted queue row to
  `ActionProposalService`. Only PAUSE campaign recommendations currently produce ledger plans.
  Assessment lookup is scoped to tenant, campaign and assessment ID; the stored decision must match.
  Current ACTIVE status and account ownership are verified through the canonical Meta reader.
- The queue ID is reused as action ID. Repeated preparation returns the existing validated plan;
  concurrent insertion uses the unique ledger identity. Partial step persistence fails closed at
  plan validation, rather than being reported as a complete plan. Atomic plan insertion remains open.
- The persisted assessment reason is frozen in the command and displayed in the approval drawer.
- This is wired to the existing V2 scheduler recommendation path, not a backfill or forced live run.
  SCALE/creative/workflow recommendations retain their existing review rows without executable plans.
  Samantha-origin execution remains blocked pending full execution evidence binding.
- Validation: 5 proposal tests and 27 existing PendingActions regression tests pass; API build,
  actions lint and dashboard TypeScript checks pass. No live scheduler run or Meta mutation was
  performed as part of these tests. No additional migration is needed for this bridge.

## Evidence revalidation

- Samantha-origin approval and execution preflight now re-read the tenant/campaign-scoped
  assessment, require the same PAUSE decision and frozen reason, reject invalid/future timestamps
  or age over 24 hours, and reject a superseded assessment. Database failures fail closed.
- This is assessment consistency validation, not verification of tracking health or learning state.
  The existing automated-status execution block remains until those signals are wired.
- 23 focused evidence/approval/policy tests passed. No migration or live Meta mutation was required.

## Live learning preflight

- Added canonical MetaApiClient read of campaign ad sets before Samantha execution. Campaign/account
  identity, unique IDs, complete pagination coverage and reported learning status are checked.
  LEARNING/LEARNING_LIMITED, unknown states, missing data and API errors fail closed. Paginated
  collections currently block rather than asserting partial data represents the entire campaign.
- TrackingHealth remains explicitly unavailable in the current assessment producer. Passing learning
  does not bypass that missing evidence: execution still returns TRACKING_UNVERIFIED.
- 11 learning tests and 9 policy-context tests passed; API build passed. No live writes or migration.

## Read-only execution readiness

- Added `GET /api/v1/actions/:id/preflight` and the matching authenticated dashboard BFF route.
  It validates tenant/workspace, executable state, command hash, exact persisted step plan,
  current execution guards and provider before-state. It never claims, approves or mutates.
- Campaign drawer now requires a successful preview for the same action/hash before enabling
  Approve & Execute. The preview exposes the first blocking guard; it is not a capability grant
  and execute still revalidates. Unexpected exception details are redacted.
- Existing CAPI intelligence is global/config-scoped and is not accepted as campaign-specific
  tracking evidence. TRACKING_UNVERIFIED therefore remains a real unresolved integration gap.
