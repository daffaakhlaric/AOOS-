/** Lifecycle status of a Campaign, AdSet, or Ad, as reported by Meta. Placed under `value-objects/` per the package's judgment call (documented in the README) since it is a closed, immutable primitive shared by three entities. */
export enum AdStatus {
  ACTIVE = "ACTIVE",
  PAUSED = "PAUSED",
  ARCHIVED = "ARCHIVED",
  DELETED = "DELETED",
}
