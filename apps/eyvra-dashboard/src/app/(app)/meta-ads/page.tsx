import { redirect } from "next/navigation";

/**
 * EYVRA MENU RESTRUCTURE Sprint 1 (PROMPT 9) — `/meta-ads` ("Data Iklan") is retired in favor of
 * the new "Campaign" hub. Real content (`MetaAdsClient`) is untouched in
 * `src/components/meta-ads/MetaAdsClient.tsx`; wiring it back in as a Campaign hub tab is
 * Sprint 2/3 work.
 */
export default function MetaAdsPage(): never {
  redirect("/campaigns");
}
