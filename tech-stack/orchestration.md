# Tech Stack Record — Orchestration

Governs: [`docs/004-TECHNOLOGY-SELECTION-RECORD.md`](../docs/004-TECHNOLOGY-SELECTION-RECORD.md) §3.20
Mirrors scoring in: [`decision-matrix/orchestration.md`](../decision-matrix/orchestration.md)
Formal decision: [`adr/ADR-TSR-020-orchestration.md`](../adr/ADR-TSR-020-orchestration.md)

---

## 1. Objective

Confirm the container orchestration platform per Architecture §11 (Deployment Diagram) and §31 (Scalability Architecture), which already assume Kubernetes throughout the platform's deployment topology and autoscaling model.

## 2. Requirements

- Support for the full multi-region, multi-tenant, thousands-of-dealer scaling target described in Architecture §31 Scalability Architecture, including per-service Horizontal Pod Autoscaling and cluster autoscaling.
- A mature operator/tooling ecosystem for every stateful platform dependency: Temporal (§3.9), NATS JetStream (§3.8), PostgreSQL/CockroachDB (§3.4), all of which are more reliably operated via existing, community/vendor-maintained Kubernetes Operators than hand-rolled orchestration.
- Native compatibility with ArgoCD (§3.18 GitOps CD), Kong (§3.15 API Gateway ingress), and Docker-format images (§3.19).
- Multi-region deployment support for the warm-standby DR posture required by Architecture §32 Disaster Recovery.
- Managed-service availability (EKS/GKE/AKS-class) to avoid AOS owning full control-plane operations from day one.

## 3. Candidate Technologies

| Candidate                                | Model                                                                     | License                                                                                                     |
| ---------------------------------------- | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| **Kubernetes** (managed — EKS/GKE-class) | Full-featured container orchestration                                     | Apache 2.0                                                                                                  |
| Nomad                                    | Simpler, general-purpose scheduler (containers + non-container workloads) | Business Source License (BSL) 1.1 (HashiCorp) — converts to MPL 2.0 after a time-delayed period per version |
| Docker Swarm                             | Docker-native, simpler orchestration                                      | Apache 2.0 (part of Docker Engine/Moby)                                                                     |

## 4. Evaluation Matrix

Scoring: 1 (worst) – 5 (best), except "Vendor Lock-in Risk" and "Estimated Cost", scored 1 (best/lowest) – 5 (worst/highest).

| Dimension                                | Kubernetes (managed) | Nomad | Docker Swarm |
| ---------------------------------------- | -------------------- | ----- | ------------ |
| Performance                              | 4                    | 4     | 3            |
| Scalability                              | 5                    | 4     | 2            |
| Reliability                              | 5                    | 4     | 3            |
| Security                                 | 4                    | 4     | 3            |
| Maintainability                          | 3                    | 4     | 4            |
| Developer Experience                     | 3                    | 4     | 4            |
| Ecosystem                                | 5                    | 2     | 2            |
| Community Maturity                       | 5                    | 3     | 2            |
| Licensing                                | 5                    | 3     | 5            |
| Cloud Compatibility                      | 5                    | 4     | 3            |
| Vendor Lock-in Risk (low=better)         | 2                    | 2     | 2            |
| Estimated Cost at AOS Scale (low=better) | 3                    | 2     | 2            |

Full weighted matrix: [`decision-matrix/orchestration.md`](../decision-matrix/orchestration.md).

## 5. Benchmark

Directionally, per widely reported large-scale operator experience: managed Kubernetes (EKS/GKE-class) is commonly operated at thousands-of-nodes/tens-of-thousands-of-pods scale across the industry, well past AOS's near/mid-term operational envelope — headroom, not a stretch target. Nomad is reported by its own maintainers and adopter case studies to scale to very large clusters with a simpler control-plane model and lower baseline resource overhead per node than Kubernetes, a genuine and credible advantage for pure scheduling throughput. Docker Swarm's active large-scale deployment case studies have become comparatively rare in recent years as community/ecosystem momentum has concentrated on Kubernetes. These are industry-reported operational patterns, not AOS-measured benchmarks.

## 6. Performance

