import { notFound } from "next/navigation";
import { SamanthaOverview } from "@/components/samantha/SamanthaOverview";
export default function Page({ params }: { params: { section: string } }) {
  if (!["decisions", "creative-intelligence", "audit", "chat", "settings"].includes(params.section))
    notFound();
  return <SamanthaOverview section={params.section} />;
}
