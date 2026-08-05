import { describe, expect, it, vi } from "vitest";

import { ConsoleKnowledgeRuntimeLogger } from "../../src/middleware/i-runtime-logger.js";

describe("Middleware Test — ConsoleKnowledgeRuntimeLogger", () => {
  it("info() writes structured JSON via console.log", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    new ConsoleKnowledgeRuntimeLogger().info({ a: 1 }, "hello");
    expect(spy).toHaveBeenCalledWith(JSON.stringify({ level: "info", message: "hello", a: 1 }));
    spy.mockRestore();
  });

  it("error() writes structured JSON via console.error", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    new ConsoleKnowledgeRuntimeLogger().error({ a: 1 }, "oops");
    expect(spy).toHaveBeenCalledWith(JSON.stringify({ level: "error", message: "oops", a: 1 }));
    spy.mockRestore();
  });
});
