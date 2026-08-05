import yaml from "js-yaml";

import { ParseException } from "../errors/parse-exception.js";
import { workflowDefinitionSchema } from "../schemas/workflow-definition.js";
import type { WorkflowDefinition } from "../schemas/workflow-definition.js";

import type { IWorkflowDefinitionParser } from "./i-parser.js";

/** Parses a YAML-serialized Workflow Definition — "Human readable" (docs/PROMPT-005.6A-WORKFLOW-DEFINITION-LANGUAGE.md — "DESIGN AOS-WDL"), validated against `workflowDefinitionSchema`. */
export class YamlWorkflowDefinitionParser implements IWorkflowDefinitionParser {
  readonly format = "yaml";

  parse(source: string): WorkflowDefinition {
    let raw: unknown;
    try {
      raw = yaml.load(source);
    } catch (error) {
      throw new ParseException(`Failed to parse YAML Workflow Definition: ${String(error)}`, {
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
