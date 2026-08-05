# Tech Stack Record — Authentication

Governs: [`docs/004-TECHNOLOGY-SELECTION-RECORD.md`](../docs/004-TECHNOLOGY-SELECTION-RECORD.md) §3.16
Mirrors scoring in: [`decision-matrix/authentication.md`](../decision-matrix/authentication.md)
Formal decision: [`adr/ADR-TSR-016-authentication.md`](../adr/ADR-TSR-016-authentication.md)

---

## 1. Objective

Choose the identity, authentication, and authorization technology satisfying Constitution §20 (Security Standards), RULE-062 ("every API endpoint MUST enforce RBAC with least-privilege defaults"), and RULE-060 (secrets never in code/config), and structurally compatible with the Tenant/Branch/User/Role model defined in DDD doc 003 §9 and its Permission Matrix (DDD §24). Authentication is a **Generic Domain** (DDD §4) — AOS does not differentiate on identity innovation, so the winning criterion is operational soundness and cost-at-scale, not feature novelty.

## 2. Requirements

- Multi-tenant identity isolation that maps cleanly onto Tenant → Branch → User → Role, not a flat user table with tenant_id bolted on.
- Native support for the eight-role class structure in DDD §24 Permission Matrix (CEO AI, COO AI, Marketing AI, Sales AI, Dealer/Admin, Sales staff, Admin ops, Manager), including the distinction between AOS-internal "Admin (ops)" break-glass access (Constitution RULE-066) and tenant-facing roles.
- Standards-based protocols (OIDC/OAuth2/SAML) so downstream services (Kong API Gateway §3.15, Dashboard, Agent Runtime) integrate via standard token validation, not a proprietary SDK dependency baked into every service.
- Fine-grained RBAC/ABAC extensibility sufficient to express the Permission Matrix's C/R/U/A/X grid per capability, including "own" scoping (e.g., Sales staff limited to owned Appointments).
- Cost structure that does not scale per-MAU/per-tenant against a target of thousands of dealer tenants × ~15 users each (cost-analysis assumption, `cost-analysis/cost-model-100-1000-10000-dealers.md` §1).
- Self-hostable, so Identity is not a hosted third party sitting outside the platform's own security/audit perimeter (Constitution §20).
- Break-glass/audit logging support for internal Admin (ops) access (RULE-066).

## 3. Candidate Technologies

| Candidate              | Type                                                                       | License                                                 |
| ---------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------- |
| **Keycloak**           | Self-hosted open-source IAM                                                | Apache 2.0                                              |
| Auth0                  | Managed SaaS IDaaS (Okta)                                                  | Proprietary, usage-metered                              |
| Clerk                  | Managed SaaS auth-as-a-feature                                             | Proprietary, usage-metered                              |
| Supabase Auth (GoTrue) | Open-core auth service, typically consumed via Supabase's managed platform | Apache 2.0 (core), platform itself is commercial hosted |

## 4. Evaluation Matrix

Scoring: 1 (worst) – 5 (best) on every dimension **except** "Vendor Lock-in Risk" and "Estimated Cost at AOS Scale", which are scored 1 (best/lowest) – 5 (worst/highest) — i.e., low numbers are good on those two rows, high numbers are good everywhere else. This is stated explicitly to avoid misreading the table.

| Dimension                                | Keycloak | Auth0 | Clerk | Supabase Auth |
| ---------------------------------------- | -------- | ----- | ----- | ------------- |
| Performance                              | 4        | 4     | 4     | 3             |
| Scalability                              | 5        | 4     | 3     | 3             |
| Reliability                              | 4        | 5     | 4     | 4             |
| Security                                 | 5        | 5     | 4     | 4             |
| Maintainability                          | 3        | 5     | 5     | 4             |
| Developer Experience                     | 3        | 5     | 5     | 5             |
| Ecosystem                                | 4        | 4     | 3     | 3             |
| Community Maturity                       | 5        | 5     | 3     | 3             |
| Licensing                                | 5        | 2     | 2     | 4             |
| Cloud Compatibility                      | 5        | 5     | 4     | 4             |
| Vendor Lock-in Risk (low=better)         | 1        | 5     | 5     | 4             |
| Estimated Cost at AOS Scale (low=better) | 2        | 5     | 4     | 3             |

Full weighted matrix with justification: [`decision-matrix/authentication.md`](../decision-matrix/authentication.md).

## 5. Benchmark

