import { setupServer } from "msw/node";

/** Shared MSW node server for integration tests that mock mobixbydss.id over HTTP (via native `fetch`), per the "no mocks in production code" rule — the mock lives entirely in `tests/`. */
export const mswServer = setupServer();
