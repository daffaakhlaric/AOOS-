import type { ZodTypeAny } from "zod";

import { RegistryException } from "../errors/registry-exception.js";

/**
 * Schema Registry (docs/PROMPT-005.6A-WORKFLOW-DEFINITION-LANGUAGE.md — "REGISTRY") — a
 * named registry of Zod schemas, the extension point a future custom Node Type (Event/AI/
 * Script — "Future" in the Node Types list) or custom Expression Type would register its
 * schema into, without a core package change.
 */
export class SchemaRegistry {
  private readonly schemasByName = new Map<string, ZodTypeAny>();

  register(name: string, schema: ZodTypeAny): void {
    if (this.schemasByName.has(name)) {
      throw new RegistryException(`Cannot register schema "${name}": already registered`);
    }
    this.schemasByName.set(name, schema);
  }

  get(name: string): ZodTypeAny | undefined {
    return this.schemasByName.get(name);
  }

  has(name: string): boolean {
    return this.schemasByName.has(name);
  }

  unregister(name: string): void {
    if (!this.schemasByName.delete(name)) {
      throw new RegistryException(`Cannot unregister schema "${name}": not registered`);
    }
  }

  list(): readonly string[] {
    return Array.from(this.schemasByName.keys());
  }
}
