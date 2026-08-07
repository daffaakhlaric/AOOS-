/**
 * A minimal, locally-defined structural equivalent of `@aos/runtime-kernel`'s `IModule` contract.
 * This package cannot import `@aos/runtime-kernel` (standalone constraint), so
 * `KnowledgeGraphSystem` implements this shape directly — any host that duck-types against
 * `IModule` (id + start + stop) can integrate it without a compile-time dependency.
 */
export interface IKnowledgeGraphModule {
  readonly id: string;
  start(): void | Promise<void>;
  stop(): void | Promise<void>;
}
