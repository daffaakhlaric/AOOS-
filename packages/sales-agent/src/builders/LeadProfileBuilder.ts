import type { LeadProfile } from "../domain/entities/LeadProfile.js";
import { QualificationStatus } from "../domain/value-objects/QualificationStatus.js";
import type { QualificationMatch } from "../scoring/QualificationDetector.js";

/** Builder Pattern: gradually enriches a `LeadProfile` from `QualificationDetector` matches, one message at a time (spec persona: "qualify lead gradually"). */
export class LeadProfileBuilder {
  static enrich(profile: LeadProfile, matches: ReadonlyArray<QualificationMatch>): LeadProfile {
    return matches.reduce((current, match) => {
      switch (match.status) {
        case QualificationStatus.BUDGET:
          return current.withEnrichment({ budget: match.extractedText }, match.status);
        case QualificationStatus.UNIT:
          return current.withEnrichment({ unit: match.extractedText }, match.status);
        case QualificationStatus.AREA:
          return current.withEnrichment({ area: match.extractedText }, match.status);
        case QualificationStatus.PAYMENT:
          return current.withEnrichment({ paymentMethod: match.extractedText }, match.status);
        case QualificationStatus.TIMELINE:
          return current.withEnrichment({ timeline: match.extractedText }, match.status);
        case QualificationStatus.NAME:
          return current.withEnrichment({ name: match.extractedText }, match.status);
      }
    }, profile);
  }
}
