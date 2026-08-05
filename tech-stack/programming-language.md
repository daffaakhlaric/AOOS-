# Tech Stack Record — Programming Language

Governs: [`docs/004-TECHNOLOGY-SELECTION-RECORD.md`](../docs/004-TECHNOLOGY-SELECTION-RECORD.md) §3.1
Decision Matrix: [`decision-matrix/programming-language.md`](../decision-matrix/programming-language.md)
ADR: [`adr/ADR-TSR-001-programming-language.md`](../adr/ADR-TSR-001-programming-language.md)

---

## Objective

Choose the language(s) the platform's Core Runtime, SDK, and services are built in — the foundational choice every other category in this TSR (framework, ORM, testing tooling) is downstream of.

## Requirements

- Async-first execution model (Constitution §3.7) — the platform's dominant workload is I/O-bound (LLM calls, DB queries, Tool invocations awaiting external systems).
- Strong static typing suited to Contract-schema-derived code generation (doc 003.5 §1.4 — Contracts are JSON Schema first, types are generated, not hand-authored twice).
- Mature ecosystem for both general web/API backend work and AI/LLM tooling.
- A hiring-viable talent pool at SaaS-startup-to-scaleup velocity — this is a Constitution §2 simplicity/pragmatism consideration, not a technical one alone.

## Candidate Technologies

- **TypeScript** (Node.js runtime)
- **Go**
- **Rust**
- **Python**

## Evaluation Matrix

Scoring: 1–5, higher is better for all dimensions except **Estimated Cost** and **Vendor Lock-in Risk**, where lower is better. "Vendor Lock-in Risk" here means language/runtime lock-in (how hard it would be to move off), not a cloud vendor.

| Dimension                                                   | TypeScript | Go  | Rust | Python |
| ----------------------------------------------------------- | ---------- | --- | ---- | ------ |
| Performance                                                 | 3          | 4   | 5    | 2      |
| Scalability                                                 | 4          | 5   | 5    | 3      |
| Reliability                                                 | 4          | 4   | 5    | 3      |
| Security                                                    | 4          | 4   | 5    | 3      |
| Maintainability                                             | 4          | 4   | 3    | 3      |
| Developer Experience                                        | 5          | 4   | 2    | 4      |
| Ecosystem                                                   | 5          | 4   | 3    | 5      |
| Community Maturity                                          | 5          | 4   | 3    | 5      |
| Licensing (1 = most permissive)                             | 1          | 1   | 1    | 1      |
| Cloud Compatibility                                         | 5          | 5   | 4    | 5      |
| Vendor Lock-in Risk (1 = lowest)                            | 1          | 1   | 1    | 1      |
| Estimated Cost (1 = lowest, mostly a hiring/velocity proxy) | 2          | 2   | 4    | 2      |

All four candidates are open-source with fully permissive licenses (MIT-style for TypeScript/Node tooling, BSD-3-Clause for Go, MIT/Apache-2.0 dual for Rust, PSF License for Python) — none carries meaningful licensing risk, which is why this dimension does not differentiate the decision. "Estimated Cost" is scored as a proxy for hiring cost and ramp-up velocity, since none of these languages carries a licensing fee.

## Benchmark

See [`benchmarks/language-runtime-benchmarks.md`](../benchmarks/language-runtime-benchmarks.md) — directional figures from TechEmpower-class public web-framework benchmarks and vendor documentation, not AOS-measured. Key directional takeaways: Rust > Go > TypeScript > Python on raw request throughput and memory footprint per request; Go and Rust both offer very high I/O concurrency ceilings via goroutines/async runtimes respectively; TypeScript's event-loop model is "High" on the same dimension, which matters more than raw throughput given AOS's actual bottleneck (external I/O wait, not CPU compute).

## Performance

Rust leads on raw throughput and memory efficiency, followed by Go, with TypeScript and Python trailing on CPU-bound work. However, AOS's Core Runtime workload is dominated by waiting on external systems (LLM provider APIs, Postgres queries, Tool HTTP calls) rather than CPU-bound computation, which narrows the practically-relevant performance gap between TypeScript/Node and Go considerably — both handle high I/O concurrency well. Go and the narrow Rust-future-consideration exist specifically for the minority of paths (Event Bus fan-out, API Gateway hot edge) where per-request memory footprint and tail latency at very high fan-out are the actual bottleneck.

