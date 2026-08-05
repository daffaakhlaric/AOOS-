import { ParseException } from "../errors/parse-exception.js";
import { workflowDefinitionSchema } from "../schemas/workflow-definition.js";
import type { WorkflowDefinition } from "../schemas/workflow-definition.js";

import type { IWorkflowDefinitionParser } from "./i-parser.js";

/** Parses a JSON-serialized Workflow Definition, validating it against `workflowDefinitionSchema`. */
export class JsonWorkflowDefinitionParser implements IWorkflowDefinitionParser {
  readonly format = "json";

  parse(source: string): WorkflowDefinition {
    let raw: unknown;
    try {
      raw = JSON.parse(source);
    } catch (error) {
      throw new ParseException(`Failed to parse JSON Workflow Definition: ${String(error)}`, {
        cause: error,
      });
    }
    return this.validate(raw);
  }

  private validate(raw: unknown): WorkflowDefinition {
    const result = workflowDefinitionSchema.safeParse(raw);
    if (!result.success) {
      const reason = result.error.issues
        .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
        .join("; ");
      throw new ParseException(`Workflow Definition failed schema validation: ${reason}`);
    }
    return result.data;
  }
}
