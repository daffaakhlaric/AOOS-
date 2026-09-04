import { LearningMonitorClient } from "@/components/learning/LearningMonitorClient";

/**
 * EYVRA MENU RESTRUCTURE Sprint 3 (PROMPT 7) — real "AI Improve" hub. `/learning` has redirected
 * here since Sprint 1; this sprint fills the real content in by rendering the REAL, already-working
 * `LearningMonitorClient` (AAOS Self-Learning AI Phase C / Self-Improving Phase SI-6) untouched in
 * its data/handlers — only relayout/additive changes were made directly inside that component
 * (title, header trigger + confirm modal, 4 score cards, real AI/Manual config badges, AI Judge
 * accordion) to match this sprint's spec. See `LearningMonitorClient.tsx`'s own doc for the full
 * real-component-reuse mapping and the honest gaps (KAI/KAREN score cards, no real `ROLLED_BACK`
 * status, AI Judge accordion is a real subset not a fabricated complete history).
 */
export default function SelfImprovePage(): React.ReactElement {
  return <LearningMonitorClient />;
}
