import type { BaseEventShape } from "../contracts/base-event.js";

import type { IEventFilter } from "./i-filter.js";

/** Composes multiple filters with AND semantics — every filter must accept for the chain to accept. */
export class FilterChain implements IEventFilter {
  readonly name = "chain";

  constructor(private readonly filters: readonly IEventFilter[]) {}

  accepts(event: BaseEventShape): boolean {
    return this.filters.every((filter) => filter.accepts(event));
  }
}
