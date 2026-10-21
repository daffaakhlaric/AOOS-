import Link from "next/link";
import styles from "./KaiStudioHub.module.css";

export const kaiViews = [
  ["overview", "Overview"],
  ["projects", "Creative Projects"],
  ["image", "Image Studio"],
  ["video", "Video Studio"],
  ["carousel", "Carousel Studio"],
  ["queue", "Production Queue"],
  ["assets", "Asset Library"],
  ["qa", "QA & Review"],
  ["reference", "Reference Intelligence"],
  ["settings", "Settings"],
] as const;
export type KaiView = (typeof kaiViews)[number][0];
export function kaiView(value: string | null): KaiView {
  return kaiViews.find(([key]) => key === value)?.[0] ?? "overview";
}
export function KaiStudioNavigation({ view }: { view: KaiView }) {
  return (
    <nav className={styles.navigation} aria-label="Kai Studio workspaces">
      {kaiViews.map(([key, label]) => (
        <Link
          key={key}
          href={`/kai-studio?view=${key}`}
          aria-current={view === key ? "page" : undefined}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
