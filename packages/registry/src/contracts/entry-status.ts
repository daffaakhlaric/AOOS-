/** Registry entry lifecycle status — mirrors the Agent Contract's `state` field pattern (docs/003.5-CONTRACT-FIRST-DESIGN.md §2), generalized to every Registry kind. */
export enum EntryStatus {
  DRAFT = "draft",
  ACTIVE = "active",
  DEPRECATED = "deprecated",
  RETIRED = "retired",
  QUARANTINED = "quarantined",
}

/** Valid status transitions — enforced by Registry.enable()/disable()/remove(). */
export const ENTRY_STATUS_TRANSITIONS: Readonly<Record<EntryStatus, readonly EntryStatus[]>> = {
  [EntryStatus.DRAFT]: [EntryStatus.ACTIVE, EntryStatus.QUARANTINED],
  [EntryStatus.ACTIVE]: [EntryStatus.DEPRECATED, EntryStatus.QUARANTINED],
  [EntryStatus.DEPRECATED]: [EntryStatus.ACTIVE, EntryStatus.RETIRED],
  [EntryStatus.RETIRED]: [],
  [EntryStatus.QUARANTINED]: [EntryStatus.DRAFT],
};
