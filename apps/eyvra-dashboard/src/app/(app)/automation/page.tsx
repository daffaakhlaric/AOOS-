import { AutomationHubClient } from "@/components/automation/AutomationHubClient";

/**
 * `/automation` — EYVRA SAMANTHA V2 + KAI V2 (this phase). Replaces Phase 50/54's `redirect()`
 * stub (which pointed here at `/settings`, since this codebase had no real Automation page yet)
 * with a real, dedicated READ/DISPLAY-ONLY hub — see `AutomationHubClient.tsx`'s own doc for the
 * 3 real sections it surfaces (Mode Operasi DEV/LIVE, Automasi Campaign auto-publish guardrail,
 * Automation Mode per Growth Objective) and the honest "not yet wired to execution" notice.
 *
 * Same "page.tsx renders a client component" convention every other hub page in this app already
 * uses (`/leads`, `/experiments`, `/kai-studio`).
 */
export default function AutomationPage(): React.ReactElement {
  return <AutomationHubClient />;
}
