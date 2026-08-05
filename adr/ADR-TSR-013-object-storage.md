# ADR-TSR-013 — Object Storage: Cloudflare R2 Default, S3 Fallback, MinIO Self-Hosted

**Status:** Accepted

**Context:** Content/Creative assets, Knowledge documents, and platform backups need S3-API-compatible object storage. AOS's access pattern is read-heavy and egress-heavy — Agents read Knowledge documents at inference time (RAG grounding) and CDN-served Dashboard/customer-facing surfaces read Content/Creative assets frequently — an access shape where a standard egress-metered pricing model (Amazon S3's default) compounds unfavorably at thousands-of-tenant scale. Architecture §32 additionally requires an on-prem/data-residency option for Enterprise tenants who cannot use any public cloud object store.

**Decision:** **Cloudflare R2** is the default production object storage — its zero-egress-fee model is directly cost-material for AOS's access pattern, and its S3-API compatibility keeps switching cost low. **Amazon S3** is retained as the named fallback for tenants with a specific AWS-ecosystem-integration or cloud-residency requirement. **MinIO** is recommended for self-hosted/dev/CI environments and as the on-prem option for data-residency-constrained Enterprise tenants.

**Consequences:**

- The platform's primary object storage introduces a single-vendor (Cloudflare) operational dependency, mitigated by S3-API compatibility meaning a future migration to raw S3 or any other S3-compatible provider requires only a configuration/credentials change, not an application-code rewrite.
- Cost scales favorably with AOS's read-heavy, high-frequency-access pattern (`cost-analysis/cost-model-100-1000-10000-dealers.md` §8), avoiding the egress-fee compounding a pure-S3 default would incur at scale.
- Enterprise tenants with AWS-standardization or compliance requirements exceeding R2's current certification catalog have an immediately available, zero-application-rewrite fallback (S3), not a future migration project.
- Data-residency-constrained Enterprise tenants who cannot use any public cloud object store have a fully self-hostable, air-gapped-capable option (MinIO), at the cost of that tenant's deployment owning its own operational burden (patching, capacity, HA).
- A periodic migration-drill validation (`risk/risk-register.md` RISK-008) is required to keep the S3-compatibility-mitigates-lock-in assumption verified in practice rather than assumed indefinitely.

**Alternatives Considered:**

- **Amazon S3 as the default** (rejected: scores marginally higher as a pure generalist object storage product per `decision-matrix/object-storage.md`, but its egress-fee model scales unfavorably against AOS's specific read-heavy access pattern at thousands-of-tenant volume — the dollar-cost delta at 10,000-dealer scale outweighs the marginal generalist-quality gap).
- **MinIO as the default production tier** (rejected: shifts full operational burden — patching, capacity planning, HA — onto AOS's own team for the platform's primary object storage, contradicting Constitution §2's simplicity bias where a managed equivalent meets the requirement; reserved instead for self-hosted/dev/CI and specific data-residency cases where that trade-off is actually justified).
- **A single object storage provider with no fallback/self-hosted option** (rejected: would leave no path for AWS-standardized or data-residency-constrained Enterprise tenants, a named requirement per Architecture §32, and would remove the R2-to-S3 fallback path this ADR's mitigation explicitly relies on).
