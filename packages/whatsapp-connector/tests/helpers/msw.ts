import { setupServer } from "msw/node";

/** Shared MSW node server for integration tests that mock the real WhatsApp Cloud API over HTTP (via `WhatsAppCloudApiClient`'s native `fetch`), per the package's "no mocks in production code" rule — the mock lives entirely in `tests/`. */
export const mswServer = setupServer();
