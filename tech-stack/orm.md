# Tech Stack Record — ORM

Governs: [`docs/004-TECHNOLOGY-SELECTION-RECORD.md`](../docs/004-TECHNOLOGY-SELECTION-RECORD.md) §3.5
Decision Matrix: [`decision-matrix/orm.md`](../decision-matrix/orm.md)
ADR: [`adr/ADR-TSR-005-orm.md`](../adr/ADR-TSR-005-orm.md)

---

## Objective

Choose the TypeScript data-access layer for PostgreSQL/CockroachDB (§3.4) used across every NestJS service (§3.2).

## Requirements

- Must not fight Row-Level Security — session-variable-scoped tenant context (`SET LOCAL app.tenant_id`) must be reliably scoped per request/query, not leaked across pooled connections (Constitution RULE-016, DDD §25).
- Acceptable performance overhead versus raw SQL.
- Strong TypeScript type inference for alignment with Contract-schema-derived types (doc 003.5 §1.4).

## Candidate Technologies

- **Prisma**
- **Drizzle**
- **TypeORM**

## Evaluation Matrix

Scoring: 1–5, higher is better for all dimensions except **Estimated Cost** and **Vendor Lock-in Risk**, where lower is better.

| Dimension                        | Prisma | Drizzle | TypeORM |
| -------------------------------- | ------ | ------- | ------- |
| Performance                      | 3      | 5       | 3       |
| Scalability                      | 3      | 5       | 3       |
| Reliability                      | 4      | 4       | 3       |
| Security                         | 3      | 5       | 3       |
| Maintainability                  | 4      | 4       | 3       |
| Developer Experience             | 5      | 4       | 3       |
| Ecosystem                        | 5      | 3       | 4       |
| Community Maturity               | 5      | 3       | 4       |
| Licensing (1 = most permissive)  | 1      | 1       | 1       |
| Cloud Compatibility              | 5      | 5       | 5       |
| Vendor Lock-in Risk (1 = lowest) | 2      | 1       | 1       |
| Estimated Cost (1 = lowest)      | 2      | 2       | 2       |

Prisma scores 2 (not 1) on Vendor Lock-in Risk because its query-engine binary and its own connection-pooling layer (Prisma Accelerate/Data Proxy for serverless-friendly pooling) introduce a degree of Prisma-specific infrastructure dependency that Drizzle and TypeORM, both thin SQL-query-builder libraries with no separate engine process, do not carry.

## Benchmark

No dedicated `benchmarks/*.md` file exists for ORMs specifically. The relevant directional, publicly-documented facts: Drizzle's SQL-first, code-generation-free design produces queries with materially less runtime overhead than Prisma's query-engine-binary architecture (which serializes queries through a separate Rust-based engine process/binary) in commonly cited community benchmarks — a difference most pronounced under high query-per-second, low-latency workloads. TypeORM's ActiveRecord/DataMapper-hybrid pattern carries decorator-reflection overhead comparable to or greater than Prisma's in most reported comparisons. These are directional, not AOS-measured, figures.

## Performance

Drizzle's lack of a separate query-engine binary and its close-to-raw-SQL query builder give it the lowest runtime overhead of the three, relevant given the Core Runtime's many small services (§3.1) each making frequent, latency-sensitive database calls. Prisma's query engine binary adds a serialization/IPC hop per query that, while generally small in absolute terms, is a real per-request cost multiplied across a high-request-volume multi-tenant platform. TypeORM's decorator/reflection-based entity resolution carries comparable or greater overhead than Prisma's in most reported comparisons.

## Scalability

Drizzle's lightweight runtime footprint scales cleanly across the many-small-services Core Runtime model (§3.1's per-service pattern) without each service needing to bundle and initialize a separate query-engine process. Prisma's connection-pooling model was historically a scaling friction point for serverless/many-small-connections topologies (mitigated by Prisma Accelerate, itself an additional hosted dependency). TypeORM scales adequately but shares Prisma's heavier per-instance overhead without Prisma's more polished tooling to offset it.

