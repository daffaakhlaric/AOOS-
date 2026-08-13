import { formatIdrCompact, formatNumber } from "@/lib/formatters";
import type { SalesStatsDto } from "@/types/crm.types";

export interface PersonalStatsCardProps {
  readonly stats: SalesStatsDto;
}

/** 4 KPI tiles (spec mockup "Leads / Test Drive / SPK / Komisi"). Komisi is formatted as IDR (spec's own pinned test "komisi formatted as IDR"). */
export function PersonalStatsCard({ stats }: PersonalStatsCardProps): React.ReactElement {
  const tiles = [
    { label: "Leads Hari Ini", value: formatNumber(stats.leadsToday) },
    { label: "Test Drive Bulan Ini", value: formatNumber(stats.testDriveThisMonth) },
    { label: "SPK Bulan Ini", value: formatNumber(stats.spkThisMonth) },
    { label: "Komisi Bulan Ini", value: formatIdrCompact(stats.commissionThisMonthIdr) },
  ];
  return (
    <div data-testid="personal-stats-card" className="grid grid-cols-2 gap-3">
      {tiles.map((tile) => (
        <div
          key={tile.label}
          className="rounded-card border border-hairline bg-surface-card p-3 shadow-card"
        >
          <p className="text-xs text-ink-muted">{tile.label}</p>
          <p className="mt-1 text-xl font-semibold text-ink">{tile.value}</p>
        </div>
      ))}
    </div>
  );
}
