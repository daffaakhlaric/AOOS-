# ADR-TSR-024 — Testing: Vitest + Playwright

**Status:** Accepted

**Context:** Constitution §19 (Testing Standards) requires unit, integration, contract, and end-to-end test coverage across the TypeScript-first codebase established in ADR-TSR-001/002/003. The chosen tooling must support native TypeScript/ESM without a heavy transpilation step, run fast enough to be practical in the tight CI feedback loop implied by Constitution RULE-091 (automated deployment gating on test success), and cover both unit/integration-level testing and full end-to-end browser testing of the Next.js Dashboard (ADR-TSR-003). Candidates evaluated: Vitest, Jest, Playwright, Cypress.

**Decision:** Adopt **Vitest** for unit and integration tests, and **Playwright** for end-to-end tests. Vitest's native ESM/TypeScript support and Vite-aligned execution model give materially faster test-run times than Jest in a TypeScript-first monorepo, directly serving CI feedback-loop speed. Playwright's multi-browser support (including WebKit, which Cypress lacks equivalent first-class support for), faster parallel execution, and more CI-native tooling make it the stronger choice for testing the Dashboard/Sales Console across the range of browsers dealer staff and customers actually use. **Jest** remains an explicitly acceptable fallback wherever a specific dependency requires Jest-specific mocking support — this is a pragmatic exception, not a contradiction of the primary decision. **Cypress** is not adopted as primary but existing team Cypress expertise is not treated as a blocker to contribution.

**Consequences:** The team standardizes on two primary test runners (Vitest for unit/integration, Playwright for E2E) rather than one framework covering both layers, which is normal industry practice, not added complexity, and each is independently well-suited to its layer. CI pipelines (ADR-TSR-018, GitHub Actions) are configured with Vitest and Playwright as first-class steps; any Jest usage is an intentionally scoped exception recorded per Constitution's Testing Standards documentation requirement, not an ambient allowance.

**Alternatives Considered:**

- **Jest (as sole/primary unit test runner)** — not rejected outright, retained as an explicit fallback; demoted from primary due to Vitest's faster execution and more native TypeScript/ESM ergonomics for this codebase.
- **Cypress (as primary E2E runner)** — rejected as primary given Playwright's current multi-browser and CI-parallelization advantages; not disqualified for contributors who bring existing Cypress expertise to a specific test suite.
