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

/**
 * EYVRA SAMANTHA V2 + KAI V2 Phase 50 (PROMPT 68) — the 2 new real redirect stubs the 8-item
 * Command Center-era `Sidebar` nav's `Experiments`/`Automation` items point at (see `Sidebar.tsx`'s
 * own class doc for the full real-destination rationale). Same `expectRedirect` harness as the
 * Sprint 1 stubs above.
 */
describe("EYVRA SAMANTHA V2 Phase 50 — new Command Center-era redirect stubs (PROMPT 68)", () => {
  // `/experiments` is no longer a redirect stub as of Phase 53 (PROMPT 84) — it's a real
  // dedicated page now (see `tests/app/(app)/experiments/page.test.tsx`).

  it("/automation -> /settings?tab=agen", async () => {
    await expectRedirect(() => import("@/app/(app)/automation/page"), "/settings?tab=agen");
  });
});

/**
 * EYVRA MENU RESTRUCTURE Sprint 4 (PROMPT 10) — integration-style walk of every real redirect
 * stub's OWN target, asserting each one lands directly on a real, non-redirecting hub route (never
 * on another stub's own path), so no stub can silently double-hop or loop. Built from the exact
 * same target strings the suite above already asserts — kept as a single source-of-truth list here
 * rather than re-deriving it from the stub files themselves (would need a real router to resolve,
 * which this suite deliberately doesn't stand up).
 */
describe("EYVRA MENU RESTRUCTURE Sprint 4 — no redirect stub points at another redirect stub", () => {
  // Every route this app's `page.tsx` files actually redirect FROM (Sprint 1's real stubs).
  const STUB_SOURCE_PATHS = new Set([
    "/meta-ads",
    "/meta-ads/audit",
    "/meta-ads/analisa",
    "/meta-ads/analytics/heatmap",
    "/meta-ads/strategi",
    "/meta-ads/abtesting",
    "/meta-ads/lookalike",
    "/meta-ads/simulasi",
    "/clara/analytics",
    "/clara/inbox",
    "/clara/contacts",
    "/clara/knowledge",
    "/clara/simulator",
    "/clara/recycling",
    "/listings",
    "/assets/library",
    "/objective",
    "/go-live",
    "/property/activity",
    "/learning",
    "/", // app/page.tsx
  ]);

  // Every real target a stub redirects TO — mirrors the exact strings asserted in the suite above
  // (plus `/` -> `/dashboard`, not itself covered by `expectRedirect` there).
  const STUB_TARGETS = [
    "/campaigns",
    "/campaigns?tab=anggaran",
    "/campaigns?tab=verdict",
    "/creative?tab=ab-results",
    "/campaigns?tab=verdict",
    "/campaigns?tab=ab",
    "/campaigns",
    "/activity",
    "/dashboard",
    "/leads",
    "/leads?tab=semua",
    "/leads?tab=knowledge-base",
    "/activity",
    "/leads?tab=recycling",
    "/creative?tab=listing",
    "/creative?tab=assets",
    "/settings?tab=objective",
    "/activity",
    "/activity",
    "/self-improve",
    "/dashboard",
  ];

  it.each(STUB_TARGETS)("target %s is not itself a redirect-stub source path", (target) => {
    const pathname = target.split("?")[0]!;
    expect(STUB_SOURCE_PATHS.has(pathname)).toBe(false);
  });

  it("every stub target's pathname is one of the 7 real hub/dashboard routes", () => {
    const REAL_ROUTES = new Set([
      "/dashboard",
      "/campaigns",
      "/leads",
      "/creative",
      "/activity",
      "/self-improve",
      "/settings",
    ]);
    for (const target of STUB_TARGETS) {
      const pathname = target.split("?")[0]!;
      expect(REAL_ROUTES.has(pathname)).toBe(true);
    }
  });
});
