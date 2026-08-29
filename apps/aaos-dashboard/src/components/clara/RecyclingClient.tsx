"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Badge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@tremor/react";

import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorCard } from "@/components/ui/ErrorCard";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { formatDateId, formatRelativeTimeId } from "@/lib/formatters";
import type { BroadcastLogDto, RecyclingPoolLeadDto, TemplateDto } from "@/types/dashboard.types";

import { BroadcastToLeadModal } from "./BroadcastToLeadModal";
import styles from "./RecyclingClient.module.css";
import { TemplateModal } from "./TemplateModal";

type Tab = "pool" | "templates" | "history";

const TEMPERATURE_BADGE_COLOR: Readonly<Record<string, "red" | "amber" | "gray">> = {
  HOT: "red",
  WARM: "amber",
  COLD: "gray",
};

function isToday(iso: string, now: Date): boolean {
  const d = new Date(iso);
  return (
    d.getUTCFullYear() === now.getUTCFullYear() &&
    d.getUTCMonth() === now.getUTCMonth() &&
    d.getUTCDate() === now.getUTCDate()
  );
}

/**
 * `/clara/recycling` — daur ulang COLD/WARM leads via broadcast promo (AAOS-LEAD-RECYCLING-
 * BROADCAST). 3 tabs (Recycling Pool / Template Broadcast / Riwayat Broadcast) + Auto Mode toggle
 * + KPI strip, all backed by `aaos-api`'s real `recycling` module via this app's own
 * `/api/recycling/*` proxy routes (never a second, client-composed backend).
 *
 * TAB 3's "Hasil" column shows the lead's real, current status/temperature and `convertedToHot`
 * flag ONLY — coordinator note section 9's explicit "never claim automatic re-qualification"
 * decision. A reply is shown honestly as "Dibalas — lanjutkan manual", never a fabricated "🔥HOT".
 */
