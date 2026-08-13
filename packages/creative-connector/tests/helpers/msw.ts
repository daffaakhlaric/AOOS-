import { setupServer } from "msw/node";

/** Shared MSW node server for integration/infra tests that mock both real Kie AI hosts (`api.kie.ai` and `kieai.redpandaai.co`) over HTTP via native `fetch` — per the package's "no mocks in production code, zero real network calls in tests" rule. */
export const mswServer = setupServer();
