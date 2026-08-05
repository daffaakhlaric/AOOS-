# Tech Stack Record — Backend Framework

Governs: [`docs/004-TECHNOLOGY-SELECTION-RECORD.md`](../docs/004-TECHNOLOGY-SELECTION-RECORD.md) §3.2
Decision Matrix: [`decision-matrix/backend-framework.md`](../decision-matrix/backend-framework.md)
ADR: [`adr/ADR-TSR-002-backend-framework.md`](../adr/ADR-TSR-002-backend-framework.md)

---

## Objective

Choose the framework hosting the TypeScript services selected in §3.1 — API Gateway integration layer, Core Runtime containers, Registry Service, and every other TypeScript-hosted service in the platform.

## Requirements

- First-class Dependency Injection (Constitution §3.13) — services must be composable and testable without ad-hoc singleton wiring.
- Modular structure compatible with Plugin-First (§3.1 Constitution principle) and Hexagonal/Ports-and-Adapters Architecture (§3.11 Constitution, ADR-005 in doc 002).
- Native or near-native OpenAPI generation for Contract-derived API surfaces (doc 003.5 §1.4 codegen goal).

## Candidate Technologies

- **NestJS**
- **Fastify**
- **Express**
- **FastAPI** (Python — considered only for the Python-scoped services from §3.1)
- **Go Fiber** (Go — considered only for the Go-scoped services from §3.1)

## Evaluation Matrix

Scoring: 1–5, higher is better for all dimensions except **Estimated Cost** and **Vendor Lock-in Risk**, where lower is better. NestJS, Fastify, and Express are scored on the shared TypeScript axis relevant to §3.1's primary-language decision; FastAPI and Go Fiber are scored for completeness since they are named candidates but are scoped to the polyglot minority, not the primary decision.

| Dimension                        | NestJS | Fastify | Express | FastAPI | Go Fiber |
| -------------------------------- | ------ | ------- | ------- | ------- | -------- |
| Performance                      | 3      | 5       | 3       | 4       | 5        |
| Scalability                      | 4      | 5       | 3       | 4       | 5        |
| Reliability                      | 4      | 4       | 4       | 4       | 4        |
| Security                         | 4      | 4       | 3       | 4       | 4        |
| Maintainability                  | 5      | 3       | 2       | 4       | 3        |
| Developer Experience             | 4      | 4       | 3       | 5       | 4        |
| Ecosystem                        | 5      | 4       | 5       | 4       | 3        |
| Community Maturity               | 5      | 4       | 5       | 4       | 3        |
| Licensing (1 = most permissive)  | 1      | 1       | 1       | 1       | 1        |
| Cloud Compatibility              | 5      | 5       | 5       | 5       | 5        |
| Vendor Lock-in Risk (1 = lowest) | 1      | 1       | 1       | 1       | 1        |
| Estimated Cost (1 = lowest)      | 2      | 2       | 2       | 2       | 2        |

All five candidates are MIT-licensed open source; none carries licensing or vendor lock-in risk.

## Benchmark

No dedicated `benchmarks/*.md` file exists for web frameworks specifically; the relevant directional data point is the same TechEmpower-class public web-framework benchmark family referenced in [`benchmarks/language-runtime-benchmarks.md`](../benchmarks/language-runtime-benchmarks.md) §3.1. Fastify is consistently reported (directionally, not AOS-measured) among the fastest Node.js HTTP frameworks, meaningfully ahead of Express on raw requests/sec; NestJS sits close to whichever underlying adapter it runs on (Express or Fastify) since NestJS itself is a structural layer, not a new HTTP engine — this is precisely why NestJS-on-Fastify captures both structure and throughput.

## Performance

NestJS's own request-handling performance is a function of its underlying HTTP adapter — it ships with an Express adapter by default but supports a Fastify adapter for latency-sensitive modules, which is exactly the configuration recommended here. Raw Express is measurably slower than Fastify under high concurrency due to Fastify's schema-based serialization and lower per-request overhead. Go Fiber (Go-scoped services only) and FastAPI (Python-scoped services only) are not competing on the primary decision axis — they apply only where §3.1 already scoped Go/Python.

## Scalability

All candidates scale horizontally as stateless containers under Kubernetes (§3.20); none is a scalability blocker at the request level. NestJS's modular structure (each Bounded-Context-aligned module independently composable) scales organizationally as well as technically — new modules can be added by different teams without destabilizing existing ones, directly supporting Plugin-First (Constitution §3.1) and ADR-006 (doc 002).

## Reliability

NestJS's DI container enforces explicit lifecycle management (module init/teardown hooks), reducing a class of resource-leak bugs common in ad-hoc Express apps. Fastify's schema-based request/response validation catches malformed payloads before they reach business logic, a reliability benefit that compounds well with NestJS's own DTO/pipe validation layer when the two are combined.

## Security

NestJS provides built-in guards, interceptors, and pipes that make cross-cutting security concerns (authentication checks, input validation, rate-limiting) declarative and consistently applied across every module, rather than left to per-route developer discipline as in bare Express. Fastify's schema validation additionally closes off a class of injection/malformed-input vectors at the framework level.

## Maintainability

NestJS is the strongest of the group on this dimension specifically because its opinionated module/provider/controller structure is the closest match to Hexagonal Architecture (ports/adapters as injectable providers) and Plugin-First of any Node.js framework — new engineers onboard into a consistent structure rather than whatever convention a given Express codebase happened to settle on. Bare Express is the weakest here precisely because it enforces no structure at all, which is why it is not recommended standalone.

## Developer Experience