export function RecyclingClient(): React.ReactElement {
  const [tab, setTab] = useState<Tab>("pool");
  const [pool, setPool] = useState<readonly RecyclingPoolLeadDto[] | undefined>(undefined);
  const [templates, setTemplates] = useState<readonly TemplateDto[] | undefined>(undefined);
  const [logs, setLogs] = useState<readonly BroadcastLogDto[] | undefined>(undefined);
  const [autoMode, setAutoMode] = useState<boolean | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);
  const [broadcastingLead, setBroadcastingLead] = useState<RecyclingPoolLeadDto | undefined>(
    undefined,
  );
  const [templateModal, setTemplateModal] = useState<
    { readonly editing: TemplateDto | undefined } | undefined
  >(undefined);
  const [sendingAll, setSendingAll] = useState(false);
  const [bulkResultSummary, setBulkResultSummary] = useState<string | undefined>(undefined);

  const loadPool = useCallback(() => {
    fetch("/api/recycling/pool")
      .then(async (res) => {
        if (!res.ok) {
          throw new Error("Gagal memuat recycling pool.");
        }
        return (await res.json()) as { leads: readonly RecyclingPoolLeadDto[] };
      })
      .then((body) => setPool(body.leads))
      .catch((caught: unknown) => {
        setError(caught instanceof Error ? caught.message : "Gagal memuat recycling pool.");
      });
  }, []);

  const loadTemplates = useCallback(() => {
    fetch("/api/recycling/templates")
      .then(async (res) => {
        if (!res.ok) {
          throw new Error("Gagal memuat template.");
        }
        return (await res.json()) as { templates: readonly TemplateDto[] };
      })
      .then((body) => setTemplates(body.templates))
      .catch((caught: unknown) => {
        setError(caught instanceof Error ? caught.message : "Gagal memuat template.");
      });
  }, []);

  const loadLogs = useCallback(() => {
    fetch("/api/recycling/logs?limit=200")
      .then(async (res) => {
        if (!res.ok) {
          throw new Error("Gagal memuat riwayat broadcast.");
        }
        return (await res.json()) as { logs: readonly BroadcastLogDto[] };
      })
      .then((body) => setLogs(body.logs))
      .catch((caught: unknown) => {
        setError(caught instanceof Error ? caught.message : "Gagal memuat riwayat broadcast.");
      });
  }, []);

  const loadAutoMode = useCallback(() => {
    fetch("/api/recycling/auto-mode")
      .then(async (res) => {
        if (!res.ok) {
          return;
        }
        const body = (await res.json()) as { autoMode: boolean };
        setAutoMode(body.autoMode);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    loadPool();
    loadTemplates();
    loadLogs();
    loadAutoMode();
  }, [loadPool, loadTemplates, loadLogs, loadAutoMode]);

  async function handleToggleAutoMode(): Promise<void> {
    if (autoMode === undefined) {
      return;
    }
    const next = !autoMode;
    setAutoMode(next); // optimistic
    try {
      const response = await fetch("/api/recycling/auto-mode", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ autoMode: next }),
      });
      if (!response.ok) {
        setAutoMode(!next); // revert on failure
      }
    } catch {
      setAutoMode(!next);
    }
  }

  async function handleBroadcastAll(): Promise<void> {
    setSendingAll(true);
    setBulkResultSummary(undefined);
    try {
      const response = await fetch("/api/recycling/broadcast-all", { method: "POST" });
      if (response.ok) {
        const body = (await response.json()) as {
          attempted: number;
          sent: readonly unknown[];
          failed: readonly unknown[];
        };
        setBulkResultSummary(
          `${body.sent.length}/${body.attempted} broadcast terkirim` +
            (body.failed.length > 0 ? ` · ${body.failed.length} gagal` : ""),
        );
        loadPool();
        loadLogs();
        loadTemplates();
      } else {
        setBulkResultSummary("Gagal mengirim broadcast massal.");
      }
    } finally {
      setSendingAll(false);
    }
  }

  const now = useMemo(() => new Date(), []);
  const kpi = useMemo(() => {
    const poolLeads = pool ?? [];
    const warm = poolLeads.filter((l) => l.status === "WARM").length;
    const cold = poolLeads.filter((l) => l.status === "COLD").length;
    const readyCount = poolLeads.filter((l) => l.readyToSend).length;
    const logRows = logs ?? [];
    const hotFromRecycling = logRows.filter((l) => l.convertedToHot).length;
    const broadcastToday = logRows.filter((l) => isToday(l.sentAt, now)).length;
    return {
      poolSize: poolLeads.length,
      warm,
      cold,
      readyCount,
      hotFromRecycling,
      broadcastToday,
    };
  }, [pool, logs, now]);

  const leadLookup = useMemo(() => {
    const map = new Map<string, RecyclingPoolLeadDto>();
    for (const lead of pool ?? []) {
      map.set(lead.id, lead);
    }
    return map;
  }, [pool]);

  if (error !== undefined) {
    return <ErrorCard message={error} />;
  }

  return (
    <div className={styles.page}>
      <div className={styles.headerRow}>
        <div>
          <h2 className={styles.title}>Lead Recycling</h2>
          <p className={styles.subtitle}>
            Daur ulang COLD &amp; WARM leads dengan broadcast promo otomatis
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={autoMode ?? false}
          aria-label="Auto Mode"
          onClick={() => void handleToggleAutoMode()}
          disabled={autoMode === undefined}
          className={autoMode === true ? styles.autoModeOn : styles.autoModeOff}
        >
          Auto Mode: {autoMode === undefined ? "…" : autoMode ? "ON ●" : "OFF ○"}
        </button>
      </div>

      <div className={styles.kpiStrip} data-testid="recycling-kpi-strip">
        <div className={styles.kpiCell}>
          <p className={styles.kpiLabel}>RECYCLING POOL</p>
          <p className={styles.kpiValue}>{kpi.poolSize}</p>
        </div>
        <div className={styles.kpiCell}>
          <p className={styles.kpiLabel}>WARM (3hr)</p>
          <p className={styles.kpiValue}>{kpi.warm}</p>
        </div>
        <div className={styles.kpiCell}>
          <p className={styles.kpiLabel}>COLD (7hr)</p>
          <p className={styles.kpiValue}>{kpi.cold}</p>
        </div>
        <div className={styles.kpiCell}>
          <p className={styles.kpiLabel}>BERHASIL HOT</p>
          <p className={styles.kpiValue}>{kpi.hotFromRecycling}</p>
        </div>
        <div className={styles.kpiCell}>
          <p className={styles.kpiLabel}>BROADCAST HARI INI</p>
          <p className={styles.kpiValue}>{kpi.broadcastToday}</p>
        </div>
      </div>

      <div className={styles.tabRow} role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "pool"}
          className={tab === "pool" ? styles.tabActive : styles.tab}
          onClick={() => setTab("pool")}
        >
          Recycling Pool
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "templates"}
          className={tab === "templates" ? styles.tabActive : styles.tab}
          onClick={() => setTab("templates")}
        >
          Template Broadcast
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "history"}
          className={tab === "history" ? styles.tabActive : styles.tab}
          onClick={() => setTab("history")}
        >
          Riwayat Broadcast
        </button>
      </div>

      {tab === "pool" ? (
        <div>
          {pool === undefined ? (
            <LoadingSpinner />
          ) : pool.length === 0 ? (
            <EmptyState
              icon="♻️"
              title="Recycling pool kosong"
              description="Belum ada lead COLD/WARM yang memenuhi kriteria recycling."
            />
          ) : (
            <>
              <div className={styles.poolActionsRow}>
                <button
                  type="button"
                  className={styles.primaryButton}
                  disabled={sendingAll || kpi.readyCount === 0}
                  onClick={() => void handleBroadcastAll()}
                >
                  {sendingAll
                    ? "Mengirim..."
                    : `📤 Broadcast ke Semua yang Siap (${kpi.readyCount})`}
                </button>
                {bulkResultSummary !== undefined ? (
                  <span className={styles.bulkResult}>{bulkResultSummary}</span>
                ) : null}
              </div>
              <div className={styles.tableWrap} data-testid="recycling-pool-table">
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableHeaderCell>Nama</TableHeaderCell>
                      <TableHeaderCell>Score</TableHeaderCell>
                      <TableHeaderCell>Status</TableHeaderCell>
                      <TableHeaderCell>Last Contact</TableHeaderCell>
                      <TableHeaderCell>Broadcast ke-</TableHeaderCell>
                      <TableHeaderCell>Aksi</TableHeaderCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {pool.map((lead) => (
                      <TableRow key={lead.id} data-testid="recycling-pool-row">
                        <TableCell>
                          {lead.leadName ?? lead.leadPhone}
                          <span className={styles.mutedCell}> · {lead.branchId}</span>
                        </TableCell>
                        <TableCell>{lead.score}/100</TableCell>
                        <TableCell>
                          <Badge color={TEMPERATURE_BADGE_COLOR[lead.status] ?? "gray"}>
                            {lead.status}
                          </Badge>
                        </TableCell>
                        <TableCell className={styles.mutedCell}>
                          {lead.lastMessageAt !== undefined
                            ? formatRelativeTimeId(lead.lastMessageAt)
                            : "—"}
                        </TableCell>
                        <TableCell>{lead.broadcastCount}/3</TableCell>
                        <TableCell>
                          {lead.readyToSend ? (
                            <button
                              type="button"
                              className={styles.sendButton}
                              onClick={() => setBroadcastingLead(lead)}
                            >
                              Kirim ▶
                            </button>
                          ) : (
                            <span className={styles.mutedCell}>Cooldown</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </div>
      ) : null}

      {tab === "templates" ? (
        <div>
          <div className={styles.poolActionsRow}>
            <button
              type="button"
              className={styles.primaryButton}
              onClick={() => setTemplateModal({ editing: undefined })}
            >
              + Buat Template Baru
            </button>
          </div>
          {templates === undefined ? (
            <LoadingSpinner />
          ) : templates.length === 0 ? (
            <EmptyState
              icon="🏷"
              title="Belum ada template"
              description="Buat template broadcast pertama untuk mulai recycling."
            />
          ) : (
            <div className={styles.templateGrid} data-testid="template-grid">
              {templates.map((template) => (
                <div key={template.id} className={styles.templateCard} data-testid="template-card">
                  <div className={styles.templateHeader}>
                    <span className={styles.templateName}>🏷 {template.name}</span>
                    <span className={styles.templateMeta}>{template.status}</span>
                  </div>
                  <p className={styles.templateTarget}>
                    Target: {template.targetStatuses.join(" + ")} · Cooldown:{" "}
                    {template.cooldownDays} hari
                  </p>
                  <p className={styles.templateContent}>{template.content}</p>
                  <p className={styles.templateStats}>
                    Terkirim: {template.sentCount} kali · Reply rate: {template.replyRate}% ·
                    Konversi HOT: {template.hotRate}%
                  </p>
                  <div className={styles.templateActions}>
                    <button
                      type="button"
                      className={styles.linkButton}
                      onClick={() => setTemplateModal({ editing: template })}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className={styles.linkButton}
                      onClick={async () => {
                        const response = await fetch(`/api/recycling/templates/${template.id}`, {
                          method: "PUT",
                          headers: { "content-type": "application/json" },
                          body: JSON.stringify({
                            status: template.status === "ACTIVE" ? "INACTIVE" : "ACTIVE",
                          }),
                        });
                        if (response.ok) {
                          loadTemplates();
                        }
                      }}
                    >
                      {template.status === "ACTIVE" ? "Nonaktif" : "Aktifkan"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {tab === "history" ? (
        <div>
          {logs === undefined ? (
            <LoadingSpinner />
          ) : logs.length === 0 ? (
            <EmptyState
              icon="📋"
              title="Belum ada riwayat broadcast"
              description="Broadcast yang terkirim akan muncul di sini."
            />
          ) : (
            <>
              <p className={styles.historySummary}>
                Terkirim: {logs.length} · Dibalas: {logs.filter((l) => l.replied).length} · Konversi
                HOT: {logs.filter((l) => l.convertedToHot).length}
              </p>
              <div className={styles.tableWrap} data-testid="recycling-history-table">
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableHeaderCell>Tgl</TableHeaderCell>
                      <TableHeaderCell>Lead</TableHeaderCell>
                      <TableHeaderCell>Status</TableHeaderCell>
                      <TableHeaderCell>Reply</TableHeaderCell>
                      <TableHeaderCell>Hasil</TableHeaderCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {logs.map((log) => {
                      const lead = leadLookup.get(log.leadId);
                      return (
                        <TableRow key={log.id} data-testid="recycling-history-row">
                          <TableCell className={styles.mutedCell}>
                            {formatDateId(log.sentAt)}
                          </TableCell>
                          <TableCell>{lead?.leadName ?? lead?.leadPhone ?? log.leadId}</TableCell>
                          <TableCell>{log.status}</TableCell>
                          <TableCell>{log.replied ? "✅ Ya" : "❌ Tidak"}</TableCell>
                          <TableCell>
                            {log.convertedToHot
                              ? "🔥 HOT"
                              : log.replied
                                ? "Dibalas — lanjutkan manual"
                                : (lead?.status ?? "—")}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </div>
      ) : null}

      {broadcastingLead !== undefined ? (
        <BroadcastToLeadModal
          lead={broadcastingLead}
          templates={(templates ?? []).filter(
            (t) => t.status === "ACTIVE" && t.targetStatuses.includes(broadcastingLead.status),
          )}
          onClose={() => setBroadcastingLead(undefined)}
          onSent={() => {
            setBroadcastingLead(undefined);
            loadPool();
            loadLogs();
            loadTemplates();
          }}
        />
      ) : null}

      {templateModal !== undefined ? (
        <TemplateModal
          editing={templateModal.editing}
          onClose={() => setTemplateModal(undefined)}
          onSaved={() => {
            setTemplateModal(undefined);
            loadTemplates();
          }}
        />
      ) : null}
    </div>
  );
}
