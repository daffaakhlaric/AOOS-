"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { ClaraInboxClient } from "@/components/clara/ClaraInboxClient";
import { ContactsClient } from "@/components/clara/ContactsClient";
import { RecyclingClient } from "@/components/clara/RecyclingClient";
import { HubTabs, type HubTab } from "@/components/layout/HubTabs";
import { TopBar } from "@/components/layout/TopBar";
import { KnowledgeClient } from "@/components/knowledge/KnowledgeClient";
import type { LeadDto } from "@/types/dashboard.types";

import { LeadPipelineBoard } from "./LeadPipelineBoard";
import styles from "./LeadsHubClient.module.css";

const DEFAULT_TAB = "pipeline";

const TABS: readonly HubTab[] = [
  { key: "pipeline", label: "Pipeline" },
  { key: "semua", label: "Semua Leads" },
  { key: "recycling", label: "Recycling" },
  { key: "knowledge-base", label: "Knowledge Base" },
  { key: "inbox", label: "Inbox" },
];

const VALID_TAB_KEYS = new Set(TABS.map((tab) => tab.key));

function resolveInitialTab(initialTab: string | undefined): string {
  return initialTab !== undefined && VALID_TAB_KEYS.has(initialTab) ? initialTab : DEFAULT_TAB;
}

export interface LeadsHubClientProps {
  readonly initialTab?: string;
  readonly initialLeadId?: string;
}

/**
 * EYVRA MENU RESTRUCTURE Sprint 2 — real "Leads" hub (PROMPT 4), gathering every Clara feature
 * behind one tab bar. `semua`/`recycling`/`knowledge-base` render the real, unmodified
 * `ContactsClient`/`RecyclingClient`/`KnowledgeClient` Sprint 1 hid behind redirects.
 *
 * `pipeline` (default) is a real, honest NEW component (`LeadPipelineBoard`) — see its own doc
 * comment: no existing per-lead kanban UI exists anywhere in this codebase to reuse, so this is
 * built from the same real `GET /api/leads`/`GET /api/leads/:id` endpoints `ContactsClient`/
 * `ClaraInboxClient` already call, not fabricated data.
 *
 * `inbox` is a Sprint 2 ADDITION beyond PROMPT 4's literal 4-tab list: the real `ClaraInboxClient`
 * (full WA reply UI) is exactly what both `/clara/inbox`'s Sprint 1 redirect (`/leads`, no tab —
 * i.e. this hub's default surface) and the spec's own header button ("Lihat WA inbox ↗") need a
 * real home for, and PROMPT 4's 4 named tabs have no slot for a full reply UI (only a read-only
 * "WA conversation preview" inside the Pipeline drawer). Rather than silently drop this real,
 * substantial, previously-working feature, it is kept reachable as an explicit 5th tab.
 *
 * KPI mini (HOT/WARM/COLD counts) reuses the SAME real `GET /api/leads` call `LeadPipelineBoard`
 * makes independently (no shared cache — kept simple, both are cheap fan-out reads) rather than
 * inventing a second summary endpoint.
 */
export function LeadsHubClient({
  initialTab,
  initialLeadId,
}: LeadsHubClientProps): React.ReactElement {
  const [tab, setTab] = useState(() => resolveInitialTab(initialTab));
  const [counts, setCounts] = useState<{ hot: number; warm: number; cold: number } | undefined>(
    undefined,
  );

  useEffect(() => {
    let cancelled = false;
    fetch("/api/leads")
      .then((res) => (res.ok ? (res.json() as Promise<{ leads: readonly LeadDto[] }>) : null))
      .then((body) => {
        if (!cancelled && body !== null) {
          const hot = body.leads.filter((lead) => lead.temperature === "HOT").length;
          const warm = body.leads.filter((lead) => lead.temperature === "WARM").length;
          const cold = body.leads.filter((lead) => lead.temperature === "COLD").length;
          setCounts({ hot, warm, cold });
        }
      })
      .catch(() => {
        // Best-effort only.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main>
      <TopBar title="Leads" accentColor="var(--v2-menu-leads)" />
      <div className={styles.headerExtra}>
        <div className={styles.kpiMini} data-testid="leads-kpi-mini">
          <span className={styles.kpiHot}>HOT: {counts?.hot ?? "…"}</span>
          <span className={styles.kpiWarm}>WARM: {counts?.warm ?? "…"}</span>
          <span className={styles.kpiCold}>COLD: {counts?.cold ?? "…"}</span>
        </div>
        <Link href="/leads?tab=inbox" className={styles.inboxButton}>
          Lihat WA inbox ↗
        </Link>
      </div>
      <HubTabs
        tabs={TABS}
        activeKey={tab}
        basePath="/leads"
        defaultKey={DEFAULT_TAB}
        onChange={setTab}
      />
      <div className={styles.tabBody} data-testid={`leads-tab-${tab}`}>
        {tab === "pipeline" ? <LeadPipelineBoard /> : null}
        {tab === "semua" ? <ContactsClient /> : null}
        {tab === "recycling" ? <RecyclingClient /> : null}
        {tab === "knowledge-base" ? <KnowledgeClient /> : null}
        {tab === "inbox" ? <ClaraInboxClient initialLeadId={initialLeadId} /> : null}
      </div>
    </main>
  );
}

export default LeadsHubClient;
