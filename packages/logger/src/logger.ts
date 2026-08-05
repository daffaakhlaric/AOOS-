import type { Writable } from "node:stream";

import pino from "pino";

import { getLogContext } from "./context.js";

export type Logger = pino.Logger;
type LoggerOptions = pino.LoggerOptions;

export interface CreateLoggerOptions {
  readonly serviceName: string;
  readonly level?: string;
  /** "json" for production (machine-parseable, Constitution §17), "pretty" for local development. */
  readonly format?: "json" | "pretty";
  /** Optional file destination — when set, logs are written there in addition to stdout format rules. */
  readonly destination?: string;
  /** Optional writable stream target, primarily for testing/log-aggregation composition. */
  readonly stream?: Writable;
}

/**
 * Creates a Pino logger that automatically enriches every log line with the current
 * request/correlation/trace/tenant IDs from @aos/logger's AsyncLocalStorage context
 * (Constitution §17 Logging Standards: every log line carries trace_id and tenant_id).
 */
export function createLogger(options: CreateLoggerOptions): Logger {
  const { serviceName, level = "info", format = "json", destination, stream } = options;

  const baseOptions: LoggerOptions = {
    level,
    base: { service: serviceName },
    mixin: () => {
      const context = getLogContext();
      return {
        requestId: context.requestId,
        correlationId: context.correlationId,
        traceId: context.traceId,
        tenantId: context.tenantId,
      };
    },
    formatters: {
      level: (label) => ({ level: label }),
    },
    timestamp: pino.stdTimeFunctions.isoTime,
  };

  if (stream) {
    return pino(baseOptions, stream);
  }

  if (destination) {
    return pino(baseOptions, pino.destination(destination));
  }

  if (format === "pretty") {
    return pino({
      ...baseOptions,
      transport: {
        target: "pino-pretty",
        options: { colorize: true, translateTime: "SYS:standard" },
      },
    });
  }

  return pino(baseOptions);
}
