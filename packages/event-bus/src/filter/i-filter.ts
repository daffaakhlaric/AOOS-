import type { BaseEventShape } from "../contracts/base-event.js";

/** One predicate stage a Subscriber (or the Dispatcher, on its behalf) can gate delivery on. */
export interface IEventFilter {
  readonly name: string;
  accepts(event: BaseEventShape): boolean;
}
