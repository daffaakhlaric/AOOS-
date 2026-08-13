import type { LeadQualificationDto } from "@/types/crm.types";

const LABELS: ReadonlyArray<[keyof LeadQualificationDto, string]> = [
  ["budget", "Budget"],
  ["unit", "Unit"],
  ["area", "Area"],
  ["payment", "Cara Beli"],
  ["timeline", "Timeline"],
  ["name", "Nama"],
];

export interface QualificationBadgesProps {
  readonly qualification: LeadQualificationDto;
}

/** Renders `Lead.qualification`'s real boolean flags as checkmarks (coordinator note #2 — never a fabricated budget amount / unit model / payment method, since those don't exist on a real `Lead`). */
export function QualificationBadges({
  qualification,
}: QualificationBadgesProps): React.ReactElement {
  return (
    <ul data-testid="qualification-badges" className="flex flex-wrap gap-1.5">
      {LABELS.map(([key, label]) => {
        const qualified = qualification[key];
        return (
          <li
            key={key}
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${
              qualified
                ? "border-brand-success/30 bg-brand-success/10 text-brand-success"
                : "border-hairline bg-ink-muted/5 text-ink-muted"
            }`}
          >
            <span aria-hidden="true">{qualified ? "✓" : "✗"}</span> {label}
          </li>
        );
      })}
    </ul>
  );
}
