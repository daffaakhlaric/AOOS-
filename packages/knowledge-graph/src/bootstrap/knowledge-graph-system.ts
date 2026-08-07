import {
  KnowledgeGraph,
  type KnowledgeGraphFacadeOptions,
} from "../application/knowledge-graph-facade.js";
import type { IKnowledgeGraphModule } from "../contracts/i-knowledge-graph-module.js";

/**
 * Composition root wrapping the `KnowledgeGraph` facade as an `IKnowledgeGraphModule` — a
 * locally-defined structural equivalent of `@aos/runtime-kernel`'s `IModule` (id + start + stop),
 * since this package cannot import `@aos/runtime-kernel` (standalone constraint). Any host that
 * duck-types against `IModule` can integrate `KnowledgeGraphSystem` without a compile-time
 * dependency on this package's contracts.
 */
export class KnowledgeGraphSystem implements IKnowledgeGraphModule {
  readonly id = "knowledge-graph";
  readonly facade: KnowledgeGraph;
  private started = false;

  constructor(options: KnowledgeGraphFacadeOptions = {}) {
    this.facade = new KnowledgeGraph(options);
  }

  start(): void {
    this.started = true;
  }

  stop(): void {
    this.started = false;
  }

  isStarted(): boolean {
    return this.started;
  }
}

/** Convenience factory mirroring sibling packages' `create*System` bootstrap entry points. */
export function createKnowledgeGraphSystem(
  options: KnowledgeGraphFacadeOptions = {},
): KnowledgeGraphSystem {
  return new KnowledgeGraphSystem(options);
}
