# Tech Stack Record — Documentation

**Category:** §3.25 of [`004-TECHNOLOGY-SELECTION-RECORD.md`](../docs/004-TECHNOLOGY-SELECTION-RECORD.md)
**ADR Reference:** [`adr/ADR-TSR-025-documentation.md`](../adr/ADR-TSR-025-documentation.md)
**Decision Matrix:** [`decision-matrix/documentation.md`](../decision-matrix/documentation.md)
**Status:** ACTIVE — Final

---

## Objective

Choose the documentation publishing tooling implementing Constitution §22 (Documentation Standards) across **two genuinely different documentation surfaces**, not one: (1) the **internal Engineering Handbook** — this living Constitutional/Architecture/DDD/Contract/TSR document series itself (docs 001–004+ and everything under `adr/`, `tech-stack/`, `decision-matrix/`, `risk/`, `migration/`, `roadmap/`, `cost-analysis/`), and (2) **external-facing Developer/API/SDK documentation** — published reference material for the Contract Specification's JSON Schemas (doc 003.5), the Core Runtime SDK, and any public API surface, once those exist. This category's Final Recommendation is deliberately **dual**, not a single tool covering both — the two surfaces have different audiences, different content shapes, and different publishing cadences, and flattening them into one tool would force a compromise neither audience needs.

## Requirements — Internal Engineering Handbook

- Fully self-hostable (no dependency on a third-party SaaS vendor for internal constitutional documents that govern the entire platform — same self-hosting-preference principle applied throughout this TSR).
- Versioning-friendly for a living document set that amends over time (Constitution §21.5 requires the Constitution itself to be versioned with a changelog; the same discipline extends to Architecture/DDD/Contract/TSR documents).
- Highly customizable — supports the current heavy use of large markdown tables, nested numbered sections, cross-document relative links (`../docs/001-...md`), and Mermaid/PlantUML/ASCII diagrams (per §10 of the TSR's own Technology Roadmap section, and DDD/Architecture's diagram conventions).
- React-based or otherwise consistent with the platform's TypeScript-first tooling posture (§3.1), so the same engineering team maintaining the Dashboard (Next.js/React, §3.3) can also maintain the docs site without a second frontend stack to learn.

## Requirements — External Developer/API/SDK Docs

- Native OpenAPI/JSON-Schema ingestion — the Contract Specification (doc 003.5) already defines every contract as a JSON Schema (`schemas/*.schema.json`); the external docs tool should be able to render browsable API reference directly from those schema files rather than requiring hand-duplicated documentation prose that drifts from the schema (directly enforcing Constitution §22.4: "API and event schemas are documented in a machine-readable spec... kept in sync with implementation via CI validation, not hand-maintained separately").
- Modern, polished external-developer-facing UX — this surface is a competitive/adoption signal for any third-party integrator or Enterprise tenant building against AOS's SDK, unlike the internal handbook whose audience is exclusively AOS's own engineering team.
- Low operational overhead for a small early team, since external docs are not the platform's core differentiator and should not consume disproportionate engineering time to stand up or maintain.

## Candidate Technologies

- **Docusaurus** (React-based static site generator, Meta-maintained)
- **MkDocs** (Python-based static site generator, Material theme ecosystem)
- **Mintlify** (modern hosted docs platform, strong native OpenAPI/schema integration)

## Evaluation Matrix

Scoring: 1 (worst) – 5 (best) for every dimension except **Vendor Lock-in Risk** (1 = highest, 5 = lowest) and **Estimated Cost** (1 = most expensive at scale, 5 = cheapest). Because this category has a **dual recommendation**, the matrix scores all three candidates against both use cases together; the Final Recommendation section explains which candidate wins which surface and why the scores diverge by intended use.

