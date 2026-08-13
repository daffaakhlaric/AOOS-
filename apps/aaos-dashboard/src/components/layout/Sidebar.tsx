"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Overview", icon: "🎯" },
  { href: "/meta-ads", label: "Data Iklan", icon: "📊" },
  { href: "/objective", label: "Objective", icon: "🎯" },
  { href: "/creative", label: "Creative Review", icon: "🎨" },
  { href: "/leads", label: "Leads", icon: "🔥" },
  { href: "/branches", label: "Branch Settings", icon: "⚙️" },
  { href: "/knowledge", label: "Knowledge Base", icon: "📚" },
  { href: "/simulator", label: "Simulator", icon: "🧪" },
] as const;

/** Desktop navigation sidebar (spec "components/layout/Sidebar.tsx") — hidden below `md`, where `MobileNav` takes over (spec "Mobile responsive"). */
export function Sidebar(): React.ReactElement {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Navigasi utama"
      className="hidden w-56 shrink-0 flex-col gap-1 border-r border-hairline bg-surface-card p-4 md:flex"
    >
      <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
        AAOS Dashboard
      </p>
      {NAV_ITEMS.map((item) => {
        const active = pathname === item.href || pathname?.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-2 rounded-button px-3 py-2 text-sm font-medium transition-colors ${
              active ? "bg-brand-primary/10 text-brand-primary" : "text-ink hover:bg-surface-page"
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

export { NAV_ITEMS };
