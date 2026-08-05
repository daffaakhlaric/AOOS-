# Tech Stack Record — CI/CD

Governs: [`docs/004-TECHNOLOGY-SELECTION-RECORD.md`](../docs/004-TECHNOLOGY-SELECTION-RECORD.md) §3.18
Mirrors scoring in: [`decision-matrix/cicd.md`](../decision-matrix/cicd.md)
Formal decision: [`adr/ADR-TSR-018-cicd.md`](../adr/ADR-TSR-018-cicd.md)

---

## 1. Objective

Choose the pipeline (build/test/CI) and deployment automation (CD) technology per Constitution §18 and RULE-086–091 (IaC-driven, traceable, gated deployment).

## 2. Requirements

- Build/test automation for a polyglot codebase (TypeScript, Go, Python per §3.1) with per-language toolchain support.
- Declarative, Git-as-source-of-truth deployment to Kubernetes (§3.20), satisfying RULE-086's IaC-driven, traceable deployment mandate.
- Gated rollout support (health checks before traffic shift, RULE-087/RULE-088) and canary/tenant-subset rollout compatibility with Architecture ADR-014.
- Auditability: every production change traceable to a Git commit and an approved pipeline run, not a manual `kubectl apply`.
- Cost/operational fit for a TypeScript-first startup-to-scaleup team, not requiring a dedicated platform-ops hire on day one.

## 3. Candidate Technologies

| Candidate          | Role                              | License / Model                                                                               |
| ------------------ | --------------------------------- | --------------------------------------------------------------------------------------------- |
| **GitHub Actions** | CI (build/test/containerize)      | Proprietary, usage-metered (free tier + minutes-based billing), tied to GitHub hosting        |
| **ArgoCD**         | CD (GitOps Kubernetes deployment) | Apache 2.0, self-hosted (CNCF project)                                                        |
| GitLab CI          | Combined CI/CD alternative        | Open-core (GitLab CE: MIT-derived "GitLab EE" proprietary tiers); usage-metered on GitLab.com |

## 4. Evaluation Matrix

Scoring: 1 (worst) – 5 (best), except "Vendor Lock-in Risk" and "Estimated Cost", scored 1 (best/lowest) – 5 (worst/highest). GitHub Actions + ArgoCD is evaluated as the adopted pairing against GitLab CI as a combined single-tool alternative (GitLab CI can perform both CI and, via its own GitOps agent, CD).

| Dimension                                | GitHub Actions + ArgoCD | GitLab CI (combined) |
| ---------------------------------------- | ----------------------- | -------------------- |
| Performance                              | 4                       | 4                    |
| Scalability                              | 4                       | 4                    |
| Reliability                              | 4                       | 4                    |
| Security                                 | 4                       | 4                    |
| Maintainability                          | 3                       | 4                    |
| Developer Experience                     | 4                       | 4                    |
| Ecosystem                                | 5                       | 4                    |
| Community Maturity                       | 5                       | 4                    |
| Licensing                                | 3                       | 3                    |
| Cloud Compatibility                      | 5                       | 4                    |
| Vendor Lock-in Risk (low=better)         | 3                       | 3                    |
| Estimated Cost at AOS Scale (low=better) | 2                       | 2                    |

Full weighted matrix: [`decision-matrix/cicd.md`](../decision-matrix/cicd.md).

## 5. Benchmark

Directionally, GitHub Actions' hosted runners are widely reported to comfortably handle typical monorepo/polyglot CI workloads (parallel matrix builds across TypeScript/Go/Python) within minutes per pipeline run when jobs are properly parallelized and cached (dependency caching, Docker layer caching) — exact throughput depends entirely on AOS's own test-suite size and is not fabricated here as a measured figure. ArgoCD's reconciliation loop is commonly reported to detect and correct Git-vs-cluster drift within seconds to low minutes depending on configured sync intervals/webhooks — a standard, widely-adopted GitOps operating characteristic, not an AOS-measured number.

## 6. Performance

GitHub Actions supports matrix builds and dependency/build caching (e.g., pnpm/npm cache, Go module cache, Docker BuildKit layer cache) that materially reduce pipeline duration for a polyglot monorepo — each language's toolchain builds/tests in parallel jobs rather than serially. ArgoCD's declarative reconciliation is asynchronous and eventually-consistent by design (a deliberate GitOps trait, not a latency deficiency) — cluster state converges to Git state on a reconciliation loop rather than a synchronous deploy command blocking until complete, which is compatible with Architecture §11's rolling/canary deploy sequence (health checks gate traffic shift).

## 7. Scalability

GitHub Actions scales via concurrent job/runner limits (configurable, self-hosted runners available if hosted-runner concurrency or cost becomes a bottleneck at high commit-frequency scale). ArgoCD scales to manage many Applications (one per service/environment) across one or many clusters from a single ArgoCD control plane, and supports the ApplicationSet controller for templated multi-tenant/multi-cluster deployment patterns — directly relevant if AOS's multi-region DR posture (Architecture §32) grows into genuinely active-active multi-cluster deployment.

