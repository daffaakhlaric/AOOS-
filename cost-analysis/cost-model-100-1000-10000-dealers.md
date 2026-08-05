# Cost Model — 100 / 1,000 / 10,000 Dealers

Governs: [`docs/004-TECHNOLOGY-SELECTION-RECORD.md`](../docs/004-TECHNOLOGY-SELECTION-RECORD.md) §5

**Status of these figures:** order-of-magnitude planning estimates for architecture and budgeting purposes, built from stated assumptions below and publicly available list-pricing patterns for the technology categories chosen in §3 of the TSR. These are **not vendor quotes** and must be re-validated against actual vendor pricing before being used as a committed operating budget.

---

## 1. Core Assumptions

| Assumption                                                                                  | Value   | Rationale                                                                                   |
| ------------------------------------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------- |
| Users per Dealer (Sales + Manager + Admin)                                                  | ~15     | Typical small-to-mid dealership staff count actively using the platform                     |
| Leads processed per Dealer per month                                                        | ~500    | Mid-market dealer digital lead volume estimate                                              |
| AI Agent invocations per Lead (full lifecycle: score, nurture steps, follow-up, escalation) | ~12     | Reflects DDD §12 Domain Event catalog's Lead lifecycle touch count                          |
| Average tokens per Agent invocation (input+output, blended across tiers)                    | ~2,500  | Blended across fast/cheap-tier (short) and mid/top-tier (longer) calls per §4 routing table |
| Conversational AI messages per Dealer per month (customer chat, all channels)               | ~2,000  | Omnichannel inbound/outbound at moderate engagement volume                                  |
| Average tokens per chat message turn                                                        | ~800    | Short conversational turns, fast/cheap tier per §4                                          |
| Content/Creative generations per Dealer per month                                           | ~40     | Campaign content cadence estimate                                                           |
| Database storage growth per Dealer per year                                                 | ~2 GB   | Transactional + conversation history, before analytics warehouse                            |
| Vector/embedding storage per Dealer                                                         | ~500 MB | Knowledge + semantic memory embeddings                                                      |
| Object storage (content assets, documents) per Dealer                                       | ~5 GB   | Creative assets, knowledge documents                                                        |
| Dashboard/API traffic egress per Dealer per month                                           | ~2 GB   | Dashboard usage, API polling, webhook payloads                                              |
| Compute headroom factor                                                                     | 1.4x    | Autoscaling buffer above steady-state average load (Architecture §31)                       |

These are deliberately conservative-to-moderate assumptions; actual figures should be replaced with measured data starting from the first 100-dealer cohort (see §10 Technology Roadmap, Year 1 checkpoint).

---

## 2. AI / LLM Inference Cost (dominant cost driver)

Estimated using the tiered routing strategy from TSR §4: ~70% of Agent invocations route to the fast/cheap tier (Lead Scoring, high-frequency classification), ~25% to mid/balanced tier (Marketing, Content), ~5% to top-reasoning tier (CEO AI/COO AI, low frequency) — blended into the "average tokens per invocation" assumption above, priced at illustrative blended per-million-token rates consistent with current market fast/mid/top tier spreads (fast tier priced roughly an order of magnitude below top tier per current published provider pricing patterns).

| Scale          | Total Agent invocations/mo | Total Chat messages/mo | Estimated AI spend/mo   |
| -------------- | -------------------------- | ---------------------- | ----------------------- |
| 100 dealers    | ~600,000                   | ~200,000               | **$3,000 – $7,000**     |
| 1,000 dealers  | ~6,000,000                 | ~2,000,000             | **$25,000 – $55,000**   |
| 10,000 dealers | ~60,000,000                | ~20,000,000            | **$220,000 – $480,000** |

The range width reflects sensitivity to (a) how effectively the fast/cheap tier absorbs volume per §4's routing strategy, and (b) real-world model pricing at time of deployment (LLM pricing has historically trended downward per token over time, which this range does not attempt to forecast).

## 3. Compute Infrastructure (Kubernetes + Core Runtime services)

Scales roughly with request/event volume and the number of stateless service replicas needed to serve it, including the 1.4x autoscaling headroom.

| Scale          | Estimate                                                                                                                                            |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| 100 dealers    | $1,500 – $3,000/mo (small multi-node cluster, modest replica counts per service)                                                                    |
| 1,000 dealers  | $8,000 – $15,000/mo (larger node pools, higher replica counts, multi-AZ)                                                                            |
| 10,000 dealers | $50,000 – $90,000/mo (large multi-region node pools; approaching the scale where reserved/committed-use discounts materially change unit economics) |

## 4. Database

Postgres managed instance sizing scales with total tenant data volume (§1 assumption: ~2GB/dealer/year) plus IOPS demand from transactional + read-query load; CockroachDB slice applies only to the fraction of Enterprise-tier tenants opting into the multi-region escape hatch (assumed ~2% of tenant base at 1,000+ scale).

| Scale          | Estimate                                                              |
| -------------- | --------------------------------------------------------------------- |
| 100 dealers    | $600 – $1,200/mo                                                      |
| 1,000 dealers  | $4,000 – $8,000/mo                                                    |
| 10,000 dealers | $30,000 – $55,000/mo (includes CockroachDB slice for Enterprise tier) |

## 5. Cache (Valkey)

