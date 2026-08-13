import { z } from "zod";

/** `POST /api/v1/objective` body — period (month/year) is always the server's current month, per `@aos/objective-engine`'s `CreateObjective` rule that a new Objective's period "must be the current or a future month"; this MVP endpoint always creates for the current month rather than exposing period selection. */
export const CreateObjectiveBodySchema = z.object({
  targetHotLeads: z.number(),
  budgetAllocation: z.number().positive(),
  focusUnits: z.array(z.string()).min(1),
  areaPriorities: z.array(z.string()).min(1),
});

export type CreateObjectiveBodyDto = z.infer<typeof CreateObjectiveBodySchema>;
