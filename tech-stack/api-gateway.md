# Tech Stack Detail — API Gateway

Governs: [`docs/004-TECHNOLOGY-SELECTION-RECORD.md`](../docs/004-TECHNOLOGY-SELECTION-RECORD.md) §3.15 · TSR Category 15 · ADR-TSR-015

**Status:** ACTIVE. This file expands, and does not alter, the Final Recommendation already made in TSR §3.15.

---

## 1. Objective

Choose the technology implementing Architecture §28 (API Gateway Architecture) — the ingress layer fronting the Core Runtime's public and partner-facing API surface, responsible for multi-tenant rate-limiting, authentication delegation, and request transformation.

## 2. Requirements

- Plugin/extensibility architecture, philosophically consistent with AOS's own Plugin-First principle (Constitution §3.1) and Architecture ADR-006.
- Mature, battle-tested rate-limiting, authentication, and request-transformation capability at multi-tenant scale — not a general Kubernetes Ingress controller re-purposed as a full API Gateway.
- Integration path with Keycloak (§3.16, OIDC-based authentication) and Vault (§3.22, upstream credential resolution).
- Acceptable operational complexity for a platform-critical, always-on ingress path.

## 3. Candidate Technologies

| Candidate | Type                                                                                      | Notes                                                              |
| --------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Kong      | Full API Gateway, plugin architecture, built on Nginx/OpenResty                           | Large plugin ecosystem; OSS core + Enterprise tier split           |
| Traefik   | Cloud-native reverse proxy / Kubernetes-native Ingress controller with gateway capability | Simple, Kubernetes-idiomatic, dynamic config discovery             |
| Envoy     | High-performance L4/L7 proxy, typically the data plane under a service mesh control plane | Not itself a gateway product; usually paired with Istio or similar |

## 4. Evaluation Matrix

Scoring: 1 (worst) – 5 (best). Vendor Lock-in Risk and Estimated Cost score 5 = lowest risk / lowest cost.

| Dimension            | Kong                                                                                                                                   | Traefik                                                                                                          | Envoy                                                                                                                     |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Performance          | 4                                                                                                                                      | 4                                                                                                                | 5 (highest-performance data plane of the three, by design)                                                                |
| Scalability          | 4                                                                                                                                      | 4                                                                                                                | 5                                                                                                                         |
| Reliability          | 4 (mature, widely production-proven)                                                                                                   | 4 (mature, widely production-proven)                                                                             | 5 (proven at the largest scale, e.g., as Istio/service-mesh data plane)                                                   |
| Security             | 4 (mature plugin-based auth/rate-limit/WAF-style plugins)                                                                              | 4 (solid built-in middleware, smaller plugin catalog than Kong)                                                  | 3 (powerful primitives, but requires more assembly to reach gateway-grade policy enforcement out of the box)              |
| Maintainability      | 3 (plugin config model adds surface, but well-documented)                                                                              | 4 (simpler config model, especially in Kubernetes-native deployments)                                            | 2 (lowest-level tool of the three; typically requires a control plane like Istio to be maintainable at gateway scope)     |
| Developer Experience | 4 (declarative config, Admin API, strong docs)                                                                                         | 4 (very low friction for Kubernetes-native setups, dynamic discovery)                                            | 2 (steep learning curve as a standalone gateway; assumes a control plane)                                                 |
| Ecosystem            | 5 (largest API Gateway plugin ecosystem of the three)                                                                                  | 3 (strong Kubernetes/Traefik-native ecosystem, narrower plugin catalog for enterprise auth/rate-limit scenarios) | 4 (huge ecosystem as a proxy/data-plane technology, but mostly service-mesh-shaped, not gateway-plugin-shaped)            |
| Community Maturity   | 5                                                                                                                                      | 4                                                                                                                | 5                                                                                                                         |
| Licensing            | 4 (Apache-2.0 core; Kong Enterprise features gated separately — the license split, not the OSS license itself, is the nuance to track) | 5 (MIT)                                                                                                          | 5 (Apache-2.0)                                                                                                            |
| Cloud Compatibility  | 5                                                                                                                                      | 5                                                                                                                | 5                                                                                                                         |
| Vendor Lock-in Risk  | 4 (OSS core covers near-term needs; Enterprise-tier feature gaps are the named risk, tracked explicitly)                               | 4                                                                                                                | 5 (no vendor tier split; fully open)                                                                                      |
| Estimated Cost       | 3 (OSS free; Enterprise licensing cost is a named future re-evaluation checkpoint)                                                     | 4 (fully OSS, no tiered licensing split)                                                                         | 4 (fully OSS, but effectively requires a service-mesh control plane to reach gateway-grade capability, adding infra cost) |

