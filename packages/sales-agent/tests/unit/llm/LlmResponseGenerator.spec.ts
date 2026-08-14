import { BranchId } from "@aos/branch-manager";
import { err, ErrorCode, ok, type Result } from "@aos/common";
import { describe, expect, it, vi } from "vitest";

import type { ResponseContext } from "../../../src/contracts/IResponseGenerator.js";
import { ResponseGenerator } from "../../../src/conversation/ResponseGenerator.js";
import { LeadConversation } from "../../../src/domain/entities/LeadConversation.js";
import { LlmError } from "../../../src/domain/errors/LlmError.js";
import { ConversationStage } from "../../../src/domain/value-objects/ConversationStage.js";
import { LlmResponseGenerator } from "../../../src/llm/LlmResponseGenerator.js";
import type { ChatCompletionRequest, ILlmChatClient } from "../../../src/llm/OpenAiChatClient.js";
import { MAX_MESSAGE_LENGTH } from "../../../src/responses/formatters.js";
import { GREETING_POOL } from "../../../src/responses/GreetingResponses.js";

const NOW = new Date("2026-08-10T09:00:00.000Z");

function context(): ResponseContext {
  return {
    conversation: LeadConversation.start("+6281200000001", BranchId.CINERE, NOW),
    stage: ConversationStage.GREETING,
    intents: [],
    messageText: "halo",
    matchedUnits: [],
    branchName: "Mobix Cinere",
  };
}

function fakeClient(result: Result<string, LlmError>): ILlmChatClient {
  return { complete: vi.fn(() => Promise.resolve(result)) };
}

describe("LlmResponseGenerator", () => {
  it("success → returns the LLM's text unchanged when within MAX_MESSAGE_LENGTH", async () => {
    const client = fakeClient(ok("Halo kak! Ada yang bisa Jessy bantu? 😊"));
    const generator = new LlmResponseGenerator({ client, fallback: new ResponseGenerator() });
    const text = await generator.generate(context());
    expect(text).toBe("Halo kak! Ada yang bisa Jessy bantu? 😊");
  });

  it("success but over MAX_MESSAGE_LENGTH → truncated to the shared limit", async () => {
    const long = `${"a".repeat(140)}. ${"b".repeat(50)}.`;
    const client = fakeClient(ok(long));
    const generator = new LlmResponseGenerator({ client, fallback: new ResponseGenerator() });
    const text = await generator.generate(context());
    expect(text.length).toBeLessThanOrEqual(MAX_MESSAGE_LENGTH);
    expect(text).toBe(`${"a".repeat(140)}.`);
  });

  it("client returns an error Result → falls back to the real ResponseGenerator", async () => {
    const client = fakeClient(err(new LlmError(ErrorCode.UNAVAILABLE, "OpenAI down")));
    const generator = new LlmResponseGenerator({ client, fallback: new ResponseGenerator() });
    const text = await generator.generate(context());
    expect(GREETING_POOL).toContain(text);
  });

  it("client resolves an empty/whitespace-only completion → falls back", async () => {
    const client = fakeClient(ok("   "));
    const generator = new LlmResponseGenerator({ client, fallback: new ResponseGenerator() });
    const text = await generator.generate(context());
    expect(GREETING_POOL).toContain(text);
  });

  it("client's complete() throws synchronously/rejects unexpectedly → falls back, never throws", async () => {
    const client: ILlmChatClient = {
      complete: () => Promise.reject(new Error("boom")),
    };
    const generator = new LlmResponseGenerator({ client, fallback: new ResponseGenerator() });
    const text = await generator.generate(context());
    expect(GREETING_POOL).toContain(text);
  });

  it("client's complete() rejects with a non-Error value → still falls back, never throws", async () => {
    const client: ILlmChatClient = {
      // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- exercising the non-Error branch on purpose
      complete: () => Promise.reject("a plain string rejection"),
    };
    const generator = new LlmResponseGenerator({ client, fallback: new ResponseGenerator() });
    const text = await generator.generate(context());
    expect(GREETING_POOL).toContain(text);
  });

  it("logs a warning with the failure reason whenever it falls back", async () => {
    const warn = vi.fn();
    const client = fakeClient(err(new LlmError(ErrorCode.TIMEOUT, "request timed out")));
    const generator = new LlmResponseGenerator({
      client,
      fallback: new ResponseGenerator(),
      logger: { warn },
    });
    await generator.generate(context());
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toEqual({ reason: "request timed out" });
  });

  it("never logs when the LLM call succeeds", async () => {
    const warn = vi.fn();
    const client = fakeClient(ok("Halo kak!"));
    const generator = new LlmResponseGenerator({
      client,
      fallback: new ResponseGenerator(),
      logger: { warn },
    });
    await generator.generate(context());
    expect(warn).not.toHaveBeenCalled();
  });

  it("passes the built conversation messages to the client", async () => {
    let received: ChatCompletionRequest | undefined;
    const client: ILlmChatClient = {
      complete: (request) => {
        received = request;
        return Promise.resolve(ok("Halo kak!"));
      },
    };
    const generator = new LlmResponseGenerator({ client, fallback: new ResponseGenerator() });
    await generator.generate(context());
    expect(received?.messages[0]?.role).toBe("system");
  });
});
