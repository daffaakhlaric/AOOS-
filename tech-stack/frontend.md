# Tech Stack Record — Frontend

Governs: [`docs/004-TECHNOLOGY-SELECTION-RECORD.md`](../docs/004-TECHNOLOGY-SELECTION-RECORD.md) §3.3
Decision Matrix: [`decision-matrix/frontend.md`](../decision-matrix/frontend.md)
ADR: [`adr/ADR-TSR-003-frontend.md`](../adr/ADR-TSR-003-frontend.md)

---

## Objective

Choose the framework for the Dealer Admin Dashboard and Sales Console — the platform's primary human-facing surface, and (per Architecture §38) the target of the `ui-components` package.

## Requirements

- Server-side rendering for dashboard performance at scale (initial load and SEO/perceived-performance are secondary but real considerations for the marketing-adjacent surfaces).
- Strong component ecosystem to support a growing set of feature surfaces (Sales Console, multi-branch reporting, Agent/Workflow admin UI, per Architecture §38).
- Large hiring pool.
- Good support for real-time data — Hot Lead notifications, live campaign metrics (DDD §12 Domain Events surfaced to the UI).

## Candidate Technologies

- **Next.js**
- **React (bare, hand-assembled toolchain)**
- **Vue** (with Nuxt as its meta-framework equivalent)
- **SvelteKit**

## Evaluation Matrix

Scoring: 1–5, higher is better for all dimensions except **Estimated Cost** and **Vendor Lock-in Risk**, where lower is better.

| Dimension                        | Next.js | React (bare) | Vue | SvelteKit |
| -------------------------------- | ------- | ------------ | --- | --------- |
| Performance                      | 4       | 3            | 4   | 5         |
| Scalability                      | 5       | 3            | 4   | 4         |
| Reliability                      | 5       | 3            | 4   | 4         |
| Security                         | 4       | 3            | 4   | 4         |
| Maintainability                  | 4       | 2            | 4   | 4         |
| Developer Experience             | 5       | 3            | 4   | 5         |
| Ecosystem                        | 5       | 4            | 4   | 3         |
| Community Maturity               | 5       | 5            | 4   | 3         |
| Licensing (1 = most permissive)  | 1       | 1            | 1   | 1         |
| Cloud Compatibility              | 5       | 4            | 4   | 4         |
| Vendor Lock-in Risk (1 = lowest) | 2       | 1            | 1   | 1         |
| Estimated Cost                   | 2       | 3            | 2   | 2         |

Next.js scores a 2 (not 1) on Vendor Lock-in Risk because its most advanced hosting-optimized features (ISR edge behaviors, some deployment conveniences) are most seamless on Vercel specifically, though the framework itself is fully open-source (MIT) and deployable anywhere Node.js runs — this is a soft, not hard, lock-in and is addressed under Vendor Lock-in below.

## Benchmark

No dedicated `benchmarks/*.md` file exists for frontend frameworks. The relevant directional, industry-known facts: SvelteKit's compiler-based approach (no virtual DOM, smaller runtime bundle) consistently benchmarks ahead of React-based frameworks on raw client-side rendering speed and bundle size in public framework-comparison benchmarks (e.g., js-framework-benchmark-class results); Next.js's React Server Components and streaming SSR narrow the practical gap for dashboard-style, data-heavy pages where server round-trip and hydration strategy dominate over raw client framework speed. These are directional industry patterns, not AOS-measured figures.

## Performance

SvelteKit has the strongest raw client-side performance characteristics of the four (smaller bundles, no virtual-DOM diffing overhead), which is a real, acknowledged advantage. Next.js narrows this gap for AOS's actual use case — a data-heavy, SSR/ISR-rendered admin dashboard where server-side rendering strategy and caching (Next.js's core strength) matter more than raw client-side re-render speed. Bare React without a meta-framework requires hand-building SSR, which is both slower to build and, without careful custom engineering, typically slower to run than a mature meta-framework's built-in solution.

