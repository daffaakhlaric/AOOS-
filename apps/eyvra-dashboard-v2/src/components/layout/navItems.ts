/** Product navigation. Supporting tools remain contextual links. */
export interface NavItem {
  readonly key: string;
  readonly href: string;
  readonly label: string;
  readonly icon: string;
  readonly colorVar: string;
  readonly comingSoon: boolean;
}
export const MAIN_NAV: readonly NavItem[] = [
  ["command-center", "Command Center", "target"],
  ["campaigns", "Campaigns", "megaphone"],
  ["leads", "Leads", "flame"],
  ["kai-studio", "Kai Studio", "palette"],
  ["activity", "Activity", "activity"],
  ["automation", "Automation", "bot"],
].map(([key, label, icon]) => ({
  key: key!,
  href: "/" + key,
  label: label!,
  icon: icon!,
  colorVar: "--brand",
  comingSoon: false,
}));
export const SETTINGS_ITEM: NavItem = {
  key: "settings",
  href: "/settings",
  label: "Settings",
  icon: "settings",
  colorVar: "--brand",
  comingSoon: false,
};
export const NAV_ITEMS: readonly NavItem[] = [...MAIN_NAV, SETTINGS_ITEM];
export const MOBILE_NAV_ITEMS: readonly NavItem[] = NAV_ITEMS;
