import type { PropertyScoreDelta } from "../domain/value-objects/PropertyScoreDelta.js";

/** Port: detects which PROPERTY scoring criteria fire for a given inbound message text — the sibling to `ILeadScorer`. */
export interface IPropertyLeadScorer {
  score(messageText: string): ReadonlyArray<PropertyScoreDelta>;
}
