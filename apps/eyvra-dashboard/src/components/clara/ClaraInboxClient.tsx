"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorCard } from "@/components/ui/ErrorCard";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { formatRelativeTimeId } from "@/lib/formatters";
import { subscribeToLeadChat } from "@/lib/realtime";
import type { BranchDto, LeadDetailDto, LeadDto, MessageDto } from "@/types/dashboard.types";

import styles from "./ClaraInboxClient.module.css";

type InboxTab = "human" | "bot";
type ReplyAs = "clara" | "sales";

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

function bubbleClass(message: MessageDto): string {
  if (message.direction === "INCOMING") {
    return `${styles.bubbleRow} ${styles.bubbleLead}`;
  }
  if (message.senderType === "SALES_HUMAN") {
    return `${styles.bubbleRow} ${styles.bubbleOutgoing} ${styles.bubbleSales}`;
  }
  if (message.senderType === "MANAGER_INTERVENTION") {
    return `${styles.bubbleRow} ${styles.bubbleOutgoing} ${styles.bubbleManager}`;
  }
  return `${styles.bubbleRow} ${styles.bubbleOutgoing} ${styles.bubbleClara}`;
}

function senderLabel(message: MessageDto): string {
  if (message.direction === "INCOMING") {
    return "Lead";
  }
  if (message.senderType === "SALES_HUMAN") {
    return message.senderName ?? "Sales";
  }
  if (message.senderType === "MANAGER_INTERVENTION") {
    return `🤖 Clara (intervensi — ${message.senderName ?? "Manager"})`;
  }
  return "🤖 Clara";
}

/**
 * `/clara/inbox` — 3-panel Chatwoot-style inbox: conversation list (280px) | chat area (flex-1) |
 * lead info (300px) (MENU RESTRUCTURE FINAL). Reuses the REAL, already-built `leads`-scoped
 * `aaos-api` endpoints from "Chat Room Clara" — a conversation belongs to exactly one lead in this
 * schema, so there is no separate `/conversations` namespace (coordinator note #2).
 *
 * Human/Bot tabs derive from `LeadDto.assignedSalesId`: present means an ACTIVE row in
 * `@aos/lead-store`'s `assignments` table exists for this lead (coordinator note #3) — this
 * domain has no "release an assignment" path yet, so `assignedSalesId !== undefined` is exactly
 * the real ACTIVE-assignment signal, the same one `LeadChatRoom`'s "Sales Assigned" card already
 * read from.
 *
 * Deliberately omits the spec mockup's Tags/Notes/Email/Local-time/Language/Country fields and the
 * 👤+/⚗ header icon buttons — none of them have any real backing data or endpoint in this domain,
 * and this codebase's convention (`DateRangeSelector.tsx`, `LeadChatRoom.tsx`'s own "Re-assign
 * Sales" disabled-button precedent) is to never render a fabricated feature. The 🔍 search IS
 * real — a client-side filter over the already-fetched lead list.
 */
export interface ClaraInboxClientProps {
  /**
   * `/clara/contacts` row clicks link here as `/clara/inbox?lead=<id>` (MENU RESTRUCTURE FINAL
   * coordinator note #4's "row click → detail" — this app has no separate contact detail page, so
   * a contact row opens straight into its real conversation instead of a fabricated detail view).
   * Read server-side by `page.tsx` from `searchParams` and passed down, never `useSearchParams`
   * client-side — avoids an unnecessary Suspense boundary for a value trivially available from
   * the Server Component's own props.
   */
  readonly initialLeadId?: string;
}

