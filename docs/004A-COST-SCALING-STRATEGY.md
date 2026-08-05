# 004A — AOS Cost Scaling Strategy & Progressive Deployment

**Status:** ACTIVE — Supplement to the Technology Selection Record
**Governs under:** [`001-ENGINEERING-CONSTITUTION.md`](./001-ENGINEERING-CONSTITUTION.md), [`002-ENTERPRISE-ARCHITECTURE.md`](./002-ENTERPRISE-ARCHITECTURE.md), [`003-DOMAIN-DRIVEN-DESIGN.md`](./003-DOMAIN-DRIVEN-DESIGN.md), [`003.5-CONTRACT-FIRST-DESIGN.md`](./003.5-CONTRACT-FIRST-DESIGN.md), [`004-TECHNOLOGY-SELECTION-RECORD.md`](./004-TECHNOLOGY-SELECTION-RECORD.md)
**Scope:** This document does **not** change any technology decision made in the TSR. It adds the missing dimension the TSR did not cover: **when** and **at what scale** each piece of that stack gets turned on, and what it costs at each step of the journey. No code.

---

## 0. Conformance Check

All five prior documents were read in full before drafting this supplement. **No TSR decision is changed.** Every technology named in the seven phases below is drawn directly from `docs/004-TECHNOLOGY-SELECTION-RECORD.md` §3 (PostgreSQL, Valkey/Redis-compatible, NATS JetStream, Temporal, MinIO/R2/S3, Qdrant/pgvector, Grafana/Prometheus/Loki/Tempo, Kubernetes, etc.) — this document only sequences _when_ each is introduced and _how much of it_ is provisioned at each stage, which is a deployment/FinOps concern, not a technology-selection one. Where this document's Phase 5–7 cost figures are stated, they are anchored to and cross-checked against `cost-analysis/cost-model-100-1000-10000-dealers.md` rather than re-derived independently — no conflicting numbers are introduced for the 100/1,000/10,000-dealer tiers already estimated there.

---

## 1. Purpose & Growth Philosophy

The TSR answers "what technology." This document answers "how much of it, starting when, costing what" — because AOS is not going to be built Enterprise-first. It is going to be **proven** first.

### 1.1 The mindset shift

The instinct for an ambitious platform spec like docs 001–004 is to design for 10,000 dealers from day one and then build toward that design. That instinct is wrong for this stage of the company, for one reason: **the current goal is not to serve thousands of dealers — it is to prove that the AI Organization (CEO AI, Marketing AI, Sales AI, and the rest of the Agent org described in the forthcoming doc 005) actually works.** Everything about infrastructure sizing, cost, and technology activation follows from that one sentence.

Concretely, the growth path this document plans against is:

```
Simulation
    ↓  (prove the runtime works, alone, with no external stakeholders)
Internal Demo
    ↓  (prove it's demoable to a non-technical stakeholder, still no real dealer)
Pilot  (e.g., a single named-brand pilot dealer — "the Mitsubishi Pilot" pattern)
    ↓  (prove it works with ONE real dealer, real leads, real Sales staff, real (small) AI spend)
5 Dealers
    ↓  (prove it works with more than one dealer without per-tenant hand-holding)
20 Dealers
    ↓  (prove the multi-tenant isolation and cost model hold under organic growth)
100 Dealers
    ↓  (this is where "Production" in the TSR's cost model actually starts to apply)
1,000 Dealers
    ↓  (this is the TSR's "Enterprise" tier)
(10,000 Dealers — National Scale — remains the long-horizon target, not a near-term milestone)
```

This document keeps the original seven WAJIB phases (Simulation → Internal Demo → Pilot → Growth → Production → Enterprise → National Scale) as the formal structure, because each phase's dealer/sales/lead counts were explicitly specified and are load-bearing for the cost math below. But **Phase 3 (Pilot) is explicitly reframed as a single named-brand pilot** (5 dealers under one pilot relationship, e.g., a Mitsubishi-dealer-network pilot, rather than 5 anonymous unrelated dealers) — this matters because a named pilot has a sponsor, a success criterion, and a renewal/expansion decision point, which a generic "5 dealers" milestone does not. Every phase below is written against this philosophy: **the cheapest infrastructure that can honestly prove the phase's specific hypothesis, and nothing more.**

### 1.2 What "prove it works" means per phase

| Phase          | What must be proven                                                                                                                                                | What must NOT be over-built yet                                                 |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| Simulation     | The Core Runtime (Event Bus, Registries, Workflow, Agent Runtime) boots and an Agent can complete one full Lead lifecycle end-to-end, entirely with synthetic data | Multi-region, HA, autoscaling, managed anything                                 |
| Internal Demo  | A non-technical stakeholder can watch an AI Agent qualify a Lead and hand off a Hot Lead, live, without the demo breaking                                          | Real integrations (Meta, WhatsApp), real billing, real multi-tenancy            |
| Pilot          | One real dealer's real leads get real AI-driven nurturing and at least one real Hot Lead conversion, with cost per Hot Lead tracked from day one                   | Kubernetes autoscaling, distributed SQL, dedicated observability team           |
| Growth         | The platform holds up with more than one dealer, without a human manually reconfiguring anything per new tenant                                                    | Enterprise-tier database escape hatch (CockroachDB), Kafka, multi-region DR     |
| Production     | The TSR's 100-dealer cost model (`cost-analysis/`) is empirically validated, not just estimated                                                                    | 1,000-dealer-scale committed-use contracts                                      |
| Enterprise     | Multi-region DR, per-tenant database escape hatch, and Enterprise-tier SLAs are real and load-tested                                                               | 10,000-dealer national infrastructure contracts                                 |
| National Scale | Hyperscale unit economics (reserved capacity, dedicated FinOps function)                                                                                           | — (this is the ceiling this roadmap plans toward, not a near-term build target) |

---

## 2. Phase 1 — Simulation

