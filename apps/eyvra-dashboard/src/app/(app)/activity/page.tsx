import { ActivityHubClient } from "@/components/activity/ActivityHubClient";

/**
 * EYVRA MENU RESTRUCTURE Sprint 3 (PROMPT 6) — real "Aktivitas Agentic" feed. Reuses the exact
 * real `GET /api/activity-log` list + `lib/realtime.ts`'s real `subscribeToActivityLog` LIVE
 * subscription the (now-orphaned since Sprint 1's `/property/activity` redirect) `ActivityLogClient`
 * already established — see `ActivityHubClient.tsx`'s own doc for the full real-reuse mapping
 * (loop-run grouping via the real `ActivityDto.loopId`, and `ActivityDetailPanel` as an inline-panel
 * adaptation of the real `ActivityDetailDrawer`'s Output/Reasoning/Tool Calls tab logic).
 *
 * `/go-live` (Go Live Monitor) is NOT merged in here — Sprint 1's own real investigation found
 * `GoLiveClient` always renders empty (no real trigger ever populates its state), so there is no
 * real functionality to fold in; `/go-live` still redirects here per that sprint's decision.
 * `/meta-ads/simulasi` and `/clara/simulator` (the real Samantha×Kai×Clara simulation wizards) also
 * stay separate real pages — folding a full wizard flow into this feed is out of this sprint's
 * scope, not fabricated as a tab here.
 */
export default function ActivityPage(): React.ReactElement {
  return <ActivityHubClient />;
}
