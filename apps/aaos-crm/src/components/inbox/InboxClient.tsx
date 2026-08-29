"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorCard } from "@/components/ui/ErrorCard";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { useSalesSession } from "@/lib/session";
import { subscribeToLeadChat } from "@/lib/realtime";
import type { LeadDetailDto, LeadDto, MessageDto, SalesHumanAccountDto } from "@/types/crm.types";

type InboxTab = "mine" | "all" | "unread";

/** Bounds the "Belum dibaca" unread-lookup fanout (one small `limit=1` request per lead) to a
 * sane number for a single-branch sales team — see the tab's docstring below for the full
 * rationale. */
const UNREAD_LOOKUP_CAP = 60;

function waLink(phone: string): string {
  return `https://wa.me/${phone.replace(/^\+/, "")}`;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return "?";
  }
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function bubbleClasses(message: MessageDto): string {
  const isLead = message.direction === "INCOMING";
  const base = "flex mb-3 max-w-[75%]";
  return isLead ? `${base} ml-0 mr-auto flex-row` : `${base} ml-auto mr-0 flex-row-reverse`;
}

function senderLabel(message: MessageDto, salesName: string): string {
  if (message.direction === "INCOMING") {
    return "Lead";
  }
  // "JESSY" is the pre-agent-rename legacy value — still real, still stored on old rows,
  // never written going forward (see crm.types.ts's MessageDto.senderType doc).
  if (message.senderType === "CLARA" || message.senderType === "JESSY") {
    return "Clara (AI)";
  }
  if (message.senderType === "MANAGER_INTERVENTION") {
    return `Clara (intervensi — ${message.senderName ?? "Manager"})`;
  }
  return message.senderName ?? salesName;
}

/**
 * `/inbox` (AAOS-SALES-MGMT-CRM-AUTH, coordinator note #2) — the new primary conversation entry
 * point, replacing `/leads`. 3-panel layout matching the spec's Part 7 mockup and closely mirroring
 * `apps/aaos-dashboard`'s `ClaraInboxClient.tsx` (same structural pattern, same real
 * `leads`-scoped `aaos-api` endpoints — `GET/POST /api/leads/:id/message`,
 * `GET /api/leads/:id/scoring-history` — no separate `/conversations` namespace), but scoped to
 * THIS signed-in sales human's own session (`useSalesSession()`) rather than a manager's global
 * view, and with no "Reply as Clara" toggle: every reply sent from here is a real sales human
 * reply (`sender_type = 'SALES_HUMAN'`) — this app never impersonates Clara.
 *
 * Tabs:
 *  - "Saya": `lead.assignedSalesId === session.salesHumanId`.
 *  - "Semua": every lead in the signed-in sales human's own branch (this app has no cross-branch
 *    visibility anywhere else either — RLS already scopes it that way).
 *  - "Belum dibaca": REAL signal, not fabricated — `messages.read_at` is a genuine column
 *    (`001_initial_schema.sql`) this app previously never read. A lead counts as unread when its
 *    latest message (`GET /api/leads/:id/messages?limit=1&order=desc`, reusing the real paginated
 *    endpoint from Chat Room Clara) is `direction === "INCOMING"` with `readAt === undefined`.
 *    Computed with one small bounded-fanout request per visible lead (capped at
 *    `UNREAD_LOOKUP_CAP` — a documented, deliberate MVP limit for a single-branch sales team's
 *    real lead volume, not a fabricated count) rather than a new bulk aggregate endpoint, keeping
 *    to the "reuse the real endpoint" discipline instead of inventing a new one.
 */
