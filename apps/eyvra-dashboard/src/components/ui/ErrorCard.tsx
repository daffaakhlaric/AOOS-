import styles from "./ErrorCard.module.css";

export interface ErrorCardProps {
  readonly message: string;
}

/** A red-bordered error card (spec "components/ui/ErrorCard.tsx"). */
export function ErrorCard({ message }: ErrorCardProps): React.ReactElement {
  return (
    <div data-testid="error-card" role="alert" className={styles.card}>
      <p className={styles.title}>Terjadi kesalahan</p>
      <p className={styles.message}>{message}</p>
    </div>
  );
}
