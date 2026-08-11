import { describe, expect, it } from "vitest";

import { ListPersonas } from "../../../../src/application/use-cases/ListPersonas.js";
import { PersonaRegistry } from "../../../../src/registry/PersonaRegistry.js";
import { unwrap } from "../../../helpers/result.js";

describe("ListPersonas", () => {
  it("returns all 10 personas from the registry", () => {
    const registry = unwrap(PersonaRegistry.create());
    const useCase = new ListPersonas(registry);
    expect(useCase.execute()).toHaveLength(10);
  });

  it("returns the same array PersonaRegistry.list() would", () => {
    const registry = unwrap(PersonaRegistry.create());
    const useCase = new ListPersonas(registry);
    expect(useCase.execute()).toEqual(registry.list());
  });
});
