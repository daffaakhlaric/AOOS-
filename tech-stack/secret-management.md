# Tech Stack Record — Secret Management

**Category:** §3.22 of [`004-TECHNOLOGY-SELECTION-RECORD.md`](../docs/004-TECHNOLOGY-SELECTION-RECORD.md)
**ADR Reference:** [`adr/ADR-TSR-022-secret-management.md`](../adr/ADR-TSR-022-secret-management.md)
**Decision Matrix:** [`decision-matrix/secret-management.md`](../decision-matrix/secret-management.md)
**Status:** ACTIVE — Final

---

## Objective

Choose the secrets store satisfying Constitution RULE-060 ("Secrets MUST NOT be stored in code, config files, or version control; only in a Secrets Manager") and, more specifically, the Tool Contract's `authentication` field (`method`, `secret_ref`, `scope`), which requires that every Tool's credential to its external system (CRM, WhatsApp/Meta, ad platforms, payment processors, etc.) be resolved from a Secrets Manager at call time — never embedded in the Tool manifest, Agent code, or version control (Tool Contract §4 invariant: "`status = active` REQUIRES `authentication.secret_ref` to resolve against the Secrets Manager at publish-validation time").

## Requirements

- Per-invocation credential resolution at Tool-call time, not a build-time or deploy-time secret injection only — the Tool Contract's model requires `secret_ref` to be a live pointer resolvable at runtime, not a baked-in value.
- Fine-grained, per-tenant and per-Tool access policy — a multi-tenant platform must guarantee Tenant A's Tool credentials are never resolvable by a request/Tool-invocation scoped to Tenant B (same isolation principle as DDD §25, applied to secrets).
- Dynamic/short-lived credential generation where the underlying system supports it (e.g., time-boxed database credentials, rotated API tokens), to minimize the blast radius of a leaked static secret (Constitution §20.2/§20.8).
- Full audit logging of every secret read — who/what resolved which secret, when — directly supporting Constitution RULE-066/§20.8 (break-glass access logged and auditable).
- Self-hostable, to avoid a third-party vendor sitting in the credential-resolution path for every Tool call across every tenant (same vendor-lock-in-avoidance principle applied to LiteLLM in §3.10 and Keycloak in §3.16).

## Candidate Technologies

- **HashiCorp Vault** (self-hosted or HCP Vault managed)
- **AWS Secrets Manager** (cloud-native, AWS-only)
- **Doppler** (SaaS secrets platform, strong developer-environment DX)
- Also considered and folded into the discussion rather than treated as fully separate candidates: **Azure Key Vault / GCP Secret Manager** (same category as AWS Secrets Manager — single-cloud-native secret stores), **Kubernetes Secrets** (base64-encoded, not encrypted at rest by default — explicitly insufficient on its own per Constitution §20.2, only usable as a delivery mechanism fed by one of the above, never as the system of record).

## Evaluation Matrix

