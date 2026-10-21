import type { ObjectionSourceKey } from "./stress-test-run.js";

/**
 * Real-vs-honest-gap map for the Objection Sources selector (spec section 17-18), First Boundary
 * scope. `available: true` means a real backend source genuinely exists today and could be read
 * from; `available: false` means selecting it is allowed (so a run can still record intent) but
 * the run's persisted result will honestly note no real data existed for it — confirmed absolute
 * gaps, not guesses:
 *
 * - LISTING_KNOWLEDGE_BASE: real — `modules/listing-knowledge` (document ingestion + retrieval)
 *   already ships and is tenant/listing-scoped.
 * - FIRST_MESSAGE_INTELLIGENCE: honest gap — no real `firstMessage` field exists anywhere in this
 *   codebase (confirmed repeatedly this session).
 * - RESPON_PINTAR_CONVERSATIONS: honest gap — no real "Respon Pintar" connected integration exists
 *   anywhere (confirmed repeatedly this session; the only occurrences of that string in the V2 app
 *   are inside honest "belum terhubung" empty-state copy).
 * - HISTORICAL_OBJECTIONS: honest gap — no `ObjectionMiningService` exists yet (Second Boundary).
 */
export interface ObjectionSourceDescriptor {
  readonly key: ObjectionSourceKey;
  readonly label: string;
  readonly available: boolean;
  readonly note: string;
}

export const OBJECTION_SOURCES: readonly ObjectionSourceDescriptor[] = [
  {
    key: "LISTING_KNOWLEDGE_BASE",
    label: "Listing Knowledge Base",
    available: true,
    note: "Real — didukung modul listing-knowledge (dokumen + retrieval per listing).",
  },
  {
    key: "FIRST_MESSAGE_INTELLIGENCE",
    label: "First Message Intelligence",
    available: false,
    note: "Belum tersedia — belum ada field firstMessage nyata di sistem ini.",
  },
  {
    key: "RESPON_PINTAR_CONVERSATIONS",
    label: "Respon Pintar Conversations",
    available: false,
    note: "Belum tersedia — belum ada integrasi Respon Pintar yang terhubung.",
  },
  {
    key: "HISTORICAL_OBJECTIONS",
    label: "Historical Objections",
    available: false,
    note: "Belum tersedia — ObjectionMiningService belum dibangun (Boundary 2).",
  },
] as const;

export function findObjectionSource(
  key: ObjectionSourceKey,
): ObjectionSourceDescriptor | undefined {
  return OBJECTION_SOURCES.find((source) => source.key === key);
}

export function objectionSourceAvailability(
  sources: readonly ObjectionSourceKey[],
): readonly {
  readonly source: ObjectionSourceKey;
  readonly hasRealData: boolean;
  readonly note: string;
}[] {
  return sources.map((key) => {
    const descriptor = findObjectionSource(key);
    return {
      source: key,
      hasRealData: descriptor?.available ?? false,
      note: descriptor?.note ?? "Sumber tidak dikenal.",
    };
  });
}
