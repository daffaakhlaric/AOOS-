import { describe, expect, it } from "vitest";

import { createMockLogger } from "../src/mock-logger.js";

describe("createMockLogger", () => {
  it("records calls to each log level method", () => {
    const logger = createMockLogger();
    logger.info("hello");
    logger.error("boom");
    expect(logger.info).toHaveBeenCalledWith("hello");
    expect(logger.error).toHaveBeenCalledWith("boom");
  });

  it("child() returns a logger with the same mockable shape", () => {
    const logger = createMockLogger();
    const child = logger.child({ module: "x" });
    expect(child).toBe(logger);
    child.warn("careful");
    expect(logger.warn).toHaveBeenCalledWith("careful");
  });
});
