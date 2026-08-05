import { KnowledgeRuntimeState } from "../domain/knowledge-runtime-state.js";

import type {
  IKnowledgeRuntimeValidatorStage,
  KnowledgeRuntimeValidationInput,
  KnowledgeRuntimeValidationResult,
} from "./i-knowledge-runtime-validator.js";

/** Flags an Instance whose `state` is not one of the 13 declared `KnowledgeRuntimeState` values. */
export class RuntimeStateValidator implements IKnowledgeRuntimeValidatorStage {
  readonly name = "runtimeState";

  validate(input: KnowledgeRuntimeValidationInput): KnowledgeRuntimeValidationResult {
    const state = input.execution.instance.state;
    const valid = Object.values(KnowledgeRuntimeState).includes(state);
    return valid
      ? { valid: true, issues: [] }
      : {
          valid: false,
          issues: [
            { path: "instance.state", message: `Unknown Knowledge Runtime State "${state}"` },
          ],
        };
  }
}
