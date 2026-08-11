import { err, ok, type Result } from "@aos/common";
import type { IPublisher } from "@aos/event-bus";

import { JessySimulationComposer } from "../application/services/JessySimulationComposer.js";
import { ObservablePublisher } from "../application/services/ObservablePublisher.js";
import { PersonaResponseService } from "../application/services/PersonaResponseService.js";
import { SimulationRunnerService } from "../application/services/SimulationRunnerService.js";
import { GetSimulationResult } from "../application/use-cases/GetSimulationResult.js";
import { ListPersonas } from "../application/use-cases/ListPersonas.js";
import { RunAllScenarios } from "../application/use-cases/RunAllScenarios.js";
import { RunSimulation } from "../application/use-cases/RunSimulation.js";
import type { SimulatorError } from "../domain/errors/SimulatorError.js";
import { SimulatorEvents } from "../domain/events/SimulatorEvents.js";
import { PersonaRegistry } from "../registry/PersonaRegistry.js";

export interface Simulator {
  readonly runSimulation: RunSimulation;
  readonly runAllScenarios: RunAllScenarios;
  readonly listPersonas: ListPersonas;
  readonly getSimulationResult: GetSimulationResult;
  readonly personaRegistry: PersonaRegistry;
}

export interface SimulatorFactoryOptions {
  /** Real `@aos/event-bus` `IPublisher` for this package's own 5 named events — defaults to a fresh `ObservablePublisher` (never a real broker) when omitted, the same composition-boundary discipline every prior AAOS package's factory establishes. */
  readonly publisher?: IPublisher;
}

/**
 * The composition root (Factory Pattern) — wires `PersonaRegistry`, `PersonaResponseService`
 * (Strategy Pattern), and `SimulationRunnerService` into the 4 public use cases (spec "Public
 * API"). Each `RunSimulation.execute()` call composes its own fresh, isolated `JessyAgent` (via
 * `JessySimulationComposer`) — this factory itself holds no per-session state.
 */
export class SimulatorFactory {
  static create(options: SimulatorFactoryOptions = {}): Result<Simulator, SimulatorError> {
    const registryResult = PersonaRegistry.create();
    /* v8 ignore start -- unreachable in practice: `PersonaRegistry.create()` only ever fails if
       one of the 10 hardcoded persona literals in `src/personas/*.ts` becomes malformed (empty
       script, non-positive maxTurns, blank name) — every `*.spec.ts` under `tests/unit/personas/`
       pins those literals exactly, so this can only fire from a future editing mistake, not at
       runtime today. */
    if (!registryResult.ok) {
      return err(registryResult.error);
    }
    /* v8 ignore stop */
    const registry = registryResult.value;

    const strategy = new PersonaResponseService();
    const events = new SimulatorEvents(options.publisher ?? new ObservablePublisher());
    const composer = new JessySimulationComposer();
    const runner = new SimulationRunnerService(registry, strategy, events, composer);
    const runSimulation = new RunSimulation(runner);

    return ok({
      runSimulation,
      runAllScenarios: new RunAllScenarios(runSimulation, registry),
      listPersonas: new ListPersonas(registry),
      getSimulationResult: new GetSimulationResult(runner),
      personaRegistry: registry,
    });
  }
}
