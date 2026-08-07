/** Options accepted by every `@aos/knowledge-intelligence` exception constructor. */
export interface KnowledgeIntelligenceExceptionOptions {
  readonly code?: string;
  readonly cause?: unknown;
  readonly context?: Readonly<Record<string, unknown>>;
}

/**
 * Base exception for `@aos/knowledge-intelligence`.
 *
 * This package is standalone (see README "Architecture") and imports zero `@aos/*` packages at
 * runtime, so it defines its own exception base here rather than extending `@aos/errors`'
 * `AosError`. The shape mirrors `AosError` in spirit — a stable `code`, a human `message`, an
 * optional `cause`, and a free-form `context` bag — but is self-contained.
 */
export class KnowledgeIntelligenceException extends Error {
  public readonly code: string;
  public readonly context?: Readonly<Record<string, unknown>>;
  public override readonly cause?: unknown;

  constructor(message: string, options: KnowledgeIntelligenceExceptionOptions = {}) {
    super(message);
    this.name = new.target.name;
    this.code = options.code ?? "KNOWLEDGE_INTELLIGENCE_ERROR";
    this.context = options.context;
    this.cause = options.cause;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
