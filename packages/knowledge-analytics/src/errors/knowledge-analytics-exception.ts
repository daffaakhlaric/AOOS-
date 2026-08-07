/** Options accepted by every `@aos/knowledge-analytics` exception constructor. */
export interface KnowledgeAnalyticsExceptionOptions {
  readonly code?: string;
  readonly cause?: unknown;
  readonly context?: Readonly<Record<string, unknown>>;
}

/**
 * Base exception for `@aos/knowledge-analytics`.
 *
 * This package is standalone (see README "Architecture") and imports zero `@aos/*` packages at
 * runtime, so it defines its own exception base here rather than extending `@aos/errors`'
 * `AosError`. The shape mirrors `AosError` in spirit — a stable `code`, a human `message`, an
 * optional `cause`, and a free-form `context` bag — but is self-contained.
 */
export class KnowledgeAnalyticsException extends Error {
  public readonly code: string;
  public readonly context?: Readonly<Record<string, unknown>>;
  public override readonly cause?: unknown;

  constructor(message: string, options: KnowledgeAnalyticsExceptionOptions = {}) {
    super(message);
    this.name = new.target.name;
    this.code = options.code ?? "KNOWLEDGE_ANALYTICS_ERROR";
    this.context = options.context;
    this.cause = options.cause;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
