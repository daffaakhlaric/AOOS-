import type { ScheduledPostStatus, SosmedPlatform } from "@/types/sosmed.types";

/** Platform color coding — literal hex values from `docs/PROMPT-AAOS-SOSMED-AUTOMATION.md`'s own "Color coding per platform" table. */
export const PLATFORM_COLOR: Readonly<Record<SosmedPlatform, string>> = {
  FACEBOOK: "#1877F2",
  INSTAGRAM: "#E1306C",
  TIKTOK: "#000000",
  YOUTUBE: "#FF0000",
};

export const PLATFORM_LABEL: Readonly<Record<SosmedPlatform, string>> = {
  FACEBOOK: "FB",
  INSTAGRAM: "IG",
  TIKTOK: "TikTok",
  YOUTUBE: "YouTube",
};

export const STATUS_LABEL: Readonly<Record<ScheduledPostStatus, string>> = {
  DRAFT: "Draft",
  SCHEDULED: "Terjadwal",
  PUBLISHING: "Sedang Post",
  PUBLISHED: "Sudah Post",
  FAILED: "Gagal",
  CANCELLED: "Dibatalkan",
};