export function ClaraInboxClient({
  initialLeadId,
}: ClaraInboxClientProps = {}): React.ReactElement {
  const [leads, setLeads] = useState<readonly LeadDto[] | undefined>(undefined);
  const [branches, setBranches] = useState<readonly BranchDto[]>([]);
  const [leadsError, setLeadsError] = useState<string | undefined>(undefined);
  const [tab, setTab] = useState<InboxTab>("bot");
  const [search, setSearch] = useState("");
  const [branchFilter, setBranchFilter] = useState("all");
  const [salesFilter, setSalesFilter] = useState("all");
  const [selectedLeadId, setSelectedLeadId] = useState<string | undefined>(initialLeadId);
  const [leadDetail, setLeadDetail] = useState<LeadDetailDto | undefined>(undefined);
  const [detailError, setDetailError] = useState<string | undefined>(undefined);
  const [replyAs, setReplyAs] = useState<ReplyAs>("clara");
  const [draft, setDraft] = useState("");
  const [sendStatus, setSendStatus] = useState<"idle" | "sending" | "error">("idle");
  const [sendError, setSendError] = useState<string | undefined>(undefined);
  const [claimStatus, setClaimStatus] = useState<"idle" | "claiming" | "error">("idle");
  const seenMessageIds = useRef(new Set<string>());

  useEffect(() => {
    fetch("/api/leads")
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

    fetch("/api/branches")
      .then(async (res) =>
        res.ok ? ((await res.json()) as { branches: readonly BranchDto[] }) : { branches: [] },
      )
      .then((body) => setBranches(body.branches))
      .catch(() => undefined);
  }, []);

  const salesNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const branch of branches) {
      for (const sales of branch.team) {
        map.set(sales.id, sales.name);
      }
    }
    return map;
  }, [branches]);

  // Every sales human across every branch, deduped by id — the "Sales" filter (Human tab only)
  // and each row's assigned-sales tag both need to resolve a name from any branch's team, not just
  // the currently-selected branch filter's team.
  const allSales = useMemo(() => {
    const seen = new Map<string, string>();
    for (const branch of branches) {
      for (const sales of branch.team) {
        seen.set(sales.id, sales.name);
      }
    }
    return [...seen.entries()].map(([id, name]) => ({ id, name }));
  }, [branches]);

  const filteredLeads = useMemo(() => {
    if (leads === undefined) {
      return [];
    }
    const byTab = leads.filter((lead) =>
      tab === "human" ? lead.assignedSalesId !== undefined : lead.assignedSalesId === undefined,
    );
    const byBranch =
      branchFilter === "all" ? byTab : byTab.filter((lead) => lead.branchId === branchFilter);
    const bySales =
      tab === "human" && salesFilter !== "all"
        ? byBranch.filter((lead) => lead.assignedSalesId === salesFilter)
        : byBranch;
    const term = search.trim().toLowerCase();
    if (term.length === 0) {
      return bySales;
    }
    return bySales.filter(
      (lead) => (lead.leadName ?? "").toLowerCase().includes(term) || lead.leadPhone.includes(term),
    );
  }, [leads, tab, branchFilter, salesFilter, search]);

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
    if (leadDetail === undefined || draft.trim().length === 0) {
      return;
    }
    setSendStatus("sending");
    setSendError(undefined);
    const text = draft.trim();
    try {
      const endpoint =
        replyAs === "clara"
          ? `/api/leads/${leadDetail.id}/intervene`
          : `/api/leads/${leadDetail.id}/message`;
      const body =
        replyAs === "clara"
          ? { message: text }
          : {
              message: text,
              salesHumanId: leadDetail.assignedSalesId ?? "",
              salesName: salesNameById.get(leadDetail.assignedSalesId ?? "") ?? "Sales",
            };
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        setSendStatus("error");
        setSendError("Gagal mengirim pesan. Coba lagi.");
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
      setSendError("Gagal mengirim pesan. Coba lagi.");
    }
  }

  async function handleClaim(salesHumanId: string): Promise<void> {
    if (leadDetail === undefined || salesHumanId.length === 0) {
      return;
    }
    setClaimStatus("claiming");
    try {
      const response = await fetch(`/api/leads/${leadDetail.id}/claim`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ salesHumanId }),
      });
      if (!response.ok) {
        setClaimStatus("error");
        return;
      }
      setLeadDetail((current) =>
        current === undefined ? current : { ...current, assignedSalesId: salesHumanId },
      );
      setLeads((current) =>
        current?.map((lead) =>
          lead.id === leadDetail.id ? { ...lead, assignedSalesId: salesHumanId } : lead,
        ),
      );
      setClaimStatus("idle");
    } catch {
      setClaimStatus("error");
    }
  }

  const branchTeam = branches.find((b) => b.id === leadDetail?.branchId)?.team ?? [];
  const botActive = leadDetail !== undefined && leadDetail.assignedSalesId === undefined;

  return (
    <div className={styles.page}>
      {/* LEFT — conversation list */}
      <div className={styles.listPanel}>
        <div className={styles.listHeader}>
          <div className={styles.tabs}>
            <button
              type="button"
              className={`${styles.tab} ${tab === "human" ? styles.tabActive : ""}`}
              onClick={() => setTab("human")}
            >
              Human
            </button>
            <button
              type="button"
              className={`${styles.tab} ${tab === "bot" ? styles.tabActive : ""}`}
              onClick={() => {
                setTab("bot");
                setSalesFilter("all");
              }}
            >
              Bot
            </button>
          </div>
          <input
            type="search"
            placeholder="Cari nama atau nomor..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className={styles.searchInput}
            aria-label="Cari percakapan"
          />
          <select
            value={branchFilter}
            onChange={(event) => setBranchFilter(event.target.value)}
            className={styles.filterSelect}
            aria-label="Filter cabang"
          >
            <option value="all">Semua Cabang</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.displayName}
              </option>
            ))}
          </select>
          {tab === "human" ? (
            <select
              value={salesFilter}
              onChange={(event) => setSalesFilter(event.target.value)}
              className={styles.filterSelect}
              aria-label="Filter sales"
            >
              <option value="all">Semua Sales</option>
              {allSales.map((sales) => (
                <option key={sales.id} value={sales.id}>
                  {sales.name}
                </option>
              ))}
            </select>
          ) : null}
        </div>

        <div className={styles.list} data-testid="conversation-list">
          {leadsError !== undefined ? (
            <ErrorCard message={leadsError} />
          ) : leads === undefined ? (
            <LoadingSpinner />
          ) : filteredLeads.length === 0 ? (
            <EmptyState
              icon="💬"
              title="Tidak ada percakapan"
              description={
                tab === "human"
                  ? "Belum ada lead yang di-handoff ke sales."
                  : "Belum ada lead yang masih ditangani Clara."
              }
            />
          ) : (
            filteredLeads.map((lead) => (
              <button
                key={lead.id}
                type="button"
                data-testid="conversation-row"
                onClick={() => setSelectedLeadId(lead.id)}
                className={`${styles.row} ${selectedLeadId === lead.id ? styles.rowActive : ""}`}
              >
                <span aria-hidden="true" className={styles.avatar}>
                  {initials(lead.leadName ?? lead.leadPhone)}
                </span>
                <span className={styles.rowBody}>
                  <span className={styles.rowTop}>
                    <span className={styles.rowName}>{lead.leadName ?? lead.leadPhone}</span>
                    {lead.lastMessageAt !== undefined ? (
                      <span className={styles.rowTime}>
                        {formatRelativeTimeId(lead.lastMessageAt)}
                      </span>
                    ) : null}
                  </span>
                  <span className={styles.rowPreview}>
                    {lead.branchId} · {lead.temperature === "HOT" ? "🔥 HOT" : lead.temperature}
                  </span>
                  {tab === "human" && lead.assignedSalesId !== undefined ? (
                    <span className={styles.rowSalesTag}>
                      👤 {salesNameById.get(lead.assignedSalesId) ?? "Sales"}
                    </span>
                  ) : null}
                </span>
              </button>
            ))
          )}
        </div>
      </div>

      {/* MIDDLE — chat area */}
      <div className={styles.chatPanel}>
        {detailError !== undefined ? (
          <ErrorCard message={detailError} />
        ) : selectedLeadId === undefined ? (
          <EmptyState
            icon="👈"
            title="Pilih percakapan"
            description="Pilih lead di daftar sebelah kiri untuk melihat chat."
          />
        ) : leadDetail === undefined ? (
          <LoadingSpinner />
        ) : (
          <>
            <div className={styles.chatHeader}>
              <div>
                <p className={styles.chatHeaderName}>
                  {leadDetail.leadName ?? leadDetail.leadPhone}
                </p>
                <label className={styles.assignRow}>
                  Assign Conversation:
                  <select
                    value={leadDetail.assignedSalesId ?? ""}
                    onChange={(event) => void handleClaim(event.target.value)}
                    disabled={
                      claimStatus === "claiming" || leadDetail.assignedSalesId !== undefined
                    }
                    className={styles.assignSelect}
                  >
                    <option value="">Belum ditugaskan</option>
                    {branchTeam.map((sales) => (
                      <option key={sales.id} value={sales.id}>
                        {sales.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <a
                href={waLink(leadDetail.leadPhone)}
                target="_blank"
                rel="noreferrer"
                className={styles.callLink}
              >
                📞
              </a>
            </div>

            {botActive ? (
              <div className={styles.botBanner} data-testid="bot-active-banner">
                🤖 The bot is active
              </div>
            ) : null}

            <div className={styles.timeline} data-testid="chat-timeline">
              {leadDetail.messages.length === 0 ? (
                <p data-testid="chat-empty">Belum ada percakapan.</p>
              ) : (
                leadDetail.messages.map((message) => (
                  <div key={message.id} className={bubbleClass(message)}>
                    <div>
                      <div className={styles.senderLabel}>{senderLabel(message)}</div>
                      <div className={styles.bubble}>
                        {message.body ?? `[${message.messageType}]`}
                      </div>
                      <div className={styles.timestamp}>
                        {formatTime(message.sentAt ?? message.createdAt)}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <form
              className={styles.inputForm}
              onSubmit={(event) => {
                event.preventDefault();
                void handleSend();
              }}
            >
              <div className={styles.replyAsRow}>
                <label>
                  Reply as:
                  <select
                    value={replyAs}
                    onChange={(event) => setReplyAs(event.target.value as ReplyAs)}
                    className={styles.replyAsSelect}
                  >
                    <option value="clara">Clara</option>
                    <option value="sales" disabled={leadDetail.assignedSalesId === undefined}>
                      Sales Human
                    </option>
                  </select>
                </label>
              </div>
              <div className={styles.inputRow}>
                <textarea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder="Ketik pesan..."
                  className={styles.textarea}
                  aria-label="Ketik pesan"
                />
                <button
                  type="submit"
                  disabled={sendStatus === "sending" || draft.trim().length === 0}
                  className={styles.sendButton}
                >
                  {sendStatus === "sending" ? "Mengirim..." : "Kirim"}
                </button>
              </div>
              {sendStatus === "error" && sendError !== undefined ? (
                <span data-testid="send-error" className={styles.errorLine}>
                  {sendError}
                </span>
              ) : null}
            </form>
          </>
        )}
      </div>

      {/* RIGHT — lead info */}
      <div className={styles.infoPanel}>
        {leadDetail === undefined ? null : (
          <>
            <div className={styles.infoAvatarWrap}>
              <span aria-hidden="true" className={styles.infoAvatar}>
                {initials(leadDetail.leadName ?? leadDetail.leadPhone)}
              </span>
              <p className={styles.infoName}>{leadDetail.leadName ?? leadDetail.leadPhone}</p>
            </div>
            <dl className={styles.infoList}>
              <div className={styles.infoRow}>
                <dt>Contact ID</dt>
                <dd>{leadDetail.id}</dd>
              </div>
              <div className={styles.infoRow}>
                <dt>Phone</dt>
                <dd>
                  <a href={waLink(leadDetail.leadPhone)} target="_blank" rel="noreferrer">
                    {leadDetail.leadPhone}
                  </a>
                </dd>
              </div>
              <div className={styles.infoRow}>
                <dt>Cabang</dt>
                <dd>{leadDetail.branchId}</dd>
              </div>
              <div className={styles.infoRow}>
                <dt>Status</dt>
                <dd>{leadDetail.temperature === "HOT" ? "🔥 HOT" : leadDetail.temperature}</dd>
              </div>
              <div className={styles.infoRow}>
                <dt>Score</dt>
                <dd>{leadDetail.score}/100</dd>
              </div>
              <div className={styles.infoRow}>
                <dt>Masuk</dt>
                <dd>{formatTime(leadDetail.createdAt)}</dd>
              </div>
            </dl>
          </>
        )}
      </div>
    </div>
  );
}