No proprietary AOS load test has been run (pre-implementation record). Directionally, per widely-reported community and vendor benchmarks: Keycloak on a modestly sized JVM instance (2–4 vCPU) has been reported handling low-thousands of token requests/second with tuned caching and an external Infinispan/DB-backed session store — sufficient headroom for AOS's 10,000-dealer × ~15-user tier where login/token-refresh volume is bursty but not sustained-peak like inference traffic. Auth0/Clerk publish SLA-backed uptime and latency figures for their managed edge but do not disclose raw internal throughput numbers; both are directionally reported as sub-100ms token issuance at the edge. These are cited as industry-reported patterns, not measured AOS figures.

## 6. Performance

Keycloak's token issuance/validation path (OIDC discovery, JWKS-based JWT validation) is stateless at the resource-server side once JWKS keys are cached — the actual per-request cost downstream services pay is a local JWT signature check, not a round trip to Keycloak, which keeps Keycloak off the hot path for the vast majority of AOS API calls (only login, refresh, and admin operations touch Keycloak directly). This is the same architecture Auth0/Clerk/Supabase Auth use. Where Keycloak differs is realm/client configuration complexity affecting cold-start login flows for large realm counts, mitigated by grouping tenants under a shared realm with per-tenant Groups rather than one realm per tenant (see §7 Security below).

## 7. Scalability

Keycloak scales horizontally behind a load balancer with a shared clustered cache (Infinispan) and an external HA Postgres for persistent storage — a well-trodden pattern for multi-thousand-realm/multi-million-user deployments reported by large enterprise Keycloak adopters. AOS's realm-per-tenant-vs-shared-realm-with-groups decision (§8) is itself a scalability lever: a shared realm with per-tenant Groups avoids the realm-count ceiling some very large Keycloak deployments have reported friction with, while still giving each dealer tenant isolated role/permission configuration. Auth0/Clerk/Supabase scale transparently as managed services but that scalability is rented, not owned, and its cost curve is the deciding factor against them (§13).

## 8. Reliability

Auth0 carries the strongest out-of-box reliability posture (mature multi-region managed SaaS with published SLAs) — acknowledged directly, not dismissed. Keycloak's reliability is achievable but owned: it requires a genuinely multi-replica deployment with its own HA persistence store from day one, which is why `risk/risk-register.md` RISK-007 flags self-hosted Keycloak as a High-severity availability risk if this discipline is skipped. This is treated as a day-one non-negotiable deployment requirement (Architecture §11 Deployment Diagram redundancy principle), not a "later hardening" task.

## 9. Security

This is the most consequential dimension for Authentication given it directly implements Constitution §20 and RULE-062.

- **Realm-based multi-tenancy model:** Keycloak's Realm is a natural fit for AOS's Tenant boundary, but the platform adopts a **shared-realm-with-per-tenant-Group** pattern rather than realm-per-dealer-tenant — realm-per-tenant becomes an administrative-overhead and cross-realm-federation problem at thousands of tenants, whereas Groups (with per-Group Role Mappings, Group-scoped Client Roles, and Group-level attribute inheritance) let each dealer tenant have its own isolated Role assignments and admin delegation (via Keycloak's fine-grained admin permissions feature) without one realm per tenant. This mirrors Architecture §12's "Row-Level Security default, database-per-tenant for Enterprise" pattern applied to identity: shared realm by default, with a dedicated realm reserved as the escape hatch for an Enterprise/Tier-1 tenant with a hard compliance requirement for full identity-plane isolation (e.g., SSO federation with the dealer's own corporate IdP).
- **RBAC mapped to DDD §24 Permission Matrix:** Keycloak's Realm Roles + Client Roles + Composite Roles model expresses the Permission Matrix's role classes directly — Dealer (Admin), Sales (staff), Manager, and AOS-internal Admin (ops) each become a Client Role scoped to the AOS API client, with Composite Roles used where a role inherits another's permissions (e.g., Manager inheriting a subset of Sales staff's read permissions). The Permission Matrix's per-capability C/R/U/A/X grid is enforced downstream at the API/Tool Manager layer (RULE-009, RULE-062) using the Role claims Keycloak issues in the access token — Keycloak's job is authenticating the subject and asserting Role claims, not implementing the capability grid itself, keeping RBAC enforcement centralized at the Gateway/Tool Manager per Architecture §25 Security Architecture rather than duplicated per service.
- **"Own"-scoped permissions** (e.g., Sales staff limited to owned Appointments/Quotations per DDD §24) are not a Keycloak concern — they are an application-layer authorization check using the authenticated `user_id` claim, consistent with Architecture §25's layered model (AuthN via Keycloak, fine-grained AuthZ at the API layer).
- **AOS-internal Admin (ops) break-glass access** (RULE-066) uses a distinct Keycloak Client Role and realm, not the tenant realm, keeping AOS's own internal operator identities fully separated from any dealer tenant's identity plane, with break-glass actions logged via Architecture §24 Logging Architecture's structured audit trail.
- Keycloak supports OIDC, OAuth2, SAML2, WebAuthn/passwordless, and brute-force detection natively, and is CVE-patched on a public disclosure cadence consistent with the Migration Strategy's expedited security-patch track (`migration/migration-and-upgrade-strategy.md` §3).
- Auth0 and Clerk both offer comparable or superior turnkey security tooling (anomaly detection, breached-password detection) as a managed convenience — acknowledged as a real DX/security-ops advantage, traded away for cost and lock-in reasons (§13).

## 10. Maintainability

This is Keycloak's weakest dimension relative to the managed alternatives: it requires the platform to own patch cycles, realm/theme configuration-as-code, upgrade testing, and HA operations, none of which Auth0/Clerk/Supabase customers must do themselves. AOS accepts this because Identity is a Generic Domain (DDD §4) where "well-operated and cost-controlled" is explicitly preferred over "best-in-class managed convenience at unsustainable per-tenant cost" (§3.16 Final Recommendation). Mitigations: realm/client configuration is managed declaratively (Terraform's Keycloak provider, consistent with §3.21 IaC decision) rather than hand-clicked in the admin console, keeping configuration reviewable and reproducible per Constitution RULE-086's IaC discipline.