**Objective:** Prove the Core Runtime — Event Bus, Registries, Tool Manager, Workflow Runtime, Agent Runtime — actually boots and can carry one Lead through its full lifecycle (Lead Created → Scored → Hot → Nurtured, per DDD §17.1 State Machine) end-to-end, entirely with synthetic data generated via the Simulation Contract (doc 003.5 §19). One developer, one machine, no external stakeholder.

**Architecture:** Single-box, everything co-located. No HA, no autoscaling, no managed services. This is deliberately the least architecturally interesting phase — the goal is runtime correctness, not infrastructure design.

**Deployment Diagram:**

```
┌─────────────────────────────────────────────────────────┐
│              1 VPS or 1 Developer Laptop                  │
│                    (Docker Compose)                        │
│                                                             │
│  [Core Runtime containers: Agent/Workflow/Tool Manager]    │
│  [PostgreSQL]  [Valkey]  [NATS JetStream]  [Temporal]      │
│  [MinIO]  [Qdrant]  [Grafana] [Prometheus] [Loki] [Tempo]  │
│                                                             │
│  All on one Docker network, one disk, one process tree      │
└─────────────────────────────────────────────────────────┘
```

**Technology Stack:** Exactly the TSR-mandated stack (§3 of doc 004), self-hosted, single-instance, via Docker Compose — no Kubernetes yet: PostgreSQL, Valkey, NATS JetStream, Temporal (single-node), MinIO (object storage stand-in for R2/S3), Qdrant, Grafana + Prometheus + Loki + Tempo.

**Resource Allocation:**

