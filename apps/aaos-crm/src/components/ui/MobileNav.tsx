"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export interface NavItem {
  readonly href: string;
  readonly label: string;
  readonly icon: string;
}

/**
 * AAOS-SALES-MGMT-CRM-AUTH: `/leads` (Hot Leads) is retired in favor of `/inbox` (the new primary
 * conversation entry point, coordinator note #2 — `/leads` now 308-redirects there via
 * `middleware.ts`), and `/profile` (Part 8, genuinely new) is added. A bottom bar realistically
 * holds 4-5 slots before labels start truncating on a real phone width, so this is a considered
 * swap, not a straight addition: "Hot Leads" 🔥 is replaced by "Inbox" 💬 (same primary-entry-point
 * role, now conversation-first instead of hot-leads-list-first) and "Profile" 👤 is appended as the
 * 5th slot. `my-leads`/`closing`/`stats` are UNCHANGED (coordinator note #2's explicit scope).
 */
export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/inbox", label: "Inbox", icon: "💬" },
  { href: "/my-leads", label: "Leads Saya", icon: "📋" },
  { href: "/closing", label: "Closing", icon: "✅" },
  { href: "/stats", label: "Statistik", icon: "📊" },
  { href: "/profile", label: "Profile", icon: "👤" },
];

/** Bottom tab bar — visible below the `md` breakpoint only; `CrmSidebar` takes over at `md` and up (AAOS-SALES-MGMT-CRM-AUTH — this app gained a real desktop sidebar, see `CrmSidebar.tsx`'s docstring for why). */
export function MobileNav(): React.ReactElement {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Navigasi utama"
      className="fixed inset-x-0 bottom-0 z-10 flex justify-around border-t border-hairline bg-surface-card py-2 md:hidden"
    >
      {NAV_ITEMS.map((item) => {
        const active = pathname === item.href || pathname?.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-col items-center gap-0.5 px-3 text-[11px] font-medium ${
              active ? "text-brand-primary" : "text-ink-muted"
            }`}
            aria-current={active ? "page" : undefined}
          >
            <span aria-hidden="true">{item.icon}</span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
