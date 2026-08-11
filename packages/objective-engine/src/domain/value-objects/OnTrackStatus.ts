/** The pacing verdict for an Objective's progress, computed by `DailyRunRateCalculator`'s ratio (spec: "On-Track Calculation"). */
export enum OnTrackStatus {
  ON_TRACK = "ON_TRACK",
  AT_RISK = "AT_RISK",
  OFF_TRACK = "OFF_TRACK",
}

/**
 * Classifies a pace ratio (`daily_run_rate_actual / daily_run_rate_needed`) into an
 * `OnTrackStatus` per the spec's exact thresholds:
 * `ON_TRACK >= onTrackThreshold` (default 0.85), `AT_RISK >= atRiskThreshold` (default 0.60),
 * else `OFF_TRACK`. Boundaries are inclusive on the upper status (ratio===0.85 → ON_TRACK,
 * ratio===0.60 → AT_RISK), matching the pinned business-correctness test
 * "on_track: ratio=0.84 → AT_RISK, ratio=0.85 → ON_TRACK".
 */
export function classifyOnTrackStatus(
  ratio: number,
  onTrackThreshold: number,
  atRiskThreshold: number,
): OnTrackStatus {
  if (ratio >= onTrackThreshold) {
    return OnTrackStatus.ON_TRACK;
  }
  if (ratio >= atRiskThreshold) {
    return OnTrackStatus.AT_RISK;
  }
  return OnTrackStatus.OFF_TRACK;
}
