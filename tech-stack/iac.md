# Tech Stack Record — Infrastructure as Code (IaC)

**Category:** §3.21 of [`004-TECHNOLOGY-SELECTION-RECORD.md`](../docs/004-TECHNOLOGY-SELECTION-RECORD.md)
**ADR Reference:** [`adr/ADR-TSR-021-iac.md`](../adr/ADR-TSR-021-iac.md)
**Decision Matrix:** [`decision-matrix/iac.md`](../decision-matrix/iac.md)
**Status:** ACTIVE — Final

---

## Objective

Choose the Infrastructure-as-Code tooling that provisions and versions every piece of infrastructure named across this TSR — Kubernetes clusters (§3.20), managed PostgreSQL/CockroachDB (§3.4), Valkey (§3.6), NATS JetStream (§3.7/§3.8), Vault (§3.22), Kong (§3.15), Keycloak (§3.16), the Grafana LGTM stack (§3.17/§3.23), object storage buckets (§3.13), and network/VPC/IAM primitives underneath all of it — satisfying Constitution RULE-086 (all infrastructure defined as code, no manual production console changes) and Architecture §32's disaster-recovery requirement that a standby region be deterministically rebuildable from source, not from institutional memory.

## Requirements

- Declarative, version-controlled infrastructure definitions that can be code-reviewed like application code (Constitution §22 Documentation Standards, §24 Deployment Standards).
- Multi-cloud / multi-provider capability, since the TSR's own decisions (Cloudflare R2 default + AWS S3 fallback, managed Postgres across potential providers, Kubernetes on any of EKS/GKE) already span more than one cloud vendor's API surface.
- Deterministic, idempotent `plan`/`apply` semantics so a re-run against unchanged infrastructure produces no drift — a hard requirement for Architecture §32's "rebuild in a standby region" DR scenario.
- State management that supports team-scale concurrent changes safely (locking, remote state) without requiring a bespoke in-house solution (Constitution §1.2, don't reinvent solved problems).
- A large enough operational talent pool that DR rebuild or incident response is not bottlenecked on one specialist engineer's tribal knowledge.
- Integration with the CI/CD decision (§3.18, GitHub Actions + ArgoCD) — IaC provisions the clusters and platform services that ArgoCD then deploys application workloads onto; the two must compose cleanly, not compete.

## Candidate Technologies

- **Terraform** (HashiCorp, HCL-based)
- **Pulumi** (general-purpose-language-based: TypeScript, Go, Python, C#)
- **AWS CloudFormation / CDK** — considered and excluded early as single-cloud-only, disqualified against the multi-cloud requirement above (R2 + S3 + potential GCP-hosted Kubernetes) without further discussion.
- **OpenTofu** (Terraform fork) — noted as a licensing-equivalent alternative to Terraform itself, discussed under Licensing below rather than as a fully separate candidate, since it is HCL-compatible and functionally near-identical at present.

## Evaluation Matrix

Scoring: 1 (worst) – 5 (best) for every dimension except **Vendor Lock-in Risk**, where 1 = highest lock-in risk (worst) and 5 = lowest lock-in risk (best); and **Estimated Cost**, where 1 = most expensive and 5 = cheapest at AOS's target scale.

| Dimension                                                 | Terraform | Pulumi |
| --------------------------------------------------------- | --------- | ------ |
| Performance (plan/apply speed at large state)             | 4         | 4      |
| Scalability (state size, module count, multi-cluster)     | 5         | 4      |
| Reliability (mature state locking, provider stability)    | 5         | 4      |
| Security (secrets-in-state handling, provider auth model) | 4         | 4      |
| Maintainability (module reuse, readability at scale)      | 4         | 4      |
| Developer Experience                                      | 3         | 5      |
| Ecosystem (provider count, module registry depth)         | 5         | 4      |
| Community Maturity                                        | 5         | 4      |
| Licensing                                                 | 3         | 5      |
| Cloud Compatibility (multi-cloud provider breadth)        | 5         | 5      |
| Vendor Lock-in Risk                                       | 4         | 4      |
| Estimated Cost (at AOS scale)                             | 4         | 3      |
| **Weighted relevance to AOS's DR/rebuild requirement**    | 5         | 3      |

**Reading the DX row:** Pulumi's use of general-purpose languages (including TypeScript, AOS's primary language per §3.1) gives it a materially better day-to-day authoring experience — real loops/conditionals/functions instead of HCL's more limited expression language, and the ability to share types with application code. This is a genuine, acknowledged advantage, not a dismissed one.

## Benchmark

No AOS-specific benchmark has been run (pre-implementation decision record). Directionally, both tools' `plan`/`apply` performance is dominated by provider-API round-trip latency (cloud API calls), not the tool's own engine — published community reports and HashiCorp/Pulumi's own materials suggest comparable wall-clock apply times for equivalent infrastructure graphs at moderate scale (hundreds of resources); Terraform's larger user base means more publicly documented large-state (thousands-of-resources) performance tuning guidance (state splitting, `-target`, workspace partitioning) exists for it than for Pulumi, which is a maturity-of-guidance advantage rather than a proven raw-engine speed advantage.

## Performance

Both tools' core loops (build a dependency graph, diff desired vs. actual state, apply deltas) are architecturally similar. Terraform's HCL is interpreted by its own graph engine; Pulumi's SDK-language programs are executed to produce a resource graph consumed by the same category of engine. Neither is expected to be a bottleneck relative to the cloud provider APIs both ultimately call.

## Scalability

Terraform's state-splitting patterns (root modules per bounded concern — networking, Kubernetes, data-tier, platform-services) are widely documented and directly reusable for AOS's multi-service infrastructure footprint. Pulumi supports equivalent patterns (stacks, project references) with somewhat less community-authored prior art to draw from at this writing.

## Reliability

Terraform's state-locking (via remote backends such as S3+DynamoDB or Terraform Cloud) and its mature `plan`-before-`apply` review discipline are proven at large scale across a huge number of production organizations. Pulumi offers equivalent state-locking and preview semantics with a smaller, though still credible, track record at comparable scale.

## Security

Neither tool solves secret management itself — both rely on the platform's chosen Secrets Manager (§3.22, Vault) for actual credential custody, referenced from IaC code via a Vault provider/data source rather than embedded values (consistent with RULE-060). State files for both tools can contain sensitive values in plaintext by default (a well-known risk class for both technologies) and MUST be stored in an encrypted-at-rest remote backend with access-controlled, audited read/write — this is an operational requirement regardless of which tool is chosen, not a differentiator between them.

## Maintainability

Terraform's HCL is intentionally declarative-only, which imposes a natural ceiling on module complexity (a maintainability advantage — no one can write an unreviewable 500-line imperative Terraform "module" the way one could in a general-purpose language) but also means genuinely repetitive infrastructure patterns sometimes require verbose module composition instead of a simple loop. Pulumi's general-purpose-language approach is the inverse trade: more expressive power, but also more surface area for infrastructure code to become as hard to reason about as application code if not disciplined.

## Developer Experience

Pulumi wins this dimension outright for a TypeScript-first team (§3.1) — writing infrastructure in the same language, with the same IDE tooling, type-checking, and even shared type definitions as the rest of the platform, is a materially nicer authoring loop than context-switching into HCL. This is explicitly acknowledged in the Final Recommendation below as the strongest argument for revisiting this decision later.

## Ecosystem

Terraform's provider registry is the largest in the IaC space by a wide margin — every technology named in this TSR (AWS, Cloudflare, Kubernetes, Vault, Keycloak's Terraform provider, Grafana's Terraform provider, etc.) has a mature, actively maintained first-party or community Terraform provider. Pulumi's own providers are, for most cloud/infra products, auto-bridged from the corresponding Terraform provider — meaning Pulumi's ecosystem breadth is largely inherited from Terraform's, with a small number of hand-written "native" providers offering deeper integration on top.

## Community Maturity

Terraform (est. 2014) has roughly a decade's head start over Pulumi (est. 2018) in community size, Stack Overflow/forum answer density, published module libraries, and third-party training material — directly relevant to Architecture §32's requirement that DR rebuild not depend on one specialist's tribal knowledge; a wider hiring pool of Terraform-experienced engineers exists today than Pulumi-experienced ones.

## Licensing

**Terraform (HashiCorp) is licensed under the Business Source License (BSL) 1.1** as of the 2023 relicensing (versions ≥ 1.6), a source-available but not fully open-source license with usage restrictions relevant to organizations building competing commercial IaC products — not a restriction relevant to AOS's own internal infrastructure use, but a licensing-risk category worth naming (same family of concern as the Redis→Valkey decision in §3.6, though the practical impact on an end-user company like AOS provisioning its own infrastructure is materially smaller than for a company redistributing the tool itself). **OpenTofu** (the Linux-Foundation-governed, Apache-2.0-licensed fork created in direct response to the BSL relicensing) is the license-safe equivalent, HCL-compatible, and remains a documented fallback if the BSL terms become a practical concern. **Pulumi's core CLI/SDK is Apache-2.0 licensed** (fully open source); Pulumi Cloud (the optional managed state/collaboration backend) is a separate commercial SaaS product, but self-managed state backends (S3, Azure Blob, GCS, local) are fully supported without it.

## Cloud Compatibility

Both tools support every cloud AOS's other TSR decisions touch (AWS, Cloudflare, any Kubernetes distribution, and each named self-hostable service's own provider/API). Neither is a limiting factor for this platform's multi-cloud footprint.

