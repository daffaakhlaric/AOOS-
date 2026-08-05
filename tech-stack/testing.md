# Tech Stack Record — Testing

**Category:** §3.24 of [`004-TECHNOLOGY-SELECTION-RECORD.md`](../docs/004-TECHNOLOGY-SELECTION-RECORD.md)
**ADR Reference:** [`adr/ADR-TSR-024-testing.md`](../adr/ADR-TSR-024-testing.md)
**Decision Matrix:** [`decision-matrix/testing.md`](../decision-matrix/testing.md)
**Status:** ACTIVE — Final

---

## Objective

Choose the test tooling implementing Constitution §19 (Testing Standards): 80%/70% line-coverage minimums for `/domain`+`/application` and `/adapters` respectively, effectively-100% coverage on critical paths via explicit test cases (§19.1), per-Tool contract tests (§19.2), per-Agent prompt-regression tests (§19.3), per-Workflow end-to-end integration tests with mocked Tools/Agents (§19.4), explicit multi-tenancy isolation tests (§19.5), and chaos/failure-injection tests for every Tool and critical Workflow (§19.6).

## Requirements

- Native TypeScript/ESM support without a slow or fragile transpilation step, matching the TypeScript-first platform (§3.1).
- Fast unit/integration test execution — a large, growing monorepo (NestJS Core Runtime, Registry Service, API Gateway, plus Go and Python-scoped services per §3.1) needs a test runner whose iteration speed does not become a CI or local-dev bottleneck as the codebase grows.
- A capable end-to-end testing tool for the Dealer Admin Dashboard/Sales Console (Next.js, §3.3) covering real browser rendering, multi-tab/session flows (relevant to §19.5's tenant-isolation testing, which often requires simulating two concurrent authenticated sessions), and reliable CI execution (no flaky-test tax).
- Good mocking/stubbing ergonomics for the Tool Contract's mocked-Tool integration-testing requirement (§19.4) and the multi-tenant RLS-context-switching testing pattern (§19.5).
- Sharing of tooling/config where reasonably possible with the frontend build toolchain, to reduce toolchain duplication across the monorepo (Constitution §2 simplicity bias).

## Candidate Technologies

- **Vitest** (unit/integration test runner)
- **Jest** (unit/integration test runner)
- **Playwright** (end-to-end/browser test tool)
- **Cypress** (end-to-end/browser test tool)

These split into two genuinely different tool categories (unit/integration vs. end-to-end) rather than one undifferentiated "testing" choice — the Final Recommendation reflects that split, consistent with how §3.7 (Queue) split into Job Queue/Event Streaming/Delayed Jobs sub-decisions.

## Evaluation Matrix

Scoring: 1 (worst) – 5 (best) for every dimension except **Vendor Lock-in Risk** (1 = highest, 5 = lowest — largely N/A/low for all four, all are open-source dev tools) and **Estimated Cost** (1 = most expensive, 5 = cheapest — all four are free/open-source; differentiation here is CI-minutes cost from execution speed, not licensing).

| Dimension                                | Vitest                                | Jest                              | Playwright                                       | Cypress                                                |
| ---------------------------------------- | ------------------------------------- | --------------------------------- | ------------------------------------------------ | ------------------------------------------------------ |
| Performance (execution speed)            | 5                                     | 3                                 | 5 (parallel, multi-browser)                      | 3                                                      |
| Scalability (large test-suite, monorepo) | 5                                     | 3                                 | 5                                                | 3                                                      |
| Reliability (flake rate)                 | 4                                     | 4                                 | 5                                                | 3                                                      |
| Security                                 | 4                                     | 4                                 | 4                                                | 4                                                      |
| Maintainability                          | 4                                     | 4                                 | 4                                                | 4                                                      |
| Developer Experience                     | 5 (native ESM/TS, Vite-shared config) | 3 (CJS/ESM friction historically) | 5 (auto-wait, trace viewer, codegen)             | 4 (strong DX, but Electron-based runner overhead)      |
| Ecosystem                                | 4 (growing fast)                      | 5 (largest, most mature)          | 4 (growing fast, MS-backed)                      | 4                                                      |
| Community Maturity                       | 3 (newer, since 2021)                 | 5 (since 2011, largest by far)    | 4 (since 2020, MS-backed momentum)               | 4 (since 2015)                                         |
| Licensing                                | 5 (MIT)                               | 5 (MIT)                           | 5 (Apache 2.0)                                   | 5 (MIT core; paid Cloud tier separate)                 |
| Cloud Compatibility (CI runner support)  | 5                                     | 5                                 | 5                                                | 5                                                      |
| Vendor Lock-in Risk                      | 5                                     | 5                                 | 5                                                | 4 (Cypress Cloud upsell, core itself is not locked-in) |
| Estimated Cost (CI-minutes at scale)     | 5                                     | 3                                 | 5 (faster parallel execution = fewer CI minutes) | 3                                                      |

## Benchmark

No AOS-specific benchmark has been run (pre-implementation decision record). Directionally, per widely reported community benchmarks and both projects' own published rationale: Vitest's use of Vite's native ESM module graph and esbuild/SWC-based transforms gives it materially faster cold-start and watch-mode re-run times than Jest's Babel/CommonJS-oriented transform pipeline, particularly noticeable in watch-mode local-dev iteration loops on larger test suites — this is a directional, widely-observed pattern rather than a number AOS has itself measured. Playwright's built-in test parallelization across browser contexts (rather than Cypress's more constrained parallelization model, which historically required its paid Cloud tier for full parallel-run orchestration) is also a widely reported speed/CI-cost advantage, again directional rather than an AOS-measured figure.

