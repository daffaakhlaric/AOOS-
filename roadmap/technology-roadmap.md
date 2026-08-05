# Technology Roadmap (3–5 Years)

Governs: [`docs/004-TECHNOLOGY-SELECTION-RECORD.md`](../docs/004-TECHNOLOGY-SELECTION-RECORD.md) §10

This roadmap sequences when each TSR decision is expected to matter, and names the checkpoints at which escape-hatch technologies (§9 Migration Strategy) are evaluated against real data rather than pre-launch estimates. It is a planning horizon, not a commitment schedule with fixed dates — each phase begins when its entry criteria are met, not on a calendar trigger alone.

## Year 1 — Foundation (Core Runtime on the TSR Stack, Single Region)

**Entry criteria:** Core Runtime implementation begins (post Volume 004+ per DDD §31 file list and the Contract Specification, doc 003.5).

- Full TSR stack (§3) implemented as decided: TypeScript/NestJS core, PostgreSQL RLS default tier only (no CockroachDB yet — no Enterprise tenant needs it yet), pgvector only (no Qdrant yet), NATS JetStream, Valkey, BullMQ, Kong, Keycloak, Temporal **or** an MVP-speed alternative (Inngest/Trigger.dev) per the explicit optionality in TSR §3.9, Grafana LGTM stack, GitHub Actions + ArgoCD, Terraform, Vault.
- First production cohort: 100-dealer scale (per Cost Model §1 tier). Real usage data collection begins here — this is the checkpoint referenced throughout the Cost Model and Risk Register as "measured data" replacing estimates.
- If the MVP-speed Workflow option (Inngest/Trigger.dev) was chosen, the Temporal migration plan (`migration/`) must be drafted concretely by the end of Year 1, not left open-ended.
- **Exit criteria:** stable operation at 100-dealer scale with real cost/performance data collected across all categories in the Cost Model.

## Year 2 — Multi-Region & First Enterprise Tenants

**Entry criteria:** Year 1 exit criteria met; first Enterprise-tier tenant contracts requiring multi-region or elevated isolation guarantees are signed or imminent.

- Multi-region Disaster Recovery activated (Architecture doc 002 §32).
- CockroachDB escape hatch (TSR §3.4) activated for the first qualifying Enterprise tenant(s) — per-tenant, triggered by the named condition in `migration/`, not platform-wide.
- Qdrant escape hatch (TSR §3.12) evaluated against real embedding-volume/RAG-latency data from Year 1; activated if the trigger condition is met.
- Kafka migration (TSR §3.7/§3.8) evaluated against real Year 1 event-volume data — a decision point, not an automatic migration.
- Growth toward 1,000-dealer scale tier (Cost Model §1); cost governance actions from Cost Model §12 executed at this checkpoint.

**Exit criteria:** multi-region DR proven via at least one drilled failover (Architecture §32 Best Practice); at least one Enterprise tenant successfully operating on the distributed-SQL escape hatch if activated.

## Year 3 — Cost & Operational Maturity Checkpoint

**Entry criteria:** ~2 years of real production usage data available across the full TSR stack.

- Full re-evaluation of every "cost-sensitive default" decision in the TSR using real data instead of estimates: Grafana Stack vs. Datadog (§3.23), Kong OSS vs. Enterprise (§3.15), Valkey vs. DragonflyDB (§3.6), Meilisearch vs. OpenSearch (§3.14).
- Re-run the Cost Model (`cost-analysis/`) with actual measured per-dealer resource consumption, replacing the original planning assumptions (§1 of that document) entirely.
- AI Model Strategy routing table (TSR §4) re-tuned based on 2+ years of model-market evolution (new tiers, price changes, new providers) — the tier abstraction (not the vendor mapping) is expected to remain stable; only the Model Registry's tier-to-vendor mapping changes.

**Exit criteria:** a written cost/operations retrospective confirming or revising each Year-1 default decision, filed as an update to the relevant `tech-stack/<category>.md` file (not a silent, undocumented change).

## Years 4–5 — Scale Maturity & Selective Specialization

**Entry criteria:** platform approaching or exceeding the 10,000-dealer cost tier; specific, measured bottlenecks identified (not speculative).

- **Selective Rust adoption** (TSR §3.1 Future Consideration) for any specific, profiled hot-path bottleneck in the Go or TypeScript services — evaluated per-service, never as a platform-wide rewrite.
- **Service mesh evaluation** (Envoy/Istio, TSR §3.15 Future Consideration) if multi-region service-to-service traffic complexity has grown beyond what Kong + direct Kubernetes networking comfortably handles.
- **Podman evaluation** (TSR §3.19 Future Consideration) specifically if an Enterprise on-prem deployment with rootless-container compliance requirements materializes.
- Continuous LLM model-tier re-routing as the model market evolves (ongoing from Year 1 onward, called out explicitly here as a standing, never-finished activity rather than a one-time project).
- Full technology stack re-audit against a then-current version of the Engineering Constitution (doc 001) and Enterprise Architecture (doc 002), since both are living documents expected to evolve over a 4–5 year horizon.

**Exit criteria:** none — this phase is intentionally open-ended, representing steady-state technology stewardship rather than a project with a defined end.

## Roadmap Governance

Any deviation from this roadmap's sequencing (e.g., activating an escape hatch earlier than its named trigger condition, or skipping a checkpoint's re-evaluation) must be recorded as an update to the relevant `adr/ADR-TSR-0NN-<category>.md` file, per the same Conflict/Amendment discipline used throughout docs 001–004 — this roadmap does not override the TSR's decisions; it sequences when they are revisited.
