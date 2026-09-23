/** Shared desktop and mobile navigation; unimplemented areas retain their availability flag. */
export interface NavItem {
  readonly key: string;
  readonly href: string;
  readonly label: string;
  readonly icon: string;
  readonly colorVar: string;
  /** `true` for every route this phase has not built yet — rendered as a real, honest "coming soon" affordance rather than a broken link. */
  readonly comingSoon: boolean;
}

export const MAIN_NAV: readonly NavItem[] = [
  {
    key: "command-center",
    href: "/command-center",
    label: "Command Center",
    icon: "target",
    colorVar: "--samantha",
    comingSoon: false,
  },
  {
    key: "listings",
    href: "/listings",
    label: "Listings",
    icon: "layers",
    colorVar: "--kai",
    comingSoon: false,
  },
  {
    key: "campaigns",
    href: "/campaigns",
    label: "Campaigns",
    icon: "megaphone",
    colorVar: "--samantha",
    comingSoon: false,
  },
  {
    key: "leads",
    href: "/leads",
    label: "Leads",
    icon: "flame",
    colorVar: "--clara",
    comingSoon: true,
  },
  {
    key: "kai-studio",
    href: "/kai-studio",
    label: "Kai Studio",
    icon: "palette",
    colorVar: "--kai",
    comingSoon: false,
  },
  {
    key: "experiments",
    href: "/experiments",
    label: "Experiments",
    icon: "flask",
    colorVar: "--samantha",
    comingSoon: true,
  },
  {
    key: "automation",
    href: "/automation",
    label: "Automation",
    icon: "bot",
    colorVar: "--samantha",
    comingSoon: true,
  },
  {
    key: "activity",
    href: "/activity",
    label: "Activity",
    icon: "activity",
    colorVar: "--text-secondary",
    comingSoon: true,
  },
] as const;

export const SETTINGS_ITEM: NavItem = {
  key: "settings",
  href: "/settings",
  label: "Settings",
  icon: "settings",
  colorVar: "--text-secondary",
  comingSoon: true,
};

export const NAV_ITEMS: readonly NavItem[] = [...MAIN_NAV, SETTINGS_ITEM];

/** Keep the current Listings workspace reachable on mobile. */
export const MOBILE_NAV_ITEMS: readonly NavItem[] = [
  MAIN_NAV[0] as NavItem, // Command Center
  MAIN_NAV[1] as NavItem, // Listings
  MAIN_NAV[2] as NavItem, // Campaigns
  MAIN_NAV[4] as NavItem, // Kai Studio
  {
    key: "more",
    href: "/more",
    label: "More",
    icon: "menu",
    colorVar: "--text-secondary",
    comingSoon: true,
  },
];
