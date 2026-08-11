import type { BuyerPersona } from "../../domain/entities/BuyerPersona.js";
import type { PersonaRegistry } from "../../registry/PersonaRegistry.js";

/** Lists all 10 registered buyer personas (spec "application/use-cases/ListPersonas.ts"). */
export class ListPersonas {
  constructor(private readonly registry: PersonaRegistry) {}

  execute(): ReadonlyArray<BuyerPersona> {
    return this.registry.list();
  }
}
