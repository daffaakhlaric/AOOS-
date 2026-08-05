import type { BaseEventShape } from "../contracts/base-event.js";

import type { IEventFilter } from "./i-filter.js";

/** Type Filter — accepts only events whose exact `type` is in the allowed set. */
export class TypeFilter implements IEventFilter {
  readonly name = "type";

  constructor(private readonly allowedTypes: ReadonlySet<string>) {}

  accepts(event: BaseEventShape): boolean {
    return this.allowedTypes.has(event.type);
  }
}
