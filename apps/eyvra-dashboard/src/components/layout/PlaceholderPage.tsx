/**
 * EYVRA MENU RESTRUCTURE Sprint 1 (Foundation) — the spec's own "Template placeholder" (PROMPT 2),
 * pulled into one shared component instead of pasting the same JSX literally into 5 different
 * `page.tsx` files under `src/app/(app)/{campaigns,leads,activity,self-improve}` and `creative`.
 * `--text-primary`/`--text-secondary` in the spec's own snippet don't exist as real tokens in this
 * app — `--v2-text-1`/`--v2-text-2` (`globals.css`'s "AAOS Colorful Brand Guideline v2" block) are
 * the real, already-shipped equivalents, used here instead of inventing a second parallel pair.
 *
 * Real tab content for each hub (Campaign/Leads/Creative/Aktivitas/AI Improve) is Sprint 2/3 work
 * — this component is deliberately just the spec's static placeholder, nothing more.
 */
export interface PlaceholderPageProps {
  readonly title: string;
  readonly description: string;
}

export function PlaceholderPage({ title, description }: PlaceholderPageProps): React.ReactElement {
  return (
    <div style={{ padding: "20px 24px" }}>
      <div
        style={{
          fontSize: 22,
          fontWeight: 500,
          color: "var(--v2-text-1)",
          marginBottom: 8,
        }}
      >
        {title}
      </div>
      <div style={{ fontSize: 14, color: "var(--v2-text-2)" }}>{description}</div>
    </div>
  );
}
