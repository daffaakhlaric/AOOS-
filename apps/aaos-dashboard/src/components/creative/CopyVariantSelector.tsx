import type { CopyVariantDto } from "@/types/dashboard.types";

import styles from "./CopyVariantSelector.module.css";

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
    <fieldset className={styles.fieldset}>
      <legend className={styles.legend}>Pilih copy</legend>
      {variants.map((variant) => (
        <label key={variant.id} className={styles.option}>
          <input
            type="radio"
            name="copy-variant"
            checked={selectedId === variant.id}
            onChange={() => onSelect(variant.id)}
          />
          <span>
            <span className={styles.label}>Copy {variant.variantLabel}: </span>
            <span className={styles.text}>&ldquo;{variant.primaryText}&rdquo;</span>
          </span>
        </label>
      ))}
    </fieldset>
  );
}
