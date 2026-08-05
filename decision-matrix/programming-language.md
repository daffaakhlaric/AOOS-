# Decision Matrix — Programming Language

Governs: [`docs/004-TECHNOLOGY-SELECTION-RECORD.md`](../docs/004-TECHNOLOGY-SELECTION-RECORD.md) §3.1
Full rationale: [`tech-stack/programming-language.md`](../tech-stack/programming-language.md)

**How to read this matrix:** each dimension is scored 1–5. For every dimension except **Estimated Cost** and **Vendor Lock-in Risk**, higher is better. For those two, lower is better (lower cost, lower lock-in risk). This matrix scores the _language_ in isolation; the master TSR's Final Recommendation is not "pick the single highest-scoring row" but a scoped combination (TypeScript primary + Go + Python each for a bounded purpose) — the matrix informs, it does not mechanically dictate, the decision.

| Dimension            | Weight | TypeScript | Go       | Rust     | Python   |
| -------------------- | ------ | ---------- | -------- | -------- | -------- |
| Performance          | 10%    | 3          | 4        | 5        | 2        |
| Scalability          | 10%    | 4          | 5        | 5        | 3        |
| Reliability          | 10%    | 4          | 4        | 5        | 3        |
| Security             | 10%    | 4          | 4        | 5        | 3        |
| Maintainability      | 10%    | 4          | 4        | 3        | 3        |
| Developer Experience | 12%    | 5          | 4        | 2        | 4        |
| Ecosystem            | 12%    | 5          | 4        | 3        | 5        |
| Community Maturity   | 8%     | 5          | 4        | 3        | 5        |
| Licensing            | 3%     | 1          | 1        | 1        | 1        |
| Cloud Compatibility  | 5%     | 5          | 5        | 4        | 5        |
| Vendor Lock-in Risk  | 5%     | 1          | 1        | 1        | 1        |
| Estimated Cost       | 5%     | 2          | 2        | 4        | 2        |
| **Weighted Total***  | 100%   | **4.02**   | **3.87** | **3.55** | **3.42** |

\*Weighted total treats Licensing/Vendor-Lock-in/Estimated-Cost as "lower is better" and inverts them (6 − score) before weighting, so all twelve dimensions contribute positively to a higher-is-better total.

**Weighting rationale:** Developer Experience and Ecosystem are weighted highest (12% each) because AOS's differentiator is velocity across a Contract-First, codegen-heavy platform (doc 003.5), where language-tooling fit compounds daily. Community Maturity is weighted next (8%) as a proxy for hiring risk and long-term support continuity. Performance, Scalability, Reliability, and Security are weighted evenly at 10% each — all matter, but AOS's actual bottleneck is I/O wait, not raw compute, which is why they are not weighted above DX/Ecosystem. Licensing, Cloud Compatibility, Vendor Lock-in, and Estimated Cost are weighted lowest (3–5% each) because none of the four candidates differentiates meaningfully on these axes — all are permissively licensed, cloud-portable, and lock-in-free.

TypeScript's highest weighted total confirms its role as the primary language; it does not by itself argue against the scoped Go/Python carve-outs, which exist for reasons (raw concurrency/latency, AI ecosystem dominance) this single-language-per-row matrix cannot fully capture.
