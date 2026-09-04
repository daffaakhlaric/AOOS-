import styles from "./LoadingSpinner.module.css";

/** A simple accessible loading indicator (spec "components/ui/LoadingSpinner.tsx"; DO NOT use an animation library — CSS `@keyframes` only). */
export function LoadingSpinner(): React.ReactElement {
  return (
    <div role="status" aria-live="polite" className={styles.wrap}>
      <div data-testid="loading-spinner" className={styles.spinner} />
      <span className={styles.srOnly}>Memuat...</span>
    </div>
  );
}
