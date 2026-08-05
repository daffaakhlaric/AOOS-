import type { CompensationConfig } from "../contracts/compensation-config.js";
import type { NodeType } from "../contracts/node-type.js";
import type { RetryConfig } from "../contracts/retry-config.js";
import type { TimeoutConfig } from "../contracts/timeout-config.js";
import { BuilderException } from "../errors/builder-exception.js";
import { nodeSchema, type Node } from "../nodes/node.js";
import type { VariableDeclaration } from "../variables/variable-declaration.js";

/**
 * NodeBuilder — fluent construction of a single `Node`. Every Node Type shares the same
 * base fields (`withName`/`withDescription`/`withInput`/`withOutput`/`withVariables`/
 * `withRetry`/`withTimeout`/`withCompensation`/`withMetadata`); a type's own extra fields
 * (e.g. `CapabilityNode.capability`, `LoopNode.bodyNodeId`) are set via the generic
 * `.set()` escape hatch, since a fully-typed builder per one of the 13 Node Types would be
 *13 near-identical classes for little benefit over `nodeSchema.safeParse()` at `.build()`
 * catching any mistake either way.
 */
export class NodeBuilder {
  private fields: Record<string, unknown>;

  private constructor(id: string, type: NodeType) {
    this.fields = { id, type };
  }

  static create(id: string, type: NodeType): NodeBuilder {
    return new NodeBuilder(id, type);
  }

  withName(name: string): this {
    this.fields = { ...this.fields, name };
    return this;
  }

  withDescription(description: string): this {
    this.fields = { ...this.fields, description };
    return this;
  }

  withInput(input: Readonly<Record<string, string>>): this {
    this.fields = { ...this.fields, input };
    return this;
  }

  withOutput(output: Readonly<Record<string, string>>): this {
    this.fields = { ...this.fields, output };
    return this;
  }

  withVariables(variables: readonly VariableDeclaration[]): this {
    this.fields = { ...this.fields, variables };
    return this;
  }

  withRetry(retry: RetryConfig): this {
    this.fields = { ...this.fields, retry };
    return this;
  }

  withTimeout(timeout: TimeoutConfig): this {
    this.fields = { ...this.fields, timeout };
    return this;
  }

  withCompensation(compensation: CompensationConfig): this {
    this.fields = { ...this.fields, compensation };
    return this;
  }

  withMetadata(metadata: Readonly<Record<string, unknown>>): this {
    this.fields = { ...this.fields, metadata };
    return this;
  }

  /** Escape hatch for Node-Type-specific fields (e.g. `capability`, `bodyNodeId`, `branches`). */
  set(field: string, value: unknown): this {
    this.fields = { ...this.fields, [field]: value };
    return this;
  }

  build(): Node {
    const result = nodeSchema.safeParse(this.fields);
    if (!result.success) {
      throw new BuilderException(
        `Failed to build Node "${String(this.fields["id"])}": ${result.error.issues
          .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
          .join("; ")}`,
      );
    }
    return result.data;
  }
}