NestJS's decorator-based routing, DI, and OpenAPI (Swagger) generation give it strong DX for exactly the kind of Contract-First, schema-derived API surface doc 003.5 requires — much of the OpenAPI surface can be generated from the same decorators that define the route, reducing double-maintenance of API documentation. Fastify's DX is excellent for teams comfortable owning more structure themselves. FastAPI (Python-scoped) is widely regarded as having exceptional DX for its own ecosystem, consistent with its use in the AI/data tooling scope.

## Ecosystem

NestJS and Express both draw on the broader Node.js/npm ecosystem, the largest in the industry; NestJS additionally has its own large plugin/module ecosystem (guards, interceptors, official integrations for TypeORM/Drizzle/GraphQL/microservices transports) that maps directly onto AOS's own plugin needs. Fastify's plugin ecosystem is strong but smaller than Express's raw middleware ecosystem, though Fastify's plugin encapsulation model is architecturally cleaner.

## Community Maturity

Express remains the largest and longest-established Node.js framework community; NestJS's community, while younger, has grown quickly and is now the de facto standard for structured enterprise Node.js backends, with strong long-term maintenance signals (regular major version cadence, corporate and independent contributor base). Fastify's community is smaller but mature and stable.

## Licensing

NestJS: MIT. Fastify: MIT. Express: MIT. FastAPI: MIT. Go Fiber: MIT. All five are fully permissive open source with no commercial-use restriction.

## Cloud Compatibility

All five run as standard containerized Node.js/Python/Go processes with no cloud-specific dependencies, deployable identically across any Kubernetes-based cloud or self-hosted environment (§3.20), consistent with the master doc §6 Compatibility Matrix.

## Vendor Lock-in

None of the five candidates introduces vendor lock-in — all are open-source frameworks with no proprietary hosted-service dependency. Switching frameworks later (e.g., from NestJS to a lighter framework for a specific service) is an engineering-effort cost, not a contractual or licensing one.

## Estimated Cost

No licensing cost for any candidate. The practical cost driver is engineering ramp-up time: NestJS's steeper initial learning curve (relative to bare Express) is a one-time onboarding cost, offset by lower long-term maintenance cost from its enforced structure. See [`cost-analysis/cost-model-100-1000-10000-dealers.md`](../cost-analysis/cost-model-100-1000-10000-dealers.md) §3 (Compute Infrastructure) for how backend service resource sizing feeds the broader cost model — framework choice has a secondary effect on this line via per-request memory/CPU efficiency (Fastify-adapter NestJS modules are recommended precisely for the services where this secondary effect matters).

## Pros

- NestJS's module/provider/DI structure is the closest off-the-shelf match to Hexagonal Architecture and Plugin-First of any Node.js framework.
- Decorator-based OpenAPI generation aligns directly with Contract-First codegen goals (doc 003.5 §1.4).
- Dual Express/Fastify adapter support means raw performance is still available where a module needs it, without abandoning NestJS's structure.
- FastAPI and Go Fiber slot cleanly into the already-scoped Python and Go services from §3.1 without requiring a separate framework decision process.

## Cons

- NestJS's opinionated structure has a steeper initial learning curve than bare Express or Fastify.
- Running NestJS-on-Express by default and switching specific modules to Fastify is an extra configuration decision per module, versus a single uniform choice.
- NestJS is one more abstraction layer versus using Fastify directly, which could be seen as unnecessary overhead for very simple services (mitigated by NestJS's compatibility with Fastify's raw performance).

## Trade-offs

NestJS's opinionated structure has a steeper initial learning curve than bare Express/Fastify, accepted because it enforces the architectural discipline the Constitution already mandates (DI, Hexagonal boundaries, Plugin-First modularity) rather than relying on developer convention, which does not scale reliably across a growing team. The alternative — bare Fastify or Express with team-enforced conventions — would require re-inventing, in-house, much of what NestJS already provides as a maintained framework, and would be more prone to structural drift as the team grows (Constitution §1.2, don't reinvent solved problems).

## Final Recommendation

**NestJS** — its module/provider/DI system is structurally the closest match to Hexagonal Architecture and Plugin-First out of the box, decorator-based OpenAPI generation aligns with Contract-First codegen goals, and it sits on top of Express/Fastify adapters so raw performance is still available where needed. **Fastify** is retained as the underlying HTTP adapter for latency-sensitive NestJS modules. **Express is not recommended as a standalone choice.** **FastAPI** is used only within the Python-scoped services from §3.1. **Go Fiber** is used only within the Go-scoped services from §3.1. This matches the master TSR §3.2 Final Recommendation exactly.

## ADR Reference

[`adr/ADR-TSR-002-backend-framework.md`](../adr/ADR-TSR-002-backend-framework.md)

## Migration Strategy

No named migration path exists for this category in [`migration/migration-and-upgrade-strategy.md`](../migration/migration-and-upgrade-strategy.md) — backend framework choice is a foundational, per-service structural decision rather than a "default + escape hatch" infrastructure dependency with an external trigger condition. If a specific NestJS module proves to be a genuine performance bottleneck, the documented mitigation is switching that module's HTTP adapter from Express to Fastify (already supported natively by NestJS), not a framework migration.

## Future Consideration

If NestJS's DI/module overhead is ever measured as a genuine bottleneck for a specific high-throughput service, migrating that single service to bare Fastify (retaining NestJS everywhere else) is the documented escalation path — consistent with the platform-wide pattern of "prove the bottleneck before optimizing," not a speculative pre-optimization. Pulumi-style "infrastructure in the same language as the app" thinking (§3.21 Future Consideration) has no direct analogue here, but a future evaluation of Nest's Fastify-first defaults (rather than Express-first) is worth revisiting once the team has production data on which modules actually need the swap.
