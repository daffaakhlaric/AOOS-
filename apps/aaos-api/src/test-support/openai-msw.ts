import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

import {
  CHAT_COMPLETIONS_PATH,
  OPENAI_BASE_URL,
} from "../modules/llm/infrastructure/OpenAiClient.js";

/** Shared MSW node server for `llm` module tests — mirrors `meta-api-msw.ts`'s pattern. Mocks live only in test code, never in production source; no test in this app ever makes a real network call to OpenAI. */
export const mswServer = setupServer();

/** Registers a happy-path `POST /v1/chat/completions` handler returning `content` as `choices[0].message.content`. */
export function registerOpenAiChatHandler(content: string): void {
  mswServer.use(
    http.post(`${OPENAI_BASE_URL}${CHAT_COMPLETIONS_PATH}`, () =>
      HttpResponse.json({
        id: "chatcmpl-test",
        object: "chat.completion",
        choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }],
      }),
    ),
  );
}

/** Registers a failing `POST /v1/chat/completions` handler (non-2xx), for `OpenAiClient`/`LlmService` provider-error-path tests. */
export function registerOpenAiErrorHandler(status: number): void {
  mswServer.use(
    http.post(`${OPENAI_BASE_URL}${CHAT_COMPLETIONS_PATH}`, () =>
      HttpResponse.json(
        { error: { message: "OpenAI API error", type: "server_error" } },
        { status },
      ),
    ),
  );
}

/** Registers a `POST /v1/chat/completions` handler returning a 200 with a malformed body (missing `choices`), for `OpenAiClient`'s "missing content" error-path test. */
export function registerOpenAiMalformedHandler(): void {
  mswServer.use(
    http.post(`${OPENAI_BASE_URL}${CHAT_COMPLETIONS_PATH}`, () =>
      HttpResponse.json({ id: "chatcmpl-bad" }),
    ),
  );
}
