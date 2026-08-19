"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";

import { createSupabaseBrowserClient } from "@/lib/supabase";
import { useSalesSession } from "@/lib/session";
import type { SalesHumanAccountDto } from "@/types/crm.types";

import { NAV_ITEMS } from "@/components/ui/MobileNav";

const STATUS_DOT: Readonly<Record<SalesHumanAccountDto["status"], string>> = {
  ON: "🟢",
  BUSY: "🟡",
  OFF: "⚫",
};

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

/**
 * Desktop sidebar (AAOS-SALES-MGMT-CRM-AUTH) — this app was mobile-only before this task (verified:
 * `RootLayout` rendered only `MobileNav`'s bottom bar, no desktop nav existed anywhere). Built as
 * NEW work per the coordinator note's explicit instruction, matching `apps/aaos-dashboard`'s real
 * `Sidebar`/`MobileNav` coexistence pattern: this renders `hidden md:flex` (desktop and up only),
 * `MobileNav` stays exactly as-is below `md`. The 3-panel `/inbox` in particular needs the desktop
 * width real estate a bottom tab bar can't provide.
 *
 * Reuses `MobileNav`'s real `NAV_ITEMS` (Inbox/Leads Saya/Closing/Statistik/Profile) rather than a
 * second, hand-duplicated menu list — one source of truth for "what pages this app has".
 */
export function CrmSidebar(): React.ReactElement {
  const { session } = useSalesSession();
  const pathname = usePathname();
  const router = useRouter();
  const [account, setAccount] = useState<SalesHumanAccountDto | undefined>(undefined);

  useEffect(() => {
    if (session === undefined) {
      return;
    }
    fetch(`/api/sales-humans/${encodeURIComponent(session.salesHumanId)}`)
      .then(async (res) => (res.ok ? ((await res.json()) as SalesHumanAccountDto) : undefined))
      .then(setAccount)
      .catch(() => undefined);
  }, [session]);

  async function handleLogout(): Promise<void> {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  const displayName = account?.name ?? session?.email ?? "Sales Human";

  return (
    <aside className="hidden h-screen w-[200px] flex-shrink-0 flex-col border-r border-hairline bg-surface-card md:flex">
      <div className="flex items-center gap-2 border-b border-hairline px-3.5 py-3.5">
        <div className="flex h-6.5 w-6.5 items-center justify-center rounded-md bg-ink text-xs font-bold text-white">
          A
        </div>
        <span className="text-[13px] font-semibold text-ink">AAOS CRM</span>
      </div>

      <div className="flex items-center gap-2 border-b border-hairline px-3.5 py-3">
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-brand-primary/10 text-[13px] font-bold text-brand-primary">
          {initials(displayName)}
        </div>
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold text-ink">{displayName}</p>
          <p className="text-[10px] text-ink-muted">
            {session?.branchId ?? "—"} · {account !== undefined ? STATUS_DOT[account.status] : "⚫"}
          </p>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 p-2">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href || pathname?.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-2 rounded-button px-2 py-1.5 text-[13px] ${
                active
                  ? "bg-brand-primary/10 font-medium text-brand-primary"
                  : "text-ink-muted hover:text-ink"
              }`}
            >
              <span aria-hidden="true" className="w-4 text-center">
                {item.icon}
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-hairline p-3">
        <button
          type="button"
          onClick={() => void handleLogout()}
          className="w-full rounded-button border border-brand-danger/30 bg-brand-danger/5 py-1.5 text-xs font-semibold text-brand-danger"
        >
          Keluar
        </button>
      </div>
    </aside>
  );
}