## Reliability

All three are production-proven with active maintenance. Prisma's migration tooling (Prisma Migrate) is the most mature and battle-tested of the three for schema-evolution reliability. Drizzle's migration tooling (Drizzle Kit) is capable but younger and less battle-tested at large scale. TypeORM's migration tooling is functional but has a smaller and slower-moving maintenance cadence than either alternative, a factor in its non-recommendation.

## Security

This is the decisive dimension for AOS specifically. Drizzle's SQL-first design and lack of an intermediary query-engine/connection-pooling layer of its own make it straightforward to guarantee that a per-request `SET LOCAL app.tenant_id` RLS session variable is scoped correctly to the connection executing that request's query. Prisma's own connection pooling and prepared-statement caching have documented community-reported friction with per-request RLS context switching — because Prisma manages its own connection lifecycle somewhat opaquely relative to the request lifecycle, guaranteeing that a `SET LOCAL` (which is transaction/session-scoped in Postgres) lands on the correct pooled connection for the correct request requires extra care that Drizzle's simpler, closer-to-the-metal model avoids by construction. TypeORM has similar connection-abstraction friction to Prisma without Prisma's more mature tooling to mitigate it.

## Maintainability

Prisma's schema-first `.prisma` file and generated client give the most discoverable, IDE-friendly maintainability experience of the three, particularly for less SQL-fluent contributors. Drizzle's SQL-first TypeScript schema definitions are highly maintainable for a team comfortable reading close-to-SQL code (the expected profile for a backend team already comfortable with the platform's Hexagonal Architecture persistence-adapter pattern). TypeORM's decorator/ActiveRecord-style entity classes fit poorly with the Hexagonal Architecture's persistence-as-adapter model (§3.11 Constitution), since domain entities and persistence concerns become intertwined in a single decorated class — a structural maintainability cost specific to AOS's architecture, not ORMs in general.

## Developer Experience

Prisma has the most polished overall DX of the three: schema-first definitions, an excellent migration CLI, Prisma Studio's visual data browser, and best-in-class TypeScript autocomplete from its generated client. Drizzle's DX is strong and closing the gap quickly (its `drizzle-kit studio` is a comparable, if less mature, visual tool) but requires more comfort writing close-to-SQL query builder code. TypeORM's DX is adequate but trails both alternatives in tooling polish and community-reported satisfaction.

## Ecosystem

Prisma has the largest ecosystem of integrations, tutorials, and third-party tooling of the three, reflecting its position as the most broadly adopted TypeScript ORM at present. TypeORM, being older, has a large body of existing integrations and Stack-Overflow-era community answers, though its maintenance velocity has slowed. Drizzle's ecosystem is the youngest and smallest of the three but is growing quickly.

## Community Maturity

Prisma and TypeORM both have larger, longer-established communities than Drizzle, which is the newest of the three entrants. This is a real, acknowledged trade-off in choosing Drizzle — its community/tooling maturity is behind Prisma's, accepted because correctness of tenant isolation outweighs tooling polish for this specific, security-critical use case.

## Licensing

Prisma: Apache 2.0 (the core ORM/CLI; Prisma Accelerate/Data Proxy are separate hosted commercial products, not required to use Prisma itself). Drizzle: Apache 2.0. TypeORM: MIT. All three are fully permissive open source at the library level with no commercial-use restriction for self-hosted use.

## Cloud Compatibility

All three run as a standard TypeScript library within any Node.js process, fully compatible with the platform's Kubernetes-based deployment topology (§3.20) and requiring no cloud-specific infrastructure. Prisma's optional Accelerate/Data Proxy product is a separate, non-required hosted service that AOS does not need to adopt.

## Vendor Lock-in

Drizzle and TypeORM both carry the lowest vendor lock-in of the three — thin libraries with no separate engine process, fully self-contained within the application, and trivially replaceable with hand-written SQL if ever needed. Prisma's core library is similarly library-only, but its most polished serverless-scaling story runs through Prisma Accelerate, an optional hosted product; AOS's use of Prisma would not require Accelerate, keeping this a soft rather than hard lock-in risk if Prisma had been chosen.

## Estimated Cost

No licensing cost for any of the three at the library level. The practical cost consideration is engineering time: Drizzle's less mature tooling (relative to Prisma) means marginally more manual work for certain admin/introspection tasks, a one-time tooling-gap cost accepted in the master decision because it is outweighed by the RLS-correctness benefit. This does not materially move the infrastructure cost figures in [`cost-analysis/cost-model-100-1000-10000-dealers.md`](../cost-analysis/cost-model-100-1000-10000-dealers.md) §4 (Database), which are driven by database instance sizing, not ORM choice.

## Pros

- SQL-first design and lack of a separate query-engine binary make per-request RLS session variable scoping straightforward to guarantee correctly.
- Lighter runtime footprint fits the many-small-services Core Runtime model better than Prisma's heavier client generation step.
- Fully permissive Apache 2.0 license with no required hosted dependency.
- Close-to-SQL query builder aligns well with the Hexagonal Architecture's persistence-as-adapter model.

## Cons

- Ecosystem and tooling (migrations, admin UI) are less mature than Prisma's.
- Smaller community than Prisma or TypeORM, meaning fewer existing answers/examples for edge cases.
- Requires more SQL fluency from contributors than Prisma's schema-first, more abstracted model.

## Trade-offs

Drizzle's ecosystem and tooling (migrations, admin UI) is less mature than Prisma's, accepted because correctness of tenant isolation (Constitution RULE-016) outweighs developer-tooling polish. Prisma's superior DX and larger ecosystem are real and were seriously weighed, but the documented community friction between Prisma's own connection-pooling/prepared-statement-caching layer and per-request RLS context switching is a correctness risk the platform is not willing to accept for its core Tenant Isolation guarantee, given how central that guarantee is to the entire multi-tenant architecture (DDD §25).

## Final Recommendation

**Drizzle** — its SQL-first design and lack of a query-engine binary/connection-pooling layer of its own makes per-request RLS session variable scoping (`SET LOCAL app.tenant_id`) straightforward to guarantee correctly, whereas Prisma's connection pooling and prepared-statement caching have documented friction with per-request RLS context switching. Drizzle's lighter runtime footprint also fits the many-small-services Core Runtime model better than Prisma's heavier client generation step. **TypeORM is not recommended** — comparatively slower community/maintenance velocity and heavier decorator/ActiveRecord-style patterns that fit poorly with the Hexagonal Architecture's persistence-as-adapter model. This matches the master TSR §3.5 Final Recommendation exactly.

## ADR Reference

[`adr/ADR-TSR-005-orm.md`](../adr/ADR-TSR-005-orm.md)

## Migration Strategy

No named migration path exists for this category in [`migration/migration-and-upgrade-strategy.md`](../migration/migration-and-upgrade-strategy.md) — ORM choice is a per-service data-access-layer decision, not a "default + escape hatch" infrastructure dependency with an external trigger condition. Because Drizzle is used behind each service's persistence-adapter interface (Hexagonal Architecture, §3.11 Constitution), a future ORM swap for any single service would be contained to that service's adapter implementation and would not require a platform-wide migration plan — this containment is itself a direct benefit of the architecture, not a gap in this document.

## Future Consideration

If Drizzle's migration/admin tooling gap versus Prisma is not closed by the broader ecosystem within the Year 1–2 roadmap window, a targeted re-evaluation of Prisma for read-heavy, non-RLS-sensitive services only (e.g., an Analytics Warehouse read layer, per Architecture §22) is worth revisiting — since the RLS-correctness argument that disqualifies Prisma for tenant-scoped OLTP services does not apply with the same force to a context that does not carry per-tenant RLS session-variable requirements.
