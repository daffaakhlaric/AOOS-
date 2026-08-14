import { describe, expect, it } from "vitest";

import { ChatRequestSchema } from "./chat.dto.js";

describe("ChatRequestSchema", () => {
  it("accepts a well-formed chat request with context", () => {
    const result = ChatRequestSchema.safeParse({
      messages: [{ role: "user", content: "Bagaimana performa iklan minggu ini?" }],
      context: "dashboard: Analisa & Rekomendasi",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a request without context (optional)", () => {
    const result = ChatRequestSchema.safeParse({ messages: [{ role: "user", content: "Halo" }] });
    expect(result.success).toBe(true);
  });

  it("rejects an empty messages array", () => {
    const result = ChatRequestSchema.safeParse({ messages: [] });
    expect(result.success).toBe(false);
  });

  it("rejects a message with an invalid role", () => {
    const result = ChatRequestSchema.safeParse({ messages: [{ role: "bot", content: "hi" }] });
    expect(result.success).toBe(false);
  });

  it("rejects a message with empty content", () => {
    const result = ChatRequestSchema.safeParse({ messages: [{ role: "user", content: "" }] });
    expect(result.success).toBe(false);
  });

  it("rejects a missing messages field", () => {
    const result = ChatRequestSchema.safeParse({ context: "x" });
    expect(result.success).toBe(false);
  });
});