## Scalability

All four scale horizontally as stateless service replicas under Kubernetes (§3.20); none is a scalability blocker at the request-volume level AOS targets. Go's goroutine model gives it the highest single-node concurrency ceiling of the practical (non-Rust) options, which is precisely why it is reserved for the consumer fan-out and gateway edge paths named in the master decision.

## Reliability

Go and Rust both benefit from low-pause or no-GC memory models, reducing tail-latency jitter under sustained load. TypeScript/Node's generational GC is well-understood and, for typical web workloads, produces acceptably low pause characteristics — the same pattern the entire Node.js web-service industry runs in production at scale. Python's GIL constrains CPU-bound reliability under concurrent load but is a non-issue for AOS's scoped, I/O-bound AI/data-tooling use.

## Security

All four have mature dependency-scanning and vulnerability-disclosure ecosystems (npm audit / Snyk for TS, `govulncheck` for Go, `cargo audit` for Rust, `pip-audit` for Python). Rust's memory-safety-by-construction (no buffer overflows, no use-after-free) gives it the strongest inherent security posture, relevant to why it remains a live Future Consideration rather than a rejected candidate. TypeScript's security surface is dominated by third-party npm supply-chain risk, which is a real, actively-managed operational concern (Constitution §20) rather than a language-design flaw.

## Maintainability

TypeScript's structural type system, broad IDE tooling (LSP-driven autocomplete/refactoring), and the sheer size of the available engineering pool make it the easiest of the four to keep maintainable across a growing, possibly-turnover-affected team. Go's simplicity-by-design (small language surface, opinionated formatting via `gofmt`) is a maintainability strength shared by the platform's chosen scope for it. Rust's learning curve is the primary maintainability cost that keeps it out of v1.

## Developer Experience

TypeScript has the richest DX of the four for the specific job of "build a Contract-schema-driven web backend and SDK" — first-class JSON Schema/type tooling, the largest package ecosystem, and a single language shared with the Next.js frontend (§3.3) reduces context-switching cost for full-stack contributors. Go's DX is strong but more verbose for the kind of schema-driven codegen doc 003.5 requires. Rust's DX, while improving, still carries the steepest learning curve (borrow checker) of the four.

## Ecosystem

TypeScript/Node's package ecosystem (npm) is the largest in the industry by package count and is exceptionally strong for both web/API tooling and a fast-growing set of AI/LLM SDKs. Python's AI/ML ecosystem remains the dominant one industry-wide (this is why it is scoped in, not excluded). Go's ecosystem is strong specifically for infrastructure/networking-class services. Rust's ecosystem is capable but comparatively thinner for the AI/LLM tooling AOS depends on.

## Community Maturity

TypeScript, Go, and Python all have large, long-established communities with predictable release cadences and low bus-factor risk. Rust's community is mature and growing quickly but is smaller in absolute headcount, which is the main driver of its "not adopted for v1" status rather than any technical deficiency.

## Licensing

TypeScript/Node.js: MIT license (Node.js core) / permissive OSS toolchain throughout. Go: BSD-3-Clause (Go toolchain, maintained by Google). Rust: dual MIT/Apache-2.0. Python: PSF License (Python Software Foundation License, BSD-style permissive). None carries copyleft or commercial-use restriction; none is a licensing concern for a commercial multi-tenant SaaS.

## Cloud Compatibility

All four run natively in Docker containers on Kubernetes (§3.19, §3.20) with mature base images, and all four have first-class SDKs for every major cloud provider and every other technology selected elsewhere in this TSR (see the master doc §6 Compatibility Matrix). No candidate is cloud-compatibility-constrained.

## Vendor Lock-in

None of the four candidates carries language-level vendor lock-in — all are open-source, community/foundation-governed (or, for Go, Google-stewarded but fully open-source and forkable), and runnable on any cloud or on-prem infrastructure. The only lock-in-adjacent risk is human-capital lock-in (a smaller Rust talent pool makes team continuity riskier), which is captured under Maintainability/DX rather than this dimension.