| Scale          | Estimate            |
| -------------- | ------------------- |
| 100 dealers    | $150 – $300/mo      |
| 1,000 dealers  | $1,000 – $2,000/mo  |
| 10,000 dealers | $6,000 – $12,000/mo |

## 6. Queue / Event Streaming (NATS JetStream + BullMQ)

Scales with Domain Event volume (DDD §12 catalog × Lead/Campaign/Workflow activity) plus job-queue throughput (Tool retries, notifications).

| Scale          | Estimate             |
| -------------- | -------------------- |
| 100 dealers    | $200 – $400/mo       |
| 1,000 dealers  | $1,500 – $3,000/mo   |
| 10,000 dealers | $10,000 – $18,000/mo |

## 7. Vector Database

pgvector cost is included within the Database line above at 100/1,000-dealer scale; a dedicated Qdrant slice is budgeted starting where the Enterprise/scale escape hatch (§3.12 of the TSR) activates.

| Scale          | Estimate                               |
| -------------- | -------------------------------------- |
| 100 dealers    | included in Database line              |
| 1,000 dealers  | $500 – $1,200/mo (Qdrant slice begins) |
| 10,000 dealers | $5,000 – $10,000/mo                    |

## 8. Object Storage (Cloudflare R2)

Zero-egress pricing model makes this line dominated by storage volume (§1: ~5GB/dealer) rather than access frequency, a deliberate cost advantage of the R2 decision (TSR §3.13).

| Scale          | Estimate           |
| -------------- | ------------------ |
| 100 dealers    | $50 – $150/mo      |
| 1,000 dealers  | $500 – $1,200/mo   |
| 10,000 dealers | $4,000 – $8,000/mo |

## 9. Observability / Monitoring (self-hosted LGTM stack infrastructure)

Infrastructure cost of running Prometheus/Loki/Tempo/Grafana at scale (compute + storage for metrics/logs/traces retention), not a per-signal metered SaaS cost — the direct cost benefit of the TSR §3.17/§3.23 decision.

| Scale          | Estimate             |
| -------------- | -------------------- |
| 100 dealers    | $300 – $600/mo       |
| 1,000 dealers  | $2,000 – $4,000/mo   |
| 10,000 dealers | $12,000 – $22,000/mo |

## 10. Traffic / CDN / Egress

Dashboard asset delivery, API traffic, webhook ingress/egress (excluding object storage egress, which is zero-cost under R2).

| Scale          | Estimate             |
| -------------- | -------------------- |
| 100 dealers    | $200 – $400/mo       |
| 1,000 dealers  | $1,500 – $3,000/mo   |
| 10,000 dealers | $10,000 – $20,000/mo |

---

## 11. Consolidated Total

| Category                       | 100 Dealers     | 1,000 Dealers     | 10,000 Dealers      |
| ------------------------------ | --------------- | ----------------- | ------------------- |
| Compute                        | $1,500 – $3,000 | $8,000 – $15,000  | $50,000 – $90,000   |
| Database                       | $600 – $1,200   | $4,000 – $8,000   | $30,000 – $55,000   |
| Cache                          | $150 – $300     | $1,000 – $2,000   | $6,000 – $12,000    |
| Queue/Event Streaming          | $200 – $400     | $1,500 – $3,000   | $10,000 – $18,000   |
| Vector DB                      | included        | $500 – $1,200     | $5,000 – $10,000    |
| Object Storage                 | $50 – $150      | $500 – $1,200     | $4,000 – $8,000     |
| AI/LLM Inference               | $3,000 – $7,000 | $25,000 – $55,000 | $220,000 – $480,000 |
| Observability                  | $300 – $600     | $2,000 – $4,000   | $12,000 – $22,000   |
| Traffic/CDN                    | $200 – $400     | $1,500 – $3,000   | $10,000 – $20,000   |
| **Total (mid-point)**          | **~$10,600/mo** | **~$75,000/mo**   | **~$558,000/mo**    |
| **Implied per-dealer cost/mo** | **~$106**       | **~$75**          | **~$56**            |

**Observation:** per-dealer cost decreases with scale (economy of scale in fixed infrastructure overhead, and better utilization of committed-use/reserved pricing tiers), while AI inference cost remains the largest single line at every tier — reinforcing TSR §5's conclusion that model-tier routing discipline (§4 of the TSR) is the platform's single highest-leverage cost lever, more impactful than any individual infrastructure vendor substitution in §3.

## 12. Recommended Cost Governance Actions (tie back to Constitution §33)

1. Re-run this cost model with real measured data at the first 100-dealer production cohort (see `roadmap/technology-roadmap.md` Year 1 checkpoint) before scaling assumptions further.
2. Track AI inference cost per Hot Lead (DDD KPI: Cost per Hot Lead, §28) as the primary unit-economics health metric, not just aggregate spend.
3. Revisit the Grafana Stack vs. Datadog trade-off (TSR §3.23) and the Kong OSS vs. Enterprise trade-off (TSR §3.15) at the 1,000-dealer checkpoint using real ops-toil data.
4. Treat any of the escape-hatch technologies (CockroachDB, Qdrant, Kafka, DragonflyDB) as capacity-triggered decisions, not calendar-triggered — activate only when the named trigger condition in `migration/migration-and-upgrade-strategy.md` is actually met.
