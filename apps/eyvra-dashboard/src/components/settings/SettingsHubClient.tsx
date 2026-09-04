"use client";

import { useState } from "react";
import Link from "next/link";

import { HubTabs, type HubTab } from "@/components/layout/HubTabs";
import { TopBar } from "@/components/layout/TopBar";
import { ObjectiveClient } from "@/components/objective/ObjectiveClient";

import styles from "./SettingsHubClient.module.css";
import { SettingsClient } from "./SettingsClient";

const DEFAULT_TAB = "objective";

const TABS: readonly HubTab[] = [
  { key: "objective", label: "Objective" },
  { key: "jadwal", label: "Jadwal" },
  { key: "lokasi", label: "Lokasi" },
  { key: "koneksi", label: "Koneksi" },
  { key: "agen", label: "Agen" },
];

const VALID_TAB_KEYS = new Set(TABS.map((tab) => tab.key));

function resolveInitialTab(initialTab: string | undefined): string {
  return initialTab !== undefined && VALID_TAB_KEYS.has(initialTab) ? initialTab : DEFAULT_TAB;
}

const AGENTS = [
  {
    key: "SAMANTHA",
    role: "Meta Ads Manager",
    color: "var(--v2-samantha)",
    tint: "var(--v2-samantha-tint)",
    alwaysActive: false,
  },
  {
    key: "KAI",
    role: "Creative AI",
    color: "var(--v2-kai)",
    tint: "var(--v2-kai-tint)",
    alwaysActive: false,
  },
  {
    key: "CLARA",
    role: "Sales AI",
    color: "var(--v2-clara)",
    tint: "var(--v2-clara-tint)",
    alwaysActive: true,
  },
  {
    key: "KAREN",
    role: "Webchat",
    color: "var(--v2-karen)",
    tint: "var(--v2-karen-tint)",
    alwaysActive: false,
  },
] as const;

export interface SettingsHubClientProps {
  readonly initialTab?: string;
}

/**
 * EYVRA MENU RESTRUCTURE Sprint 3 (PROMPT 8) — real "Settings" hub, 5 tabs.
 *
 * REAL COMPONENT REUSE MAP (investigated before writing anything, same discipline as Sprint 2):
 *  - "objective" (default): the real `ObjectiveClient` (target-hot-leads stepper-equivalent input,
 *    budget, focus units, area priorities, strategy preview via `ObjectiveCard`) — completely
 *    unmodified, same component `/campaigns?tab=objective` already reuses. `areaPriorities`
 *    (BINTARO/CINERE/UMUM/BANDUNG checkboxes inside `ObjectiveForm`) is this codebase's ONLY real
 *    location-priority mechanism today — see the "lokasi" tab's own honest note below.
 *  - "jadwal": NO real backing anywhere in this codebase — investigated (`grep`) for a loop
 *    schedule / cron time / active-days table and found none; `aaos-api` runs its agent loop on a
 *    fixed internal schedule, not a tenant-configurable one exposed via any real endpoint. Rendered
 *    as an honest "belum tersedia" panel rather than a fabricated time picker with nothing behind
 *    it.
 *  - "lokasi": the spec's drag-reorder priority-city list with per-city radius/active toggle has NO
 *    real backing either (`BranchDto` — this codebase's only real "location" entity — has no
 *    city/radius/priority-order field, only branch name/WABA/assignment mode). The real, partial
 *    overlap is `ObjectiveForm`'s own `areaPriorities` checkboxes (inside the "objective" tab) —
 *    this tab honestly says so and links there, rather than fabricating drag-and-drop/radius UI.
 *  - "koneksi": the real, unmodified `SettingsClient` (Meta Ads Configuration + test, WhatsApp
 *    Business/WABA config + test, Competitor Pages, Mode Operasi DEV/LIVE + confirm, Mode Operasi
 *    AI Full Control/Approval + confirm, Tenant Info, Account/Logout) rendered `embedded` (no
 *    duplicate `TopBar`). This codebase never split Meta/WABA connection status out from Mode/
 *    Tenant Info/Account into separate components — refactoring that apart would only fragment one
 *    real, already-cohesive, already-tested component for no functional gain, so it is reused
 *    whole here rather than partially duplicated. Kie AI (Kai) key/usage and a Supabase health
 *    indicator have NO real backing anywhere in this codebase (no settings row, no status
 *    endpoint) — `SettingsClient` itself never claimed to show them, and this tab does not
 *    fabricate them either.
 *  - "agen": NEW, honest, mostly-static card grid — the 4 real agent identities/colors/roles this
 *    whole app already establishes (`CLAUDE.md`'s own agent table, `--v2-samantha/kai/clara/karen`
 *    tokens). There is NO real per-agent "aktif" toggle anywhere in this codebase (investigated,
 *    found none) — every toggle here is rendered disabled with an honest tooltip rather than
 *    wired to a fabricated write. Clara's toggle is additionally always-on per the spec's own
 *    instruction (also the only agent with no real way to be switched off — Clara's WhatsApp
 *    pipeline has no "disable" flag in this codebase either). Real config detail already lives at
 *    `/self-improve` (real `agent_configs`/prompt overrides) — linked, not duplicated.
 */
