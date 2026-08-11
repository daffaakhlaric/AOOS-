import { SourceSystem } from "./SourceSystem.js";

/** Freshness/authority ranking used by `ConflictResolutionService` — higher wins. `API=3 > DMS=2 > SHEETS=1 > MOCK=0`. */
export enum SourcePriority {
  MOCK = 0,
  SHEETS = 1,
  DMS = 2,
  API = 3,
}

const PRIORITY_BY_SOURCE: Readonly<Record<SourceSystem, SourcePriority>> = {
  [SourceSystem.MOCK]: SourcePriority.MOCK,
  [SourceSystem.GOOGLE_SHEETS]: SourcePriority.SHEETS,
  [SourceSystem.DMS]: SourcePriority.DMS,
  [SourceSystem.API]: SourcePriority.API,
};

/** The fixed, non-configurable `SourcePriority` for a given `SourceSystem`. */
export function sourcePriorityFor(source: SourceSystem): SourcePriority {
  return PRIORITY_BY_SOURCE[source];
}
