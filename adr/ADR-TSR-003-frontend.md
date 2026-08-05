# ADR-TSR-003 — Frontend

**Status:** Accepted

**Context:** The Dealer Admin Dashboard and Sales Console require a frontend framework with server-side rendering for dashboard performance at scale, a strong component ecosystem (Architecture §38's `ui-components` package), a large hiring pool, and good support for real-time data (Hot Lead notifications, live campaign metrics). Candidates evaluated: Next.js, React (bare), Vue, SvelteKit — full evaluation in [`tech-stack/frontend.md`](../tech-stack/frontend.md) and [`decision-matrix/frontend.md`](../decision-matrix/frontend.md).

**Decision:** Next.js is the frontend framework for the Dealer Admin Dashboard and Sales Console, self-hosted as a standard containerized Node.js service under Kubernetes rather than depending on Vercel-specific managed hosting.

**Consequences:** The team adopts Next.js's file-based routing and server/client component conventions, a learning curve versus bare React but a consistent, enforced structure across a growing set of feature surfaces. The platform gains built-in SSR/ISR/edge-caching for the read-heavy dashboard/reporting use case without custom infrastructure, and shares TypeScript and tooling (Vitest, ESLint) with the rest of the stack. The team forgoes SvelteKit's raw client-side performance/bundle-size advantage in exchange for React's larger ecosystem and hiring pool.

**Alternatives Considered:**

- **React (bare, hand-assembled toolchain)** — rejected: no built-in SSR/routing answer; requires custom-building what Next.js already provides as a maintained framework, with maintainability drifting per-team absent enforced structure.
- **Vue (with Nuxt)** — rejected: technically credible and mature, but a smaller ecosystem and hiring pool than React/Next.js for an enterprise SaaS dashboard with many future feature surfaces; also introduces a second component-templating paradigm alongside JSX used elsewhere.
- **SvelteKit** — rejected as primary: strongest raw performance/bundle-size characteristics of the four, but ecosystem depth and hiring pool are meaningfully smaller than Next.js's, a decisive factor for a dashboard expected to grow many feature surfaces over time. Retained as a Future Consideration for any specific surface with a proven, measured client-rendering performance problem.
