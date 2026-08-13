import { setupServer } from "msw/node";

/** Shared MSW node server for integration tests that mock the real Meta Conversions API over HTTP (via `MetaCapiClient`'s native `fetch`), per the package's "no real Meta CAPI calls in tests" rule — the mock lives entirely in `tests/`. */
export const mswServer = setupServer();
