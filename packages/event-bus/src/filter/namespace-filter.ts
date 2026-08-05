import type { BaseEventShape } from "../contracts/base-event.js";
import { extractEventNamespace } from "../contracts/event-namespace.js";

import type { IEventFilter } from "./i-filter.js";

/** Namespace Filter — accepts only events whose `type` namespace is in the allowed set. */
export class NamespaceFilter implements IEventFilter {
  readonly name = "namespace";

  constructor(private readonly allowedNamespaces: ReadonlySet<string>) {}

  accepts(event: BaseEventShape): boolean {
    return this.allowedNamespaces.has(extractEventNamespace(event.type));
  }
}
