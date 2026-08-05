# Tech Stack Record — Container

Governs: [`docs/004-TECHNOLOGY-SELECTION-RECORD.md`](../docs/004-TECHNOLOGY-SELECTION-RECORD.md) §3.19
Mirrors scoring in: [`decision-matrix/container.md`](../decision-matrix/container.md)
Formal decision: [`adr/ADR-TSR-019-container.md`](../adr/ADR-TSR-019-container.md)

---

## 1. Objective

Choose the container runtime/build tooling used to package every AOS service, Agent Runtime, Tool Manager, and supporting component for deployment onto Kubernetes (§3.20), consistent with Architecture §11's Deployment Diagram and §37 Folder Structure's per-service containerization assumption.

## 2. Requirements

- Broadest possible CI/CD and base-image ecosystem compatibility, since GitHub Actions (§3.18), Kubernetes (§3.20), and every base image referenced across the polyglot codebase (Node.js, Go, Python, §3.1) must build/run against whichever container format is chosen.
- OCI-compliant image format, so images are portable across any Kubernetes-compatible container runtime regardless of build tool.
- Mature local-development experience (`docker compose`-equivalent) for engineers running the platform's multi-service stack locally.
- A credible security-hardening path for Enterprise/on-prem deployments requiring stricter isolation guarantees.

## 3. Candidate Technologies

| Candidate  | Model                                              | License                                                                                                        |
| ---------- | -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| **Docker** | Daemon-based (dockerd), root-privileged by default | Apache 2.0 (Docker Engine/Moby core); Docker Desktop itself is proprietary/commercial for larger organizations |
| Podman     | Daemonless, rootless-by-default                    | Apache 2.0                                                                                                     |

## 4. Evaluation Matrix

Scoring: 1 (worst) – 5 (best), except "Vendor Lock-in Risk" and "Estimated Cost", scored 1 (best/lowest) – 5 (worst/highest).

| Dimension                                | Docker | Podman |
| ---------------------------------------- | ------ | ------ |
| Performance                              | 4      | 4      |
| Scalability                              | 4      | 4      |
| Reliability                              | 4      | 4      |
| Security                                 | 3      | 5      |
| Maintainability                          | 4      | 3      |
| Developer Experience                     | 5      | 3      |
| Ecosystem                                | 5      | 3      |
| Community Maturity                       | 5      | 3      |
| Licensing                                | 4      | 5      |
| Cloud Compatibility                      | 5      | 4      |
| Vendor Lock-in Risk (low=better)         | 2      | 1      |
| Estimated Cost at AOS Scale (low=better) | 2      | 2      |

Full weighted matrix: [`decision-matrix/container.md`](../decision-matrix/container.md).

## 5. Benchmark

Both Docker and Podman build/run OCI-compliant images and, for the vast majority of typical stateless-service workloads, are reported to perform comparably at runtime once a container is scheduled — the meaningful difference is architectural (daemon vs. daemonless, root vs. rootless) rather than a raw throughput gap. Podman's rootless mode has been reported by community benchmarks to carry a modest overhead for certain networking/filesystem-heavy workloads relative to root-mode Docker, though this gap is generally described as narrowing with newer kernel/runc versions — stated directionally, not as a measured AOS figure, since neither runtime is the platform's actual runtime bottleneck (application/database/LLM-call latency dominates).

## 6. Performance

Both are effectively equivalent for AOS's purposes: the actual image AOS builds and runs (Node.js/Go/Python service binaries and their dependencies) is OCI-standard regardless of which build tool produced it, and once deployed to Kubernetes, workload performance is governed by the Kubernetes container runtime interface (containerd/CRI-O) and node resource allocation, not by which local build tool a developer used.

## 7. Scalability

Not a meaningful differentiator at the individual-container level — scalability at AOS's scale is a Kubernetes-layer concern (§3.20 Orchestration: HPA, cluster autoscaler), not a container-runtime-layer concern. Both Docker- and Podman-built images scale identically once running under Kubernetes, since Kubernetes itself does not depend on Docker's daemon at runtime (it uses containerd/CRI-O regardless of which tool built the image).

## 8. Reliability