## Scalability

Next.js's built-in ISR (Incremental Static Regeneration) and edge-caching support scale dashboard read-heavy pages (reporting views, campaign metrics) without custom caching infrastructure. Vue/Nuxt offers comparable SSR scalability. SvelteKit's SSR scalability is credible but has a smaller track record at large-application scale than Next.js. Bare React has no built-in answer to server-rendering scalability at all — it must be hand-assembled, which is precisely why it is not a complete answer on its own.

## Reliability

Next.js's maturity (used in production by a very large number of enterprise SaaS dashboards) gives it the deepest track record of the four for exactly AOS's use case. Its release cadence and backward-compatibility discipline are well-established. Vue/Nuxt is similarly mature. SvelteKit, while stable, is younger as a full meta-framework and has a shorter large-scale-production track record. Bare React's reliability is strong at the library level but the "reliability" of a hand-assembled SSR toolchain depends entirely on the quality of that in-house assembly, an unnecessary risk versus adopting a maintained meta-framework.

## Security

All four benefit from React/Vue/Svelte's mature XSS-mitigation defaults (auto-escaping by default) and active security-disclosure processes. Next.js's built-in API routes and middleware provide a single place to enforce authentication/authorization checks consistently (working with Keycloak, §3.16) — a security-relevant maintainability benefit not automatically present in a bare React SPA calling arbitrary self-assembled backend endpoints.

## Maintainability

Next.js's file-based routing and established server/client component conventions give new engineers a consistent structure to onboard into, mirroring the same argument made for NestJS on the backend (§3.2). Vue/Nuxt is comparably maintainable within the Vue ecosystem. SvelteKit is maintainable but its smaller ecosystem means fewer established patterns/examples for large enterprise dashboards specifically. Bare React scores lowest here — without a meta-framework's enforced conventions, structure drifts per-team, the same argument that disqualified bare Express in §3.2.

## Developer Experience

Next.js and SvelteKit both offer excellent DX (fast refresh, file-based routing, strong tooling). Next.js's DX advantage for AOS specifically is sharing the TypeScript language and much of the tooling (ESLint, Vitest per §3.24) with the rest of the platform, reducing context-switching cost for full-stack contributors — the same "keep it in one ecosystem" argument made in §3.1. Vue's DX is strong but introduces a second component-templating paradigm (Vue SFCs) alongside the JSX used everywhere else in a React-based stack.

## Ecosystem

React's component ecosystem is the largest and deepest of any frontend framework in the industry, directly benefiting Next.js as its meta-framework, and matches Architecture §38's `ui-components` package expectations (built on a widely-supported component primitive layer). Vue's ecosystem is strong but smaller. SvelteKit's ecosystem is the smallest of the four, a direct consequence of Svelte's comparatively newer and smaller adoption base.

## Community Maturity

React (and by extension Next.js) has the largest developer community and hiring pool of any frontend option in the industry, a decisive factor for an enterprise SaaS with many future feature surfaces. Vue has a large, mature community, particularly strong in specific regional markets. SvelteKit's community, while enthusiastic and growing, is meaningfully smaller in absolute hiring-pool terms.

## Licensing

Next.js: MIT (Vercel-maintained, open source). React: MIT (Meta-maintained, open source). Vue: MIT. SvelteKit: MIT. All four are fully permissive open source with no commercial-use restriction, regardless of which company stewards the project.

## Cloud Compatibility

Next.js runs natively on Node.js-compatible hosting anywhere (Vercel, self-hosted via `next start`/Docker, or any Kubernetes-based environment per §3.20), with Vercel offering the most seamless experience for its most advanced edge/ISR features but no hard requirement to use it. Vue/Nuxt and SvelteKit are similarly portable. Bare React deploys wherever its custom-built server does.

## Vendor Lock-in