## 5. Benchmark

Directional only. Envoy is widely reported as the highest-raw-throughput, lowest-latency data plane of the three, an expected result given its purpose (a proxy technology optimized as a service-mesh sidecar/edge data plane, written in C++). Kong and Traefik, both commonly deployed as Kubernetes Ingress/Gateway solutions, are reported as broadly comparable to each other in typical HTTP-API-gateway request/response latency for the multi-tenant REST/gRPC traffic shape AOS's API Gateway will actually carry — no AOS-run benchmark exists yet.

## 6. Performance

Envoy's raw performance advantage is real but not the deciding factor for this category: AOS's API Gateway workload (multi-tenant REST/webhook/partner-API traffic fronting Core Runtime services) is not at a scale where Kong's or Traefik's performance is a bottleneck, consistent with TSR §1 point 1 (multi-tenant cost efficiency and operational fit over raw peak performance). Envoy's performance ceiling is more relevant to a future service-mesh scenario (§24 Future Consideration) than to the gateway-ingress problem this category solves today.

## 7. Scalability

All three scale horizontally as stateless (or externally-stated) proxy processes behind a load balancer, consistent with Architecture §31's autoscaling model. This dimension does not meaningfully differentiate Kong from Traefik for AOS's target scale; Envoy's scalability advantage is real but, as in §6, oriented toward a service-mesh use case this category is not solving.

## 8. Reliability

Kong and Traefik are both widely production-proven as API gateways specifically (not merely as generic reverse proxies), with mature health-check, circuit-breaking, and failover capability. Envoy's reliability track record is excellent but almost entirely earned in its role as a service-mesh data plane under a control plane like Istio — using it as a standalone gateway without that control plane is a materially less proven configuration for the specific "API Gateway" role this category defines.

## 9. Security

Kong's plugin catalog has the deepest, most battle-tested set of authentication, rate-limiting, and request-validation plugins directly relevant to Architecture §28's multi-tenant rate-limiting/auth/transformation requirements, and integrates cleanly with Keycloak's OIDC (§3.16) via a well-established plugin. Traefik's built-in middleware covers the same categories with a smaller catalog and less enterprise-multi-tenant-scenario depth at this writing. Envoy provides low-level primitives (filters) that can implement equivalent security policy, but doing so from scratch (rather than configuring an existing plugin) is materially more implementation effort — effort more appropriate to a full service-mesh build-out than a gateway decision.

## 10. Maintainability

Traefik's simpler, more Kubernetes-idiomatic configuration model (dynamic service discovery via Kubernetes CRDs/annotations) is genuinely easier to maintain for straightforward ingress scenarios, which is exactly why it is retained as a credible option for lower-stakes internal/dev-environment gateways (§21). Kong's plugin/Admin-API model has more configuration surface but is well-documented and battle-tested at the multi-tenant enterprise scale AOS's primary API Gateway needs to serve. Envoy, absent a control plane, is the most maintenance-intensive of the three to operate correctly as a full gateway — its low-level primitive design assumes a higher-level system (a control plane) manages it, which is infrastructure AOS's current scale does not yet justify (§20).

## 11. Developer Experience

