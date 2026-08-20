import type { IPropertyLeadScorer } from "../contracts/IPropertyLeadScorer.js";
import type { PropertyScoreDelta } from "../domain/value-objects/PropertyScoreDelta.js";

import { PropertyScoreCalculator } from "./PropertyScoreCalculator.js";

/** The PROPERTY-vertical scoring engine — a thin `IPropertyLeadScorer` adapter over the pure `PropertyScoreCalculator` math (sibling to `LeadScorer`). */
export class PropertyLeadScorer implements IPropertyLeadScorer {
  score(messageText: string): ReadonlyArray<PropertyScoreDelta> {
    return PropertyScoreCalculator.calculate(messageText);
  }
}
