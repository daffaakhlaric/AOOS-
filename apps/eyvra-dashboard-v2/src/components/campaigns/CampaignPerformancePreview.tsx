import type { HistoryPoint } from "@/lib/campaigns";
import { formatIdrCompact } from "@/lib/formatters";
import styles from "./CampaignTabs.module.css";

export function CampaignPerformancePreview({
  points,
  events,
}: {
  points: HistoryPoint[];
  events: { date: string; label: string }[];
}) {
  if (points.length < 2)
    return (
      <p className={styles.empty}>
        Samantha sedang mengumpulkan data delivery. Minimal dua snapshot diperlukan untuk grafik.
      </p>
    );
  const maxSpend = Math.max(1, ...points.map((p) => p.spend));
  const maxLeads = Math.max(1, ...points.map((p) => p.leads));
  const x = (i: number) => 72 + (i / (points.length - 1)) * 560;
  return (
    <>
      <p className={styles.muted}>
        ▥ Spend (Rp, kiri) · <span style={{ color: "var(--info)" }}>● Leads (kanan)</span> · CPQL
        belum tersedia
      </p>
      <svg
        viewBox="0 0 710 240"
        className={styles.chart}
        role="img"
        aria-label="Performance: spend dan leads harian"
      >
        {[0, 0.5, 1].map((v) => (
          <g key={v}>
            <line x1="62" x2="644" y1={195 - v * 155} y2={195 - v * 155} stroke="var(--border)" />
            <text x="0" y={199 - v * 155}>
              {formatIdrCompact(v * maxSpend)}
            </text>
            <text x="654" y={199 - v * 155}>
              {Math.round(v * maxLeads)}
            </text>
          </g>
        ))}
        {points.map((p, i) => (
          <rect
            key={p.date}
            x={x(i) - Math.min(11, 220 / points.length)}
            y={195 - (p.spend / maxSpend) * 155}
            width={Math.min(22, 440 / points.length)}
            height={(p.spend / maxSpend) * 155}
            fill="var(--primary-cyan)"
            opacity=".65"
          >
            <title>
              {p.date}: Spend {formatIdrCompact(p.spend)}
            </title>
          </rect>
        ))}
        <polyline
          points={points.map((p, i) => `${x(i)},${195 - (p.leads / maxLeads) * 155}`).join(" ")}
          fill="none"
          stroke="var(--info)"
          strokeWidth="2"
        />
        {points.map((p, i) => (
          <circle
            key={p.date}
            cx={x(i)}
            cy={195 - (p.leads / maxLeads) * 155}
            r="3"
            fill="var(--info)"
          >
            <title>
              {p.date}: {p.leads} leads
            </title>
          </circle>
        ))}
        {events.map((event, i) => {
          const index = points.findIndex((p) => p.date.slice(0, 10) === event.date.slice(0, 10));
          return index < 0 ? null : (
            <line
              key={i}
              x1={x(index)}
              x2={x(index)}
              y1="25"
              y2="195"
              stroke="var(--brand)"
              strokeDasharray="4 4"
            >
              <title>{event.label}</title>
            </line>
          );
        })}
        <text x="62" y="226">
          {points[0]?.date}
        </text>
        <text x="560" y="226">
          {points.at(-1)?.date}
        </text>
      </svg>
    </>
  );
}
