import "@testing-library/jest-dom/vitest";

/**
 * jsdom has no real `ResizeObserver` — `@tanstack/react-virtual` (AAOS-ANALYTICS-PLATFORM Phase 1,
 * `CampaignTable.tsx`) constructs one internally to track its scroll container's size. Without this
 * polyfill every test that renders a virtualized list throws `ReferenceError: ResizeObserver is not
 * defined`.
 *
 * A real browser's `ResizeObserver.observe()` fires its callback once, synchronously-ish, with the
 * target's initial size — `@tanstack/react-virtual` relies on that first callback to learn the
 * scroll container's height and compute which rows are "visible" at all. A no-op `observe()` never
 * calls back, so the virtualizer permanently believes the container is 0px tall and renders zero
 * rows — this polyfill instead calls back immediately with the target's real (in tests, stubbed —
 * see `CampaignTable.test.tsx`'s `stubViewportSize`) `getBoundingClientRect()`, matching real
 * browser behavior closely enough for the virtualizer to compute a real, non-empty visible range.
 */
if (typeof globalThis.ResizeObserver === "undefined") {
  class ResizeObserverPolyfill {
    readonly #callback: ResizeObserverCallback;

    constructor(callback: ResizeObserverCallback) {
      this.#callback = callback;
    }

    observe(target: Element): void {
      const rect = target.getBoundingClientRect();
      const entry = {
        target,
        contentRect: rect,
        borderBoxSize: [],
        contentBoxSize: [],
        devicePixelContentBoxSize: [],
      } as unknown as ResizeObserverEntry;
      this.#callback([entry], this as unknown as ResizeObserver);
    }

    unobserve(): void {
      // no-op — no test needs re-measurement after an explicit unobserve.
    }

    disconnect(): void {
      // no-op
    }
  }
  globalThis.ResizeObserver = ResizeObserverPolyfill as unknown as typeof ResizeObserver;
}