## 11. Developer Experience

Auth0 and Clerk are materially ahead here — drop-in SDKs, prebuilt login UI components, and near-zero setup time for a new service to add authentication. Keycloak's DX is heavier: standard OIDC client libraries work identically once configured, but the initial realm/client/role setup and local-dev environment (a Keycloak container, seeded realm export) requires more upfront platform-team investment. This is scoped as a one-time platform-team cost (a shared, documented Keycloak client library and seeded dev-realm export used by every service) rather than a recurring per-developer tax, keeping the DX gap from compounding across the engineering org.

## 12. Ecosystem

Keycloak has a large, mature ecosystem: official Kubernetes Operator (relevant to §3.20 Orchestration), Terraform provider, broad OIDC/SAML client library coverage in every language AOS uses (TypeScript, Go, Python per §3.1), and first-class integration patterns with API gateways including Kong (§3.15) via its OIDC/JWT plugins. Auth0 and Clerk have strong ecosystems within their own SDK surface but are narrower outside it by design (they are the ecosystem).

## 13. Community Maturity

Keycloak is a long-lived (since 2014), CNCF-adjacent, Red Hat-stewarded project (as the upstream of Red Hat SSO/RH-SSO) with a large enterprise deployment base — one of the most-adopted open-source IAM projects. Auth0 (an Okta company) has strong commercial community/support maturity for its own product. Clerk and Supabase Auth are newer entrants (strong recent traction, particularly in the indie/startup/Next.js ecosystem) but have a materially shorter enterprise-deployment track record than Keycloak or Auth0.

## 14. Licensing

- **Keycloak:** Apache License 2.0 — fully open source, no feature paywall, no usage metering. This is the strongest licensing position of the four candidates.
- **Auth0:** Proprietary commercial SaaS; tiered plans gate features (e.g., advanced MFA, custom domains, enterprise SSO connections) behind higher tiers in addition to MAU-based metering.
- **Clerk:** Proprietary commercial SaaS; free tier plus MAU-metered paid tiers, with organization/multi-tenancy features gated to paid plans.
- **Supabase Auth (GoTrue):** Apache 2.0 at the open-source component level (genuinely self-hostable), but the managed Supabase platform most teams actually consume it through is a commercial, usage-metered SaaS layered on top — the open-source escape hatch exists but is not how the product is typically operated in production.

## 15. Cloud Compatibility