Scoring: 1 (worst) – 5 (best) for every dimension except **Vendor Lock-in Risk** (1 = highest lock-in risk, 5 = lowest) and **Estimated Cost** (1 = most expensive at AOS's scale, 5 = cheapest).

| Dimension                                       | Vault              | AWS Secrets Manager                             | Doppler                               |
| ----------------------------------------------- | ------------------ | ----------------------------------------------- | ------------------------------------- |
| Performance (secret-read latency)               | 4                  | 5                                               | 4                                     |
| Scalability (per-tenant/per-Tool secret volume) | 5                  | 4                                               | 3                                     |
| Reliability (self-managed HA required)          | 4                  | 5 (AWS-managed)                                 | 4                                     |
| Security (dynamic secrets, fine-grained policy) | 5                  | 3                                               | 3                                     |
| Maintainability                                 | 3 (own ops burden) | 5                                               | 4                                     |
| Developer Experience                            | 3                  | 3                                               | 5                                     |
| Ecosystem (integrations, client libraries)      | 5                  | 4                                               | 3                                     |
| Community Maturity                              | 5                  | 5 (AWS-backed)                                  | 3                                     |
| Licensing                                       | 3 (BSL, see below) | 5 (proprietary SaaS, not redistributed)         | 3 (proprietary SaaS)                  |
| Cloud Compatibility (multi-cloud)               | 5                  | 1 (AWS-only)                                    | 5                                     |
| Vendor Lock-in Risk                             | 4                  | 1                                               | 2                                     |
| Estimated Cost (at 10,000-dealer scale)         | 4                  | 2 (per-secret + per-API-call pricing compounds) | 2 (per-seat/per-project SaaS pricing) |

## Benchmark

No AOS-specific benchmark has been run (pre-implementation decision record). Directionally: Vault's in-memory-cached read path is sub-10ms for typical policy-authorized reads under normal load, per widely reported operational experience; AWS Secrets Manager's read latency is typically comparable (single-digit-to-low-double-digit milliseconds) as a managed API call within the same AWS region. Both are fast enough to sit in the Tool Manager's per-invocation credential-resolution path (Tool Contract §12.5) without becoming the dominant latency contributor relative to the external API call the Tool is about to make.

## Performance

Both Vault and AWS Secrets Manager are architected for the request pattern the Tool Contract needs: a fast, authenticated, policy-checked read of one secret per Tool invocation. Vault additionally supports response caching at the client-agent layer for further latency reduction on high-frequency Tools, at the cost of a (bounded, configurable) staleness window that must be weighed against the freshness benefit of dynamic secrets.

## Scalability

Vault's namespace and policy-path model (e.g., `secret/<tenant_id>/<tool_id>`) scales cleanly to thousands of tenants and hundreds of Tool types without a structural ceiling; its KV secrets engine and dynamic-secret engines (database, cloud-provider) are both designed for exactly this per-tenant, per-service secret-sprawl pattern. AWS Secrets Manager scales well operationally (it's a managed AWS service) but its secret-count-based pricing (see Estimated Cost) becomes a genuine cost concern at AOS's per-tenant-per-Tool secret volume, unlike Vault's infrastructure-bound cost model.

## Reliability

Vault requires the platform to operate its own HA deployment (multiple replicas, a storage backend such as Integrated Storage/Raft or Consul, unseal/auto-unseal configuration) — a real operational burden, directly analogous to Keycloak's HA requirement flagged in `risk/risk-register.md` RISK-007. AWS Secrets Manager is fully managed by AWS with no self-operated HA burden, a genuine reliability-with-less-effort advantage, but only within AWS's own SLA and only for AWS-hosted workloads.

## Security

**This is the decisive dimension for this category.** Vault's **dynamic secrets** capability (its database secrets engine can mint a short-lived, uniquely-scoped PostgreSQL/CockroachDB credential per lease, automatically revoked on expiry) is a materially stronger security posture than any static-secret store (AWS Secrets Manager, Doppler) can offer natively — a leaked dynamic credential has a bounded, typically short, lifetime rather than persisting until someone notices and manually rotates it. This directly serves Constitution §20.2 and §20.8 (least-privilege, auditable access).

For the **Tool Contract's `authentication` field resolution** specifically (RULE-060): each Tool manifest's `authentication.secret_ref` resolves to a Vault path scoped by `permission_scope` and tenant; Vault's policy engine (HCL-based ACL policies keyed on the calling identity — here, the Tool Manager's own service identity plus the invoking tenant context) enforces that a Tool invocation on behalf of Tenant A can only resolve secrets under Tenant A's path, never Tenant B's — the storage-layer secret-isolation equivalent of DDD §25's RLS tenant isolation applied to credentials rather than data rows. Every resolution is written to Vault's audit log (who/what identity, which path, when, success/failure), satisfying RULE-066's auditability requirement for the credential-access class specifically (distinct from, but complementary to, the general human-access audit logging RISK/RULE already covers). At publish-validation time, the Tool Registry performs the Tool Contract invariant check ("`secret_ref` MUST resolve against the Secrets Manager") by issuing a policy-scoped Vault read (or a dry-run existence check) before allowing `status` to transition to `active` — a Tool whose declared `secret_ref` does not resolve is refused registration, exactly as the contract requires.

AWS Secrets Manager and Doppler both support static-secret storage with encryption at rest and IAM/API-token-based access policy, satisfying the baseline RULE-060 requirement, but neither offers Vault's dynamic-secret generation as a first-class, broad-engine capability (AWS Secrets Manager has limited native rotation support for specific AWS-integrated services like RDS, not the general-purpose dynamic-secret-engine model Vault provides across arbitrary backends).

## Maintainability

Vault is the highest-maintenance-burden option of the three — it is a stateful service the platform must operate, patch, and upgrade (unseal keys, storage backend health, policy sprawl management as Tool/tenant count grows). AWS Secrets Manager and Doppler both externalize that operational burden to their respective vendors, a genuine maintainability advantage traded against the security and lock-in considerations above.

