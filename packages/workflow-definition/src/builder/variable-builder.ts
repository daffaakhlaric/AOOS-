import type { VariableScope } from "../contracts/variable-scope.js";
import { BuilderException } from "../errors/builder-exception.js";
import {
  variableDeclarationSchema,
  type VariableDeclaration,
} from "../variables/variable-declaration.js";
import type { VariableType } from "../variables/variable-type.js";

/** VariableBuilder — fluent construction of a single `VariableDeclaration`. */
export class VariableBuilder {
  private fields: Partial<VariableDeclaration>;

  private constructor(name: string, type: VariableType, scope: VariableScope) {
    this.fields = { name, type, scope, required: false };
  }

  static create(name: string, type: VariableType, scope: VariableScope): VariableBuilder {
    return new VariableBuilder(name, type, scope);
  }

  required(): this {
    this.fields = { ...this.fields, required: true };
    return this;
  }

  withDefault(value: unknown): this {
    this.fields = { ...this.fields, defaultValue: value };
    return this;
  }

  withDescription(description: string): this {
    this.fields = { ...this.fields, description };
    return this;
  }

  build(): VariableDeclaration {
    const result = variableDeclarationSchema.safeParse(this.fields);
    if (!result.success) {
      throw new BuilderException(
        `Failed to build VariableDeclaration: ${result.error.issues.map((i) => i.message).join("; ")}`,
      );
    }
    return result.data;
  }
}
