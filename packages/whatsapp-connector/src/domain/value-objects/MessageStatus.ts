/**
 * Judgment call (documented in the engineering report, resolution #2): the spec's folder tree
 * lists `MessageStatus.ts` twice — once under `domain/entities/` ("sent/delivered/read/failed")
 * and once under `domain/value-objects/` ("SENT | DELIVERED | READ | FAILED") — the same 4-value
 * status concept listed in two layers by drafting error, the same class of duplicate-listing bug
 * already caught twice before in this session (`@aos/objective-engine`, the W1D-S1S2 supplement).
 * A 4-value enum with no identity of its own is a value object, not an entity, so it is built
 * exactly once, here. No `domain/entities/MessageStatus.ts` file exists in this package.
 */
export enum MessageStatus {
  SENT = "SENT",
  DELIVERED = "DELIVERED",
  READ = "READ",
  FAILED = "FAILED",
}