Next.js's core framework is open-source and deployable on any Node.js-capable infrastructure, including the Kubernetes-based deployment topology already assumed platform-wide (§3.20, master doc §6). The soft lock-in risk is that a subset of Next.js's most advanced features (certain edge-runtime behaviors, some ISR nuances) are most seamless on Vercel's own hosting; AOS mitigates this by deploying Next.js as a standard containerized Node.js service under Kubernetes rather than depending on Vercel-specific infrastructure, consistent with the platform's general "avoid vendor-managed hosting lock-in" posture (Constitution principle in master TSR §1, point 2).

## Estimated Cost

No licensing cost for any candidate. Next.js's largest hiring pool of the four keeps engineering cost lower than SvelteKit's narrower talent pool would imply at comparable seniority. Self-hosting Next.js under Kubernetes (rather than paying for Vercel's managed hosting tier) is the assumed deployment model, consistent with the compute infrastructure costs already modeled in [`cost-analysis/cost-model-100-1000-10000-dealers.md`](../cost-analysis/cost-model-100-1000-10000-dealers.md) §3 (Compute Infrastructure) and §10 (Traffic/CDN/Egress), rather than a separate managed-hosting line item.

## Pros

- Removes the need to hand-assemble a React SSR toolchain — bare React alone is not a complete answer.
- Largest component ecosystem and hiring pool of the four candidates, matching Architecture §38's `ui-components` expectations.
- Shares TypeScript and much of the tooling chain with the rest of the platform, reducing full-stack context-switching cost.
- Built-in ISR/edge caching directly benefits the read-heavy dashboard/reporting use case without custom infrastructure.

## Cons

- Opinionated file-based routing and server/client component split add a learning curve versus bare React.
- A subset of the most advanced Next.js features are most seamless on Vercel's own hosting, a soft vendor-adjacency risk (mitigated by self-hosting under Kubernetes).
- SvelteKit's raw performance/bundle-size advantage is real and forgone in favor of ecosystem/hiring-pool depth.

## Trade-offs

Next.js's opinionated file-based routing and server/client component split add a learning curve versus bare React, accepted for the SSR performance and ecosystem payoff. SvelteKit's raw performance edge is real but is outweighed for an enterprise SaaS dashboard with many future feature surfaces (Sales Console, multi-branch reporting, Agent/Workflow admin UI) by Next.js's larger ecosystem and hiring pool — a performance advantage that cannot be capitalized on if the team cannot hire for it or if the component ecosystem cannot keep pace with feature growth.

## Final Recommendation

**Next.js** — React's ecosystem dominance plus built-in SSR/ISR/routing removes the need to hand-assemble a React toolchain, and its hiring pool and component-library ecosystem is the largest of the four. **Vue and SvelteKit** are technically credible (SvelteKit in particular has strong performance characteristics) but lose on ecosystem depth and hiring availability for an enterprise SaaS dashboard with many future feature surfaces. This matches the master TSR §3.3 Final Recommendation exactly.

## ADR Reference

[`adr/ADR-TSR-003-frontend.md`](../adr/ADR-TSR-003-frontend.md)

## Migration Strategy

No named migration path exists for this category in [`migration/migration-and-upgrade-strategy.md`](../migration/migration-and-upgrade-strategy.md) — frontend framework is a foundational choice for the Dashboard/Sales Console with no external trigger-condition-driven escape hatch defined at this time. A framework migration, if ever needed, would be a full re-platforming effort scoped and planned independently, not a pre-documented "default + escape hatch" pattern like Database or Cache.

## Future Consideration

If a specific dashboard surface is measured to have a genuine client-side performance problem attributable to React's runtime overhead (not server-rendering strategy, which Next.js already addresses), a Svelte/SvelteKit-based rewrite of that specific surface is a plausible, narrowly-scoped future option — following the same "prove the bottleneck first" discipline applied to Rust in §3.1. Vercel-hosted deployment (versus self-hosted Kubernetes) may also be revisited if the operational savings of managed hosting are shown to outweigh the platform's general preference for self-hosted infrastructure at a specific team-size/scale checkpoint.