export function SettingsHubClient({ initialTab }: SettingsHubClientProps): React.ReactElement {
  const [tab, setTab] = useState(() => resolveInitialTab(initialTab));

  return (
    <main>
      <TopBar title="Settings" accentColor="var(--v2-menu-settings)" />
      <HubTabs
        tabs={TABS}
        activeKey={tab}
        basePath="/settings"
        defaultKey={DEFAULT_TAB}
        onChange={setTab}
      />
      <div className={styles.tabBody} data-testid={`settings-tab-${tab}`}>
        {tab === "objective" ? <ObjectiveClient /> : null}

        {tab === "jadwal" ? (
          <div className={styles.unavailableCard}>
            <h2 className={styles.unavailableTitle}>Jadwal Loop</h2>
            <p className={styles.unavailableText}>
              Belum tersedia — tidak ada endpoint atau kolom real (jam loop, hari aktif, timezone,
              toggle aktif/nonaktif) di codebase ini. Loop agent saat ini berjalan pada jadwal
              internal tetap di `aaos-api`, belum bisa dikonfigurasi per-tenant.
            </p>
          </div>
        ) : null}

        {tab === "lokasi" ? (
          <div className={styles.unavailableCard}>
            <h2 className={styles.unavailableTitle}>Lokasi</h2>
            <p className={styles.unavailableText}>
              Daftar kota prioritas dengan drag-reorder, radius per-kota, dan toggle aktif per-kota
              belum tersedia — tidak ada field seperti itu pada data branch/objective real di
              codebase ini. Mekanisme prioritas lokasi real yang ADA hari ini adalah &quot;Area
              Prioritas&quot; (checkbox BINTARO/CINERE/UMUM/BANDUNG) di dalam tab Objective.
            </p>
            <button type="button" className={styles.linkButton} onClick={() => setTab("objective")}>
              Buka tab Objective →
            </button>
          </div>
        ) : null}

        {tab === "koneksi" ? <SettingsClient embedded /> : null}

        {tab === "agen" ? (
          <div className={styles.agentGrid}>
            {AGENTS.map((agent) => (
              <div
                key={agent.key}
                className={styles.agentCard}
                style={{ background: agent.tint }}
                data-testid={`agent-card-${agent.key}`}
              >
                <span className={styles.agentName} style={{ color: agent.color }}>
                  {agent.key}
                </span>
                <span className={styles.agentRole}>{agent.role}</span>
                <label
                  className={styles.agentToggleRow}
                  title={
                    agent.alwaysActive
                      ? "Clara selalu aktif — tidak ada mekanisme nonaktifkan Clara di codebase ini."
                      : "Toggle aktif per-agent belum tersedia — tidak ada field/endpoint real untuk ini di codebase ini."
                  }
                >
                  <input type="checkbox" checked disabled />
                  <span>Aktif</span>
                </label>
              </div>
            ))}
            <p className={styles.agentHonestNote}>
              Toggle aktif per-agent belum tersedia secara real — hanya Mode Operasi tenant-wide
              (DEV/LIVE) dan Mode Operasi AI (Full Control/Approval) di tab Koneksi yang benar-benar
              mengubah perilaku agent. Detail konfigurasi per-agent (threshold, prompt override,
              skor) ada di halaman AI Improve.
            </p>
            <Link href="/self-improve" className={styles.linkButton}>
              Buka AI Improve untuk config detail →
            </Link>
          </div>
        ) : null}
      </div>
    </main>
  );
}

export default SettingsHubClient;
