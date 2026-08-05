import { vi } from "vitest";

/** A minimal, spy-based stand-in for @aos/logger's Logger, for use in other packages' unit tests. */
export interface MockLogger {
  readonly trace: ReturnType<typeof vi.fn>;
  readonly debug: ReturnType<typeof vi.fn>;
  readonly info: ReturnType<typeof vi.fn>;
  readonly warn: ReturnType<typeof vi.fn>;
  readonly error: ReturnType<typeof vi.fn>;
  readonly fatal: ReturnType<typeof vi.fn>;
  readonly child: ReturnType<typeof vi.fn>;
}

export function createMockLogger(): MockLogger {
  const logger: MockLogger = {
    trace: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
    child: vi.fn(),
  };
  // child() returns a logger with the same shape, so chained .child().info() calls in code under test don't throw.
  logger.child.mockReturnValue(logger);
  return logger;
}
