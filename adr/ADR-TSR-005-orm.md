# ADR-TSR-005 — ORM

**Status:** Accepted

**Context:** Every NestJS service (§3.2) needs a TypeScript data-access layer for PostgreSQL/CockroachDB (§3.4) that does not fight Row-Level Security — specifically, per-request session-variable-scoped tenant context (`SET LOCAL app.tenant_id`) must be reliably scoped to the correct connection, not leaked across a pooled connection to a different tenant's request (Constitution RULE-016, DDD §25) — while offering acceptable performance overhead and strong TypeScript type inference aligned with Contract-schema-derived types (doc 003.5 §1.4). Candidates evaluated: Prisma, Drizzle, TypeORM — full evaluation in [`tech-stack/orm.md`](../tech-stack/orm.md) and [`decision-matrix/orm.md`](../decision-matrix/orm.md).

**Decision:** Drizzle is the ORM/data-access layer for all TypeScript services accessing PostgreSQL/CockroachDB.

**Consequences:** Every service's persistence adapter is written against Drizzle's SQL-first query builder rather than Prisma's schema-first generated client, requiring more SQL fluency from contributors and accepting a less mature migration/admin-tooling ecosystem than Prisma's. In exchange, per-request RLS session-variable scoping is straightforward to guarantee correctly, and each service's runtime footprint avoids Prisma's separate query-engine binary. Because Drizzle sits behind each service's Hexagonal persistence-adapter interface (§3.11 Constitution), any future service-level ORM change is contained to that adapter and does not require a platform-wide migration.

**Alternatives Considered:**

- **Prisma** — rejected: its own connection pooling and prepared-statement caching have documented community-reported friction with per-request RLS context switching, a correctness risk unacceptable for the platform's core Tenant Isolation guarantee, despite Prisma's superior developer experience, migration tooling, and larger ecosystem.
- **TypeORM** — rejected: comparatively slower community/maintenance velocity, and its decorator/ActiveRecord-style entity pattern fits poorly with the Hexagonal Architecture's persistence-as-adapter model, intertwining domain entities with persistence concerns in a single decorated class.