| Dimension                                            | Docusaurus                                   | MkDocs                                         | Mintlify                                      |
| ---------------------------------------------------- | -------------------------------------------- | ---------------------------------------------- | --------------------------------------------- |
| Performance (site build/load speed)                  | 4                                            | 4                                              | 5 (hosted, CDN-optimized)                     |
| Scalability (large multi-doc-series site)            | 5 (versioning built-in)                      | 4                                              | 4                                             |
| Reliability                                          | 4 (self-hosted, own uptime)                  | 4 (self-hosted, own uptime)                    | 4 (vendor-hosted uptime)                      |
| Security                                             | 4                                            | 4                                              | 4                                             |
| Maintainability                                      | 4 (React/TS, team-familiar)                  | 3 (Python toolchain, second stack)             | 5 (hosted, no infra to maintain)              |
| Developer Experience                                 | 4                                            | 4                                              | 5 (best-in-class for API-reference authoring) |
| Ecosystem (plugins, themes)                          | 5 (largest, most active for a JS-first team) | 4 (mature Material theme ecosystem)            | 3 (newer, narrower plugin surface)            |
| Community Maturity                                   | 5 (Meta-backed, since 2017)                  | 5 (since 2014, huge Python-community adoption) | 3 (newer entrant)                             |
| Licensing                                            | 5 (MIT)                                      | 5 (BSD-2-Clause)                               | 2 (proprietary SaaS)                          |
| Cloud Compatibility                                  | 5 (deployable anywhere, static output)       | 5 (deployable anywhere, static output)         | 3 (hosted-first; self-host option limited)    |
| Vendor Lock-in Risk                                  | 5                                            | 5                                              | 2 (hosted platform, content export friction)  |
| Estimated Cost (at scale)                            | 5 (free, self-hosted)                        | 5 (free, self-hosted)                          | 3 (per-seat/usage SaaS pricing at scale)      |
| **Fit for internal Engineering Handbook (weighted)** | **5**                                        | 3                                              | 2                                             |
| **Fit for external API/SDK docs (weighted)**         | 3                                            | 3                                              | **5**                                         |

## Benchmark

No AOS-specific benchmark has been run (pre-implementation decision record). Directionally, per each project's own published architecture: Docusaurus and MkDocs both produce fully static HTML/CSS/JS output, giving near-instant page loads once built/deployed (typical of static-site generators generally, no server-side rendering cost at request time) — build time itself scales with document-set size and versioned-docs-plugin usage, and is a one-time CI cost rather than a per-request cost. Mintlify, as a hosted platform, benefits from vendor-managed CDN edge caching without AOS needing to configure that itself, a directional operational-convenience advantage rather than a measured latency number.

## Performance

Both self-hosted static-site generators produce output fast enough that page-load performance is not a meaningful differentiator for an internal engineering audience reading documentation, not a latency-sensitive customer-facing product. Mintlify's hosted, CDN-fronted delivery is well-suited to unpredictable external-developer traffic patterns (a documentation page going viral in a developer community, for instance) without AOS needing to provision for that spike itself.

## Scalability

Docusaurus's native **versioned-docs** feature (each documentation "version" is a first-class, independently browsable snapshot, with a version switcher in the UI) is a direct, purpose-built match for this TSR's own document series, which is explicitly living and amendable (Constitution §21.5) — MkDocs supports versioning only via a third-party plugin (`mike`), functionally similar but less deeply integrated than Docusaurus's built-in support. This is the single most decisive scalability consideration for the internal-handbook use case specifically, since a governing document set that changes over time without losing access to prior versions is a stated requirement, not a nice-to-have.

## Reliability

Docusaurus and MkDocs both produce static output deployable to any static host (including the same infrastructure already used for other self-hosted assets, or a simple CDN-fronted object-storage bucket via R2, §3.13) — reliability is simply "is the static host up," a very low-complexity reliability profile. Mintlify's reliability depends on the vendor's own hosting uptime, outside AOS's direct control, an acceptable trade for the external-docs use case (lower stakes than internal governance documents being unavailable) but a genuine consideration if ever proposed for the internal handbook instead.

## Security

None of the three candidates handle sensitive runtime data — they render static or vendor-hosted content from source-controlled markdown/schema files. The main security-adjacent consideration is access control: the internal Engineering Handbook may eventually need to be gated behind AOS's own authentication (Keycloak, §3.16) if any internal-only content should not be publicly reachable, which a self-hosted Docusaurus/MkDocs deployment can enforce via a reverse-proxy/gateway (Kong, §3.15) in front of the static site — straightforward with self-hosted output, and one more reason self-hosting fits the internal-handbook use case better than a third-party-hosted product would.

## Maintainability

Docusaurus is React/TypeScript-based, meaning the same engineering team already maintaining the Next.js Dashboard (§3.3) can maintain and extend the docs site's theme/components without a second frontend stack to learn — a direct, concrete instance of Constitution §2's simplicity bias applied to tooling choice. MkDocs' Python-based toolchain (Jinja2 templates, `mkdocs.yml` config, Python plugin ecosystem) is a genuinely good tool but represents a second, unrelated toolchain for a TypeScript-first team (§3.1) to maintain proficiency in, for no corresponding capability gain over Docusaurus for AOS's specific needs. Mintlify, being fully hosted, has effectively zero self-maintenance burden — the trade is control/customization depth versus maintenance-free operation.

## Developer Experience

