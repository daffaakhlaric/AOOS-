import styles from "./BrandLogo.module.css";

export function BrandMark(): React.ReactElement {
  return (
    <span className={styles.mark}>
      <img src="/brand/skorpintar-mark.svg" alt="SkorPintar" width={36} height={36} />
    </span>
  );
}

/** The supplied artwork is preserved, including its original wordmark. */
export function BrandLogo(): React.ReactElement {
  return (
    <span className={styles.logo}>
      <img src="/brand/skorpintar-full.png" alt="SkorPintar" width={144} height={144} />
      <span>ADS INSIGHT</span>
    </span>
  );
}
