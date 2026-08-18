/**
 * Domain shape for one stored `meta_interests` row (AAOS-SIMULASI-TARGETING). Kept in one small
 * self-contained file, mirroring `modules/simulation`/`modules/creative-packages`'s precedent for a
 * module whose domain has no upstream `@aos/*` package entity of its own.
 *
 * This is the PERSISTED counterpart of `@aos/meta-ads-connector`'s `AdInterest` (the in-flight
 * shape returned by the real `SearchAdInterests` Graph API call). The two are deliberately
 * separate types rather than one shared one: the stored row additionally carries `tenantId` and
 * `fetchedAt`, which are AAOS storage concerns the connector has no business knowing about.
 *
 * Every field here originates from a REAL live Meta response — `id`, `name`, the two audience
 * bounds, `path` and `topic` are Meta's own values, carried through unmodified. `searchTerm` and
 * `fetchedAt` are AAOS provenance.
 */
export interface StoredMetaInterest {
  /** Meta's own interest id, e.g. `"6003304550260"`. */
  readonly id: string;
  readonly tenantId: string;
  readonly name: string;
  readonly audienceSizeLower: number;
  readonly audienceSizeUpper: number;
  readonly path: readonly string[];
  readonly topic?: string;
  readonly searchTerm: string;
  /** ISO timestamp of the live Meta call that produced this row. */
  readonly fetchedAt: string;
}
