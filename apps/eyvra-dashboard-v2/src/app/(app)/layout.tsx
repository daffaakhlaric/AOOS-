import { AppShell } from "@/components/layout/AppShell";

export default function AuthenticatedLayout({
  children,
}: {
  readonly children: React.ReactNode;
}): React.ReactElement {
  return <AppShell>{children}</AppShell>;
}
