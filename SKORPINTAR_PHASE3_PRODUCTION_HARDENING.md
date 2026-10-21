# Phase 3 — Production hardening

Status: IN PROGRESS. Not approved for autonomous writes or Phase 4 execution.
Updated: 20 October 2026 (Asia/Jakarta).

## Verified in this session

- Migration 073 was confirmed applied by the user. Supabase read-back confirms active OWNER membership for the explicitly approved workspace.
- The second explicitly approved login account was provisioned as OWNER without removing the first membership.
- Login originally failed for two independent reasons: an old running API lacked `/api/v1/auth/context`, and the actual login email differed from the initially approved OWNER email.
- Rebuilt/restarted the API. Browser verification then reached `/campaigns` and displayed the real `SiapKPR PERJUANGAN` campaign.
- Login now checks workspace authorization before redirecting and shows a failure message instead of silently returning to the login form.
- API build and dashboard TypeScript checks pass.
- 21 focused tests pass across trusted authorization, API-key guard, and tenant repository. This is not a full regression-suite result.
- Read-only scheduler sync logs show successful Meta campaign/adset/ad retrieval. This does not establish write capability.
- Live Settings verification: selected SiapKPR account reports CONNECTED / READ_ONLY; READ_ACCOUNT, READ_CAMPAIGNS, READ_ADSETS, READ_ADS and READ_INSIGHTS all AVAILABLE. Credential source manual, version 2. Page selection is missing; creative/ad creation is UNAVAILABLE. Budget remains UNVERIFIED. Other writes remain UNKNOWN despite ads_management permission.

## Implemented foundation

### Identity and tenant boundary

`apps/aaos-api/src/modules/auth/tenant-authorization.service.ts` verifies the Supabase user and reads membership from server-controlled tables. Editable user metadata does not grant tenant, role, or superadmin access. Multiple memberships require explicit selection. Unknown roles and absent memberships fail closed.

`ApiKeyGuard` now requires both the application API key and authenticated user identity. Workspace hints cannot override trusted membership. OAuth integration initiation is restricted even when exposed through GET.

Dashboard session resolution calls the trusted backend context endpoint. Session refresh cookies are carried through route responses. The new `/api/auth/workspace` check provides explicit login feedback.

### Meta credentials

The canonical registry reads current database configuration on every resolve and fingerprints credential version, encrypted token, selected account, Page, API version, and source before cache reuse. Missing/corrupt encryption or unavailable configuration cannot fall back to global credentials.

The database trigger increments credential versions. The Settings update path verifies a candidate account before persistence and uses compare-and-swap against the inspected version, preventing a late validation from overwriting a newer configuration. Page accessibility is probed when supplied; this alone is not proof of advertising permission or Page-to-WhatsApp linkage.

OAuth no longer automatically picks the only discovered account. Explicit selection is required.

### Transport and readiness

Canonical Meta transport includes normalized safety errors, write gating, uncertain-write handling, receipt hooks, and read-back helpers. Real writes remain disabled. Capability inspection distinguishes read success from unproven writes.

Settings now exposes connection status, credential source/version, validation time, per-action capability status, and budget readiness through a protected BFF endpoint. Secrets are not included in this response.

### Currency

IDR/USD production budget conversion remains UNVERIFIED. Fixture arithmetic is not provider evidence. Budget mutation remains blocked until a controlled provider write/read-back establishes the required unit contract.

## Remaining acceptance gaps

1. Finish OAuth refresh/disconnect concurrency and status handling, including the migration trigger's DEGRADED override during disconnect.
2. Persist capability/readiness evidence tied to the credential version, including stale-result rejection.
3. Complete explicit account/Page/Instagram/WhatsApp selection and capability-aware Settings controls.
4. Complete resource ownership coverage for generic route IDs and all legacy routes.
5. Audit remaining direct writers and legacy services, including global Page/default-account assumptions.
6. Exercise transport uncertain outcomes, receipt persistence, cache rotation across processes, and read-back failure scenarios with focused tests.
7. Finish log/secret-redaction audit and regression tests for authentication, cookies, and existing protected routes.
8. Establish currency evidence or retain the explicit budget block in final acceptance.
9. Final live capability verification and production-readiness report. No real Meta write was performed for this hardening validation.

## Continuation: destination and lifecycle hardening

- Migration 074 is implemented, applied twice successfully in local PostgreSQL, and confirmed applied in Supabase by the user. It preserves DISCONNECTED when credentials are removed, increments the credential version, clears prior evidence, and resets execution tier to READ_ONLY.
- Refresh, callback persistence, and disconnect use version-conditional writes. A delayed refresh cannot restore a credential after a newer disconnect. Disconnect clears selected account and destinations as well as both token formats.
- Destination discovery no longer reads plaintext manual credentials. Existing encrypted access is reused.
- Settings has explicit Page/Instagram/WhatsApp discovery and selection. Server-side validation checks Page advertising assignment, Page–Instagram association, business WhatsApp membership, role, tenant, and credential version. Page–WhatsApp delivery linkage is still a preflight requirement.
- Live discovery for the selected SiapKPR account found the Siap KPR Page through the business fallback, but account advertising assignment is not verified. WhatsApp discovery failed for this connection. No destination was automatically selected or saved.
- Capability results are persisted against the inspected credential version; stale checks cannot overwrite newer integration state.
- Legacy superadmin token/account changes now reject and direct callers to verified Settings, preventing plaintext credentials from reappearing. Property campaign publishing no longer sources its Page from the global environment.
- Eight additional transport/money tests pass: kill switch, executor context, uncertain writes without retry, unverified receipt, budget blocking, account mismatch, and IDR/USD fixture arithmetic without production verification.

Items 1–3 in the earlier gap list have substantial implementations above, but end-to-end write acceptance is still pending. Account advertising assignment and WhatsApp discovery need correction or confirmation in Meta before completing destination acceptance. Full legacy-route/regression review remains open; do not interpret the focused tests as full production certification.

## Phase boundaries

Full ActionExecutor, campaign-operation UI/runtime replacement, autonomous actions, creative production changes, and later learning work remain outside this phase. Do not start Phase 4 automatically.

## Current disposition

- Login: VERIFIED in browser.
- Trusted membership: VERIFIED for the explicitly authorized workspace/accounts.
- Build/typecheck: PASS.
- Focused tests: 50 backend + 8 transport/currency PASS (58 total; not a full regression suite).
- Meta read: all five read capabilities VERIFIED in the live Settings panel.
- Meta write: DISABLED.
- Budget write: UNVERIFIED / BLOCKED.
- Phase 3: INCOMPLETE.

## User scope update — 21 October 2026

WhatsApp assignment/token regeneration and WhatsApp-specific live acceptance are explicitly deferred by the user. Do not request a replacement token for this work now. Keep WhatsApp capability unverified and CTWA execution blocked; this deferral does not establish readiness or remove destination preflight. Continue non-WhatsApp Phase 3 work. Page advertising assignment, non-WhatsApp write safety, and regression acceptance remain independent requirements.