## Performance

Vitest's esbuild/SWC-based transform pipeline and Vite's module graph give it a fast cold-start and near-instant watch-mode re-runs, a direct productivity benefit for TDD-style local development implied by Constitution §19's coverage discipline (fast feedback loops make high coverage less painful to maintain). Playwright's test execution is CPU-parallel by default across browser contexts/workers without requiring a paid tier, materially reducing wall-clock CI time for a large E2E suite relative to Cypress's more constrained default parallelization model.

## Scalability

Both Vitest and Playwright are architected for large test suites: Vitest's workspace/projects feature supports monorepo-scale test organization (relevant to AOS's multi-package Core Runtime/SDK/Dashboard layout, Architecture §38), and Playwright's test sharding across CI runners scales E2E suite execution time sublinearly with runner count. Jest and Cypress both scale adequately but with comparatively more configuration effort to achieve equivalent monorepo/CI-sharding ergonomics.

## Reliability

Playwright's auto-waiting mechanism (waiting for actionability — element attached, visible, stable, receives events — before every action, rather than requiring explicit manual waits) is widely credited with a lower flaky-test rate than Cypress's historically more manual wait-condition authoring pattern, directly relevant to Constitution §19.6's chaos/failure-injection testing requirement, where distinguishing a genuine failure-injection-induced failure from tooling flakiness is operationally important.

## Security

All four are local/CI-execution developer tooling with no meaningful attack surface exposed to production traffic; the relevant security consideration is supply-chain (dependency-scanning per Constitution §20.9 applies to test tooling's own npm dependency tree same as any other package) — no material differentiation between the four candidates on this dimension.

## Maintainability

Vitest's Jest-compatible API (largely a drop-in replacement for common Jest usage patterns) keeps the migration/maintenance cost low for teams with prior Jest experience, while gaining the ESM-native and speed benefits. Playwright's test files, fixtures, and Page Object Model support scale well as the Dashboard/Sales Console's E2E surface grows across multiple product areas (Lead management, Campaign management, Sales Console per Architecture's product surfaces).

## Developer Experience

Vitest's native TypeScript/ESM support (no Babel transform step, no `ts-jest`/`babel-jest` configuration friction that has historically been a notable Jest pain point for ESM-based TypeScript projects) is a direct, meaningful DX win for AOS's TypeScript-first monorepo. Playwright's trace viewer (a full step-by-step visual replay of a failed test run, including DOM snapshots and network activity) and codegen tool (record-a-test-by-clicking-through-the-UI) are both materially better debugging/authoring aids than Cypress's equivalent tooling at this writing, per widely reported developer feedback.

## Ecosystem

Jest remains the single largest testing ecosystem by raw plugin/matcher/tutorial count, a real asset for onboarding speed — this is explicitly why Jest is retained as a fallback (see Final Recommendation) rather than fully excluded. Vitest's ecosystem is smaller but growing quickly and directly inherits much of Jest's matcher API surface (compatibility layer), reducing the practical ecosystem gap. Playwright's ecosystem (fixtures, component-testing mode, official CI-provider integrations) has grown rapidly under Microsoft's active investment; Cypress's ecosystem is mature and stable but growing more slowly by comparison at this writing.

## Community Maturity

Jest (Facebook/Meta, since 2011) is the most battle-tested and widely adopted of the four by a wide margin, with the largest hiring pool of "already knows this tool" engineers. Vitest (since 2021) is the newest of the four; its rapid adoption curve within the Vite ecosystem is a strong current-momentum signal, but it has the shortest track record. Playwright (Microsoft, since 2020) and Cypress (since 2015) both have solid, multi-year production track records in the E2E space specifically.

## Licensing

**Vitest, Jest, and Cypress's core testing framework** are all **MIT-licensed** (fully open source, no restrictions). **Playwright** is **Apache-2.0-licensed** (also fully open source). None of the four core testing tools carry the licensing-risk pattern seen elsewhere in this TSR (Redis→Valkey §3.6, Elasticsearch→OpenSearch §3.14, Terraform/Vault BSL notes in §3.21/§3.22) — this is a clean dimension for all four candidates. The one adjacent note: **Cypress Cloud** (the optional hosted dashboard/parallelization/analytics service) is a separate proprietary commercial product layered on top of the MIT-licensed Cypress core; using Cypress's free core test runner without Cypress Cloud carries no such consideration, but achieving Cypress's full parallel-CI-execution story historically leaned on that paid tier more than Playwright's equivalent capability does.

## Cloud Compatibility

