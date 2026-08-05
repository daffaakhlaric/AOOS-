import { z } from "zod";

import { baseEventSchema } from "./base-event.js";
import { EventCategory } from "./event-category.js";

/** An event produced by or about a Simulation run (e.g. "simulation.scenario_completed") — never a live-Runtime event. */
export const simulationEventSchema = baseEventSchema.extend({
  category: z.literal(EventCategory.SIMULATION),
  scenarioId: z.string().min(1).optional(),
});

export type SimulationEventShape = z.infer<typeof simulationEventSchema>;
export type SimulationEvent<TPayload = unknown> = Readonly<
  Omit<SimulationEventShape, "payload">
> & {
  readonly payload: TPayload;
};
