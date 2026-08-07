import type { EmbeddingValidatorValidationInput } from "../../src/contracts/i-embedding-validator.js";
import { EmbeddingState } from "../../src/domain/embedding-state.js";

import { executionFixture } from "./execution-fixture.js";

export function validatorInputFixture(
  overrides: Partial<EmbeddingValidatorValidationInput> = {},
): EmbeddingValidatorValidationInput {
  const execution = executionFixture();
  return {
    embedding: execution.instance,
    metadata: execution.metadata,
    request: execution.request,
    context: execution.context,
    currentState: EmbeddingState.DRAFT,
    ...overrides,
  };
}
