# ADR-TSR-006 — Valkey as the Platform Cache

**Status:** Accepted

**Context:** AOS requires a sub-millisecond in-memory store for the Memory Contract's Working Memory tier, per-tenant rate-limit counters (Kong plugins, Architecture ADR-011 fair-share queueing), session data, and the backing store for the BullMQ job queue (§3.7). The historical default choice for this role, Redis, relicensed as of version 7.4 (2024) from the permissive BSD-3-Clause license to a dual RSALv2/SSPL license — neither of which is OSI-approved open source, and both of which carry "as a service" competitive-use restrictions directly relevant to a platform that may offer managed/hosted tiers in the future (master TSR §1 guiding philosophy #2). This is a licensing decision under a technical-compatibility constraint: whatever is chosen must remain a drop-in Redis-protocol-compatible store, since the client libraries, BullMQ, and every service's Working Memory access pattern all assume that protocol.

**Decision:** Adopt **Valkey**, the Linux-Foundation-governed, BSD-3-Clause-licensed fork of Redis, as the platform cache for all environments (Working Memory, rate limiting, session data, BullMQ backing store). Redis (post-7.4) is not adopted due to licensing risk. DragonflyDB is evaluated and explicitly deferred as a named Future Consideration (see Migration Strategy below), not adopted at this stage.

**Consequences:**

- The platform remains fully free to self-host and to potentially offer a managed AOS tier in the future without license-driven legal exposure.
- Valkey is younger as an independently-branded project than Redis (forked 2024); the operational risk this introduces is mitigated by full protocol/client-library compatibility (near-zero migration cost if a future switch is ever needed) and by Linux Foundation governance plus major-cloud-vendor (AWS, Google Cloud) backing, which meaningfully de-risks long-term maintenance continuity relative to a smaller independent fork.
- A future cost- or throughput-driven migration to DragonflyDB remains available as a low-risk, protocol-compatible swap (see `migration/migration-and-upgrade-strategy.md`), without needing to first pass back through Redis.
- All Working Memory, rate-limiting, and BullMQ operational runbooks and monitoring integrations are written against the Redis protocol, which both Valkey and DragonflyDB honor, keeping this decision reversible at the infrastructure layer without an application-code rewrite.

**Alternatives Considered:**

- **Redis (post-7.4)** — rejected as the go-forward default: its RSALv2/SSPL dual license introduces direct commercial/legal risk for a platform that intends to remain free to self-host and to potentially offer managed tiers, and the 2024 relicensing itself demonstrates that a single-vendor-governed license can change unfavorably with no notice period the platform controls.
- **DragonflyDB** — rejected for the current decision, not disqualified outright: its multi-threaded architecture gives it a real, directional throughput-per-node advantage, but its Business Source License is not fully permissive, its community/ecosystem maturity is the thinnest of the three candidates, and adopting it now (before Valkey is proven in production) risks two consecutive cache migrations instead of one. Retained as the explicit named upgrade path once Valkey is operationally proven and a measured throughput/cost bottleneck actually materializes (`migration/migration-and-upgrade-strategy.md` §2; cost model 10,000-dealer checkpoint).