For AOS's actual workload shape (many stateless services plus several critical stateful dependencies), Kubernetes's scheduling and networking overhead is well-characterized and tunable (node-local DNS caching, CNI plugin choice, resource requests/limits tuning) and is not expected to be AOS's bottleneck — Agent Runtime latency is dominated by LLM inference calls (§3.10/§3.11), not pod-scheduling overhead. Nomad's simpler scheduler has a lower baseline resource footprint, a real efficiency advantage at small-to-mid scale, though this becomes less differentiating as cluster size and workload complexity grow toward AOS's target scale.

## 7. Scalability

This is Kubernetes's clearest and most decisive advantage for AOS: native Horizontal Pod Autoscaling (per-service, tied to custom metrics via the Prometheus Adapter from the LGTM stack, §3.17), Cluster Autoscaler for node-level elasticity, and a mature multi-region/multi-cluster tooling landscape (e.g., cluster federation patterns, multi-cluster ArgoCD ApplicationSets per §3.18) that directly satisfies Architecture §31's autoscaling requirements at thousands-of-dealer scale. Nomad supports autoscaling (via the Nomad Autoscaler) but with a materially smaller ecosystem of pre-built integrations for AOS's specific custom-metric-driven scaling needs. Docker Swarm's autoscaling story is the weakest of the three — no native HPA-equivalent, typically requiring third-party tooling bolted on, which is precisely why Architecture §31's requirements disqualify it.

## 8. Reliability

Managed Kubernetes (EKS/GKE-class) offloads control-plane HA to the cloud provider, a meaningful reliability advantage over self-managing a scheduler's control plane. Kubernetes's mature, widely-battle-tested reconciliation-loop model (the same self-healing principle ArgoCD applies at the deployment layer, §3.18) restarts failed pods and reschedules around node failures automatically. Nomad's control plane (Raft-based consensus) is also mature and reliable, with a strong operational track record, but managed-Nomad-as-a-service offerings are far less common than managed Kubernetes across major clouds, meaning AOS would more often own Nomad's control-plane HA itself.

## 9. Security

Kubernetes's security surface (Pod Security Standards, NetworkPolicy, RBAC at the cluster level, admission controllers) is mature, extensively documented, and directly integrates with the Vault-based secret injection pattern (§3.22) and the Kong ingress/API Gateway layer (§3.15). Nomad has a comparable, if less extensively field-tested-at-AOS's-target-scale, security model (Nomad ACLs, Vault integration is in fact a first-party HashiCorp integration point, arguably even smoother than Kubernetes's given shared HashiCorp authorship). Docker Swarm's security tooling ecosystem (network policies, secrets management maturity) is comparatively thin and has seen less recent investment.

## 10. Maintainability

This is where Kubernetes's cost is most honestly acknowledged: it is operationally the most complex of the three candidates, with a steeper learning curve and more moving parts (CNI, CSI, Ingress controllers, admission webhooks, CRDs) than Nomad's comparatively minimal, single-binary-agent model or Swarm's Docker-native simplicity. This is explicitly accepted in exchange for ecosystem breadth (§12) and scalability (§7), and is mitigated by choosing managed Kubernetes (EKS/GKE-class) specifically so the cloud provider — not AOS — owns control-plane operations, narrowing the maintainability gap versus self-managed Kubernetes considerably.

## 11. Developer Experience

Nomad and Docker Swarm both offer a gentler day-to-day DX for engineers who are not Kubernetes specialists — simpler manifests, fewer abstractions to learn. Kubernetes's YAML/CRD-heavy manifest model and its ecosystem of Helm charts/Kustomize overlays carry real cognitive overhead for engineers new to it. AOS mitigates this by having ArgoCD (§3.18) and Terraform (§3.21) own most of the declarative manifest authoring/application as platform-team-owned configuration, meaning individual feature engineers interact with Kubernetes primarily through CI/CD outcomes and `kubectl` for debugging, not hand-authoring raw manifests for every change.

## 12. Ecosystem

This is the decisive dimension for AOS, and it is the master TSR's explicitly stated reasoning: Kubernetes's ecosystem — autoscaling tooling, service mesh options, and critically, the specific operator/tooling landscape for the platform's own named stateful dependencies (Temporal's official Kubernetes Operator, NATS JetStream's Kubernetes-native operator, PostgreSQL/CockroachDB operators, Kong's Kubernetes Ingress Controller, ArgoCD itself) — is decisively the best-supported path of the three candidates. Nomad's operator ecosystem for these same specific dependencies is materially smaller; running Temporal or Kafka/NATS reliably on Nomad is achievable but requires more custom operational work than the ready-made Kubernetes-native tooling AOS's other TSR decisions already assume. Docker Swarm's ecosystem momentum has visibly stagnated relative to Kubernetes industry-wide.

