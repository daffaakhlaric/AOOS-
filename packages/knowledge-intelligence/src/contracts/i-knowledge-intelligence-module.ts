/**
 * A minimal, locally-defined structural equivalent of `@aos/runtime-kernel`'s `IModule` contract.
 * This package cannot import `@aos/runtime-kernel` (standalone constraint), so any host that
 * duck-types against `IModule` (id + start + stop) can integrate `KnowledgeIntelligenceEngine`
 * without a compile-time dependency on this package's internals.
 */
export interface IKnowledgeIntelligenceModule {
  readonly id: string;
  start(): void | Promise<void>;
  stop(): void | Promise<void>;
}
