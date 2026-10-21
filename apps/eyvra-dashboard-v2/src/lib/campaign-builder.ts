export const goals = [
  "WhatsApp Leads",
  "Qualified Leads",
  "Meta Lead Form",
  "Website Conversion",
  "Retargeting",
  "Traffic",
  "Awareness",
  "Engagement",
] as const;
export type BusinessGoal = (typeof goals)[number];
export interface BuilderDraft {
  id: string;
  listingId: string;
  name: string;
  goal: BusinessGoal;
  dailyBudget: number;
  start: string;
  end: string;
  copyIndex: number;
  metaDestination?: { pageId: string; adAccountId: string; number: string } | null;
  updatedAt?: string;
  revision?: number;
  kaiProjectId?: string | null;
  kaiBriefId?: string | null;
  status?: "READY" | "NEEDS_INPUT";
  missingFields?: string[];
}
export function budgetPeriod(start: string, end: string, daily: number) {
  const a = Date.parse(start),
    b = Date.parse(end);
  const days =
    Number.isFinite(a) && Number.isFinite(b) && b >= a ? Math.round((b - a) / 86400000) + 1 : 0;
  return {
    days,
    total: days * Math.max(0, Number.isFinite(daily) ? daily : 0),
    valid: days > 0 && days <= 366 && daily > 0,
  };
}
export function validDraft(value: unknown): value is BuilderDraft {
  if (!value || typeof value !== "object") return false;
  const d = value as BuilderDraft;
  return (
    /^[a-f0-9-]{36}$/.test(d.id) &&
    /^[a-f0-9-]{36}$/.test(d.listingId) &&
    typeof d.name === "string" &&
    d.name.length > 0 &&
    d.name.length <= 200 &&
    goals.includes(d.goal) &&
    Number.isFinite(d.dailyBudget) &&
    d.dailyBudget >= 0 &&
    d.dailyBudget <= 1e10 &&
    /^\d{4}-\d{2}-\d{2}$/.test(d.start) &&
    /^\d{4}-\d{2}-\d{2}$/.test(d.end) &&
    Number.isInteger(d.copyIndex) &&
    d.copyIndex >= 0 &&
    d.copyIndex < 5 &&
    (d.revision === undefined || (Number.isInteger(d.revision) && d.revision >= 0)) &&
    (d.metaDestination == null ||
      (typeof d.metaDestination === "object" &&
        typeof d.metaDestination.pageId === "string" &&
        /^\d*$/.test(d.metaDestination.pageId) &&
        typeof d.metaDestination.adAccountId === "string" &&
        /^(act_\d+)?$/.test(d.metaDestination.adAccountId) &&
        typeof d.metaDestination.number === "string" &&
        /^[+\d\s()-]*$/.test(d.metaDestination.number)))
  );
}
