import { setupServer } from "msw/node";

/** Shared MSW node server for tests that mock the real Meta Graph API over HTTP (via `MetaGraphApiClient`'s native `fetch`), per the package's "no mocks in production code" rule — the mock lives entirely in `tests/`. */
export const mswServer = setupServer();
