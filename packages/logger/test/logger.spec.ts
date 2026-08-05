import { Writable } from "node:stream";

import { describe, expect, it } from "vitest";

import { withLogContext } from "../src/context.js";
import { createLogger } from "../src/logger.js";

function collectingStream(lines: string[]): Writable {
  return new Writable({
    write(chunk, _enc, callback) {
      lines.push(chunk.toString());
      callback();
    },
  });
}

describe("createLogger", () => {
  it("emits JSON lines carrying the service name and requested level", () => {
    const lines: string[] = [];
    const logger = createLogger({
      serviceName: "aos-test-service",
      level: "debug",
      stream: collectingStream(lines),
    });

    logger.info("hello world");

    expect(lines).toHaveLength(1);
    const parsed = JSON.parse(lines[0]!);
    expect(parsed.service).toBe("aos-test-service");
    expect(parsed.msg).toBe("hello world");
    expect(parsed.level).toBe("info");
  });

  it("enriches log lines with the active LogContext via mixin", () => {
    const lines: string[] = [];
    const logger = createLogger({ serviceName: "svc", stream: collectingStream(lines) });

    withLogContext({ traceId: "trace-abc", tenantId: "tenant-1" }, () => {
      logger.info("scoped message");
    });

    const parsed = JSON.parse(lines[0]!);
    expect(parsed.traceId).toBe("trace-abc");
    expect(parsed.tenantId).toBe("tenant-1");
  });

  it("respects the configured minimum level", () => {
    const lines: string[] = [];
    const logger = createLogger({
      serviceName: "svc",
      level: "warn",
      stream: collectingStream(lines),
    });

    logger.info("should be suppressed");
    logger.warn("should appear");

    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0]!).msg).toBe("should appear");
  });
});