| Resource       | Allocation                                                                                                                                           |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| CPU            | 6–8 vCPU (Temporal + Postgres + the Grafana stack are the heaviest concurrent consumers)                                                             |
| RAM            | 16–32 GB (Temporal's persistence layer and Qdrant's in-memory index are the main drivers; 16GB is workable if Grafana-stack retention is kept short) |
| Disk           | 100–200 GB NVMe SSD (mostly Postgres + Temporal history + Loki/Tempo short-retention logs/traces)                                                    |
| Bandwidth      | Negligible (no external traffic; only the developer's own access)                                                                                    |
| Traffic        | ~0 (no customers)                                                                                                                                    |
| Storage growth | Near-zero (synthetic data, periodically reset)                                                                                                       |

**AI Token Estimation:** Development-time testing only — a few hundred Agent invocations per week while iterating on Planner/Reflection prompts, routed to the fast/cheap model tier (per §4 below) almost exclusively. Estimated **2,000–5,000 tokens/day** blended, i.e., low tens of dollars per month at most.

**Infrastructure Cost:**

| Option                                                                                 | Monthly Cost           | Note                                                               |
| -------------------------------------------------------------------------------------- | ---------------------- | ------------------------------------------------------------------ |
| Developer's own laptop                                                                 | $0 marginal infra cost | Fine for the first 2–4 weeks; not reproducible/shareable           |
| Single VPS (8 vCPU / 16–32GB RAM / 200GB NVMe, e.g., Hetzner/DigitalOcean/Vultr class) | **$40 – $90/mo**       | Recommended once more than one person needs to see the environment |

**Operational Cost:** Effectively $0 beyond the developer's own time — no on-call, no SLA, resets/rebuilds are expected and cheap.

**Total Monthly Cost: ~$60 – $130/mo** (VPS + minimal AI token spend), or **~$10 – $30/mo** if run entirely on a personal laptop with no dedicated VPS.

**Scaling Trigger:** Move to Phase 2 when the full Lead lifecycle (DDD §19 Event Storming timeline, Marketing→Lead→Qualification→Nurturing) runs successfully end-to-end against the Simulation Contract's synthetic scenarios (doc 003.5 §19) without manual intervention, and the Core Runtime survives a full container restart without data loss (proving the durability claims in Architecture §7/§15).

**Risk:** Over-engineering this phase (e.g., standing up Kubernetes, HA Postgres, or multi-region anything) wastes weeks of runway on infrastructure nobody will use yet — this is the single biggest risk at this phase, not a technical one.

**Upgrade Path:** Docker Compose → Phase 2's slightly more robust single-VPS setup; no data migration needed since Phase 1 data is synthetic and disposable by design.

**Rollback Plan:** None needed in the traditional sense — the entire environment is disposable (`docker compose down -v && docker compose up`); this disposability is itself a feature of the phase, not a gap.

---

## 3. Phase 2 — Internal Demo

**Objective:** Prove the platform is demoable to a non-technical internal stakeholder (founder, investor, prospective pilot dealer) with a believable, live walkthrough — 1 simulated Dealer, 10 simulated Sales staff, 5,000 simulated Leads. Still no real Meta/WhatsApp production API, no real customer, no real money moving.

**Architecture:** Still single-node, but now persistent and presentable — a dedicated always-on VPS (not a laptop), a seeded demo dataset, and the Dashboard (Next.js, TSR §3.3) actually running and reachable by URL for the first time.

**Deployment Diagram:**

```
┌───────────────────────────────────────────────────────────┐
│                  1 Persistent VPS (upgraded)                 │
│                                                               │
│  [Next.js Dashboard]  [API Gateway (Kong, single instance)]  │
│  [Core Runtime containers]                                   │
│  [PostgreSQL]  [Valkey]  [NATS JetStream]  [Temporal]         │
│  [MinIO]  [Qdrant]  [Grafana stack]                           │
│                                                               │
│  Seeded demo dataset: 1 Dealer / 10 Sales / 5,000 Leads       │
└───────────────────────────────────────────────────────────┘
                              ▲
                        (demo viewer, browser)
```

**Technology Stack:** Same as Phase 1, plus the Dashboard (Next.js) and API Gateway (Kong) now actually fronting traffic; Keycloak introduced here for the first time (even a demo needs believable login/role separation for Dealer Admin vs. Sales roles per DDD §24 Permission Matrix).

**Resource Allocation:**

| Resource       | Allocation                                                                                        |
| -------------- | ------------------------------------------------------------------------------------------------- |
| CPU            | 8–16 vCPU                                                                                         |
| RAM            | 32–64 GB                                                                                          |
| Disk           | 150–250 GB NVMe SSD (backups now matter — a demo dying mid-pitch is expensive in a different way) |
| Bandwidth      | Low (a handful of concurrent viewers at most)                                                     |
| Traffic        | A few hundred requests/day during active demo prep                                                |
| Storage growth | Minimal (seeded dataset, periodically refreshed)                                                  |

**AI Token Estimation:** Demo conversations are scripted/semi-scripted but run through the real Model Router — estimate **500–1,500 Agent invocations/month**, still overwhelmingly on the fast/cheap tier, with a handful of top-tier CEO AI/COO AI invocations for demo-worthy "strategic reasoning" moments. Estimated **$30 – $80/mo**.

**Infrastructure Cost:** $120 – $180/mo (upgraded persistent VPS, or small managed Kubernetes single-node/small-cluster if the team prefers to start on K8s early for consistency with later phases — a legitimate choice, at a cost premium of roughly $30–60/mo over raw VPS).

**Operational Cost:** Still near-$0 in dedicated ops time; backups should now be automated (a few dollars/month via VPS snapshot features), which is the one operational discipline that starts here and never stops.

**Total Monthly Cost: ~$160 – $280/mo**

**Scaling Trigger:** Move to Phase 3 when a real prospective pilot dealer has agreed to be the named pilot (the "Mitsubishi Pilot" pattern from §1.1) and real API credentials (Meta, WhatsApp Business, a real LLM provider account rather than a shared dev key) are ready to be provisioned.

**Risk:** Demo data quality — a stakeholder who sees an obviously fake, repetitive, or nonsensical AI conversation loses confidence fast; investing in a genuinely good Simulation Contract scenario library (doc 003.5 §19) pays for itself here.

**Upgrade Path:** Same VPS can often be resized in place (more vCPU/RAM) rather than replaced; Keycloak realm structure introduced here carries forward unchanged into Phase 3.

**Rollback Plan:** Nightly VPS snapshot; a broken demo environment is restored from the last snapshot in minutes, not rebuilt from scratch.

---

## 4. Phase 3 — Pilot ("Mitsubishi Pilot" pattern)

**Objective:** Prove the platform works for **one real, named pilot dealer relationship** (illustratively "5 Dealers" under one pilot brand/network, per the original phase spec) — 5 Dealers, 100 Sales staff, 50,000 Leads, with **real APIs turned on for the first time**: real Meta/WhatsApp Business messaging, a real LLM provider account with real billing, real (small) AI spend that must be tracked per Constitution §33.

**Architecture:** First departure from single-node. Still not Kubernetes-mandatory, but now split across a small number of machines/services for the first real reliability margin: a managed small Postgres instance (or a well-backed-up self-hosted one), the Core Runtime containers on 2–3 small VMs behind a load balancer, real Temporal (still self-hosted, single-cluster), real NATS JetStream cluster (3-node minimum for quorum, matching NATS's own recommended minimum), Vault introduced here for the first time (real API credentials now exist and must not live in `.env` files, per Constitution RULE-060).

**Deployment Diagram:**

```
                    ┌───────────────┐
                    │  Load Balancer │
                    └───────┬───────┘
                            ▼
        ┌──────────────────────────────────────┐
        │   2–3 small VMs: API Gateway, Core     │
        │   Runtime (Agent/Workflow/Tool Mgr)     │
        └───────┬─────────────────┬─────────────┘
                 ▼                 ▼
        ┌────────────────┐ ┌────────────────┐
        │ Postgres (small │ │ NATS JetStream  │
        │ managed or self- │ │ (3-node cluster)│
        │ hosted, backed up)│ └────────────────┘
        └────────────────┘
        ┌────────────────┐ ┌────────────────┐ ┌──────────┐
        │ Temporal (single│ │ Valkey │ Qdrant │ │  Vault    │
        │ cluster)         │ │ (single instance)│ │(secrets) │
        └────────────────┘ └────────────────┘ └──────────┘
                            │
                            ▼
                  Real Meta / WhatsApp / LLM APIs
```

**Technology Stack:** Full TSR §3 stack now active except the Enterprise-tier escape hatches (CockroachDB, Kafka, dedicated Qdrant cluster) and multi-region anything.

**Resource Allocation:**

| Resource       | Allocation                                                                     |
| -------------- | ------------------------------------------------------------------------------ |
| CPU            | 20–30 vCPU total across all nodes                                              |
| RAM            | 80–120 GB total                                                                |
| Disk           | 300–500 GB (real conversation history, real Lead data, real backups)           |
| Bandwidth      | Real but modest — a few GB/day of webhook/API traffic                          |
| Traffic        | Low thousands of requests/day                                                  |
| Storage growth | ~10–20 GB/month (real Leads, Conversations, Knowledge documents for 5 dealers) |

**AI Token Estimation:** Using the §5 model-routing strategy against 50,000 Leads/dealer-network with realistic engagement (≈12 Agent invocations per Lead over its lifecycle per the Cost Model's assumption set, scaled down): roughly **15,000 – 30,000 Agent invocations/month** plus a modest volume of real customer chat messages. Estimated **$150 – $350/mo**, overwhelmingly fast/cheap tier.

**Infrastructure Cost:** $300 – $500/mo (small managed Postgres + a handful of small VMs + NATS cluster + Vault).

**Operational Cost:** First real operational cost line — someone is now on the hook if the pilot dealer's Sales team can't log in on a Monday morning. Budget **$50 – $150/mo** equivalent in monitoring/alerting tooling costs (still self-hosted Grafana stack, but now actually alerting a human), even though the "labor" cost of watching it is not counted in infrastructure dollars.

**Total Monthly Cost: ~$450 – $800/mo**

**Scaling Trigger:** Move to Phase 4 when the pilot dealer network has at least one verified real Hot-Lead-to-Sale conversion attributable to the AI Organization, and Cost per Hot Lead (DDD §28 KPI) has been measured for at least 60 days — i.e., when there is real unit-economics data, not just uptime data.

**Risk:** This is the first phase where a real dealer's real customer relationship is on the line — a broken Conversational Agent reply or a missed Hot Lead handoff has real reputational cost, not just an internal embarrassment. Guardrail Engine correctness (Architecture §11.7, §25) matters for real starting here.

**Upgrade Path:** The 3-node NATS cluster, Vault instance, and small managed Postgres are all directly reusable at Phase 4 scale with resizing, not replacement — this phase's infrastructure choices were deliberately made "small but real" specifically so they don't need to be thrown away.

**Rollback Plan:** Blue/green-style: keep the Phase 2 demo environment intact and separate from the Phase 3 pilot environment (different Tenant IDs, different infra) so a Phase 3 incident never risks the ability to demo to the _next_ prospective pilot dealer while the current one is being fixed.

---

## 5. Phase 4 — Growth

**Objective:** Prove the platform holds up with meaningfully more than one dealer relationship without a human manually reconfiguring anything per new tenant — 20 Dealers, 500 Sales staff, 500,000 Leads.

**Architecture:** First Kubernetes deployment (TSR §3.20). This is the trigger point for containerized orchestration, not before — introducing Kubernetes at Phase 1–3 would have been pure overhead for a single pilot relationship; at 20 independently-onboarding dealers, manual per-tenant VM management stops being tenable.

**Deployment Diagram:**

```
┌─────────────────────────────────────────────────────────────┐
│                Kubernetes Cluster (single region)              │
│                                                                 │
│  ┌──────────┐ ┌───────────┐ ┌────────────┐ ┌────────────┐     │
│  │API Gateway│ │Agent/     │ │Workflow    │ │Tool Manager │     │
│  │(Kong, HPA)│ │Workflow RT│ │RT (Temporal│ │(HPA)        │     │
│  │           │ │(HPA)      │ │Activities) │ │             │     │
│  └──────────┘ └───────────┘ └────────────┘ └────────────┘     │
│                                                                 │
│  Managed Postgres (small-medium)  │  NATS JetStream (3-5 node) │
│  Valkey (managed or self-hosted, HA)  │  Qdrant (small cluster)│
│  Grafana LGTM stack (in-cluster)  │  Vault (HA, 3-node)         │
└─────────────────────────────────────────────────────────────┘
```

**Technology Stack:** Full TSR §3 stack, now with Horizontal Pod Autoscaling active on the stateless services (API Gateway, Agent Runtime, Tool Manager) per Architecture §31.

**Resource Allocation:**

| Resource       | Allocation                                                         |
| -------------- | ------------------------------------------------------------------ |
| CPU            | 60–100 vCPU total (cluster-wide, autoscaled)                       |
| RAM            | 200–350 GB total                                                   |
| Disk           | 1–2 TB (managed Postgres storage + Qdrant + object storage growth) |
| Bandwidth      | Tens of GB/day                                                     |
| Traffic        | Tens of thousands of requests/day                                  |
| Storage growth | ~80–150 GB/month                                                   |

**AI Token Estimation:** ~150,000 – 300,000 Agent invocations/month (20 dealers × 500k leads platform-wide over the period, scaled by the same ~12-touch lifecycle assumption from the Cost Model), plus meaningfully more real customer chat volume. Estimated **$600 – $1,800/mo**.

**Infrastructure Cost:** $1,200 – $2,800/mo (small-medium Kubernetes cluster, managed Postgres, HA Valkey, NATS cluster, Vault HA).

**Operational Cost:** $200 – $500/mo equivalent (more thorough monitoring/alerting coverage, first real on-call rotation cost, though still lightweight).

**Total Monthly Cost: ~$1,850 – $4,200/mo**

**Scaling Trigger:** Move to Phase 5 when the platform has been validated against the DDD §25 Tenant Isolation test suite at 20-tenant scale with zero cross-tenant data incidents, and onboarding a new dealer no longer requires a manual infrastructure step (fully Registry/Contract-driven per doc 003.5).

**Risk:** This is the phase where "it worked for one pilot dealer" assumptions get tested against real multi-tenant load patterns for the first time — a "noisy neighbor" tenant (Architecture §26 Queue fairness) is a realistic risk here for the first time, not a theoretical one.

**Upgrade Path:** Kubernetes cluster scales by adding nodes/resizing node pools; no architectural change needed to reach Phase 5 — this phase's Kubernetes adoption is exactly the point at which the architecture stops changing shape and starts just getting bigger.

**Rollback Plan:** Kubernetes rolling deployments with automatic rollback on failed health checks (Architecture §11 Deployment Diagram discipline) become standard practice starting here, replacing the ad hoc VM-snapshot rollback of earlier phases.

---

## 6. Phase 5 — Production

**Objective:** Validate, with real 100-dealer-scale data, the cost and performance model the TSR estimated in advance (`cost-analysis/cost-model-100-1000-10000-dealers.md`).

**Architecture:** This phase is the TSR's own 100-dealer tier, already fully specified in Architecture doc 002 §11 (Deployment Diagram) and §31 (Scalability Architecture) and costed in the TSR's Cost Model — this document does not re-derive it, only confirms it is the correct point at which those documents' assumptions start being empirically checked rather than estimated.

**Deployment Diagram:** As per `docs/002-ENTERPRISE-ARCHITECTURE.md` §11 — multi-AZ Kubernetes cluster, managed Postgres with read replicas, full Grafana LGTM stack, Vault HA, Kong with production-grade rate-limiting policies active per tenant tier.

**Technology Stack:** Full TSR §3 stack at production-grade redundancy (every Tier-0 dependency per the Dependency Matrix, TSR §7, deployed multi-replica).

**Resource Allocation, AI Token Estimation, Infrastructure Cost, Operational Cost:** See `cost-analysis/cost-model-100-1000-10000-dealers.md` §3–§10 (100-dealer column) — reproduced here as the anchor:

| Category              | Estimate             |
| --------------------- | -------------------- |
| Compute               | $1,500 – $3,000/mo   |
| Database              | $600 – $1,200/mo     |
| Cache                 | $150 – $300/mo       |
| Queue/Event Streaming | $200 – $400/mo       |
| Vector DB             | included in Database |
| Object Storage        | $50 – $150/mo        |
| AI/LLM Inference      | $3,000 – $7,000/mo   |
| Observability         | $300 – $600/mo       |
| Traffic/CDN           | $200 – $400/mo       |

**Total Monthly Cost: ~$8,000 – $13,000/mo** (matches the TSR Cost Model's 100-dealer figure exactly — no new number introduced here).

**Scaling Trigger:** Move to Phase 6 when a specific Enterprise-tier tenant contractually requires multi-region DR or the distributed-SQL escape hatch (TSR §3.4, `migration/migration-and-upgrade-strategy.md`) — this is a demand-triggered move, not a calendar-triggered one.

**Risk:** See `risk/risk-register.md` in full — every risk registered there is now live risk, not theoretical.

**Upgrade Path:** Activate the named escape hatches from `migration/migration-and-upgrade-strategy.md` (CockroachDB, Qdrant dedicated cluster, Kafka) only for the specific tenants/workloads whose measured trigger condition is actually met.

**Rollback Plan:** ArgoCD GitOps rollback (TSR §3.18) to the last known-good Git state; database rollback via point-in-time recovery, tested via a drilled restore at this phase for the first time (Architecture §32 DR Best Practice: "never let a DR runbook go untested").

---

## 7. Phase 6 — Enterprise

**Objective:** Prove multi-region DR, the distributed-SQL/vector-DB escape hatches, and Enterprise-tier SLAs are real and load-tested at 1,000-dealer scale, not just documented.

**Architecture:** As per `docs/002-ENTERPRISE-ARCHITECTURE.md` §32 (Disaster Recovery) — multi-region active/standby, CockroachDB active for qualifying Enterprise tenants, Qdrant dedicated cluster active, Kafka migration evaluated per its named trigger.

**Resource Allocation, AI Token Estimation, Infrastructure Cost, Operational Cost:** Anchored to `cost-analysis/cost-model-100-1000-10000-dealers.md` §3-§10 (1,000-dealer column):

| Category              | Estimate             |
| --------------------- | -------------------- |
| Compute               | $8,000 – $15,000/mo  |
| Database              | $4,000 – $8,000/mo   |
| Cache                 | $1,000 – $2,000/mo   |
| Queue/Event Streaming | $1,500 – $3,000/mo   |
| Vector DB             | $500 – $1,200/mo     |
| Object Storage        | $500 – $1,200/mo     |
| AI/LLM Inference      | $25,000 – $55,000/mo |
| Observability         | $2,000 – $4,000/mo   |
| Traffic/CDN           | $1,500 – $3,000/mo   |

**Total Monthly Cost: ~$55,000 – $95,000/mo** (matches the TSR Cost Model's 1,000-dealer figure). The original task brief leaves this phase's target as "sesuai kebutuhan" (as needed) rather than a fixed band — this figure is that "as needed" number, made concrete.

**Scaling Trigger:** Move toward Phase 7 planning only when real committed/contracted demand for national-scale reach exists — this is explicitly a long-horizon target, not a near-term milestone (§1.1).

**Risk:** Operational-talent-pool risk for CockroachDB (RISK-006 in `risk/risk-register.md`) and self-hosted Keycloak HA (RISK-007) become material at this scale for the first time.

**Upgrade Path / Rollback Plan:** Fully governed by `migration/migration-and-upgrade-strategy.md` and `docs/002-ENTERPRISE-ARCHITECTURE.md` §32 — no new mechanism introduced here.

---

## 8. Phase 7 — National Scale

**Objective:** The long-horizon ceiling this roadmap plans toward: 10,000 dealers, hyperscale unit economics.

**Architecture, Cost:** Anchored to `cost-analysis/cost-model-100-1000-10000-dealers.md` §3-§10 (10,000-dealer column) — **~$400,000 – $715,000/mo total**, with AI/LLM Inference remaining the dominant line at **$220,000 – $480,000/mo**.

**Scaling Trigger:** This phase is not "triggered" by a metric — it is a strategic decision requiring a dedicated FinOps function, reserved/committed-use infrastructure contracts, and almost certainly renegotiated LLM provider pricing tiers, none of which are meaningful to plan in detail before Phase 6 is real. This document intentionally does not over-specify Phase 7 beyond confirming it is cost-consistent with the TSR, for the same reason Phase 1 intentionally does not over-specify Kubernetes: **premature detail here is itself a form of waste.**

---

## 9. Cost Comparison — Self-Hosted vs. Cloud Managed

For each pair, ROI is expressed as the self-hosted savings **minus** the added operational burden, stated qualitatively where a dollar figure for engineering time would be false precision.

### 9.1 PostgreSQL (self-hosted) vs. Cloud SQL / RDS-class managed

|                                    | Self-Hosted                                                                                                                                                                                                                                                                                                                           | Managed                               |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| Cost at Pilot scale (Phase 3)      | ~$40–80/mo (VM + storage)                                                                                                                                                                                                                                                                                                             | ~$80–150/mo                           |
| Cost at Production scale (Phase 5) | ~$400–800/mo                                                                                                                                                                                                                                                                                                                          | ~$600–1,200/mo                        |
| Ops burden                         | Backups, patching, failover all manual/scripted                                                                                                                                                                                                                                                                                       | Automated backups, patching, failover |
| **ROI verdict**                    | Self-hosted saves ~40–50% of the line item but costs real engineering time on failover drills and patch management — **not worth it below Phase 4**; **worth strong consideration from Phase 4 onward** once a platform team exists to own it, especially since Postgres is a Tier-0 dependency (TSR §7) where downtime is costliest. |                                       |

### 9.2 Redis-compatible (self-hosted Valkey) vs. Managed Redis/Valkey

|                          | Self-Hosted                                                                                                                                                                                                                            | Managed      |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| Cost at Pilot scale      | ~$15–30/mo                                                                                                                                                                                                                             | ~$40–70/mo   |
| Cost at Production scale | ~$80–150/mo                                                                                                                                                                                                                            | ~$200–350/mo |
| Ops burden               | Low (cache data is disposable by nature — a crashed cache is a performance problem, not a data-loss problem)                                                                                                                           | Near-zero    |
| **ROI verdict**          | Self-hosted wins cleanly at every phase — cache is the one Tier-0-adjacent service where self-hosting's low blast-radius (data is disposable/rebuildable) makes the managed-service premium hard to justify, even at Enterprise scale. |

### 9.3 NATS (self-hosted) vs. Kafka Cloud (managed, e.g. Confluent-class)

|                          | Self-Hosted NATS JetStream                                                                                                                                                                                                                                                                                                    | Kafka Cloud                                                                                                                   |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Cost at Pilot scale      | ~$60–120/mo (3-node cluster)                                                                                                                                                                                                                                                                                                  | Not applicable — Kafka is the TSR's documented future migration target, not a Pilot-phase choice                              |
| Cost at Production scale | ~$300–600/mo                                                                                                                                                                                                                                                                                                                  | ~$1,500–3,500/mo (managed Kafka's per-partition/throughput pricing is materially higher than self-hosted NATS at this volume) |
| Ops burden               | Low-Medium (single binary, no external coordination service)                                                                                                                                                                                                                                                                  | Near-zero, but at a real cost premium                                                                                         |
| **ROI verdict**          | Self-hosted NATS JetStream wins decisively at every phase this roadmap covers, consistent with TSR §3.7/§3.8's reasoning — a managed Kafka's operational-simplicity premium is the right trade only once/if AOS's event volume genuinely exceeds JetStream's ceiling (`migration/`), which no phase in this document reaches. |

### 9.4 MinIO (self-hosted) vs. Amazon S3

|                          | Self-Hosted MinIO                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Amazon S3                                                  |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Cost at Pilot scale      | ~$10–20/mo (bundled on existing VM disk)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | ~$20–40/mo (storage + egress)                              |
| Cost at Production scale | ~$100–200/mo (dedicated storage nodes)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | ~$400–800/mo (egress-dominated, per TSR §3.13's reasoning) |
| Ops burden               | Low-Medium (disk management, replication config)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Near-zero                                                  |
| **ROI verdict**          | Note the TSR's actual production default is **Cloudflare R2** (zero-egress), not raw S3 — this comparison exists because the task brief named MinIO vs. S3 specifically. Against S3 specifically, self-hosted MinIO wins on cost at every phase due to S3's egress fees, but the TSR's R2 decision already captures most of this benefit without the self-hosting ops burden — **MinIO is recommended only for Phase 1–2 (dev/demo) and as the Enterprise on-prem/data-residency option (TSR §3.13), not as the general production default.** |

### 9.5 Temporal Self-Hosted vs. Temporal Cloud

|                          | Self-Hosted                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Temporal Cloud                                                 |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Cost at Pilot scale      | ~$40–80/mo (single-cluster, bundled)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | ~$200–400/mo (managed, minimum commitment tiers)               |
| Cost at Production scale | ~$500–1,000/mo (HA cluster, own persistence store)                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | ~$2,000–5,000/mo                                               |
| Ops burden               | Medium-High (this is the real cost — Temporal's own persistence layer, upgrade cycles, and worker-fleet management are non-trivial, per RISK-002 in `risk/risk-register.md`)                                                                                                                                                                                                                                                                                                                                           | Low (Temporal Cloud exists specifically to absorb this burden) |
| **ROI verdict**          | Self-hosted is cheaper in dollars at every phase, but this is the one line item in this whole comparison where the **ops-burden trade-off is genuinely close** — RISK-002 already flags this. **Recommendation: self-hosted through Phase 4 (Growth); re-evaluate Temporal Cloud specifically at the Phase 5 (Production) checkpoint**, using real measured ops-hours spent on Temporal as the deciding input, exactly as `roadmap/technology-roadmap.md`'s Year 3 checkpoint already prescribes for other categories. |

### 9.6 Qdrant Self-Hosted vs. Qdrant Cloud

|                                 | Self-Hosted                                                                                                                                                                                                                                                                                                                                                                               | Qdrant Cloud   |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| Cost at Pilot scale             | Not yet active — pgvector covers Pilot-scale needs per TSR §3.12                                                                                                                                                                                                                                                                                                                          | Not yet active |
| Cost at Growth/Production scale | ~$300–700/mo (dedicated cluster)                                                                                                                                                                                                                                                                                                                                                          | ~$600–1,400/mo |
| Ops burden                      | Low-Medium (single-binary architecture per TSR §3.12's own reasoning)                                                                                                                                                                                                                                                                                                                     | Near-zero      |
| **ROI verdict**                 | Consistent with the TSR's own stated preference for Qdrant specifically because of its low operational complexity relative to Milvus/Weaviate — self-hosted Qdrant is the recommended default when the escape hatch activates (Phase 4–5), with Qdrant Cloud as a legitimate option only if the team is already stretched thin managing the rest of the self-hosted stack at that moment. |

---

## 10. LLM Cost Optimization Strategy

### 10.1 Principle: not every component needs an LLM, and not every Agent needs the same tier

The single biggest cost-optimization lever in the entire platform is refusing to let "AI-native" (Constitution §3.6) be misread as "everything calls an LLM." Most of AOS's Core Runtime is **deterministic infrastructure that must never call an LLM at all** — routing an Event Bus dispatch or a Scheduler tick through an LLM would be both slower and less reliable than the plain code it would replace, and would silently destroy the cost model.

### 10.2 Component-Level Routing (extends TSR §4)

| Component / Agent        | Model Tier                                   | Reasoning                                                                                                                                                                                                                            |
| ------------------------ | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| CEO AI                   | **Claude — top reasoning tier (Opus-class)** | Strategic, cross-context, lowest frequency, highest stakes                                                                                                                                                                           |
| Marketing Director AI    | **GPT — mid/current tier**                   | Medium-frequency campaign judgment; strong balance of quality/cost                                                                                                                                                                   |
| Lead Qualification Agent | **GPT-mini-class (fast/cheap tier)**         | Highest invocation frequency in the platform; classification-shaped task, not open-ended reasoning                                                                                                                                   |
| Reflection Engine        | **Claude — mid tier (Sonnet-class)**         | Needs enough reasoning quality to judge its own Agent's output honestly, but runs once per Agent turn, not per token — mid tier is sufficient                                                                                        |
| Knowledge Extraction     | **Gemini — long-context tier**               | Long-document ingestion/summarization benefits from long context window                                                                                                                                                              |
| Image Generation         | **KIE (Tool, not Model Router)**             | Distinct capability shape, metered per asset                                                                                                                                                                                         |
| Video Generation         | **KIE (Tool, not Model Router)**             | Distinct capability shape, metered per asset, higher unit cost — tightest quota                                                                                                                                                      |
| Speech (STT)             | **Whisper-class (Tool)**                     | De facto cost-effective standard                                                                                                                                                                                                     |
| **Workflow Runtime**     | **No LLM**                                   | Pure deterministic orchestration — nodes/edges/conditions execute as code (doc 003.5 §4), never as a model call                                                                                                                      |
| **Scheduler**            | **No LLM**                                   | Cron/interval/calendar evaluation is pure deterministic code (doc 003.5 §12)                                                                                                                                                         |
| **Registry**             | **No LLM**                                   | Configuration resolution/versioning is pure deterministic code (doc 003.5 §13)                                                                                                                                                       |
| **Event Bus**            | **No LLM**                                   | Pub/sub dispatch is pure deterministic code (doc 003.5 §10)                                                                                                                                                                          |
| **Tool Manager**         | **No LLM**                                   | Permission check, schema validation, circuit breaking are pure deterministic code (doc 003.5 §3)                                                                                                                                     |
| **Guardrail Engine**     | **No LLM** (by default)                      | Policy evaluation is deterministic rule evaluation against the Permission Contract; an LLM is only invoked here if a specific Guardrail policy is explicitly defined as an LLM-judged check, which is the exception, not the default |

This "No LLM" row is not a simplification — it is the single largest structural cost saving in the platform, because a naive implementation could easily route Guardrail checks, Scheduler decisions, or Workflow branching through an LLM "for flexibility," multiplying the invocation count from thousands of deterministic operations/day (effectively free) to thousands of paid model calls/day.

### 10.3 Quantifying the ≥70% Target

**Naive baseline (illustrative):** if every one of Phase 5's (100-dealer) ~800,000 monthly Agent+chat invocations (per `cost-analysis/cost-model-100-1000-10000-dealers.md` §2 assumptions) were routed to the top reasoning tier at an illustrative blended cost of **~$0.030/invocation**, monthly AI spend would be **~$24,000/mo**.

**Tiered routing (per TSR §4 / this document §10.2):** with the routing mix of ~~70% fast/cheap tier (~~$0.002/invocation), ~25% mid tier (~$0.010/invocation), ~~5% top tier (~~$0.030/invocation):

```
Weighted average cost per invocation
  = 0.70 × $0.002 + 0.25 × $0.010 + 0.05 × $0.030
  = $0.0014 + $0.0025 + $0.0015
  = $0.0054 per invocation

Monthly AI spend at 800,000 invocations ≈ $4,320/mo
```

**Reduction achieved: (1 − $4,320 / $24,000) ≈ 82%** — comfortably exceeding the ≥70% target, and consistent with the $3,000–$7,000/mo AI cost band already stated for Phase 5/Production in both this document and the TSR Cost Model (the range reflects real-world variance in the tier mix and per-tier pricing, not a contradiction of this illustrative calculation).

**The two levers, stacked:**

1. **Tier routing** (§10.2 table, models) — the ~82% calculated above.
2. **No-LLM components** (Workflow, Scheduler, Registry, Event Bus, Tool Manager, default Guardrail) — not counted in the 82% at all, because these operations were never going to be LLM calls in a correctly-designed system. Their contribution to cost optimization is preventing a _worse_ baseline from ever existing, not reducing an existing one — arguably the more important lever precisely because it's invisible when done right and catastrophic when missed.

**Illustrative figures disclaimer:** the $0.002/$0.010/$0.030 per-invocation figures above are illustrative placeholders for the purpose of demonstrating the _method_, consistent with `benchmarks/llm-model-benchmarks.md`'s explicit note that this document does not hard-code current market pricing as a stale snapshot. The Model Registry (Registry Contract) is the live source of truth for actual per-tier pricing at any given time; this section's job is to fix the _routing ratios and method_, which remain valid even as underlying per-token prices change.

---

## 11. Target Cost Realism Assessment

| Phase                 | Task Brief Target                          | This Document's Estimate                                      | Realistic?                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| --------------------- | ------------------------------------------ | ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Simulation            | $20 – $100/mo                              | $60 – $130/mo (VPS) / $10 – $30/mo (laptop-only)              | **Partially realistic.** Achievable at the low end only if run on a developer's own laptop with no dedicated VPS; a shared, reproducible, always-on VPS environment running the full stack (Postgres+Valkey+NATS+Temporal+MinIO+Qdrant+Grafana stack simultaneously) realistically lands at $60–130/mo, modestly above the $100 ceiling. **Recommendation: keep Phase 1 laptop-first as long as possible; treat $100–150/mo as the honest ceiling once a shared VPS becomes necessary**, rather than force-fitting the original target by under-provisioning RAM, which risks Temporal/Qdrant instability. |
| MVP (→ Internal Demo) | $100 – $300/mo                             | $160 – $280/mo                                                | **Realistic**, comfortably within the stated band.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Pilot                 | $300 – $1,000/mo                           | $450 – $800/mo                                                | **Realistic**, within the stated band with margin on both ends.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Growth                | $1,000 – $5,000/mo                         | $1,850 – $4,200/mo                                            | **Realistic**, within the stated band.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Production            | $5,000 – $20,000/mo                        | $8,000 – $13,000/mo (= TSR Cost Model's 100-dealer figure)    | **Realistic**, and notably the TSR's independently-derived 100-dealer figure lands comfortably inside this band without needing adjustment — a useful cross-check that the two documents' cost models agree.                                                                                                                                                                                                                                                                                                                                                                                               |
| Enterprise            | "Sesuai kebutuhan" (no fixed target given) | $55,000 – $95,000/mo (= TSR Cost Model's 1,000-dealer figure) | **N/A — brief explicitly left this open; this document supplies the concrete number.**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |

**Overall verdict:** six of the seven cost bands in the task brief are realistic as stated; only Phase 1 (Simulation) is optimistic by roughly $10–30/mo if a shared VPS is required rather than a personal laptop — a minor, easily-absorbed gap, not a structural problem with the target-setting exercise. The brief's underlying instinct (keep early phases radically cheap, let cost grow with proven demand) is validated by this analysis, not contradicted by it.

---

## 12. Output Classification

This document serves simultaneously as:

- **Cost Scaling Handbook** — §2–§8 (the seven phases).
- **Deployment Handbook** — the Deployment Diagrams and Technology Stack sections per phase.
- **FinOps Handbook** — §9 (Self-Hosted vs. Managed comparisons with ROI verdicts), §10 (LLM Cost Optimization), §11 (Target Realism Assessment).
- **Infrastructure Growth Strategy** — §1 (Growth Philosophy) and the Scaling Trigger / Upgrade Path / Rollback Plan fields threaded through every phase.

No technology decision in `docs/004-TECHNOLOGY-SELECTION-RECORD.md` is altered by this document — this is confirmed in §0 and holds throughout.

---

## 13. Required Changes Before ENGINEERING TASK 005 (Core Runtime Framework)

Per the task instruction, this is a punch-list of what must change/be decided before Core Runtime implementation begins — **nothing below is implemented here.**

1. **Adopt the phase-gated deployment model as binding**, not aspirational — Core Runtime implementation planning (whatever forms doc 005 and beyond take) must explicitly target Phase 1 (Simulation) as its first milestone, not a scaled-down version of the Phase 5 (Production) architecture. Concretely: no Kubernetes manifests, no multi-region config, no CockroachDB/Kafka code paths in the first implementation milestone.
2. **Confirm which Workflow Engine option Phase 1 actually starts on** — TSR §3.9 explicitly permits either Temporal or an MVP-speed alternative (Inngest/Trigger.dev); this document's Phase 1–3 figures assume Temporal self-hosted throughout for cost-model consistency, but if the implementation team chooses the MVP-speed alternative instead, the Phase 1–4 cost figures in §2–§5 should be revisited (likely lower, per `benchmarks/workflow-engine-benchmarks.md`'s "faster to first production" note) before Core Runtime work begins.
3. **Stand up the Simulation Contract's scenario library early** (doc 003.5 §19) — Phase 1's entire success criterion depends on it, so it cannot be an afterthought scheduled after the runtime is "done."
4. **Define the actual Phase 1 VPS/laptop decision explicitly** with whoever owns the first implementation sprint, given §11's finding that the $20–100/mo target requires a laptop-first approach to hit reliably — this is a real planning decision, not a rounding error, and should be made before infrastructure is provisioned rather than discovered after the first VPS bill.
5. **Pre-select the Phase 3 pilot dealer relationship** (or confirm the "Mitsubishi Pilot" framing is illustrative vs. an actual named target) — because Phase 3 is the first phase requiring real API credentials (Meta, WhatsApp Business, a real LLM billing account), and provisioning those takes real lead time that should start in parallel with Phase 1–2 engineering work, not after Phase 2 is "done."
6. **Assign an explicit owner for the Model Registry's tier-to-vendor mapping** (§10.2 of this document, TSR §4) before any Agent goes live, since the entire ≥70% cost optimization claim in §10.3 depends on the routing ratios actually being enforced in the Model Registry from the very first Agent invocation, not retrofitted after costs are observed to be too high.
7. **Confirm the Cost Model's core assumptions** (`cost-analysis/cost-model-100-1000-10000-dealers.md` §1) against whatever real usage data exists by the end of Phase 3 (Pilot) — this document's Phase 4+ figures inherit those assumptions, so Phase 3 is the last checkpoint to correct them cheaply before they propagate into larger, costlier phases.
8. **Decide the self-hosted-vs-managed posture for each §9 comparison explicitly per phase**, rather than leaving it implicit — in particular, confirm whether Temporal starts self-hosted (as this document assumes) or on Temporal Cloud, since that single decision has the largest cost-model variance of any item in §9.

No code, runtime, or implementation artifact is produced by this document — every item above is a planning/decision prerequisite for whatever Engineering Task 005 (Core Runtime Framework) turns out to require.