## Developer Experience

Doppler's DX is the strongest of the three for local development — a simple CLI that injects secrets into a local process's environment without ever writing them to disk, well-suited to engineers working across many services locally. Vault's DX for local development is comparatively heavier (running a local Vault dev-mode instance, or connecting to a shared dev Vault cluster with its own auth flow) — this is precisely why Doppler is retained for development-environment secret distribution specifically (see Final Recommendation), separate from the production custody decision.

## Ecosystem

Vault has first-party or well-maintained community integrations for essentially every technology in this TSR (Kubernetes auth method, Terraform provider for provisioning Vault policies as code — directly composing with §3.21's IaC decision, database secrets engines for Postgres/CockroachDB, PKI engine for internal TLS if ever needed). AWS Secrets Manager's ecosystem is deep but AWS-scoped. Doppler's ecosystem is oriented around CI/CD and local-dev integrations (GitHub Actions, Docker, common language SDKs) rather than deep infrastructure-secret-engine integrations.

## Community Maturity

Vault (HashiCorp, since 2015) has the largest, most mature community and the deepest body of published operational practice among the three, including extensive prior art on exactly the multi-tenant-policy-path pattern AOS needs. AWS Secrets Manager benefits from AWS's own scale and documentation but is narrower in scope (secret storage/rotation only, not a general secrets-engine platform). Doppler is the youngest and smallest of the three, appropriate for its scoped role here.

## Licensing

**HashiCorp Vault is licensed under the Business Source License (BSL) 1.1** as of the same 2023 relicensing that affected Terraform (§3.21) — the same category of licensing-risk note applies here: not a practical restriction on AOS using Vault to secure its own infrastructure, but worth tracking given the broader industry trend. **OpenBao** (the Linux-Foundation-governed, Mozilla-Public-License-2.0 fork of Vault, created in direct response to the same relicensing event that produced OpenTofu) is the license-safe equivalent and a documented fallback, consistent with the OpenTofu fallback named in §3.21. **AWS Secrets Manager** is a proprietary managed service (no redistribution licensing concern, since it is never self-hosted or forked — usage is governed by the AWS Customer Agreement, standard for any AWS service). **Doppler** is a proprietary SaaS product under its own commercial terms of service.

## Cloud Compatibility

Vault runs identically on any cloud or on-prem environment (Kubernetes, VMs, bare metal), making it the only one of the three candidates compatible with AOS's full deployment footprint including self-hosted/on-prem Enterprise tenants requiring data-residency isolation (Architecture §32, same rationale as MinIO's role in §3.13). AWS Secrets Manager is categorically AWS-only. Doppler is cloud-agnostic as a SaaS control plane but still introduces a third-party network dependency regardless of where AOS's workloads run.

## Vendor Lock-in

AWS Secrets Manager carries the highest lock-in risk of the three — adopting it as the primary secrets store would tie AOS's entire credential-resolution path to AWS specifically, in direct tension with the TSR's stated multi-cloud posture (R2 default + S3 fallback + MinIO self-hosted, per §3.13) and Architecture §32's DR requirement to be rebuildable in a standby region that may not even be AWS. Doppler carries moderate lock-in risk as a third-party SaaS vendor sitting in the credential-resolution path for every Tool call platform-wide — a materially larger blast radius than Doppler's intended scope (development-environment convenience) justifies for production. Vault, being self-hostable and open-source-licensed (modulo the BSL note above, with OpenBao as a fallback), carries the lowest lock-in risk of the three.

## Estimated Cost

Per `cost-analysis/cost-model-100-1000-10000-dealers.md`, secret management is not broken out as its own top-level cost line (it is a small fraction of the Compute Infrastructure line, since Vault runs as a modestly sized HA cluster of stateful pods on the same Kubernetes footprint as everything else). Directionally: a self-hosted Vault HA cluster (3-node Raft-backed) costs on the order of a small fraction of the Compute Infrastructure budget at every scale tier — materially cheaper than AWS Secrets Manager's per-secret-per-month plus per-10,000-API-calls pricing pattern once multiplied across thousands of tenants × dozens of Tool types × per-invocation resolution frequency, which is exactly the "many small metered charges compound at multi-tenant SaaS scale" cost-risk pattern this TSR consistently avoids (same reasoning family as R2 vs. S3 egress in §3.13 and Grafana Stack vs. Datadog in §3.23). Doppler's per-seat/per-project SaaS pricing is reasonable for a small engineering team's development-environment usage (its recommended scope here) but was never evaluated for production per-invocation-scale usage, since it is not recommended for that role.

