# ADR-TSR-015 — API Gateway: Kong, With Traefik for Lower-Stakes Ingress and Envoy Deferred

**Status:** Accepted

**Context:** Architecture §28 (API Gateway Architecture) requires an ingress layer fronting Core Runtime's public and partner-facing API surface, responsible for multi-tenant rate-limiting, authentication delegation (integrating with Keycloak, §3.16), and request transformation. Constitution §3.1 already establishes Plugin-First as a cross-cutting architectural principle (Architecture ADR-006). The three natural candidates are Kong (plugin-architecture API Gateway), Traefik (Kubernetes-native reverse proxy/gateway), and Envoy (high-performance L4/L7 proxy typically operated as a service-mesh data plane).

**Decision:** **Kong** is the API Gateway technology implementing Architecture §28. **Traefik** remains an accepted alternative specifically for lower-stakes internal/dev-environment gateways where its simpler Kubernetes-native configuration model is a better fit. **Envoy** is not adopted as a standalone Gateway choice; it is deferred as a Future Consideration tied to a possible future full service-mesh adoption (e.g., via Istio), not to this category's near-term decision.

**Consequences:**

- The platform's primary ingress inherits Kong's mature, battle-tested plugin catalog for multi-tenant rate-limiting, authentication, and request transformation, directly serving Architecture §28's requirements without custom-building equivalent policy enforcement.
- Kong's OSS/Enterprise feature-tier split introduces a named, tracked risk (`risk/risk-register.md` RISK-010) that a specific advanced multi-tenant rate-limiting capability could someday require Kong Enterprise licensing; this is explicitly scheduled for re-evaluation at the 1,000-dealer cost checkpoint (TSR §3.15) rather than left open-ended.
- Traefik remains available and recommended for internal/dev-environment gateways, avoiding forcing Kong's full plugin/Admin-API configuration model onto lower-stakes use cases that do not need it.
- No service-mesh infrastructure (Envoy/Istio) is adopted prematurely; this defers a real, but not currently justified, infrastructure investment until multi-region service-to-service traffic complexity (Architecture §32) actually warrants it.

**Alternatives Considered:**

- **Traefik as the primary API Gateway** (rejected for the primary role: numerically near-tied with Kong on the weighted decision matrix, but its plugin ecosystem for enterprise multi-tenant auth/rate-limiting scenarios is thinner than Kong's at present — retained instead as the recommended choice for lower-stakes internal/dev-environment gateways, where that gap is immaterial).
- **Envoy as the primary API Gateway** (rejected: scores highest on raw performance/scalability/reliability among the three candidates, but is architecturally a data-plane technology typically operated under a service-mesh control plane like Istio; adopting it standalone would require building substantial gateway-grade policy-enforcement logic from lower-level primitives, or committing to a full service mesh earlier than AOS's current scale target justifies).
- **Kong Enterprise from day one** (rejected: Kong's open-source core already covers AOS's near-term multi-tenant gateway needs; committing to Enterprise licensing before a specific feature gap is identified and confirmed blocking would be a premature cost commitment, contrary to TSR §1's cost-efficiency philosophy).
- **A general-purpose Kubernetes Ingress controller with no dedicated Gateway product** (rejected: does not meet Architecture §28's multi-tenant rate-limiting/authentication/request-transformation requirements at the maturity level a dedicated API Gateway plugin ecosystem provides).
