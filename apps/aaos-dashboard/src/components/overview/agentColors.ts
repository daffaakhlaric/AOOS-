/**
 * Real per-agent brand colors — `CLAUDE.md`'s own documented roster (`## Agents`), the single
 * source of truth every Overview Monitor component reuses for agent-coded accents (score ring,
 * card top-border, activity-row badge). Deliberately only the 3 real agents (SAMANTHA/KAI/CLARA,
 * `docs/PROMPT-AAOS-OVERVIEW-MONITOR.md` Finding 1) — no "KAREN" entry.
 */
export const AGENT_COLOR: Readonly<Record<"SAMANTHA" | "KAI" | "CLARA", string>> = {
  SAMANTHA: "#1E6FD9",
  KAI: "#8B5CF6",
  CLARA: "#0EA472",
};

export function agentColorFor(agent: string): string {
  return (AGENT_COLOR as Record<string, string>)[agent] ?? "#71717a";
}
