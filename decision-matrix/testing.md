# Decision Matrix — Testing

**Category:** §3.24 of [`../docs/004-TECHNOLOGY-SELECTION-RECORD.md`](../docs/004-TECHNOLOGY-SELECTION-RECORD.md)
**Full record:** [`../tech-stack/testing.md`](../tech-stack/testing.md)
**ADR:** [`../adr/ADR-TSR-024-testing.md`](../adr/ADR-TSR-024-testing.md)

## How to read this matrix

Every dimension is scored **1 (worst) – 5 (best)**. **Vendor Lock-in Risk** and **Estimated Cost** are inverted so "5" always means "best for AOS" (5 = lowest lock-in / cheapest). Because this category splits into two genuinely different tool jobs (unit/integration vs. end-to-end), the scoring matrix is presented as **two sub-tables** rather than one four-way table — comparing Vitest against Jest, and Playwright against Cypress, is the meaningful comparison; comparing a unit-test runner against a browser-automation tool head-to-head would not be. Each sub-table has its own weighted total.

## Sub-Matrix A — Unit/Integration Test Runner

| Dimension            | Weight   | Vitest   | Jest     |
| -------------------- | -------- | -------- | -------- |
| Performance          | 20%      | 5        | 3        |
| Scalability          | 10%      | 5        | 3        |
| Reliability          | 8%       | 4        | 4        |
| Security             | 4%       | 4        | 4        |
| Maintainability      | 8%       | 4        | 4        |
| Developer Experience | 18%      | 5        | 3        |
| Ecosystem            | 12%      | 4        | 5        |
| Community Maturity   | 10%      | 3        | 5        |
| Licensing            | 3%       | 5        | 5        |
| Cloud Compatibility  | 2%       | 5        | 5        |
| Vendor Lock-in Risk  | 2%       | 5        | 5        |
| Estimated Cost       | 3%       | 5        | 3        |
| **Weighted Total**   | **100%** | **4.44** | **3.80** |

## Sub-Matrix B — End-to-End Test Tool

| Dimension            | Weight   | Playwright | Cypress  |
| -------------------- | -------- | ---------- | -------- |
| Performance          | 18%      | 5          | 3        |
| Scalability          | 12%      | 5          | 3        |
| Reliability          | 15%      | 5          | 3        |
| Security             | 4%       | 4          | 4        |
| Maintainability      | 8%       | 4          | 4        |
| Developer Experience | 15%      | 5          | 4        |
| Ecosystem            | 8%       | 4          | 4        |
| Community Maturity   | 6%       | 4          | 4        |
| Licensing            | 3%       | 5          | 5        |
| Cloud Compatibility  | 4%       | 5          | 5        |
| Vendor Lock-in Risk  | 4%       | 5          | 4        |
| Estimated Cost       | 3%       | 5          | 3        |
| **Weighted Total**   | **100%** | **4.72**   | **3.62** |

## Weight Justification

- **Performance (20% / 18%) and Developer Experience (18% / 15%) are the two heaviest weights in both sub-matrices** — for test tooling specifically, iteration speed and authoring/debugging ergonomics directly determine whether Constitution §19's coverage minimums (80%/70%, effectively 100% on critical paths) are sustainable in practice or become a dreaded chore that erodes over time; slow or flaky tooling is a leading real-world cause of coverage discipline decaying.
- **Reliability (8% / 15%)** is weighted notably higher in the E2E sub-matrix than the unit-test sub-matrix — E2E flakiness (Cypress's comparative weakness per widely reported experience) is a much larger tax on CI trustworthiness than unit-test flakiness, since a flaky E2E suite trains engineers to ignore failures, directly undermining §19.6's chaos/failure-injection testing requirement's signal quality.
- **Scalability (10% / 12%)** reflects both tools' behavior at monorepo/large-suite scale, relevant as Architecture §38's many-service footprint grows.
- **Ecosystem and Community Maturity (12%+10% for Vitest/Jest; 8%+6% for Playwright/Cypress)** are weighted higher in the unit-test sub-matrix specifically because Jest's ecosystem/maturity lead over Vitest is real and larger than Cypress's lead over Playwright in the E2E space — the weighting reflects that Jest is retained as an explicit fallback partly because this gap is more material than the corresponding E2E gap.
- **Licensing, Cloud Compatibility, Vendor Lock-in Risk, Security, Maintainability** are low-weighted across both sub-matrices — all four candidates are comparable, low-risk, open-source developer tooling on these dimensions, none of them a deciding factor.

## Result

Vitest wins Sub-Matrix A (4.44 vs. 3.80), and Playwright wins Sub-Matrix B (4.72 vs. 3.62) — both decisively, driven by the heavily weighted Performance/DX/Reliability dimensions. Jest's Ecosystem and Community Maturity wins are real but insufficient to close the gap once TypeScript/ESM-native performance and DX are weighted as heavily as they are for a TypeScript-first monorepo (§3.1) — which is exactly why Jest is retained as a sanctioned fallback rather than fully excluded, rather than a false "clean win" framing.