All four run identically on any CI provider (GitHub Actions per §3.18, or any alternative) and any container-based CI runner; Playwright additionally ships official Docker images with browser binaries pre-installed, slightly reducing CI setup friction for the E2E suite specifically.

## Vendor Lock-in

All four are standard open-source dev-tooling dependencies with no runtime coupling to AOS's production architecture — switching test tools at any point is a developer-tooling migration, not a production-architecture change, making this dimension low-stakes for all four relative to every infrastructure-category decision elsewhere in this TSR. Cypress carries a slightly elevated (still low in absolute terms) consideration only insofar as its full-featured parallel/analytics story nudges toward its paid Cloud product; this does not lock in the core open-source test-writing investment, which remains portable.

## Estimated Cost

All four tools are free and open-source at the core-framework level; the practical "cost" differentiator is CI-minutes consumption (GitHub Actions, per §3.18, bills by runner-minute) — faster test execution directly reduces CI spend at scale. Vitest and Playwright's speed/parallelization advantages (reasoned in Performance/Benchmark above) translate to measurably fewer CI-minutes-per-run than Jest/Cypress at equivalent suite size, a small but real, monorepo-wide-multiplied cost saving as the platform's test suite grows across every service named in Architecture §38. This is not separately broken out in `cost-analysis/cost-model-100-1000-10000-dealers.md` (CI/CD cost is folded into general engineering-tooling overhead, not a named infrastructure line), but the directional saving is consistent with the same "avoid metered-cost patterns that compound with platform growth" philosophy applied throughout this TSR.

## Pros

**Vitest:** fastest cold-start/watch-mode iteration; native TS/ESM, no transform-config friction; Jest-API-compatible (low migration cost); shares config with a Vite-based frontend toolchain if adopted.
**Jest:** largest ecosystem and hiring pool; most battle-tested; best choice when a specific dependency requires Jest-only mocking support.
**Playwright:** fastest, most reliable E2E execution; native multi-browser including WebKit; best-in-class debugging tooling (trace viewer, codegen); Microsoft-backed active development.
**Cypress:** strong, approachable DX; mature ecosystem; good choice if a hire brings existing deep Cypress expertise.

## Cons

**Vitest:** youngest of the four, shortest production track record; smaller ecosystem than Jest's (though narrowing).
**Jest:** slower cold-start/watch-mode than Vitest; historically real ESM/TypeScript configuration friction for modern TS-ESM projects.
**Playwright:** younger than Cypress in the E2E space specifically (though backed by a large company); smaller ecosystem of third-party plugins than Cypress's longer history has accumulated.
**Cypress:** slower, more flake-prone default execution than Playwright per widely reported comparisons; full parallel-CI story leans toward its paid Cloud tier; no native WebKit/Safari support (a real gap for cross-browser Dashboard testing).

## Trade-offs

Choosing Vitest over Jest trades Jest's larger ecosystem/hiring-pool maturity for materially faster local/CI iteration and native ESM/TS ergonomics that fit AOS's TypeScript-first stack better — Jest is not excluded, only demoted to an explicit, sanctioned fallback for specific dependency needs, so the ecosystem-gap risk is bounded rather than absolute. Choosing Playwright over Cypress trades Cypress's longer track record and comparably strong DX for broader browser coverage (including WebKit, relevant to Dashboard cross-browser support commitments) and faster, more reliable default parallel execution — directly reducing both flaky-test tax and CI-minutes cost at monorepo scale.

## Final Recommendation

**Vitest** for unit/integration tests — matching TSR §3.24 exactly: faster execution and native TypeScript/ESM support than Jest, and shares configuration/tooling with a Vite-based frontend build if one is adopted, reducing toolchain duplication. **Playwright** for end-to-end tests — broader multi-browser (including WebKit) support, materially faster parallel execution, and better CI-native tooling than Cypress at present. **Jest** remains an acceptable fallback wherever a specific dependency (e.g., a legacy library with Jest-only mocking support) requires it, rather than a hard rule against it. **Cypress** is not recommended as primary given Playwright's current advantages, though existing Cypress expertise on a hire is not a blocker to contributing.

## ADR Reference

[`adr/ADR-TSR-024-testing.md`](../adr/ADR-TSR-024-testing.md)

## Migration Strategy

No migration is currently triggered — both Vitest and Playwright are the v1 default from project inception, so this category has no "default + escape hatch" structure like several infrastructure categories in this TSR. If a team-level need to fall back to Jest arises for a specific package (a documented dependency constraint), that package's test config diverges locally without forcing a monorepo-wide reversion, consistent with Constitution §19's per-package coverage enforcement. No migration path exists (or is needed) away from Playwright for E2E, absent a currently unforeseen structural problem.

## Future Consideration

Track Vitest's community-maturity trajectory (currently its one real weak dimension relative to Jest) at the Year 2–3 Technology Roadmap checkpoints; if Vitest's ecosystem has not continued to close the gap with Jest's by then, re-confirm rather than assume the choice remains optimal. Track Playwright's component-testing mode (beyond its current E2E-primary role) as a possible future consolidation point if it matures enough to reduce the need for separate unit-level component tests in some cases — evaluated, not adopted, at this stage.
