import { Sidebar } from "@/components/layout/Sidebar";
import { MobileNav } from "@/components/layout/MobileNav";

/**
 * Layout for every authenticated route (`/dashboard`, `/meta-ads`, `/objective`, `/creative`,
 * `/leads`, `/branches`, `/knowledge`, `/simulator`) — adds the desktop `Sidebar` and mobile
 * bottom nav around the page content. Deliberately excludes `(auth)/login`, a sibling route
 * group: the login page should render as a bare centered form with no app chrome.
 */
export default function AppLayout({
  children,
}: {
  readonly children: React.ReactNode;
}): React.ReactElement {
  return (
    <>
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex-1 pb-16 md:pb-0">{children}</div>
      </div>
      <MobileNav />
    </>
  );
}
