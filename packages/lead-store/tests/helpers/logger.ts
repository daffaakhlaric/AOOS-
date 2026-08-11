import type { Logger } from "@aos/logger";
import { vi } from "vitest";

/** A minimal spy-based fake `Logger` — records nothing meaningful, just avoids wiring a real pino instance in every test. */
export function createFakeLogger(): Logger {
  return {
    trace: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
    child: vi.fn(() => createFakeLogger()),
  } as unknown as Logger;
}