## Vendor Lock-in

Both tools produce infrastructure state that is, in principle, portable to hand-written provider-API calls or another IaC tool, though in practice migrating a large existing Terraform/Pulumi codebase to a different tool is nontrivial regardless of which was chosen — this is a property of "own your infrastructure as versioned code" in general, not specific to either candidate. The BSL licensing question above is a more concrete lock-in-adjacent risk for Terraform specifically than anything architectural.

## Estimated Cost

Terraform's CLI and OpenTofu are free; the cost is the remote state backend (a small S3 bucket + DynamoDB lock table, or a Terraform Cloud subscription if used, likely unnecessary at AOS's scale) — negligible relative to every other line in `cost-analysis/cost-model-100-1000-10000-dealers.md`. Pulumi's CLI/SDK are free under Apache-2.0 for self-managed state; Pulumi Cloud (if adopted for its collaboration/policy features) has a per-seat pricing tier that would add cost at scale but is not required. Neither tool materially affects the cost model's $1,500–$90,000/mo Compute Infrastructure line (§3 of the cost model) — IaC tooling cost is operational/engineering time, not a metered infrastructure cost like Datadog-class monitoring (§3.23) would be.

## Pros

**Terraform:** largest provider ecosystem covering every TSR technology; decade of production hardening; largest hiring pool; declarative-only ceiling keeps modules reviewable; OpenTofu exists as a fully open-source escape hatch from the BSL.
**Pulumi:** same-language-as-application-code DX (TypeScript); full programming-language expressiveness (loops, functions, shared types) where genuinely useful; Apache-2.0 core license, no licensing-risk conversation needed.

