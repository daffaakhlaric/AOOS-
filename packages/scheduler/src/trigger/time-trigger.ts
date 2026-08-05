import { TriggerType } from "../contracts/trigger-type.js";
import type { ITimer, TimerTickResult } from "../timer/i-timer.js";

import type { ITrigger } from "./i-trigger.js";

/** Time Trigger — a thin `ITrigger`-shaped adapter over `TimerService`, the actual clock-driven readiness detector. */
export class TimeTrigger implements ITrigger {
  readonly type = TriggerType.TIME;

  constructor(private readonly timer: ITimer) {}

  tick(): Promise<TimerTickResult> {
    return this.timer.tick();
  }
}
