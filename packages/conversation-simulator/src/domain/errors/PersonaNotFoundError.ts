import { ErrorCode } from "@aos/common";
import type { AosErrorOptions } from "@aos/errors";

import type { PersonaId } from "../value-objects/PersonaId.js";

import { SimulatorError } from "./SimulatorError.js";

/** Raised when `PersonaRegistry` is asked for a `PersonaId` it doesn't have registered. */
export class PersonaNotFoundError extends SimulatorError {
  constructor(personaId: PersonaId | string, options: AosErrorOptions = {}) {
    super(ErrorCode.NOT_FOUND, `No buyer persona registered for id "${personaId}"`, options);
  }
}
