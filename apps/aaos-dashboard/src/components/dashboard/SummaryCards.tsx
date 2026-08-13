import { MetricCard } from "@/components/ui/MetricCard";
import { formatIdrCompact, formatNumber } from "@/lib/formatters";

export interface SummaryCardsData {
  readonly spend: number;
  readonly spendChangePercent: number;
  readonly d3Leads: number;
  readonly d3ChangePercent: number;
  readonly hotLeads: number;
  readonly hotLeadsChangePercent: number;
  readonly closings: number;
  readonly closingsChangePercent: number;
}

/** The 4 "Overview Bulan Ini" KPI cards (spec "dashboard/page.tsx" mockup): Belanja, D3 Lead, Hot Lead, Closing. */
export function SummaryCards({ data }: { readonly data: SummaryCardsData }): React.ReactElement {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <MetricCard
        label="Belanja"
        value={formatIdrCompact(data.spend)}
        changePercent={data.spendChangePercent}
      />
      <MetricCard
        label="D3 Lead"
        value={formatNumber(data.d3Leads)}
        changePercent={data.d3ChangePercent}
      />
      <MetricCard
        label="Hot Lead"
        value={formatNumber(data.hotLeads)}
        changePercent={data.hotLeadsChangePercent}
      />
      <MetricCard
        label="Closing"
        value={formatNumber(data.closings)}
        changePercent={data.closingsChangePercent}
      />
    </div>
  );
}
