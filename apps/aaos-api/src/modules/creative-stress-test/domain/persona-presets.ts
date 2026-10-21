import type { PersonaPresetId } from "./stress-test-run.js";

/**
 * Static, versioned Buyer Persona Stress Test presets (spec section 12), First Boundary scope.
 * These are CONFIGURED presets — a fixed, documented list this module ships with — NOT derived
 * from real lead data. Second Boundary's `PersonaBuilder`/persona-source-priority system is what
 * will eventually build personas from real leads; until that exists, callers (including the
 * frontend) must label these as presets, never as "real buyer data".
 */
export interface PersonaPreset {
  readonly id: PersonaPresetId;
  readonly label: string;
  readonly description: string;
}

export const PERSONA_PRESETS_VERSION = 1;

export const PERSONA_PRESETS: readonly PersonaPreset[] = [
  {
    id: "PRICE_SENSITIVE",
    label: "Price Sensitive",
    description: "Fokus pada harga, DP, dan cicilan — akan membandingkan dengan kompetitor.",
  },
  {
    id: "SKEPTICAL_BUYER",
    label: "Skeptical Buyer",
    description: "Meragukan klaim iklan, butuh bukti/fakta konkret sebelum percaya.",
  },
  {
    id: "HIGH_INTENT",
    label: "High Intent",
    description: "Sudah siap membeli, ingin proses cepat dan jawaban langsung.",
  },
  {
    id: "INVESTOR",
    label: "Investor",
    description: "Menilai dari sisi ROI/nilai investasi, bukan kebutuhan pribadi.",
  },
  {
    id: "FAMILY_BUYER",
    label: "Family Buyer",
    description: "Mempertimbangkan kebutuhan keluarga — ruang, keamanan, lingkungan sekitar.",
  },
] as const;

export function findPersonaPreset(id: PersonaPresetId): PersonaPreset | undefined {
  return PERSONA_PRESETS.find((preset) => preset.id === id);
}