## 13. Community Maturity

Kubernetes (CNCF graduated, originally Google-authored) is the dominant container orchestration platform industry-wide by a wide margin, with the largest contributor base, largest job/talent market, and deepest operational knowledge base of any candidate here. Nomad has solid, genuine community maturity within HashiCorp's own ecosystem and among teams valuing operational simplicity, but a materially smaller adopter base than Kubernetes. Docker Swarm's community activity has visibly declined in recent years as the broader ecosystem consolidated around Kubernetes.

## 14. Licensing

- **Kubernetes:** Apache 2.0, fully open source, CNCF-governed (not controlled by a single commercial vendor).
- **Nomad:** Business Source License (BSL) 1.1 as of HashiCorp's 2023 relicensing — source-available with usage restrictions (competing commercial/hosted-service use is restricted) that converts to MPL 2.0 after a time-delayed period per release version. This is a materially different, more restrictive licensing posture than Kubernetes's Apache 2.0, and is treated as a genuine consideration, not a footnote — a license change on an already-adopted dependency is exactly the kind of vendor-relationship risk the TSR's guiding philosophy (§1, principle 2) is written to avoid.
- **Docker Swarm:** Apache 2.0 (as part of Docker Engine/Moby).

## 15. Cloud Compatibility

Kubernetes is the most cloud-portable of the three: every major cloud provider offers a managed Kubernetes service (EKS, GKE, AKS) with near-identical API surface, and self-managed Kubernetes is a credible fallback on any infrastructure, directly supporting Architecture §32's DR requirement that infrastructure be deterministically rebuildable in a standby region (mirroring the same reasoning behind the Terraform decision, §3.21). Nomad is also genuinely cloud-agnostic and runs well on any infrastructure, but with fewer fully-managed-service offerings across major clouds than Kubernetes. Docker Swarm is cloud-portable in principle but has materially less managed-service support across major clouds today.

## 16. Vendor Lock-in

Kubernetes's API is itself the portability layer — workloads defined against the Kubernetes API move between EKS, GKE, AKS, or self-managed clusters with minimal changes (cloud-provider-specific storage classes/load balancer annotations aside), which is the same anti-lock-in mechanism OpenTelemetry provides for observability (§3.17). Nomad, similarly, is cloud-agnostic at the workload-definition level, but its BSL licensing terms introduce a different kind of lock-in risk — dependency on HashiCorp's continued commercial licensing terms rather than infrastructure portability per se. Docker Swarm carries low technical lock-in (it is Docker-native, and Docker itself is the platform's chosen container tool, §3.19) but its shrinking ecosystem is itself a practical lock-in-adjacent risk: fewer future integrations and less community troubleshooting support over time.

## 17. Estimated Cost

Reference: `cost-analysis/cost-model-100-1000-10000-dealers.md` §3 (Compute Infrastructure) and §11 (Consolidated Total), which already price Kubernetes-based compute directly:

| Scale          | Compute estimate (`cost-analysis` §3)                                                                                                               |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| 100 dealers    | $1,500 – $3,000/mo (small multi-node cluster, modest replica counts per service)                                                                    |
| 1,000 dealers  | $8,000 – $15,000/mo (larger node pools, higher replica counts, multi-AZ)                                                                            |
| 10,000 dealers | $50,000 – $90,000/mo (large multi-region node pools; approaching the scale where reserved/committed-use discounts materially change unit economics) |

Managed Kubernetes control-plane fees (EKS/GKE/AKS typically charge a modest flat per-cluster-hour fee, materially smaller than the node-pool compute cost itself) are a small, predictable addition to the Compute line above, not a separate scaling risk. Nomad avoids a managed-control-plane fee (fewer managed-Nomad offerings exist to charge one) but this is offset by higher expected AOS-side operational engineering cost to self-manage the control plane and build the operator tooling Kubernetes already provides off-the-shelf for Temporal/NATS/Postgres — an engineering-time cost not captured in the infrastructure cost model but real, and directly the reasoning behind Kubernetes's Estimated Cost score being framed as "moderate, but total-cost-of-ownership favorable" rather than "cheapest infrastructure line item."

## 18. Pros

- Decisively the best-supported ecosystem for AOS's specific stateful dependencies (Temporal, NATS JetStream, Postgres/CockroachDB) via mature Kubernetes Operators.
- Native, mature autoscaling (HPA + Cluster Autoscaler) directly satisfying Architecture §31.
- Apache 2.0, CNCF-governed — no single-vendor licensing risk.
- Largest talent pool and operational knowledge base of any orchestration platform, easing hiring.
- Deepest available managed-service support (EKS/GKE/AKS) across every major cloud, supporting Architecture §32's DR rebuild-in-any-region requirement.

## 19. Cons

- Operationally the most complex of the three candidates — steepest learning curve, most moving parts (CNI, CSI, Ingress, admission webhooks, CRDs).
- Higher baseline resource overhead than Nomad's simpler scheduler at small cluster sizes.
- Requires deliberate platform-team investment (Helm/Kustomize conventions, RBAC policy, NetworkPolicy design) to keep manifest sprawl manageable at scale.

## 20. Trade-offs

Kubernetes's ecosystem and scalability advantages are chosen over Nomad's operational simplicity and Docker Swarm's Docker-native minimalism, because AOS's specific stateful-dependency operator landscape (Temporal, NATS/Kafka, Postgres) and thousands-of-dealer autoscaling target are best served by the platform with the deepest available tooling, even though that tooling comes with materially higher day-to-day operational complexity than either alternative — mitigated by choosing managed Kubernetes (EKS/GKE-class) specifically to offload control-plane operations rather than self-managing the full stack.

## 21. Final Recommendation

**Kubernetes** (managed — EKS/GKE-class) — already assumed throughout Architecture doc 002's deployment diagrams and scalability model; its ecosystem (autoscaling, service mesh options, the vast operator/tooling landscape including ArgoCD, Kong, and Temporal's own Kubernetes operators) is decisively the best-supported path for AOS's multi-region, multi-tenant, thousands-of-dealer scaling target. **Nomad** is simpler operationally but has a materially smaller ecosystem of ready-made operators for the specific stateful services (Temporal, Kafka/NATS, Postgres) AOS depends on. **Docker Swarm is not recommended** — its ecosystem momentum has stagnated relative to Kubernetes and it lacks the autoscaling sophistication Architecture §31 requires.