## Estimated Cost

Primarily a hiring/velocity cost, not a licensing cost. TypeScript and Python both draw from very large, comparatively lower-cost-to-hire talent pools. Go hiring cost is moderate. Rust engineers command a premium and are scarcer, which is a direct input into why Rust is deferred rather than adopted for v1 — see [`cost-analysis/cost-model-100-1000-10000-dealers.md`](../cost-analysis/cost-model-100-1000-10000-dealers.md) §1 for how engineering velocity assumptions feed the broader cost model (the cost model itself prices infrastructure, not headcount, but the same "avoid a narrow, expensive talent pool for v1" logic that justifies the AI-cost-routing strategy in §4 of the master TSR applies here to language choice).

## Pros

- TypeScript-first keeps the majority of the platform in a single language, minimizing cross-team coordination and hiring-pool fragmentation.
- Go is scoped to a small, clearly bounded set of performance-critical services, capturing its concurrency/latency advantage without polyglot sprawl.
- Python's AI/ML ecosystem dominance is captured exactly where it is decisive (embedding pipelines, data tooling) without becoming the platform's general-purpose language.
- All three chosen languages are permissively licensed with no vendor lock-in.

## Cons

- A three-language footprint (TS/Go/Python) is real cross-team coordination overhead versus a single-language shop (tracked as RISK-012 in the risk register).
- TypeScript's single-threaded event loop is a genuine ceiling for CPU-bound work, requiring the Go carve-out rather than a single clean answer.
- Deferring Rust means AOS forgoes its safety/performance ceiling until a specific hot path proves the investment justified — a deliberate, revisitable trade, not a permanent rejection.

## Trade-offs

A three-language footprint costs more cross-team coordination than a single-language shop, but each addition (Go, Python) is scoped to a narrow, explicitly justified purpose rather than "use whatever a given engineer prefers," consistent with Constitution §2's bias against unjustified tooling sprawl. The alternative — an all-TypeScript platform — would leave the Event Bus fan-out layer and API Gateway hot edge without a clean answer to their latency/memory requirements, and would exclude Python's dominant AI/ML tooling ecosystem from data-heavy Knowledge/embedding work.

## Final Recommendation

**TypeScript as the primary language** for Core Runtime, Agent Runtime, Workflow Runtime, Tool Manager, API Gateway, SDK, and Dashboard. **Go for a small, explicitly scoped set of performance-critical services**: the Event Bus consumer fan-out layer and the API Gateway's hot edge path. **Python for AI/data tooling only**: embedding pipeline scripts, Simulation Contract scenario generation, and data-science-style Knowledge ingestion work. **Rust is not adopted for v1** — flagged as a Future Consideration, not a rejection. This matches the master TSR §3.1 Final Recommendation exactly.

## ADR Reference

[`adr/ADR-TSR-001-programming-language.md`](../adr/ADR-TSR-001-programming-language.md)

## Migration Strategy

No named migration path exists for this category in [`migration/migration-and-upgrade-strategy.md`](../migration/migration-and-upgrade-strategy.md) — programming language is a foundational choice, not a "default + escape hatch" infrastructure decision, and migrating an existing service's implementation language is treated as an implementation-time engineering decision scoped to a specific proven bottleneck, not a pre-planned platform migration. The one adjacent, explicitly planned change is captured under Future Consideration below (selective Rust adoption), which — per the Technology Roadmap Years 4–5 — would be scoped to one proven hot path at a time, never a platform-wide rewrite.

## Future Consideration

Selective Rust adoption for any proven, measured hot-path bottleneck (Technology Roadmap Years 4–5) once a specific service's performance ceiling under TypeScript or Go is demonstrated, not assumed, to be a limiting factor. Go's scope may also expand if additional services prove to be genuinely concurrency/latency-bound in production, following the same "prove it first" discipline. Python's role could expand if AOS's AI/data tooling surface grows materially (e.g., a dedicated ML feature-engineering pipeline), but would remain scoped to AI/data tooling, not general backend services.
