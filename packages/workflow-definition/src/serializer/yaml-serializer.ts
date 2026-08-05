import yaml from "js-yaml";

import { SerializationException } from "../errors/serialization-exception.js";
import type { WorkflowDefinition } from "../schemas/workflow-definition.js";

import type { IWorkflowDefinitionSerializer } from "./i-serializer.js";

/** Serializes a Workflow Definition to YAML — the exact inverse of `YamlWorkflowDefinitionParser`. */
export class YamlWorkflowDefinitionSerializer implements IWorkflowDefinitionSerializer {
  readonly format = "yaml";

  serialize(workflow: WorkflowDefinition): string {
    try {
      return yaml.dump(workflow, { noRefs: true, sortKeys: false });
    } catch (error) {
      throw new SerializationException(
        `Failed to serialize Workflow Definition to YAML: ${String(error)}`,
        { cause: error },
      );
    }
  }
}
