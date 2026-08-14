"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { NAV_ITEMS } from "./Sidebar";

/** Bottom tab bar for mobile viewports (spec "Mobile responsive (stacked layout)") — visible below `md`, where `Sidebar` is hidden. Shows the first 5 nav items to keep the bar from overflowing small screens. */
export function MobileNav(): React.ReactElement {
  const pathname = usePathname();
  const items = NAV_ITEMS.slice(0, 5);
  return (
    <nav
      aria-label="Navigasi mobile"
      className="fixed inset-x-0 bottom-0 z-10 flex justify-around border-t border-hairline-sidebar bg-surface-card py-2 md:hidden"
    >
      {items.map((item) => {
        const active = pathname === item.href || pathname?.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-col items-center gap-0.5 px-2 text-[11px] font-medium ${
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
