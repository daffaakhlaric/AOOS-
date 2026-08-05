import { randomUUID } from "node:crypto";

/** Generates a fresh random identifier for kernel instances, requests, traces, etc. */
export function generateId(): string {
  return randomUUID();
}