Kong and Traefik both offer declarative configuration and strong documentation; Traefik's zero-friction Kubernetes-native dynamic discovery is arguably the nicer DX for simple cases, while Kong's Admin API and plugin configuration model, though more involved, is the better-documented path for the specific multi-tenant auth/rate-limiting scenarios AOS's API Gateway Architecture (doc 002 §28) specifies. Envoy's DX as a standalone gateway is the weakest of the three — its configuration model (xDS) is designed to be driven by a control plane, not hand-authored for a gateway use case directly.

## 12. Ecosystem

Kong has the largest and most mature API-Gateway-specific plugin ecosystem of the three, directly relevant to the multi-tenant rate-limiting, authentication, and request-transformation needs Architecture §28 specifies. Envoy has an enormous ecosystem as a proxy/data-plane technology broadly, but that ecosystem is shaped around service-mesh use cases (Istio, service-to-service traffic management), not gateway-specific plugin patterns. Traefik's ecosystem is solid for Kubernetes-native ingress but thinner than Kong's for enterprise multi-tenant auth/rate-limiting scenarios specifically.

## 13. Community Maturity

Kong and Envoy both have large, mature, well-resourced communities (Envoy additionally benefiting from CNCF graduated-project status and broad industry adoption as a data-plane standard). Traefik's community is mature and active, though smaller in the specific enterprise-API-gateway segment than Kong's.

## 14. Licensing

Kong's open-source core is Apache-2.0-licensed, with additional capabilities gated to Kong Enterprise under separate commercial licensing — a license _split_, not a restrictive-license risk in the SSPL/Elastic-License sense (§3.14's Search Engine category); the nuance to track is feature availability, not license-type risk. Traefik is fully MIT-licensed with no tiered split. Envoy is fully Apache-2.0-licensed with no tiered split. All three are acceptable from a pure open-source-license-type standpoint; Kong's tiered-feature-split is the one licensing-adjacent nuance carried into §16 and §20.

## 15. Cloud Compatibility

All three are Kubernetes-deployable (self-hosted or via managed/cloud-marketplace offerings), consistent with Architecture §11's single deployment topology. No candidate is disqualified or differentiated on this dimension.

## 16. Vendor Lock-in

Kong's OSS core covers AOS's near-term multi-tenant gateway needs without requiring Kong Enterprise licensing; the named risk — tracked explicitly in `risk/risk-register.md` RISK-010 — is that a specific Enterprise-tier feature gap (e.g., an advanced multi-tenant rate-limiting policy not available in the OSS tier) could force an unplanned mid-project move to Kong Enterprise licensing or a different gateway. This risk is mitigated by treating it as a named, monitored checkpoint (the 1,000-dealer cost tier, per TSR §3.15) rather than a silent assumption. Traefik and Envoy carry effectively zero licensing-tier lock-in risk (no Enterprise-feature split of comparable scope), though Traefik's plugin ecosystem depth for AOS's specific enterprise auth/rate-limiting needs is the trade-off accepted in exchange (§20).

## 17. Estimated Cost

See [`cost-analysis/cost-model-100-1000-10000-dealers.md`](../cost-analysis/cost-model-100-1000-10000-dealers.md). API Gateway infrastructure cost is scoped within the general Compute Infrastructure line (§3 of the cost model) rather than broken out independently, since Kong OSS, Traefik, and Envoy are all self-hosted, non-metered-per-request software running on the same Kubernetes clusters already budgeted for Core Runtime services. The cost dimension that _is_ independently material is the potential Kong Enterprise licensing cost named in §16 — explicitly flagged for re-evaluation at the 1,000-dealer checkpoint (TSR §3.15) rather than budgeted preemptively, since it is a contingent, not a certain, cost.

## 18. Pros

- Kong: plugin architecture philosophically aligned with AOS's own Plugin-First principle; deepest, most battle-tested plugin ecosystem for multi-tenant rate-limiting/auth/transformation.
- Traefik: lowest-friction Kubernetes-native operational model; fully MIT-licensed with no tiered feature split; strong option for lower-stakes internal/dev gateways.
- Envoy: highest raw performance/scalability ceiling; fully open (Apache-2.0), CNCF-graduated, industry-standard data plane.

