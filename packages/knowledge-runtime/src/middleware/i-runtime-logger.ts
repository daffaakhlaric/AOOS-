/**
 * A minimal structured-logging contract owned by this package — `@aos/logger` is not in
 * this package's allowed Dependency Rules, so `LoggingMiddleware` depends on this instead
 * of pulling in an external logging library. A caller may inject any adapter (including
 * one wrapping `@aos/logger`) without this package changing.
 */
export interface IKnowledgeRuntimeLogger {
  info(fields: Readonly<Record<string, unknown>>, message: string): void;
  error(fields: Readonly<Record<string, unknown>>, message: string): void;
}

/** The zero-dependency default — structured `console.log`/`console.error` output. */
export class ConsoleKnowledgeRuntimeLogger implements IKnowledgeRuntimeLogger {
  info(fields: Readonly<Record<string, unknown>>, message: string): void {
    console.log(JSON.stringify({ level: "info", message, ...fields }));
  }

  error(fields: Readonly<Record<string, unknown>>, message: string): void {
    console.error(JSON.stringify({ level: "error", message, ...fields }));
  }
}
