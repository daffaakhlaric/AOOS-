import { describe, expect, it } from "vitest";

import { SimulatorFactory } from "../../../src/factories/SimulatorFactory.js";
import { unwrap } from "../../helpers/result.js";

describe("SimulatorFactory", () => {
  it("create() wires up all 4 use cases + PersonaRegistry", () => {
    const simulator = unwrap(SimulatorFactory.create());
    expect(simulator.runSimulation).toBeDefined();
    expect(simulator.runAllScenarios).toBeDefined();
    expect(simulator.listPersonas).toBeDefined();
    expect(simulator.getSimulationResult).toBeDefined();
    expect(simulator.personaRegistry).toBeDefined();
  });

  it("listPersonas.execute() returns all 10 registered personas", () => {
    const simulator = unwrap(SimulatorFactory.create());
    expect(simulator.listPersonas.execute()).toHaveLength(10);
  });

  it("create() accepts an explicit publisher override", () => {
    const published: unknown[] = [];
    const publisher = {
      publish: async (input: unknown) => {
        published.push(input);
        return input as never;
      },
      publishAsync: async (input: unknown) => {
        published.push(input);
        return input as never;
      },
      publishBatch: async (inputs: readonly unknown[]) => {
        published.push(...inputs);
        return inputs as never;
      },
    };
    const simulator = unwrap(SimulatorFactory.create({ publisher }));
    expect(simulator.runSimulation).toBeDefined();
  });
});
