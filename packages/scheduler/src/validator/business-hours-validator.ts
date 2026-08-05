import type { BusinessHoursConfig } from "../contracts/business-hours.js";

import type { ValidationResult } from "./i-job-validator.js";

function toMinutes(hhmm: string): number {
  const [hourText, minuteText] = hhmm.split(":");
  return Number(hourText) * 60 + Number(minuteText);
}

/**
 * Business Hour Validation — checks a `BusinessHoursConfig` is internally consistent
 * (`workStart < workEnd`, `lunchStart < lunchEnd` when both are set, and lunch falls
 * inside the working window) before it's handed to `policy/business-hours-policy.ts`.
 * Not part of the Job Validation pipeline — a config is validated once, at setup time.
 */
export function validateBusinessHoursConfig(config: BusinessHoursConfig): ValidationResult {
  const issues: ValidationResult["issues"][number][] = [];
  const workStart = toMinutes(config.workStart);
  const workEnd = toMinutes(config.workEnd);

  if (workStart >= workEnd) {
    issues.push({ path: "workStart", message: "workStart must be before workEnd" });
  }

  if (config.lunchStart && config.lunchEnd) {
    const lunchStart = toMinutes(config.lunchStart);
    const lunchEnd = toMinutes(config.lunchEnd);
    if (lunchStart >= lunchEnd) {
      issues.push({ path: "lunchStart", message: "lunchStart must be before lunchEnd" });
    } else if (lunchStart < workStart || lunchEnd > workEnd) {
      issues.push({ path: "lunchStart", message: "lunch break must fall within working hours" });
    }
  }

  if (config.workDays.length === 0) {
    issues.push({ path: "workDays", message: "at least one work day is required" });
  }

  return { valid: issues.length === 0, issues };
}