Mintlify's authoring DX for **API reference content specifically** is its strongest, most decisive advantage — writing/maintaining OpenAPI-driven interactive API reference pages (try-it-now request builders, auto-generated parameter tables, multi-language code-sample generation) is meaningfully faster and more polished in Mintlify than hand-building the equivalent in Docusaurus's OpenAPI plugin ecosystem, which exists but is less deeply integrated. For general narrative documentation (the internal handbook's actual content shape — long-form governing prose, large tables, cross-document references), Docusaurus and MkDocs both offer perfectly adequate, comparably good authoring DX (standard markdown/MDX editing), with no decisive winner between them beyond the toolchain-alignment argument above.

## Ecosystem

Docusaurus has the largest, most active plugin/theme ecosystem of the three for a JavaScript/TypeScript-oriented team, actively maintained by Meta and a large open-source community, including first-class Mermaid-diagram support (relevant to this TSR's own diagram conventions, §10) and versioned-docs tooling as noted above. MkDocs' ecosystem (particularly the widely used Material for MkDocs theme) is also mature and large, concentrated in the Python/data-science documentation community rather than the TypeScript/web community AOS is otherwise standardized on. Mintlify's plugin/extension ecosystem is narrower, reflecting its younger age and more opinionated, hosted-platform-first product shape — appropriate for its scoped role (API reference) rather than a general documentation-ecosystem gap.

## Community Maturity

Docusaurus (Meta, since 2017, versions 2/3 widely adopted across a huge number of open-source and corporate documentation sites) and MkDocs (since 2014, especially dominant in Python-ecosystem project documentation) are both long-established, well-understood tools with large communities and long production track records. Mintlify is a comparatively young entrant (founded 2022) with a fast-growing but smaller community and shorter track record — an acceptable trade for the external-API-docs use case given its category-leading DX for that specific job, but a reason it is not recommended for the higher-stakes, longer-lived internal governance-document role.

## Licensing

**Docusaurus is MIT-licensed** (fully open source, Meta-maintained). **MkDocs is BSD-2-Clause-licensed** (fully open source). Neither carries any licensing-risk pattern seen elsewhere in this TSR. **Mintlify is a proprietary hosted SaaS product** under its own commercial terms — content (markdown/MDX source files) remains in AOS's own version control regardless, limiting true lock-in to the _hosting/rendering layer_ rather than the content itself, but the specific interactive-API-reference tooling and its configuration format are Mintlify-specific and would need reauthoring against a different platform's equivalent feature if ever migrated away.

## Cloud Compatibility

Docusaurus and MkDocs both produce static output deployable to literally any static host or CDN (including R2, §3.13, or any other object-storage-plus-CDN combination already in use elsewhere in this TSR) — no cloud-specific dependency at all. Mintlify is primarily a hosted-first product; while it does support some self-hosting/custom-deployment options, its core value proposition and most polished experience assumes using Mintlify's own hosting.

## Vendor Lock-in

Docusaurus and MkDocs carry effectively zero vendor lock-in — both are self-hosted open-source tools producing portable static output, consistent with the self-hosting-preference principle applied throughout this TSR (Vault over cloud-native secrets managers §3.22, Grafana Stack over Datadog §3.23, Keycloak over Auth0 §3.16). Mintlify carries real, acknowledged lock-in on the hosting/interactive-features layer (its request-builder, auto-generated SDK code samples, and analytics are Mintlify-specific capabilities) — accepted deliberately for the external-docs use case specifically because the DX payoff for API-reference content is judged to outweigh that lock-in risk for a documentation surface that is not itself core platform infrastructure and is comparatively cheap to migrate later (markdown/schema source content ports; only the presentation layer would need rework).

## Estimated Cost

Docusaurus and MkDocs are both free and open-source; their cost is purely the infrastructure to build/host the static output (negligible — folded into general CDN/hosting cost already budgeted elsewhere, not separately broken out in `cost-analysis/cost-model-100-1000-10000-dealers.md`, which does not name a documentation-hosting line item given how small it is relative to every other category). Mintlify's pricing is a per-seat/usage-tier SaaS model; at AOS's scale this remains a small line item relative to the platform's dominant cost drivers (AI/LLM Inference, Compute Infrastructure) but is a real, ongoing metered cost compared to Docusaurus/MkDocs's effectively-zero licensing cost — an acceptable trade given external developer docs are a small, bounded surface (not a cost driver that compounds with tenant count the way Monitoring's per-host/per-GB pattern does, since docs traffic does not scale with tenant/Agent-invocation volume the way telemetry ingestion does).

## Pros

**Docusaurus:** React/TS-aligned with the platform's own frontend stack; best-in-class native versioned-docs support, a direct match for a living Constitutional document series; MIT-licensed, fully self-hostable; large, active ecosystem including strong Mermaid diagram support.
**MkDocs:** mature, stable, large community (especially strong Material theme ecosystem); BSD-licensed; fine alternative for teams preferring Python-based tooling.
**Mintlify:** category-leading DX for OpenAPI/JSON-Schema-driven interactive API reference; modern, polished external-developer-facing UX; low operational overhead (fully hosted).

## Cons

**Docusaurus:** OpenAPI/interactive-API-reference plugin ecosystem is less deeply integrated/polished than Mintlify's purpose-built equivalent — a real gap for the external-docs use case specifically, which is exactly why it is not recommended for that surface.
**MkDocs:** Python-based toolchain is a second, unrelated stack for a TypeScript-first team to maintain, for no corresponding capability advantage over Docusaurus on AOS's specific requirements; versioning support is plugin-based rather than as deeply native as Docusaurus's.
**Mintlify:** proprietary SaaS with real (if bounded) vendor lock-in on the hosting/interactive-feature layer; younger, smaller community/shorter track record; ongoing metered cost versus Docusaurus/MkDocs's free self-hosted model; not well-suited to the internal handbook's long-form governance-document content shape or self-hosting requirement.

## Trade-offs

Splitting the recommendation across two tools (rather than picking one for both surfaces) accepts running two documentation toolchains instead of one, but is the direct, intentional consequence of the two surfaces having genuinely different requirements — the internal handbook needs self-hosted, versioned, React-aligned narrative documentation with zero vendor dependency for governing documents; the external API docs need best-in-class OpenAPI-driven interactive reference with minimal operational overhead, a job Mintlify is purpose-built for and Docusaurus is not. Forcing one tool to serve both jobs (either Docusaurus stretched to do API-reference-generation work it is not specialized for, or Mintlify stretched to host long-lived internal governance documents on a third-party platform) would produce a worse outcome on both surfaces than the two-tool split does on either alone — the same "different access patterns deserve different tools" reasoning already applied to BullMQ+NATS JetStream in §3.7.

## Final Recommendation

**Docusaurus** for the internal Engineering Handbook (this document series, docs 001–004 and beyond) — React-based, fully self-hostable, highly customizable, and versioning-friendly for a living constitutional document set. **Mintlify** for external-facing Developer/API/SDK documentation (once the Core Runtime and SDK exist) — modern DX, strong native OpenAPI/schema integration well-suited to publishing the Contract Specification's JSON Schemas (doc 003.5) as browsable API reference. **MkDocs is not adopted** — Docusaurus covers the same ground with a more actively maintained plugin ecosystem for a TypeScript-first team, though MkDocs remains a fine choice for teams preferring Python-based tooling. This is a **dual, not a flattened single, recommendation** — Docusaurus and Mintlify serve two different audiences and content shapes and are both binding simultaneously, not sequential alternatives.

## ADR Reference

[`adr/ADR-TSR-025-documentation.md`](../adr/ADR-TSR-025-documentation.md)

## Migration Strategy

No migration is currently triggered for either surface. The external-API-docs surface (Mintlify) does not yet exist as a populated site — it is deferred until the Core Runtime and SDK exist to document, per this category's own Objective — so there is no cutover to plan yet, only an adoption-at-the-right-time sequencing note (do not stand up Mintlify prematurely against an unstable/pre-v1 SDK surface, consistent with Constitution §21's versioning discipline). If Mintlify's hosting/lock-in trade-off ever becomes a concern at scale, the markdown/MDX source content and the underlying JSON Schemas (doc 003.5) both remain portable to a self-hosted Docusaurus-plus-OpenAPI-plugin setup; only the interactive request-builder/SDK-code-sample generation would need to be rebuilt against Docusaurus's OpenAPI tooling. The internal handbook (Docusaurus) has no planned migration away from it named in this TSR.

## Future Consideration

Re-evaluate Mintlify's cost-at-scale (per-seat/usage pricing) against Docusaurus-plus-OpenAPI-plugin as a self-hosted alternative once real external-developer-docs traffic/usage data exists, at a Year 2–3 Technology Roadmap checkpoint, mirroring the re-evaluation discipline applied to Grafana Stack vs. Datadog (§3.23) and Kong OSS vs. Enterprise (§3.15) elsewhere in this TSR. Track Docusaurus's own OpenAPI-plugin ecosystem maturity over the same horizon — if it closes the gap with Mintlify's purpose-built interactive-reference DX, that would be a relevant input to any future single-tool-consolidation discussion, though no such consolidation is currently planned or recommended.
