const PATHS: Record<string, string> = {
  layers: "M12 3 2 8l10 5 10-5-10-5ZM2 12l10 5 10-5M2 16l10 5 10-5",
  target:
    "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 4a6 6 0 1 0 0 12 6 6 0 0 0 0-12Zm0 4a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z",
  megaphone:
    "M3 10v4a1 1 0 0 0 1 1h2l4 4v-14l-4 4H4a1 1 0 0 0-1 1Zm14-4a7 7 0 0 1 0 12M15 9a3 3 0 0 1 0 6",
  flame: "M12 2c1 3-3 4-3 8a3 3 0 0 0 6 0c0-1-1-2-1-2 2 1 3 3 3 5a5 5 0 0 1-10 0c0-5 3-7 5-11Z",
  palette:
    "M12 2a10 10 0 1 0 0 20c1.5 0 2-.9 2-2 0-.6-.3-1-.5-1.3-.3-.4-.5-.8-.5-1.2 0-.8.7-1.5 1.5-1.5H16a4 4 0 0 0 4-4c0-5.5-4.5-10-8-10Zm-5 9a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Zm3-4a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Zm5 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Zm3 4a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Z",
  flask: "M9 2v6.5L4.5 18a1.5 1.5 0 0 0 1.3 2.2h12.4a1.5 1.5 0 0 0 1.3-2.2L15 8.5V2M8 2h8M7 14h10",
  bot: "M12 2v3M7 8h10a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2Zm2 6v1m6-1v1M4 12H2m20 0h-2",
  activity: "M3 12h4l2 8 4-16 2 8h4",
  settings:
    "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm8-3a8 8 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a8 8 0 0 0-2-1.2L15 2H9l-.5 2.6a8 8 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6A8 8 0 0 0 4 12c0 .4 0 .8.1 1.2l-2 1.6 2 3.4 2.4-1c.6.5 1.3.9 2 1.2L9 22h6l.5-2.6c.7-.3 1.4-.7 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2Z",
  bell: "M12 3a5 5 0 0 0-5 5v3.5c0 .9-.3 1.7-.9 2.4L5 15h14l-1.1-1.1c-.6-.7-.9-1.5-.9-2.4V8a5 5 0 0 0-5-5Zm-2 15a2 2 0 0 0 4 0",
  check: "M5 12l4 4 10-10",
  chevron: "M9 6l6 6-6 6",
  clock: "M12 7v5l3 3M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Z",
  menu: "M4 6h16M4 12h16M4 18h16",
};

export function NavIcon({
  name,
  size = 18,
}: {
  readonly name: string;
  readonly size?: number;
}): React.ReactElement {
  const d = PATHS[name] ?? PATHS["target"];
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );
}
