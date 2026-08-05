# ADR-TSR-019 — Container: Docker

**Status:** Accepted

**Context:** AOS requires a container build/runtime tool to package every service, Agent Runtime, Tool Manager, and supporting component (Architecture §37 Folder Structure) for deployment onto Kubernetes (§3.20). Every other infrastructure decision already made in this TSR — Kubernetes orchestration, ArgoCD GitOps deployment, GitHub Actions CI — implicitly assumes Docker-format (OCI) images and Docker-based build tooling as the default working assumption of the broader container ecosystem.

**Decision:** Adopt **Docker** (Docker Engine/Moby, Apache 2.0 open-source core) as the standard container build and local-development tool across the platform. All images are OCI-compliant, built via `docker build`/Docker BuildKit in CI (§3.18), and consumed by Kubernetes's own container runtime (containerd/CRI-O) in production — Docker's daemon itself is not part of the production runtime path.

**Consequences:** AOS inherits the broadest available CI/CD, base-image, and tooling ecosystem compatibility, and near-universal engineering familiarity, reducing onboarding friction. AOS accepts Docker's traditionally root-privileged daemon model as the default local/CI build posture rather than Podman's rootless-by-default design; this is substantially mitigated at the production layer by Kubernetes's own Pod Security Standards and `runAsNonRoot` configuration, which govern actual production container privilege independent of the local build tool. Docker Desktop's commercial licensing tier for larger organizations is tracked as a minor internal engineering-tooling cost, not a platform-scaling cost (it does not affect CI or production, which do not use Docker Desktop).

**Alternatives Considered:**

- **Podman** — daemonless, rootless-by-default execution model, a genuine security advantage, and fully Apache 2.0-licensed with no commercial-desktop-tier complication; not adopted as the default because its CI/CD tooling, base-image, and general ecosystem compatibility is measurably thinner than Docker's at this writing, and every other TSR infrastructure decision already assumes Docker-format tooling. Retained explicitly as a Future Consideration for security-hardened Enterprise on-prem deployments where rootless execution is a named compliance requirement, evaluated per-tenant rather than as a platform-wide migration.
