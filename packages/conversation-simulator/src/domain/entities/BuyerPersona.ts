import { err, ErrorCode, ok, type Result } from "@aos/common";

import type { IBuyerPersona } from "../../contracts/IBuyerPersona.js";
import { SimulatorError } from "../errors/SimulatorError.js";

/** Who the AI buyer is (spec "domain/entities/BuyerPersona.ts"). Public API type alias — see `src/index.ts`. */
export type BuyerPersona = IBuyerPersona;

/**
 * Validates a raw persona definition before it's allowed into `PersonaRegistry` — the one piece
 * of domain logic protecting the 10 literal persona scripts from being silently malformed (empty
 * script, non-positive `maxTurns`, blank name/id).
 */
export function createBuyerPersona(props: IBuyerPersona): Result<BuyerPersona, SimulatorError> {
  if (props.script.length === 0) {
    return err(
      new SimulatorError(
        ErrorCode.VALIDATION_ERROR,
        `Persona "${props.id}" must have a non-empty script`,
      ),
    );
  }
  if (!Number.isInteger(props.maxTurns) || props.maxTurns <= 0) {
    return err(
      new SimulatorError(
        ErrorCode.VALIDATION_ERROR,
        `Persona "${props.id}" maxTurns must be a positive integer, got ${props.maxTurns}`,
      ),
    );
  }
  if (props.name.trim().length === 0) {
    return err(
      new SimulatorError(
        ErrorCode.VALIDATION_ERROR,
        `Persona "${props.id}" must have a non-empty name`,
      ),
    );
  }
  return ok({ ...props });
}
