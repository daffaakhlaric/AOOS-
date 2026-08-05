import { randomUUID } from "node:crypto";

/** A deterministic, obviously-fake tenant identifier for use in tests. */
export const SAMPLE_TENANT_ID = "00000000-0000-4000-8000-000000000001";

/** A deterministic, obviously-fake trace identifier for use in tests. */
export const SAMPLE_TRACE_ID = "00000000-0000-4000-8000-000000000002";

/** Generates a fresh random UUID — thin wrapper so tests never import `node:crypto` directly. */
export function generateTestUuid(): string {
  return randomUUID();
}

/** A fixed, deterministic ISO timestamp for snapshot-stable tests. */
export const FIXED_TEST_TIMESTAMP = "2026-01-01T00:00:00.000Z" as const;

/** Returns a Date object frozen at FIXED_TEST_TIMESTAMP, for tests needing a deterministic "now". */
export function fixedTestDate(): Date {
  return new Date(FIXED_TEST_TIMESTAMP);
}
