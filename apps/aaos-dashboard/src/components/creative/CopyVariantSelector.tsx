import type { CopyVariantDto } from "@/types/dashboard.types";

export interface CopyVariantSelectorProps {
  readonly variants: readonly CopyVariantDto[];
  readonly selectedId: string | undefined;
  readonly onSelect: (id: string) => void;
}

/** Pick copy A/B/C (spec "components/creative/CopyVariantSelector.tsx" — mockup "Pilih copy: ● A  ○ B  ○ C"). */
export function CopyVariantSelector({
  variants,
  selectedId,
  onSelect,
}: CopyVariantSelectorProps): React.ReactElement {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-sm font-medium text-ink">Pilih copy</legend>
      {variants.map((variant) => (
        <label key={variant.id} className="flex items-start gap-2 text-sm">
          <input
            type="radio"
            name="copy-variant"
            checked={selectedId === variant.id}
            onChange={() => onSelect(variant.id)}
          />
          <span>
            <span className="font-semibold text-ink">Copy {variant.variantLabel}: </span>
            <span className="text-ink-muted">&ldquo;{variant.primaryText}&rdquo;</span>
          </span>
        </label>
      ))}
    </fieldset>
  );
}
