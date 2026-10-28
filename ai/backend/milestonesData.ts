export interface MilestoneItem {
  name: string;
  aliases: string[];
  kind: string;
  dates: Record<string, string>;
}

export const MILESTONES_DATA: MilestoneItem[] = [
  {
    name: "New Year's Day",
    aliases: ["new year", "new year's day", "new years", "jan 1"],
    kind: "milestone",
    dates: {
      "2025": "2025-01-01",
      "2026": "2026-01-01",
      "2027": "2027-01-01",
    },
  },
  {
    name: "Valentine's Day",
    aliases: ["valentine", "valentines", "valentine's day"],
    kind: "milestone",
    dates: {
      "2025": "2025-02-14",
      "2026": "2026-02-14",
      "2027": "2027-02-14",
    },
  },
  {
    name: "International Women's Day",
    aliases: ["women's day", "womens day", "international women's day", "iwd"],
    kind: "milestone",
    dates: {
      "2025": "2025-03-08",
      "2026": "2026-03-08",
      "2027": "2027-03-08",
    },
  },
  {
    name: "Spring Equinox (Rejuvenation Window)",
    aliases: ["spring equinox", "vernal equinox", "first day of spring"],
    kind: "milestone",
    dates: {
      "2025": "2025-03-20",
      "2026": "2026-03-20",
      "2027": "2027-03-20",
    },
  },
  {
    name: "Earth Day",
    aliases: ["earth day"],
    kind: "milestone",
    dates: {
      "2025": "2025-04-22",
      "2026": "2026-04-22",
      "2027": "2027-04-22",
    },
  },
  {
    name: "Summer Solstice (Peak Travel Season)",
    aliases: ["summer solstice", "midsummer", "longest day", "first day of summer"],
    kind: "milestone",
    dates: {
      "2025": "2025-06-21",
      "2026": "2026-06-21",
      "2027": "2027-06-21",
    },
  },
  {
    name: "Midsummer Vacation Season",
    aliases: ["midsummer break", "summer vacation", "july holidays"],
    kind: "milestone",
    dates: {
      "2025": "2025-07-15",
      "2026": "2026-07-15",
      "2027": "2027-07-15",
    },
  },
  {
    name: "Late Summer Getaway",
    aliases: ["late summer", "august getaway", "summer retreat"],
    kind: "milestone",
    dates: {
      "2025": "2025-08-20",
      "2026": "2026-08-20",
      "2027": "2027-08-20",
    },
  },
  {
    name: "Autumn Equinox (Focus Season)",
    aliases: ["autumn equinox", "fall equinox", "first day of fall", "back to school"],
    kind: "milestone",
    dates: {
      "2025": "2025-09-22",
      "2026": "2026-09-22",
      "2027": "2027-09-22",
    },
  },
  {
    name: "Global Marathon Season",
    aliases: ["marathon season", "fall marathon", "october race"],
    kind: "milestone",
    dates: {
      "2025": "2025-10-18",
      "2026": "2026-10-18",
      "2027": "2027-10-18",
    },
  },
  {
    name: "Winter Holiday Break",
    aliases: ["holiday break", "winter holidays", "end of year break", "christmas holidays"],
    kind: "milestone",
    dates: {
      "2025": "2025-12-24",
      "2026": "2026-12-24",
      "2027": "2027-12-24",
    },
  },
  {
    name: "New Year's Eve Gala",
    aliases: ["new year's eve", "new years eve", "nye", "dec 31"],
    kind: "milestone",
    dates: {
      "2025": "2025-12-31",
      "2026": "2026-12-31",
      "2027": "2027-12-31",
    },
  },
];

export default MILESTONES_DATA;