## Pros

**Vault:** dynamic secrets (strongest security posture of the three); fine-grained per-tenant/per-Tool policy engine matching the Tool Contract's model precisely; full audit logging; self-hostable on any cloud including on-prem Enterprise tenants; infrastructure-bound cost scales predictably.
**AWS Secrets Manager:** fully managed, no HA operational burden; fast, simple integration for AWS-native workloads.
**Doppler:** excellent local-development DX; simple CLI-based secret injection; no infrastructure to operate.

## Cons

**Vault:** real operational burden (HA, unseal, upgrades) — the platform now owns another stateful service, on top of Keycloak, Postgres, NATS, Temporal, and everything else already named across this TSR; BSL licensing note (mitigated by OpenBao).
**AWS Secrets Manager:** AWS-only (fails the multi-cloud requirement outright as a primary choice); per-secret/per-API-call pricing compounds unfavorably at thousands-of-tenant scale; no dynamic-secret engine breadth.
**Doppler:** third-party SaaS vendor in the credential path is not appropriate for production custody of a multi-tenant enterprise platform's secrets; smaller company/community than HashiCorp, a business-continuity risk if relied upon beyond its intended dev-only scope.

## Trade-offs

Choosing Vault as primary accepts a real, ongoing operational cost (another HA stateful service to run) in exchange for the security model (dynamic secrets, fine-grained per-tenant policy, full audit trail) that most completely satisfies both RULE-060 and the Tool Contract's `authentication` field resolution semantics — the same "operational burden accepted for a first-class match to our own Contract model" trade-off pattern already applied to Keycloak (§3.16) and Temporal (§3.9) elsewhere in this TSR. Using AWS Secrets Manager as primary would be simpler operationally but would both violate the multi-cloud requirement and forfeit dynamic secrets; it remains an acceptable _simpler default_ only for a team already fully single-cloud-committed and willing to defer Vault's complexity, exactly as the master TSR states — not a general recommendation.

## Final Recommendation

**HashiCorp Vault** (self-hosted or HCP Vault managed) as the primary secrets store — matching TSR §3.22 exactly. Its dynamic secrets, fine-grained per-tenant/per-Tool access policies, and audit logging match the Tool Contract's per-invocation credential resolution model and Constitution §20's least-privilege mandate most completely of any candidate. **A cloud-native Secrets Manager (e.g., AWS Secrets Manager)** is an acceptable simpler default only for teams already fully committed to a single cloud provider and wanting to defer Vault's operational complexity until it is clearly needed — not the default recommendation for AOS's stated multi-cloud posture. **Doppler is recommended for development-environment secret distribution only** — its excellent local-dev DX is valuable, but production secret custody for a multi-tenant enterprise SaaS should not sit with a smaller third-party vendor by default.

## ADR Reference

[`adr/ADR-TSR-022-secret-management.md`](../adr/ADR-TSR-022-secret-management.md)

## Migration Strategy

No migration is currently triggered. If a team starts on AWS Secrets Manager for early-MVP simplicity (an acceptable deferral per the recommendation above, not a contradiction of it), the migration path to Vault should be planned before the Tool Registry's `secret_ref` format is finalized — using a Vault-path-shaped reference convention (`vault:secret/data/<tenant_id>/<tool_id>/<key>`) from day one, even if temporarily backed by a thin adapter resolving against AWS Secrets Manager, avoids a Tool Contract schema migration later; only the resolution backend changes, not the reference format every Tool manifest already carries. If BSL terms become a practical concern, OpenBao is the low-friction fallback (Vault-API-compatible fork), following the same pattern as the OpenTofu fallback in `tech-stack/iac.md`.

## Future Consideration

Evaluate HCP Vault (HashiCorp's managed Vault offering) as a middle-ground at a future cost/ops checkpoint if self-hosted Vault's HA operational burden proves heavier than budgeted, mirroring the Grafana Cloud middle-ground pattern used for Monitoring (§3.23). Track OpenBao's feature/security-patch parity with Vault over time as a standing licensing-risk mitigation option, consistent with the OpenTofu tracking note in `tech-stack/iac.md`.