## Cons

**Terraform:** HCL is a second language/toolchain for a TypeScript-first team to maintain proficiency in; BSL licensing requires periodically confirming AOS's usage stays within the license's permitted-use terms (a documentation/compliance task, not a blocker); HCL's expression language is more limited than a general-purpose language for genuinely complex conditional infrastructure logic.
**Pulumi:** smaller ecosystem/community than Terraform's decade-long head start; a general-purpose language's expressiveness is also a footgun — infrastructure code can become as unreviewable as bad application code without team discipline; smaller hiring pool of Pulumi-specific experience today.

## Trade-offs

Choosing Terraform over Pulumi trades a nicer day-to-day authoring experience (Pulumi's clearest win) for a decisively larger ecosystem, community, and hiring pool (Terraform's clearest win) — directly weighted toward Architecture §32's DR requirement that infrastructure be rebuildable "by any qualified engineer, not just the original author." A materially smaller, TypeScript-only team optimizing purely for authoring velocity would reasonably choose Pulumi instead; AOS's enterprise, multi-tenant, DR-critical posture weighs ecosystem depth and hiring-pool breadth more heavily than authoring convenience for this specific category.

## Final Recommendation

**Terraform** is the binding v1 decision, matching TSR §3.21 exactly: the largest multi-cloud provider ecosystem and deepest available operational talent pool, both directly relevant to Architecture §32's disaster-recovery requirement that infrastructure be deterministically rebuildable in a standby region by any qualified engineer, not just the original author. **Pulumi is acknowledged as offering a materially nicer developer experience for a TypeScript-first team** (infrastructure defined in the same language as the application) and is explicitly flagged as a valid alternative worth revisiting if the team's Terraform/HCL friction becomes a measured productivity problem — but Terraform's ecosystem maturity wins the v1 decision. If Terraform's BSL licensing terms become a practical concern before that revisit happens, **OpenTofu** is the lower-friction fallback (HCL-compatible, near-zero migration cost) rather than a full Pulumi rewrite.

## ADR Reference

[`adr/ADR-TSR-021-iac.md`](../adr/ADR-TSR-021-iac.md)

## Migration Strategy

No migration is currently triggered. If adopted, the path away from Terraform (to OpenTofu on a licensing trigger, or to Pulumi on a measured DX-productivity trigger) follows the same staged principle as every other escape hatch in `migration/migration-and-upgrade-strategy.md`: named trigger condition, not calendar-driven, with a soak-tested parallel-run period before cutover of any given module. A Terraform→OpenTofu move is low-risk (HCL-compatible, largely a state-backend and CLI-binary swap). A Terraform→Pulumi move is higher-effort (full rewrite of module logic into a general-purpose language) and would be scoped module-by-module, starting with the least state-sensitive infrastructure (e.g., observability stack config) before touching the data-tier or networking modules.

## Future Consideration

Re-evaluate Pulumi at the Year 3 Technology Roadmap checkpoint (`roadmap/technology-roadmap.md`) using real measured Terraform/HCL authoring friction data from the first two years of operation, rather than a priori preference. Also monitor OpenTofu's ecosystem/provider parity with Terraform over the same horizon as a standing licensing-risk mitigation option.