Docker's daemon-based model (`dockerd`) is a single long-running process per host that, if it crashes, can affect all containers on that host during local development — a known operational characteristic, though largely irrelevant to production reliability since production runs under Kubernetes's own container runtime, not a developer's local Docker daemon. Podman's daemonless model avoids this single-process failure mode entirely by running each container as a direct child process, a genuine reliability/isolation advantage at the local-dev and CI-runner level, though again not a production-runtime differentiator given both ultimately produce standard OCI images consumed by Kubernetes.

## 9. Security

This is Podman's clearest advantage: rootless-by-default execution avoids the security exposure of a root-privileged daemon (`dockerd` traditionally runs as root, meaning a container escape or daemon compromise carries root-level host risk). Docker has substantially closed this gap over time (rootless mode is available, and Docker's default security posture with modern seccomp/AppArmor/capabilities-dropping defaults is considered solid for standard production use), but it is opt-in configuration rather than Podman's default posture. For AOS's primary managed-Kubernetes deployment target, this distinction is meaningfully mitigated regardless of build tool, because the actual production container runtime is Kubernetes's own (containerd/CRI-O) with its own security context configuration (`runAsNonRoot`, Pod Security Standards) applied at the manifest level — the build-tool choice does not itself determine production container privilege level. Podman's rootless-by-default posture remains most relevant for on-prem/Enterprise deployments where the container engine itself (not just the orchestrator) is part of the compliance surface.

## 10. Maintainability

