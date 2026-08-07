import { GraphNotFoundException } from "../errors/graph-not-found-exception.js";
import type { GraphEngine } from "../graph/graph-engine.js";

import { RegistryBucket } from "./registry-bucket.js";

/** Id-keyed store of every live `GraphEngine` known to the system. */
export class GraphRegistry {
  private readonly bucket = new RegistryBucket<GraphEngine>(
    "graph",
    (id) => new GraphNotFoundException(id),
  );

  register(engine: GraphEngine): GraphEngine {
    return this.bucket.register(engine.graph.id, engine);
  }

  get(graphId: string): GraphEngine {
    return this.bucket.get(graphId);
  }

  tryGet(graphId: string): GraphEngine | undefined {
    return this.bucket.tryGet(graphId);
  }

  has(graphId: string): boolean {
    return this.bucket.has(graphId);
  }

  remove(graphId: string): boolean {
    return this.bucket.remove(graphId);
  }

  list(): GraphEngine[] {
    return this.bucket.list();
  }

  get size(): number {
    return this.bucket.size;
  }

  clear(): void {
    this.bucket.clear();
  }
}