## 22. ADR Reference

[`adr/ADR-TSR-020-orchestration.md`](../adr/ADR-TSR-020-orchestration.md)

## 23. Migration Strategy

No migration is executed as part of this record — Kubernetes is already the assumed baseline throughout Architecture doc 002, so this record confirms rather than changes the platform's orchestration layer. Named forward paths, consistent with the "trigger condition, not open-ended revisit" principle of `migration/migration-and-upgrade-strategy.md` §1:

- **If self-managed control-plane operational toil becomes material** at a given scale despite starting on managed Kubernetes → escalate to a higher-tier managed offering or increase platform-team headcount dedicated to Kubernetes operations, rather than migrating orchestration platforms; this is an operations-scaling response, not a technology-swap trigger.
- **If a specific, narrow workload class is genuinely better served by a simpler scheduler** (e.g., a batch-only, non-service workload with no autoscaling/service-mesh need) → evaluate Nomad for that narrow workload class only, not a platform-wide migration, mirroring the same narrow-scope-first pattern used for polyglot language adoption (RISK-012 mitigation) — not currently a named requirement, and not expected to trigger given AOS's workload shape is dominated by long-running, autoscaled services and Workflow Engine (Temporal) execution.
- Multi-region cluster topology for DR (Architecture §32) is provisioned via Terraform (§3.21) to keep the standby region deterministically rebuildable, consistent with the master TSR's cross-cutting IaC discipline.

## 24. Future Consideration

- Service mesh adoption (e.g., Istio, with Envoy as its data plane — Envoy being explicitly named as a Future Consideration in §3.15 API Gateway) if/when AOS's service-to-service traffic complexity (mTLS, fine-grained traffic policy, multi-cluster service discovery) outgrows what Kong's ingress-layer capabilities and Kubernetes's native NetworkPolicy provide.
- Multi-cluster/multi-region active-active topology (beyond the current warm-standby DR model) if Architecture §32's disaster-recovery posture evolves, leveraging ArgoCD ApplicationSets (§3.18 Future Consideration) and Kubernetes's own multi-cluster federation patterns.
- Periodic re-evaluation of Nomad specifically for any narrow, clearly-scoped workload class that does not benefit from Kubernetes's full feature surface, keeping the comparison capability-driven rather than calendar-driven.
