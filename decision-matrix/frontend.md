# Decision Matrix — Frontend

Governs: [`docs/004-TECHNOLOGY-SELECTION-RECORD.md`](../docs/004-TECHNOLOGY-SELECTION-RECORD.md) §3.3
Full rationale: [`tech-stack/frontend.md`](../tech-stack/frontend.md)

**How to read this matrix:** each dimension is scored 1–5, higher is better except **Estimated Cost** and **Vendor Lock-in Risk**, where lower is better. Next.js scores 2 (not 1) on Vendor Lock-in Risk specifically because its most advanced hosting-optimized features are most seamless on Vercel, though the framework itself is open-source and portable — this is a soft, not hard, lock-in.

| Dimension            | Weight | Next.js  | React (bare) | Vue      | SvelteKit |
| -------------------- | ------ | -------- | ------------ | -------- | --------- |
| Performance          | 8%     | 4        | 3            | 4        | 5         |
| Scalability          | 10%    | 5        | 3            | 4        | 4         |
| Reliability          | 10%    | 5        | 3            | 4        | 4         |
| Security             | 8%     | 4        | 3            | 4        | 4         |
| Maintainability      | 12%    | 4        | 2            | 4        | 4         |
| Developer Experience | 12%    | 5        | 3            | 4        | 5         |
| Ecosystem            | 15%    | 5        | 4            | 4        | 3         |
| Community Maturity   | 12%    | 5        | 5            | 4        | 3         |
| Licensing            | 3%     | 1        | 1            | 1        | 1         |
| Cloud Compatibility  | 5%     | 5        | 4            | 4        | 4         |
| Vendor Lock-in Risk  | 3%     | 2        | 1            | 1        | 1         |
| Estimated Cost       | 2%     | 2        | 3            | 2        | 2         |
| **Weighted Total***  | 100%   | **4.42** | **3.32**     | **3.83** | **3.71**  |

\*Weighted total inverts Licensing/Vendor-Lock-in/Estimated-Cost (6 − score) before weighting so every dimension contributes positively to a higher-is-better total.

**Weighting rationale:** Ecosystem is weighted highest (15%) because Architecture §38's `ui-components` package and the growing set of future feature surfaces (Sales Console, multi-branch reporting, Agent/Workflow admin UI) make component-library depth a compounding, multi-year advantage. Developer Experience, Community Maturity, and Maintainability follow at 12% each, reflecting the hiring-pool and long-term-team-scaling concerns that decided this category in the master doc. Performance and Security are weighted lower (8% each) because AOS's dashboard workload is data-heavy and I/O-bound (server round-trips dominate), not raw client-rendering-bound, echoing the same reasoning applied to backend language choice in §3.1. Licensing, Cloud Compatibility, Vendor Lock-in, and Cost are weighted lowest (2–5% each) since all four candidates are open-source and cloud-portable.

Next.js's highest weighted total, driven by Ecosystem, Community Maturity, and Developer Experience, confirms the master doc's recommendation despite SvelteKit's raw Performance edge.
