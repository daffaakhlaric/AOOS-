import { formatPercent } from "@/lib/formatters";

export function computeRealDelta(
  points: readonly number[],
  higherIsBetter: boolean,
): { readonly label: string; readonly tone: "up" | "down" | "neutral" } | undefined {
  if (points.length < 2) {
    return undefined;
  }
  const first = points[0];
  const last = points[points.length - 1];
  if (first === undefined || last === undefined || first === 0) {
    return undefined;
  }
  const fraction = (last - first) / Math.abs(first);
  const sign = fraction >= 0 ? "+" : "-";
  const label = `${sign}${formatPercent(Math.abs(fraction))} vs awal periode`;
  const isImprovement = higherIsBetter ? fraction >= 0 : fraction <= 0;
  const tone = fraction === 0 ? "neutral" : isImprovement ? "up" : "down";
  return { label, tone };
}
