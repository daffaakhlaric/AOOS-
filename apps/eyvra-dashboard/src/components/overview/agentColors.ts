/**
 * Real per-agent brand colors — single source of truth every Overview Monitor component reuses
 * for agent-coded accents (score ring, card gradient header, activity-row badge, AI score gradient
 * bar).
 *
 * REAL FINDING + FIX (AAOS Colorful Brand Guideline v2, Phase B3): this map previously hardcoded
 * `CLAUDE.md`'s documented agent-color roster (`SAMANTHA: #1E6FD9`, `KAI: #8B5CF6`,
 * `CLARA: #0EA472`) — but Phase B1 already committed a SEPARATE, slightly different agent-color
 * system as `globals.css` `--v2-*` tokens (`--v2-samantha: #1e6fd9`, `--v2-kai: #7c3aed`,
 * `--v2-clara: #059669`, sourced from `docs/PROMPT-EYVRA-COLORFUL-BRAND-GUIDELINE-V2.md`'s own
 * "AGENT COLORS" table). SAMANTHA already matched; KAI (`#8B5CF6` vs `#7C3AED`) and CLARA
 * (`#0EA472` vs `#059669`) did not — two different hex values for the same agent identity, one in
 * this file, one in `globals.css`, neither aware of the other.
 *
 * Fixed by making this file MATCH the `--v2-*` tokens exactly (plain hex constants, not a live
 * `var(--v2-kai)` CSS reference — this module's values are consumed as plain JS strings for
 * inline-style `stroke`/`background`/gradient-stop props across `AgentStatusRow.tsx`/
 * `ActivityFeedSection.tsx`/`AiScoreCard.tsx`, not as CSS custom properties, so a `var()` string
 * would only resolve correctly when interpolated back into a `style` attribute the browser parses —
 * safe for e.g. `border-top-color`, but SVG `stroke` and JS string interpolation for gradient stops
 * need a real color literal). This is now the ONE agent-color system for the whole v2 app:
 *
 *   Agent      | Before (this file) | After (this file, == `--v2-*` token) |
 *   -----------|---------------------|----------------------------------------|
 *   SAMANTHA   | #1E6FD9             | #1E6FD9  (unchanged — already matched)  |
 *   KAI        | #8B5CF6             | #7C3AED  (now == `--v2-kai`)            |
 *   CLARA      | #0EA472             | #059669  (now == `--v2-clara`)          |
 *
 * `CLAUDE.md`'s `## Agents` section (`Kai #8B5CF6`, `Clara #0EA472`) is the older, pre-v2-brand-
 * guideline roster and is now superseded here for the v2 dashboard's own rendering — it documents
 * the ORIGINAL brand assignment, not this file's runtime values, and is out of scope for this
 * phase to edit (a docs-only follow-up, not a code change).
 *
 * Deliberately only the 3 real agents (SAMANTHA/KAI/CLARA, `docs/PROMPT-AAOS-OVERVIEW-MONITOR.md`
 * Finding 1) — no "KAREN" entry.
 */
export const AGENT_COLOR: Readonly<Record<"SAMANTHA" | "KAI" | "CLARA", string>> = {
  SAMANTHA: "#1E6FD9",
  KAI: "#7C3AED",
  CLARA: "#059669",
};

/** Lighter gradient-stop pairing per agent (`--v2-*` tokens' own values), used by gradient headers (`AgentStatusRow.tsx`) and gradient progress bars (`AiScoreCard.tsx`) — spec Prompts 4 and 9. */
export const AGENT_GRADIENT: Readonly<Record<"SAMANTHA" | "KAI" | "CLARA", string>> = {
  SAMANTHA: "linear-gradient(135deg, #1E6FD9 0%, #3B82F6 100%)",
  KAI: "linear-gradient(135deg, #7C3AED 0%, #A78BFA 100%)",
  CLARA: "linear-gradient(135deg, #059669 0%, #34D399 100%)",
};

/** Same 3 agents' gradient, oriented left-to-right (90deg) for horizontal progress-bar fills (Prompt 9's `AI_SCORE_GRADIENT`). */
export const AGENT_SCORE_BAR_GRADIENT: Readonly<Record<"SAMANTHA" | "KAI" | "CLARA", string>> = {
  SAMANTHA: "linear-gradient(90deg, #1E6FD9, #60A5FA)",
  KAI: "linear-gradient(90deg, #7C3AED, #A78BFA)",
  CLARA: "linear-gradient(90deg, #059669, #34D399)",
};

export function agentColorFor(agent: string): string {
  return (AGENT_COLOR as Record<string, string>)[agent] ?? "#71717a";
}
