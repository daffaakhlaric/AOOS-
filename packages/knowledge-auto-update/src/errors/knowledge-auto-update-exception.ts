/** Options accepted by every `@aos/knowledge-auto-update` exception constructor. */
export interface KnowledgeAutoUpdateExceptionOptions {
  readonly code?: string;
  readonly cause?: unknown;
  readonly context?: Readonly<Record<string, unknown>>;
}

/**
 * Base exception for `@aos/knowledge-auto-update`.
 *
 * This package is standalone (see README "Architecture") and imports zero `@aos/*` packages at
 * runtime, so it defines its own exception base here rather than extending `@aos/errors`'
 * `AosError`. The shape mirrors `AosError` in spirit — a stable `code`, a human `message`, an
 * optional `cause`, and a free-form `context` bag — but is self-contained.
 */
export class KnowledgeAutoUpdateException extends Error {
  public readonly code: string;
  public readonly context?: Readonly<Record<string, unknown>>;
  public override readonly cause?: unknown;

  constructor(message: string, options: KnowledgeAutoUpdateExceptionOptions = {}) {
    super(message);
    this.name = new.target.name;
    this.code = options.code ?? "KNOWLEDGE_AUTO_UPDATE_ERROR";
    this.context = options.context;
    this.cause = options.cause;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
