import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * EYVRA MENU RESTRUCTURE Sprint 1 (PROMPT 9) — real redirect stubs for every OLD route
 * confirmed to still exist in this app, each replaced with a bare Server Component that calls
 * `redirect()` (from `next/navigation`) at the new hub route. `redirect()` is mocked here so
 * calling the page function directly doesn't throw Next's real `NEXT_REDIRECT` control-flow
 * error — this asserts the exact target each stub redirects to, not just that *a* redirect
 * happens.
 *
 * `/meta-ads/data-iklan` (from the spec's own PROMPT 9 list) is deliberately absent from this
 * suite: it never existed as a real, separate route in this app (the real `/meta-ads` root page
 * already covers "Data Iklan") — see this suite's own component doc / the Sidebar's investigation
 * notes for the full accounting of what was skipped and why.
 */
const redirectMock = vi.fn();
vi.mock("next/navigation", () => ({
  redirect: (url: string) => redirectMock(url),
}));

beforeEach(() => {
  redirectMock.mockClear();
});

async function expectRedirect(
  importPage: () => Promise<{ default: () => unknown }>,
  target: string,
): Promise<void> {
  const { default: Page } = await importPage();
  Page();
  expect(redirectMock).toHaveBeenCalledWith(target);
}

describe("EYVRA MENU RESTRUCTURE Sprint 1 — real redirect stubs (PROMPT 9)", () => {
  it("/meta-ads -> /campaigns", async () => {
    await expectRedirect(() => import("@/app/(app)/meta-ads/page"), "/campaigns");
  });

  it("/meta-ads/audit -> /campaigns?tab=anggaran", async () => {
    await expectRedirect(
      () => import("@/app/(app)/meta-ads/audit/page"),
      "/campaigns?tab=anggaran",
    );
  });

  it("/meta-ads/analisa -> /campaigns?tab=verdict", async () => {
    await expectRedirect(
      () => import("@/app/(app)/meta-ads/analisa/page"),
      "/campaigns?tab=verdict",
    );
  });

  it("/meta-ads/analytics/heatmap -> /creative?tab=ab-results", async () => {
    await expectRedirect(
      () => import("@/app/(app)/meta-ads/analytics/heatmap/page"),
      "/creative?tab=ab-results",
    );
  });

  it("/meta-ads/strategi -> /campaigns?tab=verdict", async () => {
    await expectRedirect(
      () => import("@/app/(app)/meta-ads/strategi/page"),
      "/campaigns?tab=verdict",
    );
  });

  it("/meta-ads/abtesting -> /campaigns?tab=ab", async () => {
    await expectRedirect(() => import("@/app/(app)/meta-ads/abtesting/page"), "/campaigns?tab=ab");
  });

  it("/meta-ads/lookalike -> /campaigns", async () => {
    await expectRedirect(() => import("@/app/(app)/meta-ads/lookalike/page"), "/campaigns");
  });

  it("/meta-ads/simulasi -> /activity", async () => {
    await expectRedirect(() => import("@/app/(app)/meta-ads/simulasi/page"), "/activity");
  });

  it("/clara/analytics -> /dashboard", async () => {
    await expectRedirect(() => import("@/app/(app)/clara/analytics/page"), "/dashboard");
  });

  it("/clara/inbox -> /leads", async () => {
    await expectRedirect(() => import("@/app/(app)/clara/inbox/page"), "/leads");
  });

  it("/clara/contacts -> /leads?tab=semua", async () => {
    await expectRedirect(() => import("@/app/(app)/clara/contacts/page"), "/leads?tab=semua");
  });

  it("/clara/knowledge -> /leads?tab=knowledge-base", async () => {
    await expectRedirect(
      () => import("@/app/(app)/clara/knowledge/page"),
      "/leads?tab=knowledge-base",
    );
  });

  it("/clara/simulator -> /activity", async () => {
    await expectRedirect(() => import("@/app/(app)/clara/simulator/page"), "/activity");
  });

  it("/clara/recycling -> /leads?tab=recycling", async () => {
    await expectRedirect(() => import("@/app/(app)/clara/recycling/page"), "/leads?tab=recycling");
  });

  it("/listings -> /creative?tab=listing", async () => {
    await expectRedirect(() => import("@/app/(app)/listings/page"), "/creative?tab=listing");
  });

  it("/assets/library -> /creative?tab=assets", async () => {
    await expectRedirect(() => import("@/app/(app)/assets/library/page"), "/creative?tab=assets");
  });

  it("/objective -> /settings?tab=objective", async () => {
    await expectRedirect(() => import("@/app/(app)/objective/page"), "/settings?tab=objective");
  });

  it("/go-live -> /activity", async () => {
    await expectRedirect(() => import("@/app/(app)/go-live/page"), "/activity");
  });

  it("/property/activity -> /activity", async () => {
    await expectRedirect(() => import("@/app/(app)/property/activity/page"), "/activity");
  });

  it("/learning -> /self-improve", async () => {
    await expectRedirect(() => import("@/app/(app)/learning/page"), "/self-improve");
  });
});
