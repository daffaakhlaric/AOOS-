import type { StressTestObjectionSeverity, StressTestPersonaAttempt } from "./stress-test-run.js";

/**
 * Creative Stress Test — objection grouping shared by the Objection Resolution evaluator.
 *
 * KEEP IN SYNC WITH THE FRONTEND: `normalizeObjectionText` below is a byte-for-byte copy of
 * `apps/eyvra-dashboard-v2/src/lib/stress-test-result.ts#normalizeObjectionText`, and
 * `groupSimulatedObjections` follows the same grouping rule as the dashboard's
 * `mapObjectionRows` (exact normalized text, first-seen order, one entry per persona with that
 * persona's highest severity). The persisted `objectionResolution.items[].key` is this normalized
 * text, which is how the dashboard joins an assessment back onto its own table row. If either copy
 * changes, change both — otherwise assessments silently stop matching rows (they then render as
 * "Belum dinilai", never as a wrong status).
 *
 * Rule: lowercase -> collapse whitespace -> trim -> strip leading/trailing straight or curly quotes
 * -> strip trailing `.!?,;:` punctuation/whitespace -> trim.
 */
export function normalizeObjectionText(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^["'“”‘’]+|["'“”‘’]+$/g, "")
    .replace(/[.!?,;:\s]+$/g, "")
    .trim();
}

const SEVERITY_RANK: Record<StressTestObjectionSeverity, number> = { HIGH: 3, MEDIUM: 2, LOW: 1 };

export interface GroupedObjection {
  /** Normalized text — the join key the dashboard uses (see this file's doc). */
  readonly key: string;
  /** Original (trimmed) text of the first occurrence. */
  readonly objection: string;
  /** Highest severity any persona gave it. */
  readonly severity: StressTestObjectionSeverity;
  readonly personaLabels: readonly string[];
}

/** Groups the real simulated objections of every successful persona critique (see this file's doc). */
export function groupSimulatedObjections(
  personaAttempts: readonly StressTestPersonaAttempt[],
): readonly GroupedObjection[] {
  const groups = new Map<
    string,
    {
      objection: string;
      personas: Map<string, { label: string; severity: StressTestObjectionSeverity }>;
    }
  >();
  for (const attempt of personaAttempts) {
    if (!attempt.ok || attempt.critique === undefined) continue;
    for (const o of attempt.critique.objections) {
      const key = normalizeObjectionText(o.objection);
      if (key.length === 0) continue;
      const group = groups.get(key) ?? {
        objection: o.objection.trim(),
        personas: new Map<string, { label: string; severity: StressTestObjectionSeverity }>(),
      };
      const previous = group.personas.get(attempt.personaId);
      if (previous === undefined || SEVERITY_RANK[o.severity] > SEVERITY_RANK[previous.severity]) {
        group.personas.set(attempt.personaId, {
          label: attempt.personaLabel,
          severity: o.severity,
        });
      }
      groups.set(key, group);
    }
  }
  return [...groups.entries()].map(([key, g]) => {
    const personas = [...g.personas.values()];
    const severity = personas.reduce<StressTestObjectionSeverity>(
      (max, p) => (SEVERITY_RANK[p.severity] > SEVERITY_RANK[max] ? p.severity : max),
      "LOW",
    );
    return { key, objection: g.objection, severity, personaLabels: personas.map((p) => p.label) };
  });
}

/**
 * Loose normalization for the evidence-substring check: lowercase, every straight/curly quote
 * removed, whitespace collapsed, trailing punctuation stripped. Applied to BOTH
 * the quote and the creative text, so only formatting differences are forgiven — never wording.
 */
export function normalizeForEvidenceMatch(text: string): string {
  return text
    .toLowerCase()
    .replace(/[“”‘’"']/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.!?,;:\s]+$/g, "")
    .trim();
}

/** Minimum normalized evidence length — a 1-2 character "quote" would trivially be a substring. */
export const MIN_EVIDENCE_LENGTH = 4;

export function evidenceExistsInText(evidence: string, creativeText: string): boolean {
  const needle = normalizeForEvidenceMatch(evidence);
  if (needle.length < MIN_EVIDENCE_LENGTH) return false;
  return normalizeForEvidenceMatch(creativeText).includes(needle);
}
