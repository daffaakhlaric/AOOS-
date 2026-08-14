import { setupServer } from "msw/node";

/** Shared MSW node server for `OpenAiChatClient`/`LlmResponseGenerator` tests that mock `api.openai.com` over HTTP via native `fetch` — per the package's "no mocks in production code, zero real network calls in tests" rule. */
export const mswServer = setupServer();
