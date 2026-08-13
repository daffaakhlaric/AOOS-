"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { ErrorCard } from "@/components/ui/ErrorCard";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import type { LeadDetailDto } from "@/types/crm.types";

import { ConversationHistory } from "./ConversationHistory";
import { LeadStatusBadge } from "./LeadStatusBadge";
import { QualificationBadges } from "./QualificationBadges";

export interface LeadDetailProps {
  readonly leadId: string;
}

/** WA Langsung link — `+6281234567890` -> `https://wa.me/6281234567890`. */
function waLink(phone: string): string {
  return `https://wa.me/${phone.replace(/^\+/, "")}`;
}

/**
 * Full lead info + REAL conversation history (spec "leads/[leadId]/page.tsx"). Coordinator note
 * #2: this page deliberately shows only real, honest data — `Lead`'s boolean qualification flags
 * (not fabricated "Budget: Rp 200 juta" text) and the real per-message conversation thread. There
 * is no "Ringkasan Jessy" prose-summary section — `@aos/lead-store` persists no such field
 * anywhere, so a placeholder-looking summary would not be backed by real data.
 */
export function LeadDetail({ leadId }: LeadDetailProps): React.ReactElement {
  const [lead, setLead] = useState<LeadDetailDto | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    fetch(`/api/leads/${leadId}`)
      .then(async (res) => {
        if (!res.ok) {
          throw new Error("Gagal memuat detail lead.");
        }
        return (await res.json()) as LeadDetailDto;
      })
      .then(setLead)
      .catch((caught: unknown) => {
        setError(caught instanceof Error ? caught.message : "Gagal memuat detail lead.");
      });
  }, [leadId]);

  if (error !== undefined) {
    return <ErrorCard message={error} />;
  }
  if (lead === undefined) {
    return <LoadingSpinner />;
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-ink">{lead.leadName ?? lead.leadPhone}</h1>
        <LeadStatusBadge status={lead.status} />
      </div>

      <section className="rounded-card border border-hairline bg-surface-card p-4 shadow-card">
        <h2 className="text-sm font-semibold text-ink">📋 Info Lead</h2>
        <dl className="mt-2 flex flex-col gap-1 text-sm">
          <div className="flex justify-between">
            <dt className="text-ink-muted">WA</dt>
            <dd>
              {lead.leadPhone}{" "}
              <a
                href={waLink(lead.leadPhone)}
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-brand-primary"
              >
                💬 WA Langsung
              </a>
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-muted">Cabang</dt>
            <dd>{lead.branchId}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-muted">Skor</dt>
            <dd>{lead.score}/100</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-muted">Temperature</dt>
            <dd>{lead.temperature}</dd>
          </div>
        </dl>
        <div className="mt-3">
          <p className="text-xs font-semibold text-ink-muted">Kriteria Terpenuhi</p>
          <div className="mt-1">
            <QualificationBadges qualification={lead.qualification} />
          </div>
        </div>
      </section>

      <section className="rounded-card border border-hairline bg-surface-card p-4 shadow-card">
        <h2 className="text-sm font-semibold text-ink">📱 Riwayat Percakapan</h2>
        <div className="mt-2">
          <ConversationHistory messages={lead.messages} />
        </div>
      </section>

      <div className="flex gap-2">
        <a
          href={waLink(lead.leadPhone)}
          target="_blank"
          rel="noreferrer"
          className="flex-1 rounded-button bg-brand-primary px-4 py-2 text-center text-sm font-semibold text-white"
        >
          📞 Hubungi Sekarang
        </a>
        <Link
          href={`/closing/new?leadId=${lead.id}`}
          className="flex-1 rounded-button border border-brand-primary px-4 py-2 text-center text-sm font-semibold text-brand-primary"
        >
          ✅ Input Closing
        </Link>
      </div>
    </div>
  );
}