export function InboxClient(): React.ReactElement {
  const { session, loading: sessionLoading } = useSalesSession();
  const [account, setAccount] = useState<SalesHumanAccountDto | undefined>(undefined);
  const [leads, setLeads] = useState<readonly LeadDto[] | undefined>(undefined);
  const [leadsError, setLeadsError] = useState<string | undefined>(undefined);
  const [tab, setTab] = useState<InboxTab>("mine");
  const [search, setSearch] = useState("");
  const [unreadLeadIds, setUnreadLeadIds] = useState<ReadonlySet<string>>(new Set());
  const [selectedLeadId, setSelectedLeadId] = useState<string | undefined>(undefined);
  const [leadDetail, setLeadDetail] = useState<LeadDetailDto | undefined>(undefined);
  const [detailError, setDetailError] = useState<string | undefined>(undefined);
  const [draft, setDraft] = useState("");
  const [sendStatus, setSendStatus] = useState<"idle" | "sending" | "error">("idle");
  const [claimStatus, setClaimStatus] = useState<"idle" | "claiming" | "error">("idle");
  const seenMessageIds = useRef(new Set<string>());

  useEffect(() => {
    if (session === undefined) {
      return;
    }
    fetch(`/api/sales-humans/${encodeURIComponent(session.salesHumanId)}`)
      .then(async (res) => (res.ok ? ((await res.json()) as SalesHumanAccountDto) : undefined))
      .then(setAccount)
      .catch(() => undefined);
  }, [session]);

  useEffect(() => {
    if (session?.branchId === undefined) {
      return;
    }
    fetch(`/api/leads?branchId=${encodeURIComponent(session.branchId)}`)
      .then(async (res) => {
        if (!res.ok) {
          throw new Error("Gagal memuat daftar percakapan.");
        }
        return (await res.json()) as { leads: readonly LeadDto[] };
      })
      .then((body) => setLeads(body.leads))
      .catch((caught: unknown) => {
        setLeadsError(caught instanceof Error ? caught.message : "Gagal memuat daftar percakapan.");
      });
  }, [session?.branchId]);

  // Real "Belum dibaca" signal — see class docstring. Recomputes whenever the lead list changes.
  useEffect(() => {
    if (leads === undefined || leads.length === 0) {
      return;
    }
    let cancelled = false;
    const targets = leads.slice(0, UNREAD_LOOKUP_CAP);
    Promise.all(
      targets.map(async (lead) => {
        try {
          const res = await fetch(`/api/leads/${lead.id}/messages?limit=1&order=desc`);
          if (!res.ok) {
            return undefined;
          }
          const body = (await res.json()) as { messages: readonly MessageDto[] };
          const latest = body.messages[0];
          const unread =
            latest !== undefined && latest.direction === "INCOMING" && latest.readAt === undefined;
          return unread ? lead.id : undefined;
        } catch {
          return undefined;
        }
      }),
    )
      .then((results) => {
        if (!cancelled) {
          setUnreadLeadIds(new Set(results.filter((id): id is string => id !== undefined)));
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [leads]);

  const filteredLeads = useMemo(() => {
    if (leads === undefined || session === undefined) {
      return [];
    }
    const byTab = leads.filter((lead) => {
      if (tab === "mine") {
        return lead.assignedSalesId === session.salesHumanId;
      }
      if (tab === "unread") {
        return unreadLeadIds.has(lead.id);
      }
      return true;
    });
    const term = search.trim().toLowerCase();
    if (term.length === 0) {
      return byTab;
    }
    return byTab.filter(
      (lead) => (lead.leadName ?? "").toLowerCase().includes(term) || lead.leadPhone.includes(term),
    );
  }, [leads, tab, search, unreadLeadIds, session]);

  useEffect(() => {
    if (selectedLeadId === undefined) {
      setLeadDetail(undefined);
      return;
    }
    setLeadDetail(undefined);
    setDetailError(undefined);
    fetch(`/api/leads/${selectedLeadId}`)
      .then(async (res) => {
        if (!res.ok) {
          throw new Error("Gagal memuat percakapan.");
        }
        return (await res.json()) as LeadDetailDto;
      })
      .then((detail) => {
        seenMessageIds.current = new Set(detail.messages.map((m) => m.id));
        setLeadDetail(detail);
      })
      .catch((caught: unknown) => {
        setDetailError(caught instanceof Error ? caught.message : "Gagal memuat percakapan.");
      });
  }, [selectedLeadId]);

  useEffect(() => {
    if (selectedLeadId === undefined) {
      return;
    }
    const channel = subscribeToLeadChat(selectedLeadId, {
      onNewMessage: (message) => {
        if (seenMessageIds.current.has(message.id)) {
          return;
        }
        seenMessageIds.current.add(message.id);
        setLeadDetail((current) =>
          current === undefined
            ? current
            : { ...current, messages: [...current.messages, message] },
        );
      },
      onNewScoringEvent: () => undefined,
    });
    return () => {
      void channel.unsubscribe();
    };
  }, [selectedLeadId]);

  async function handleSend(): Promise<void> {
    if (leadDetail === undefined || session === undefined || draft.trim().length === 0) {
      return;
    }
    setSendStatus("sending");
    const text = draft.trim();
    try {
      const response = await fetch(`/api/leads/${leadDetail.id}/message`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          message: text,
          salesHumanId: session.salesHumanId,
          salesName: account?.name ?? session.email ?? "Sales",
        }),
      });
      if (!response.ok) {
        setSendStatus("error");
        return;
      }
      const sent = (await response.json()) as MessageDto;
      if (!seenMessageIds.current.has(sent.id)) {
        seenMessageIds.current.add(sent.id);
        setLeadDetail((current) =>
          current === undefined ? current : { ...current, messages: [...current.messages, sent] },
        );
      }
      setDraft("");
      setSendStatus("idle");
    } catch {
      setSendStatus("error");
    }
  }

  async function handleClaim(): Promise<void> {
    if (leadDetail === undefined || session === undefined) {
      return;
    }
    setClaimStatus("claiming");
    try {
      const response = await fetch(`/api/leads/${leadDetail.id}/claim`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ salesHumanId: session.salesHumanId }),
      });
      if (!response.ok) {
        setClaimStatus("error");
        return;
      }
      setLeadDetail((current) =>
        current === undefined ? current : { ...current, assignedSalesId: session.salesHumanId },
      );
      setLeads((current) =>
        current?.map((lead) =>
          lead.id === leadDetail.id ? { ...lead, assignedSalesId: session.salesHumanId } : lead,
        ),
      );
      setClaimStatus("idle");
    } catch {
      setClaimStatus("error");
    }
  }

  if (sessionLoading) {
    return <LoadingSpinner />;
  }
  if (session === undefined) {
    return <EmptyState title="Belum masuk" description="Silakan masuk untuk melihat inbox." />;
  }

  const botActive = leadDetail !== undefined && leadDetail.assignedSalesId === undefined;
  const salesName = account?.name ?? session.email ?? "Sales";

  return (
    <div className="flex h-screen flex-col md:h-full md:flex-row">
      {/* LEFT — conversation list */}
      <div className="flex w-full flex-col border-b border-hairline md:h-full md:w-[280px] md:flex-shrink-0 md:border-b-0 md:border-r">
        <div className="flex flex-col gap-2 border-b border-hairline p-3">
          <div className="flex gap-1" role="tablist">
            {(
              [
                ["mine", "Saya"],
                ["all", "Semua"],
                ["unread", "Belum dibaca"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={tab === value}
                onClick={() => setTab(value)}
                className={`rounded-button px-2.5 py-1 text-xs font-semibold ${
                  tab === value ? "bg-brand-primary text-white" : "bg-surface-page text-ink-muted"
                }`}
              >
                {label}
                {value === "unread" && unreadLeadIds.size > 0
                  ? ` (${String(unreadLeadIds.size)})`
                  : ""}
              </button>
            ))}
          </div>
          <input
            type="search"
            placeholder="Cari nama atau nomor..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Cari percakapan"
            className="w-full rounded-button border border-hairline px-2.5 py-1.5 text-xs text-ink"
          />
        </div>

        <div className="flex-1 overflow-y-auto" data-testid="conversation-list">
          {leadsError !== undefined ? (
            <ErrorCard message={leadsError} />
          ) : leads === undefined ? (
            <LoadingSpinner />
          ) : filteredLeads.length === 0 ? (
            <EmptyState
              title="Tidak ada percakapan"
              description={
                tab === "mine"
                  ? "Belum ada lead yang kamu tangani."
                  : tab === "unread"
                    ? "Tidak ada pesan yang belum dibaca."
                    : "Belum ada percakapan di cabang ini."
              }
            />
          ) : (
            filteredLeads.map((lead) => (
              <button
                key={lead.id}
                type="button"
                data-testid="conversation-row"
                onClick={() => setSelectedLeadId(lead.id)}
                className={`flex w-full items-start gap-2.5 border-b border-hairline/60 px-3.5 py-3 text-left ${
                  selectedLeadId === lead.id ? "bg-brand-primary/10" : "bg-transparent"
                }`}
              >
                <span
                  aria-hidden="true"
                  className="relative flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-surface-page text-xs font-semibold text-ink-muted"
                >
                  {initials(lead.leadName ?? lead.leadPhone)}
                  <span className="absolute -bottom-0 -right-0 h-2.5 w-2.5 rounded-full border-2 border-surface-card bg-brand-success" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span
                      className={`truncate text-[13px] ${
                        unreadLeadIds.has(lead.id)
                          ? "font-semibold text-ink"
                          : "font-medium text-ink"
                      }`}
                    >
                      {lead.leadName ?? lead.leadPhone}
                    </span>
                  </span>
                  <span className="flex items-center justify-between text-[11px] text-ink-muted">
                    <span className="truncate">
                      {lead.branchId} · {lead.temperature === "HOT" ? "🔥 HOT" : lead.temperature}
                    </span>
                    {unreadLeadIds.has(lead.id) ? (
                      <span
                        aria-label="Belum dibaca"
                        className="ml-2 h-2 w-2 flex-shrink-0 rounded-full bg-brand-primary"
                      />
                    ) : null}
                  </span>
                </span>
              </button>
            ))
          )}
        </div>
      </div>

      {/* MIDDLE — chat area */}
      <div className="flex min-h-0 flex-1 flex-col">
        {detailError !== undefined ? (
          <ErrorCard message={detailError} />
        ) : selectedLeadId === undefined ? (
          <EmptyState
            title="Pilih percakapan"
            description="Pilih lead di daftar untuk melihat chat."
          />
        ) : leadDetail === undefined ? (
          <LoadingSpinner />
        ) : (
          <>
            <div className="flex items-center justify-between border-b border-hairline px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-ink">
                  {leadDetail.leadName ?? leadDetail.leadPhone}
                </p>
                <a href={waLink(leadDetail.leadPhone)} className="text-xs text-brand-primary">
                  {leadDetail.leadPhone}
                </a>
              </div>
              {leadDetail.assignedSalesId === undefined ? (
                <button
                  type="button"
                  onClick={() => void handleClaim()}
                  disabled={claimStatus === "claiming"}
                  className="rounded-button bg-brand-primary px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                >
                  {claimStatus === "claiming" ? "Mengklaim..." : "Klaim Lead Ini"}
                </button>
              ) : null}
            </div>

            {botActive ? (
              <div
                data-testid="bot-active-banner"
                className="bg-brand-warning px-4 py-2 text-center text-xs text-white"
              >
                🤖 The bot is active
              </div>
            ) : null}

            <div className="flex-1 overflow-y-auto bg-surface-page p-4" data-testid="chat-timeline">
              {leadDetail.messages.length === 0 ? (
                <p className="text-xs text-ink-muted">Belum ada percakapan.</p>
              ) : (
                leadDetail.messages.map((message) => (
                  <div key={message.id} className={bubbleClasses(message)}>
                    <div>
                      <div className="mb-0.5 px-1 text-[10px] text-ink-muted">
                        {senderLabel(message, salesName)}
                      </div>
                      <div
                        className={`rounded-card px-3 py-2 text-[13px] ${
                          message.direction === "INCOMING"
                            ? "bg-surface-card"
                            : "bg-brand-primary/10 text-ink"
                        }`}
                      >
                        {message.body ?? `[${message.messageType}]`}
                      </div>
                      <div className="mt-0.5 px-1 text-[10px] text-ink-muted">
                        {formatTime(message.sentAt ?? message.createdAt)}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <form
              className="border-t border-hairline bg-surface-card p-3"
              onSubmit={(event) => {
                event.preventDefault();
                void handleSend();
              }}
            >
              <p className="mb-1.5 text-[11px] text-ink-muted">
                Membalas sebagai: <strong>{salesName}</strong>
              </p>
              <div className="flex items-end gap-2">
                <textarea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      void handleSend();
                    }
                  }}
                  placeholder="Ketik pesan..."
                  aria-label="Ketik pesan"
                  rows={1}
                  className="flex-1 resize-none rounded-button border border-hairline px-3 py-2 text-[13px]"
                />
                <button
                  type="submit"
                  disabled={sendStatus === "sending" || draft.trim().length === 0}
                  className="rounded-full bg-brand-primary px-4 py-2 text-xs font-semibold text-white disabled:bg-hairline"
                >
                  {sendStatus === "sending" ? "..." : "Kirim"}
                </button>
              </div>
              {sendStatus === "error" ? (
                <p data-testid="send-error" className="mt-1 text-xs text-brand-danger">
                  Gagal mengirim pesan. Coba lagi.
                </p>
              ) : null}
            </form>
          </>
        )}
      </div>

      {/* RIGHT — lead info */}
      {leadDetail !== undefined ? (
        <div className="hidden w-[280px] flex-shrink-0 overflow-y-auto border-l border-hairline bg-surface-card p-4 lg:block">
          <div className="mb-4 text-center">
            <div className="mx-auto mb-2 flex h-16 w-16 items-center justify-center rounded-full bg-surface-page text-2xl">
              👤
            </div>
            <p className="text-sm font-semibold text-ink">
              {leadDetail.leadName ?? leadDetail.leadPhone}
            </p>
          </div>

          <div
            className={`mb-3.5 rounded-button border p-3 text-center ${
              leadDetail.score >= 65
                ? "border-brand-success/30 bg-brand-success/10"
                : "border-brand-warning/30 bg-brand-warning/10"
            }`}
          >
            <p className="text-[10px] text-ink-muted">SCORE CLARA</p>
            <p
              className={`text-xl font-bold ${
                leadDetail.score >= 65 ? "text-brand-success" : "text-brand-warning"
              }`}
            >
              {leadDetail.score}/100
            </p>
            <p className="text-[11px] font-semibold text-ink-muted">{leadDetail.temperature}</p>
          </div>

          <dl className="flex flex-col gap-0">
            {[
              ["Contact ID", leadDetail.id.slice(0, 8)],
              ["Phone", leadDetail.leadPhone],
              ["Cabang", leadDetail.branchId],
              ["Status", leadDetail.status],
              ["Masuk", formatTime(leadDetail.createdAt)],
            ].map(([label, value]) => (
              <div
                key={label}
                className="flex items-center justify-between border-b border-hairline/60 py-1.5 text-xs"
              >
                <dt className="text-ink-muted">{label}</dt>
                <dd className="font-medium text-ink">{value}</dd>
              </div>
            ))}
          </dl>

          <Link
            href={`/closing/new?leadId=${leadDetail.id}`}
            className="mt-3.5 block rounded-button bg-brand-success py-2 text-center text-xs font-semibold text-white"
          >
            ✅ Input Closing
          </Link>
        </div>
      ) : null}
    </div>
  );
}