Keycloak runs identically on any Kubernetes cluster (EKS, GKE, AKS, self-managed) or VM, with no cloud-specific dependency — directly compatible with Architecture §11's Deployment Diagram and the multi-region DR standby model (Architecture §32), since Keycloak itself can be deployed cross-region with its clustered cache and replicated Postgres backing store. Auth0, Clerk, and Supabase are all cloud-agnostic from AOS's integration point of view (they are consumed over HTTPS/OIDC regardless of AOS's own infrastructure choice) but that also means AOS has zero control over their own DR posture — it is entirely dependent on the vendor's SLA.

## 16. Vendor Lock-in

This is a deciding factor and is treated in depth per the task brief's requirement.

- **Keycloak (score 1 — lowest risk):** Standards-based (OIDC/OAuth2/SAML) with an open-source, self-hosted deployment means AOS's own token issuance, realm configuration, and user data live entirely inside AOS's own infrastructure. Migrating away from Keycloak, should it ever be necessary, means standing up another OIDC provider and re-pointing configuration — the _protocol_ every downstream service (Kong, Dashboard, Agent Runtime) integrates against does not change, because it is a standard, not Keycloak's proprietary API.
- **Auth0 (score 5 — highest risk):** Proprietary Rules/Actions (custom login-flow logic), proprietary Management API for realm-equivalent tenant configuration, and MAU-based billing tied to Okta's platform create real switching cost beyond "just re-point the OIDC endpoint" — any custom Auth0 Action/Rule logic must be rewritten for a new provider.
- **Clerk (score 5 — highest risk):** Similarly proprietary SDK/component surface (Clerk's prebuilt UI components, organization model) that is deeper-integrated into a frontend codebase than a pure OIDC redirect flow would be, raising switching cost.
- **Supabase Auth (score 4):** Somewhat lower lock-in than Auth0/Clerk because GoTrue itself is open-source and self-hostable outside the Supabase platform, but in practice most teams consume it bundled with Supabase's Postgres/Storage/Realtime platform, and disentangling just the Auth piece from that bundle carries real migration friction.

## 17. Estimated Cost

Reference: `cost-analysis/cost-model-100-1000-10000-dealers.md`. The cost model's Compute line already folds self-hosted Keycloak's infrastructure cost into the general Kubernetes compute estimate (it is deployed as a stateless-replica service like any other platform component) — it does not appear as a separate metered line item precisely _because_ it does not have a per-user pricing dimension, which is the point of this decision.

Concretely, to make the "per-MAU/per-tenant pricing risk" of the rejected SaaS alternatives tangible against the platform's own dealer-scale assumptions (`cost-analysis` §1: ~15 users/dealer):

| Scale          | Total platform users (≈15/dealer) | Auth0-style illustrative MAU-tier cost/mo*                                                                                                                                      | Clerk-style illustrative MAU-tier cost/mo*               | Keycloak self-hosted incremental cost/mo                                                                           |
| -------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| 100 dealers    | ~1,500                            | Low-hundreds to ~$1,000+ (crosses free/starter-tier MAU ceiling almost immediately)                                                                                             | Low-hundreds (crosses free-tier MAU ceiling immediately) | Near-zero (folds into shared compute line, `cost-analysis` §3)                                                     |
| 1,000 dealers  | ~15,000                           | Solidly into enterprise-tier custom pricing — commonly quoted in the low-to-mid five-figures/mo range at this MAU band per publicly discussed enterprise IDaaS pricing patterns | Mid-four-to-low-five-figures/mo at this MAU band         | A few hundred to low-thousands/mo incremental (dedicated Keycloak node pool + HA Postgres), no per-user multiplier |
| 10,000 dealers | ~150,000                          | High five-figures to six-figures/mo territory at enterprise IDaaS list-pricing patterns — this is the disqualifying scale                                                       | High five-figures/mo territory                           | Low-thousands/mo (scales with node count, not user count)                                                          |

*These are illustrative, directionally-sourced from publicly discussed IDaaS enterprise pricing patterns (list pricing tends to move to custom-quoted "Contact Sales" tiers well before 10,000-MAU scale for both vendors) — not vendor quotes, consistent with the cost model's own stated caveat (`cost-analysis` §"Status of these figures"). The qualitative conclusion these figures support — that per-MAU SaaS pricing grows _linearly with tenant/user count_ while Keycloak's cost grows _sub-linearly with request/session volume_ (bound by compute nodes, not headcount) — is the load-bearing point, not the specific dollar figures.

This is precisely the "vendor pricing that scales worse than our own cost model" pattern the TSR's guiding philosophy (§1, principle 2) is written to avoid, and it is why Authentication is one of the categories where the SaaS-vs-self-hosted trade-off is most stark: identity is a near-pure per-seat multiplier product, and AOS's business model is per-dealer-tenant with many seats per tenant — the worst-case shape for per-MAU pricing.

## 18. Pros

- No per-MAU/per-tenant pricing ceiling; cost is compute-bound and scales with the platform's own infrastructure economics.
- Standards-based (OIDC/OAuth2/SAML), avoiding protocol-level lock-in.
- Realm/Group model maps naturally onto Tenant/Branch/Role without contortion.
- Full control over data residency for identity records — relevant for Enterprise-tier tenants with data-residency requirements (Architecture §32-adjacent concerns).
- Mature, enterprise-proven, actively maintained, Apache 2.0.

## 19. Cons

- Requires the platform to own HA, patching, and upgrade operations for a security-critical system (RISK-007).
- Heavier initial developer setup than a managed SDK-first competitor.
- Admin console/theming customization has a steeper learning curve than Auth0's/Clerk's polished dashboards.
- Smaller "batteries included" feature surface (e.g., prebuilt breached-password databases, some advanced bot-detection heuristics) than large managed IDaaS vendors.

## 20. Trade-offs

Self-hosting Keycloak trades vendor-managed convenience and best-in-class turnkey DX for durable cost control and lock-in avoidance at AOS's target scale (thousands of dealer tenants × ~15 users). This is accepted because Identity is a Generic Domain (DDD §4) — differentiated identity UX is not part of AOS's value proposition to dealers, so the "good enough, well-operated, cost-controlled" standard is the correct bar, not "best-in-class managed convenience at unsustainable per-tenant cost" (§3.16 of the master TSR, verbatim).

## 21. Final Recommendation

**Keycloak (self-hosted)** — matching the master TSR document's §3.16 Final Recommendation exactly: open-source, mature multi-tenant realm model mapping naturally onto AOS's Tenant/Branch/User/Role structure (DDD §9, §25), avoiding the per-MAU/per-tenant pricing that Auth0/Clerk/Supabase Auth all carry. Auth0 is acknowledged as superior turnkey DX for a smaller-scale product but disqualified by its cost curve at AOS's target scale. Clerk and Supabase Auth are explicitly endorsed as legitimate _early-prototype-only_ options (fast MVP velocity) but not for the production multi-tenant platform, for the same cost-at-scale reasoning plus generally weaker enterprise SSO/realm-isolation maturity than Keycloak at this writing.

**Trade-off (verbatim from master TSR):** Self-hosting Keycloak requires the platform to own its own identity infrastructure operations (patching, HA, upgrade cycles) rather than outsourcing that to a vendor; accepted given Identity is explicitly a Generic Domain (DDD §4) where "good enough, well-operated, cost-controlled" beats "best-in-class managed convenience at unsustainable per-tenant cost."

## 22. ADR Reference

[`adr/ADR-TSR-016-authentication.md`](../adr/ADR-TSR-016-authentication.md)

## 23. Migration Strategy

No migration is executed as part of this record (documentation-only per TSR scope). Named forward path, consistent with `migration/migration-and-upgrade-strategy.md`'s pattern:

- **If a specific Enterprise/Tier-1 tenant contractually requires full identity-plane isolation** (e.g., federating with the dealer's own corporate IdP under a dedicated realm) → provision a dedicated Keycloak realm for that tenant rather than migrating the whole platform, mirroring the database-per-tenant escape-hatch pattern (Architecture ADR-012).
- **If self-hosted Keycloak's operational toil (measured engineering hours) is found to exceed a managed alternative's cost at a specific dealer-count checkpoint** (re-evaluated at the same 1,000-dealer checkpoint pattern used for Kong OSS in `migration/migration-and-upgrade-strategy.md`) → because Keycloak is OIDC-standard, migrating specific tenant realms to a managed IDaaS is a re-pointing exercise for standards-compliant clients, with custom Keycloak-side logic (if any) rewritten for the target platform. This checkpoint is not currently expected to trigger given the cost analysis in §17, but is named explicitly rather than left as an open-ended "revisit later."
- Deploy Keycloak multi-replica with HA persistence from the first production environment, not deferred (RISK-007 mitigation, non-negotiable per Architecture §11).

## 24. Future Consideration

- Passwordless/WebAuthn as the default authentication method for Dealer/Admin and Manager roles, reducing credential-stuffing risk, once Keycloak's WebAuthn support is validated against AOS's target user base's device posture.
- Per-tenant SSO federation (SAML/OIDC) as a paid Enterprise-tier feature, letting a dealer group federate AOS login with their own corporate IdP — natively supported by Keycloak's Identity Brokering feature without a platform architecture change.
- Re-evaluate Auth0/Clerk as a _dev/sandbox-environment-only_ convenience layer (not production) if it measurably speeds up early-stage engineering onboarding, without touching the production identity plane.
