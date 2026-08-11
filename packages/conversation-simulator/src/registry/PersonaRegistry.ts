import { err, ok, type Result } from "@aos/common";

import { createBuyerPersona, type BuyerPersona } from "../domain/entities/BuyerPersona.js";
import { PersonaNotFoundError } from "../domain/errors/PersonaNotFoundError.js";
import type { SimulatorError } from "../domain/errors/SimulatorError.js";
import type { PersonaId } from "../domain/value-objects/PersonaId.js";
import { ALL_PERSONA_IDS } from "../domain/value-objects/PersonaId.js";
import {
  BudgetBuyer,
  ColdBuyer,
  ComplainerBuyer,
  FirstTimeBuyer,
  GhostBuyer,
  KreditBuyer,
  ReadyBuyer,
  SpecificUnitBuyer,
  SyariahBuyer,
  UrgentBuyer,
} from "../personas/index.js";

const RAW_PERSONAS: ReadonlyArray<BuyerPersona> = [
  ColdBuyer,
  BudgetBuyer,
  ReadyBuyer,
  SpecificUnitBuyer,
  KreditBuyer,
  SyariahBuyer,
  GhostBuyer,
  ComplainerBuyer,
  FirstTimeBuyer,
  UrgentBuyer,
];

/**
 * The single source of truth for all 10 fixed DSS Motor buyer personas (spec
 * "registry/PersonaRegistry.ts"). Validates every persona through `createBuyerPersona` once, at
 * construction, so a malformed persona fails fast rather than surfacing mid-simulation.
 */
export class PersonaRegistry {
  private readonly personas: ReadonlyMap<PersonaId, BuyerPersona>;

  private constructor(personas: ReadonlyMap<PersonaId, BuyerPersona>) {
    this.personas = personas;
  }

  static create(): Result<PersonaRegistry, SimulatorError> {
    const map = new Map<PersonaId, BuyerPersona>();
    for (const raw of RAW_PERSONAS) {
      const validated = createBuyerPersona(raw);
      /* v8 ignore start -- unreachable in practice: every literal in `RAW_PERSONAS` (the 10
         `src/personas/*.ts` exports) has a non-empty script, a positive integer `maxTurns`, and a
         non-blank name, pinned exactly by `tests/unit/personas/*.spec.ts` — this only guards
         against a future editing mistake, not a runtime condition today. */
      if (!validated.ok) {
        return err(validated.error);
      }
      /* v8 ignore stop */
      map.set(validated.value.id, validated.value);
    }
    /* v8 ignore start -- unreachable in practice: `RAW_PERSONAS` above is a hardcoded literal
       array covering exactly `ALL_PERSONA_IDS` (verified by `PersonaRegistry.spec.ts`'s "creates
       successfully with all 10 personas registered" and "list() returns personas in the spec's
       canonical order" assertions), so this defensive completeness check can only fire if a new
       `PersonaId` is added without a matching persona file. */
    for (const id of ALL_PERSONA_IDS) {
      if (!map.has(id)) {
        return err(new PersonaNotFoundError(id));
      }
    }
    /* v8 ignore stop */
    return ok(new PersonaRegistry(map));
  }

  get(personaId: PersonaId): Result<BuyerPersona, SimulatorError> {
    const found = this.personas.get(personaId);
    if (found === undefined) {
      return err(new PersonaNotFoundError(personaId));
    }
    return ok(found);
  }

  list(): ReadonlyArray<BuyerPersona> {
    return ALL_PERSONA_IDS.map((id) => this.personas.get(id)).filter(
      (persona): persona is BuyerPersona => persona !== undefined,
    );
  }
}
