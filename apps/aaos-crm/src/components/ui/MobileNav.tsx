"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export interface NavItem {
  readonly href: string;
  readonly label: string;
  readonly icon: string;
}

export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/leads", label: "Hot Leads", icon: "🔥" },
  { href: "/my-leads", label: "Leads Saya", icon: "📋" },
  { href: "/closing", label: "Closing", icon: "✅" },
  { href: "/stats", label: "Statistik", icon: "📊" },
];

/** Bottom tab bar — this app is mobile-first, so the nav is always the bottom bar (spec "Mobile responsive (bottom nav)"), never a desktop sidebar. */
export function MobileNav(): React.ReactElement {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Navigasi utama"
      className="fixed inset-x-0 bottom-0 z-10 flex justify-around border-t border-hairline bg-surface-card py-2"
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