Docker's single-daemon model and unified CLI/Compose tooling is simpler to operate and document for a general engineering team than Podman's daemonless/pod-concept model, which introduces its own set of operational nuances (e.g., Podman's `pod` abstraction predates and differs subtly from a Kubernetes Pod despite sharing the name). Docker's much larger base of publicly available troubleshooting knowledge, Stack Overflow answers, and internal team familiarity (likely pre-existing across most hires) lowers ongoing maintenance friction.

## 11. Developer Experience

Docker remains the default mental model most engineers already have (`docker build`, `docker compose up`, `docker run`) and the AOS engineering team's polyglot codebase (§3.1) benefits from that near-universal familiarity requiring no additional onboarding. Podman aims for CLI compatibility with Docker (`podman` accepts most `docker`-equivalent commands, including a `podman-compose` project), narrowing the DX gap, but is not a bit-for-bit drop-in for every workflow (some Docker Desktop-specific integrations, GUI tooling, and less mature Compose-equivalent support) at this writing.

## 12. Ecosystem

Docker is the ecosystem standard: broadest CI/CD tool support (including GitHub Actions' native `docker/build-push-action`), broadest base-image availability and tooling (Docker Hub as the default public registry point of reference), and the format every other TSR decision (Kubernetes, ArgoCD, GitHub Actions) implicitly assumes. Podman produces standard OCI images and is broadly compatible, but its own tooling ecosystem (build caching services, GUI tools, some third-party integrations) is measurably thinner.

## 13. Community Maturity

Docker (since 2013) is the longest-established and most widely adopted container tooling in the industry, with Docker Engine/Moby's open-source core actively maintained. Podman (Red Hat-originated, since 2018) has a smaller but genuinely active and growing community, particularly strong within Red Hat/OpenShift-adjacent enterprise environments, but with materially less general-industry adoption than Docker at this writing.

## 14. Licensing

- **Docker Engine/Moby (the open-source core AOS actually builds/runs images with in CI and production):** Apache 2.0.
- **Docker Desktop** (the GUI application, relevant only to local developer machines, not CI/production): free for personal use/small business/education, requires a paid subscription for larger commercial organizations under Docker's licensing terms — a cost AOS should track for its own engineering team's local-dev tooling, though it does not affect the CI/production container runtime, which does not use Docker Desktop.
- **Podman:** Apache 2.0, fully open source with no desktop-tier licensing complication (Podman Desktop, its GUI counterpart, is also open source).

## 15. Cloud Compatibility

Both produce OCI-compliant images runnable on any Kubernetes-compatible cloud (EKS, GKE, AKS, self-managed) — the container build tool choice does not constrain cloud portability at all, since Kubernetes itself does not run containers via Docker's daemon in production (it uses containerd/CRI-O directly). Docker scores marginally higher here only because of its broader base-image/registry ecosystem availability across every major cloud's container registry tooling.

## 16. Vendor Lock-in

Both are low-lock-in choices: OCI is the portable standard, and images built by either tool run identically under any OCI-compliant runtime. Podman scores marginally lower (better) because it has no commercial "Desktop" licensing tier complication at all, whereas Docker's ecosystem includes both a fully open core and a separately licensed commercial desktop product, a minor distinction to track for engineering tooling procurement, not a switching-cost concern for the images themselves.

## 17. Estimated Cost

Reference: `cost-analysis/cost-model-100-1000-10000-dealers.md`. Container build tooling itself does not appear as a cost-model line item — it is a build-time developer/CI tool, not a runtime-scaling cost, and its cost shape (CI minutes already covered under §3.18 CI/CD, and potential Docker Desktop per-seat licensing for larger engineering teams) is materially smaller than any runtime infrastructure line at every dealer-count tier. The only cost consideration specific to this decision is Docker Desktop's commercial licensing tier for local developer machines at a larger engineering headcount — a per-engineer-seat cost, not a per-dealer cost, and one Podman avoids entirely by being fully open source end to end (relevant primarily as a minor internal tooling-budget line, not a platform-scaling cost driver).

## 18. Pros

- Broadest CI/CD, base-image, and general tooling compatibility of any container build tool.
- Every other TSR infrastructure decision (Kubernetes, ArgoCD, GitHub Actions) assumes Docker-format images and workflows.
- Near-universal engineering familiarity reduces onboarding friction.
- Apache 2.0-licensed open-source core (Docker Engine/Moby) for the actual build/run tooling used in CI and production.

## 19. Cons

- Traditional daemon-based, root-privileged-by-default model is a real (if increasingly mitigable) security posture disadvantage versus Podman's rootless-by-default design.
- Docker Desktop's commercial licensing tier is a per-seat cost consideration for larger engineering teams' local-dev tooling.
- Single-daemon local-dev model is a (minor, local-only) single point of failure that Podman's daemonless design avoids.

## 20. Trade-offs

Docker's ecosystem-standard status is chosen over Podman's rootless-by-default security advantage at this stage, because every other TSR decision (Kubernetes, ArgoCD, GitHub Actions) already assumes Docker-format tooling and that compatibility is judged not worth trading away for a security advantage that is substantially mitigated at the production layer anyway (Kubernetes's own Pod Security Standards and `runAsNonRoot` configuration govern actual production container privilege, largely independent of the local build-tool choice) — the master TSR's stated trade-off (§3.19), reproduced here in substance.

## 21. Final Recommendation

**Docker** — remains the ecosystem standard with the broadest CI/CD, base-image, and tooling compatibility; every other decision in this document (Kubernetes, ArgoCD, GitHub Actions) assumes Docker-format images, and that compatibility is not worth trading away for Podman's rootless-by-default security advantage at this stage. **Podman is flagged as a Future Consideration** specifically for security-hardened Enterprise on-prem deployments where rootless container execution is a compliance requirement.

## 22. ADR Reference

[`adr/ADR-TSR-019-container.md`](../adr/ADR-TSR-019-container.md)

## 23. Migration Strategy

No migration is executed as part of this record. Named forward path: if a specific Enterprise/on-prem tenant contractually requires rootless container execution as a compliance requirement, evaluate Podman for that tenant's specific deployment footprint rather than a platform-wide migration — since both tools produce standard OCI images, this is a build/runtime-tool substitution at the CI and node level for that tenant's environment, not an application-code change. This mirrors the same "escalate the escape hatch per-tenant, not platform-wide" pattern already used for CockroachDB (Architecture ADR-012) and the dedicated Keycloak realm pattern (§3.16). Because Kubernetes itself does not depend on Docker specifically at the production container-runtime level, this migration path does not require re-architecting the deployment model, only the image-build pipeline for the affected environment.

## 24. Future Consideration

- Podman adoption for security-hardened Enterprise/on-prem deployments where rootless execution is a named compliance requirement.
- Buildah/Skopeo (Podman's companion tooling) evaluation if daemonless, more granular image-build control becomes valuable for CI pipeline security hardening.
- Periodic re-evaluation of Docker Desktop's commercial licensing terms against engineering headcount growth, as a minor internal tooling-cost governance item.
