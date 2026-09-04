import { BranchId } from "@aos/branch-manager";
import { err, ErrorCode, ok, type Result } from "@aos/common";
import { describe, expect, it, vi } from "vitest";

import type { PropertyResponseContext } from "../../../src/contracts/IPropertyResponseGenerator.js";
import { PropertyResponseGenerator } from "../../../src/conversation/PropertyResponseGenerator.js";
import { LeadConversation } from "../../../src/domain/entities/LeadConversation.js";
import { LlmError } from "../../../src/domain/errors/LlmError.js";
import { ConversationStage } from "../../../src/domain/value-objects/ConversationStage.js";
import { LlmPropertyResponseGenerator } from "../../../src/llm/LlmPropertyResponseGenerator.js";
import type { ChatCompletionRequest, ILlmChatClient } from "../../../src/llm/OpenAiChatClient.js";

const NOW = new Date("2026-08-20T09:00:00.000Z");

function context(): PropertyResponseContext {
  return {
    conversation: LeadConversation.start("+6281200000001", BranchId.BINTARO, NOW),
    stage: ConversationStage.GREETING,
    intents: [],
    messageText: "halo min",
    matchedListings: [],
  };
}

function fakeClient(result: Result<string, LlmError>): ILlmChatClient {
  return { complete: vi.fn(() => Promise.resolve(result)) };
}

describe("LlmPropertyResponseGenerator", () => {
  it("success → returns the LLM's text unchanged when within HARD_LENGTH_CEILING", async () => {
    const client = fakeClient(ok("Hai kak! Lagi cari rumah, apartemen, atau ruko nih? 😊"));
    const generator = new LlmPropertyResponseGenerator({
      client,
      fallback: new PropertyResponseGenerator(),
    });
    const text = await generator.generate(context());
    expect(text).toBe("Hai kak! Lagi cari rumah, apartemen, atau ruko nih? 😊");
  });

  it("success but over HARD_LENGTH_CEILING (200) → trimmed to SOFT_LENGTH_TARGET (150) at a sentence boundary", async () => {
    const long = `${"a".repeat(80)}. ${"b".repeat(150)}.`;
    const client = fakeClient(ok(long));
    const generator = new LlmPropertyResponseGenerator({
      client,
      fallback: new PropertyResponseGenerator(),
    });
    const text = await generator.generate(context());
    expect(text.length).toBeLessThanOrEqual(200);
    expect(text).toBe(`${"a".repeat(80)}.`);
  });

  it("success but over HARD_LENGTH_CEILING with no sentence boundary early enough → hard character cut at SOFT_LENGTH_TARGET", async () => {
    const long = "a".repeat(300);
    const client = fakeClient(ok(long));
    const generator = new LlmPropertyResponseGenerator({
      client,
      fallback: new PropertyResponseGenerator(),
    });
    const text = await generator.generate(context());
    expect(text.length).toBe(150);
  });

  it("client returns an error Result → falls back to the real PropertyResponseGenerator", async () => {
    const client = fakeClient(err(new LlmError(ErrorCode.UNAVAILABLE, "OpenAI down")));
    const generator = new LlmPropertyResponseGenerator({
      client,
      fallback: new PropertyResponseGenerator(),
    });
    const text = await generator.generate(context());
    const expected = await new PropertyResponseGenerator().generate(context());
    expect(text).toBe(expected);
  });

  it("client resolves an empty/whitespace-only completion → falls back", async () => {
    const client = fakeClient(ok("   "));
    const generator = new LlmPropertyResponseGenerator({
      client,
      fallback: new PropertyResponseGenerator(),
    });
    const text = await generator.generate(context());
    const expected = await new PropertyResponseGenerator().generate(context());
    expect(text).toBe(expected);
  });

  it("client's complete() throws/rejects unexpectedly → falls back, never throws", async () => {
    const client: ILlmChatClient = { complete: () => Promise.reject(new Error("boom")) };
    const generator = new LlmPropertyResponseGenerator({
      client,
      fallback: new PropertyResponseGenerator(),
    });
    const text = await generator.generate(context());
    const expected = await new PropertyResponseGenerator().generate(context());
    expect(text).toBe(expected);
  });

  it("logs a warning with the failure reason whenever it falls back", async () => {
    const warn = vi.fn();
    const client = fakeClient(err(new LlmError(ErrorCode.TIMEOUT, "request timed out")));
    const generator = new LlmPropertyResponseGenerator({
      client,
      fallback: new PropertyResponseGenerator(),
      logger: { warn },
    });
    await generator.generate(context());
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toEqual({ reason: "request timed out" });
  });

  it("never logs when the LLM call succeeds", async () => {
    const warn = vi.fn();
    const client = fakeClient(ok("Hai kak!"));
    const generator = new LlmPropertyResponseGenerator({
      client,
      fallback: new PropertyResponseGenerator(),
      logger: { warn },
    });
    await generator.generate(context());
    expect(warn).not.toHaveBeenCalled();
  });

  it("passes the built PROPERTY conversation messages to the client (system prompt first)", async () => {
    let received: ChatCompletionRequest | undefined;
    const client: ILlmChatClient = {
      complete: (request) => {
        received = request;
        return Promise.resolve(ok("Hai kak!"));
      },
    };
    const generator = new LlmPropertyResponseGenerator({
      client,
      fallback: new PropertyResponseGenerator(),
    });
    await generator.generate(context());
    expect(received?.messages[0]?.role).toBe("system");
    expect(received?.messages[0]?.content).toContain("sales AI properti");
  });

  it("threads a configured promptOverride into buildPropertyConversationMessages, for every generate() call", async () => {
    const override = "Kamu Clara properti versi override. Stage: {stage}. {stage_instruction}";
    let received: ChatCompletionRequest | undefined;
    const client: ILlmChatClient = {
      complete: (request) => {
        received = request;
        return Promise.resolve(ok("Hai kak!"));
      },
    };
    const generator = new LlmPropertyResponseGenerator({
      client,
      fallback: new PropertyResponseGenerator(),
      promptOverride: override,
    });
    await generator.generate(context());
    expect(received?.messages[0]?.content).toContain("Kamu Clara properti versi override.");
    expect(received?.messages[0]?.content).not.toContain("sales AI properti");
  });

  it("promptOverride omitted → uses the unmodified default PROPERTY system prompt template", async () => {
    let received: ChatCompletionRequest | undefined;
    const client: ILlmChatClient = {
      complete: (request) => {
        received = request;
        return Promise.resolve(ok("Hai kak!"));
      },
    };
    const generator = new LlmPropertyResponseGenerator({
      client,
      fallback: new PropertyResponseGenerator(),
    });
    await generator.generate(context());
    expect(received?.messages[0]?.content).toContain("sales AI properti");
  });
});