## 19. Cons

- Kong: OSS/Enterprise feature split introduces a named, monitored licensing-cost risk at scale (`risk/risk-register.md` RISK-010).
- Traefik: thinner plugin ecosystem for the specific enterprise multi-tenant auth/rate-limiting scenarios Architecture §28 requires, relative to Kong.
- Envoy: not itself a complete API Gateway product; reaching gateway-grade policy enforcement typically requires a control plane (e.g., Istio), which is more infrastructure than AOS's current scale target justifies.

## 20. Trade-offs

Kong's plugin/Enterprise-tier feature split means some advanced capabilities may require Kong Enterprise licensing at scale; mitigated by Kong's open-source core covering AOS's near-term needs, with the licensing trade-off explicitly revisited at the 1,000-dealer cost checkpoint (TSR §3.15) rather than left as an open-ended "maybe later." Choosing Traefik instead would avoid this specific risk but accept a materially thinner enterprise-auth/rate-limiting plugin ecosystem today; choosing Envoy instead would mean building a substantial amount of gateway-grade policy logic from lower-level primitives, or adopting a full service mesh earlier than AOS's current scale justifies.

## 21. Final Recommendation

**Kong** — its plugin architecture is philosophically aligned with AOS's own Plugin-First principle (Constitution §3.1), and its plugin ecosystem has mature, battle-tested options for the multi-tenant rate-limiting, authentication, and request-transformation needs the API Gateway Architecture (doc 002 §28) specifies. **Traefik** is a credible, simpler alternative particularly strong for Kubernetes-native Ingress use cases and may be adopted for lower-stakes internal/dev-environment gateways, but its plugin ecosystem depth for enterprise multi-tenant auth/rate-limiting scenarios is thinner than Kong's at present. **Envoy** is not recommended as a standalone Gateway choice for AOS — it is more commonly the _data plane_ underneath a service-mesh control plane (e.g., Istio), which is more infrastructure than the platform's current scale target justifies; it remains a Future Consideration if/when a full service mesh becomes necessary. This matches, without alteration, the Final Recommendation already made in TSR §3.15.

## 22. ADR Reference

[`adr/ADR-TSR-015-api-gateway.md`](../adr/ADR-TSR-015-api-gateway.md)

## 23. Migration Strategy

Per `migration/migration-and-upgrade-strategy.md`: the named trigger condition for Kong OSS → Kong Enterprise (or an alternative gateway) is a specific enterprise-tier feature gap (e.g., an advanced multi-tenant rate-limiting policy) becoming a blocking requirement, evaluated at the 1,000-dealer checkpoint — feature-gap-driven, not scale-driven alone. Migration approach: document the specific missing capability before committing to the licensing cost, rather than pre-emptively upgrading against a hypothetical future need. A parallel, less formally documented path exists for Kong→Traefik (or vice versa) for internal/dev-environment gateways specifically, which is a lower-stakes, non-production-critical configuration change given both tools' shared reverse-proxy foundation.

## 24. Future Consideration

- Re-evaluate Envoy (typically via Istio) if/when AOS's multi-region, service-to-service traffic complexity (Architecture §32 DR/multi-region model) grows to a point where a full service mesh's traffic-management, mTLS, and observability capabilities become independently justified — not as an API Gateway replacement, but as a complementary internal data-plane layer alongside Kong at the edge.
- Track Kong OSS feature-gap specifics proactively (per `risk/risk-register.md` RISK-010's mitigation) rather than discovering them reactively under production pressure, feeding directly into the 1,000-dealer licensing re-evaluation checkpoint named in TSR §3.15.
- Monitor Traefik's enterprise-auth/rate-limiting plugin ecosystem maturity over time; if it closes the gap with Kong's, it becomes a stronger candidate for promotion beyond internal/dev-environment use.
