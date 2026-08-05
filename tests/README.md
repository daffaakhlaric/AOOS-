# tests/

Repository-level (cross-package) end-to-end test scaffolding. **Empty by design in the Foundation phase** — there is no Dashboard, API, or Runtime yet for a Playwright E2E suite to exercise (per `docs/PROMPT-005.1-CORE-RUNTIME-FOUNDATION.md`'s explicit prohibition on building any of those in this phase).

- `tests/e2e/` — reserved directory Playwright's config (`../playwright.config.ts`) already points at; the first `*.spec.ts` file lands here once Engineering Task 005.2 (or later) produces a real app to test against.

Package-level unit tests live inside each package's own `test/` directory (e.g. `packages/common/test/`), not here — this directory is exclusively for tests that span more than one deployable app/service.