## 8. Reliability

GitHub Actions carries GitHub's own platform SLA (a managed dependency, acknowledged as an external reliability factor outside AOS's direct control, mitigated by CI being a build-time, not runtime, dependency — a GitHub Actions outage delays a deploy, it does not take down the running platform). ArgoCD, self-hosted, requires the same HA discipline as any other platform-critical self-hosted component (multi-replica, backed by a persistent Redis/etcd-backed cache) — but because ArgoCD is a reconciliation controller, not a request-serving hot-path service, a brief ArgoCD outage does not itself degrade the already-running cluster state, only pauses new reconciliation, a materially lower-severity failure mode than an Authentication or API Gateway outage.

## 9. Security

GitHub Actions workflows are scoped via repository/organization-level permissions and support OIDC-based cloud credential federation (avoiding long-lived cloud secrets stored in Actions secrets, aligned with RULE-060's spirit of minimizing standing credentials). ArgoCD's GitOps model is itself a security improvement over push-based CI-triggered deploys: because ArgoCD pulls desired state from Git and reconciles the cluster to match, the CI pipeline never needs direct production cluster credentials at all — only ArgoCD does, and ArgoCD's own RBAC (Projects, AppProjects with restricted source repos/destinations) scopes exactly which Git sources may deploy to which cluster/namespace, directly supporting Constitution RULE-062's least-privilege mandate applied to the deployment pipeline itself, not just the application's API.

## 10. Maintainability

Running two systems (GitHub Actions for CI, ArgoCD for CD) instead of one "CI/CD does everything" tool is the primary maintainability cost of this decision (§20) — two configuration surfaces (workflow YAML + ArgoCD Application manifests) instead of one. GitLab CI's combined model scores better here specifically because it is one system. This is accepted because GitOps deployment safety is judged to outweigh the tooling-count reduction (§20).

## 11. Developer Experience

GitHub Actions' workflow YAML is widely known across the industry, has a large marketplace of reusable Actions, and integrates natively with GitHub's PR/status-check UI — a strong default for a TypeScript-first team already using GitHub for source control (assumed per the master TSR §3.18). ArgoCD's web UI gives visual, real-time diff-and-sync views of desired-vs-actual cluster state per Application, which is a materially better deployment-debugging DX than a CLI-only `kubectl` workflow or a CI-log-only view of what a deploy actually did to the cluster.

## 12. Ecosystem

GitHub Actions has the largest CI marketplace ecosystem of any CI tool at present (broad first-party and community Action coverage for virtually every language/tool AOS uses). ArgoCD is a CNCF graduated project with deep native integration into the Kubernetes ecosystem broadly and specific, well-documented compatibility with Kong (§3.15), Temporal's Kubernetes Operator (§3.9), and Terraform-provisioned clusters (§3.21) — precisely the ecosystem alignment the master TSR's Final Recommendation calls out.

## 13. Community Maturity

GitHub Actions (launched 2019, backed by Microsoft/GitHub) has very wide industry adoption at this writing. ArgoCD (CNCF graduated, originally Intuit-authored) is one of the two dominant GitOps controllers in the Kubernetes ecosystem (alongside Flux) with a large enterprise adopter base and active maintenance cadence.

## 14. Licensing

- **GitHub Actions:** Proprietary, usage-metered (generous free tier for public/private repos depending on plan, minutes-based billing beyond included allowance, tied to hosting source control on GitHub).
- **ArgoCD:** Apache 2.0, fully open source, self-hosted, no feature paywall or usage metering.
- **GitLab CI:** Core CI/CD features are available in GitLab Community Edition (open-core), but many enterprise-relevant features (advanced approvals, compliance pipelines, some security scanning) are gated to GitLab Enterprise Edition's proprietary tiers; GitLab.com hosted usage is metered similarly to GitHub Actions.

## 15. Cloud Compatibility

GitHub Actions is a hosted service independent of AOS's own cloud/infrastructure choice — it triggers on repository events and can deploy to any target via its runners. ArgoCD, self-hosted inside the Kubernetes cluster it manages, is fully cloud-agnostic (works identically on EKS, GKE, AKS, or self-managed Kubernetes) and requires no cloud-specific integration beyond standard Kubernetes API access, directly compatible with Architecture §11's multi-region deployment topology and the Terraform-provisioned cluster model (§3.21).

## 16. Vendor Lock-in

GitHub Actions carries moderate lock-in: workflow YAML syntax and Actions marketplace usage are GitHub-specific, though the underlying build/test/containerize steps are portable in substance (the same Dockerfile, test commands, and build scripts run under any CI system) — migrating to GitLab CI or another CI tool means rewriting pipeline YAML, not rearchitecting the build itself. ArgoCD carries low lock-in: it operates purely on standard Kubernetes manifests/Helm charts/Kustomize from Git, meaning the actual deployment artifacts ArgoCD reconciles are not ArgoCD-specific — switching to Flux (the other dominant GitOps controller) or a different CD tool re-points the controller, not the deployment artifacts themselves.

## 17. Estimated Cost

Reference: `cost-analysis/cost-model-100-1000-10000-dealers.md`. CI/CD tooling cost is not broken out as its own line in the consolidated cost model — it is a build-time/deployment-time cost, not a runtime-per-dealer-scaling cost, and is materially smaller than any of the model's runtime infrastructure lines at every tier. Directionally: GitHub Actions minutes-based billing scales with commit/PR frequency and pipeline duration (engineering team size and codebase test-suite size), not with dealer count — this is a fundamentally different cost shape than the per-tenant/per-signal cost risks flagged for Authentication (§3.16) and Observability (§3.17), since CI/CD spend is bound to engineering activity, not platform traffic or tenant count. ArgoCD's cost is purely the compute it runs on inside the existing Kubernetes cluster (a small, fixed control-plane footprint), already covered within the general Compute line (`cost-analysis` §3). GitHub Actions self-hosted runners are available as a mitigation if hosted-runner minute cost becomes material at high build-frequency scale, trading GitHub's managed-runner convenience for owned compute cost, the same "own vs. rent" pattern seen elsewhere in this TSR.

## 18. Pros

- ArgoCD's GitOps model removes standing production cluster credentials from the CI pipeline entirely — a meaningful security improvement over push-based deploy.
- Git is the auditable single source of truth for both desired application code (GitHub) and desired cluster state (ArgoCD, reconciling from Git) — satisfying RULE-086 end to end.
- GitHub Actions' marketplace ecosystem materially reduces custom pipeline-tooling work.
- Both tools are best-in-class within their specific scope (CI vs. GitOps CD) rather than adequate-at-both from a combined tool.
- ArgoCD is Apache 2.0/self-hosted, avoiding a second metered SaaS bill on top of GitHub Actions.

## 19. Cons

- Two systems to learn, configure, and keep in sync (workflow YAML + Application manifests) instead of one.
- GitHub Actions' usage-metered billing model is a real, if currently non-disqualifying, ongoing cost tied to GitHub hosting.
- ArgoCD's asynchronous reconciliation model requires engineers to understand GitOps drift-correction semantics, a learning curve versus a simpler "CI directly runs `kubectl apply`" mental model.
- Coordinating pipeline promotion across CI (build/test) and CD (ArgoCD sync) requires a clear handoff convention (e.g., CI updates a Git manifest repo/tag that ArgoCD watches) that must be deliberately designed, not automatic.

## 20. Trade-offs

Running both GitHub Actions (CI) and ArgoCD (CD) is two systems instead of one "CI/CD does everything" tool, accepted because GitOps-style deployment (ArgoCD reconciling cluster state to Git) is a materially safer and more auditable production deployment model than push-based CI-triggered deploys alone — the master TSR's stated trade-off (§3.18), reproduced here in substance.

## 21. Final Recommendation

**GitHub Actions** for build/test/CI (assuming GitHub as the source control host, the default for a TypeScript-first startup-to-scaleup team) paired with **ArgoCD** for GitOps-based Kubernetes deployment — ArgoCD's declarative, Git-as-source-of-truth deployment model directly satisfies Constitution RULE-086 and integrates cleanly with the Terraform-provisioned Kubernetes clusters (§3.21). **GitLab CI is not adopted as primary** but is noted as the direct substitute if the organization ever standardizes on GitLab instead of GitHub — the CI/CD pattern (build → test → containerize → ArgoCD sync) is portable between the two.

## 22. ADR Reference

[`adr/ADR-TSR-018-cicd.md`](../adr/ADR-TSR-018-cicd.md)

## 23. Migration Strategy

No migration is executed as part of this record. If the organization standardizes on GitLab instead of GitHub (an organizational, not technical, trigger), the CI portion migrates to GitLab CI while ArgoCD is retained unchanged (ArgoCD is source-host-agnostic, watching any Git remote including a GitLab-hosted manifest repo) — only the build/test pipeline definition needs porting, not the GitOps deployment layer. If ArgoCD's operational fit is ever reconsidered, Flux is the direct like-for-like GitOps alternative, since both operate on the same standard Kubernetes-manifest-in-Git model, making a swap a controller-level change, not a re-architecture of how deployments are expressed.

## 24. Future Consideration

- Progressive delivery tooling (e.g., Argo Rollouts, which integrates natively with ArgoCD) for automated canary analysis tied to Architecture §23 Monitoring metrics, deepening the canary rollout pattern already required by Architecture ADR-014 beyond manual tenant-subset promotion.
- Self-hosted GitHub Actions runners if hosted-runner cost or build-queue latency becomes measurable at high engineering-team scale.
- Multi-cluster ArgoCD ApplicationSets if the multi-region DR posture (Architecture §32) evolves from warm-standby to active-active.
