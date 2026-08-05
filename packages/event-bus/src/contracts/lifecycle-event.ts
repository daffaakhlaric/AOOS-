import { z } from "zod";

import { baseEventSchema } from "./base-event.js";
import { EventCategory } from "./event-category.js";

/** A component's start/stop/failure transition (e.g. "kernel.started", "module.stopped"). */
export const lifecycleEventSchema = baseEventSchema.extend({
  category: z.literal(EventCategory.LIFECYCLE),
  phase: z.enum(["starting", "started", "stopping", "stopped", "failed"]).optional(),
});

export type LifecycleEventShape = z.infer<typeof lifecycleEventSchema>;
export type LifecycleEvent<TPayload = unknown> = Readonly<Omit<LifecycleEventShape, "payload">> & {
  readonly payload: TPayload;
};
