export interface MilestoneItem {
  name: string;
  aliases: string[];
  kind: string;
  dates: Record<string, string>;
}

export const MILESTONES_DATA: MilestoneItem[] = [
  {
    name: "New Year's Day",
    aliases: [
      "new year", "new year's day", "new years", "jan 1",
      "ന്യൂ ഇയർ", "പുതുവത്സരം", "नए साल", "नया साल", "न्यू ईयर",
    ],
    kind: "milestone",
    dates: {
      "2025": "2025-01-01",
      "2026": "2026-01-01",
      "2027": "2027-01-01",
    },
  },
  {
    name: "Valentine's Day",
    aliases: [
      "valentine", "valentines", "valentine's day",
      "വാലന്റൈൻസ്", "वैलेंटाइन डे", "वैलेंटाइन",
    ],
    kind: "milestone",
    dates: {
      "2025": "2025-02-14",
      "2026": "2026-02-14",
      "2027": "2027-02-14",
    },
  },
  {
    name: "International Women's Day",
    aliases: [
      "women's day", "womens day", "international women's day", "iwd",
      "വനിതാ ദിനം", "വനിതാദിനം", "महिला दिवस",
    ],
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
    aliases: ["earth day", "ഭൂമി ദിനം", "अर्थ डे", "पृथ्वी दिवस"],
    kind: "milestone",
    dates: {
      "2025": "2025-04-22",
      "2026": "2026-04-22",
      "2027": "2027-04-22",
    },
  },
  {
    name: "Summer Solstice (Peak Travel Season)",
    aliases: ["summer solstice", "longest day", "first day of summer"],
    kind: "milestone",
    dates: {
      "2025": "2025-06-21",
      "2026": "2026-06-21",
      "2027": "2027-06-21",
    },
  },
  {
    name: "Midsummer Vacation Season",
    aliases: [
      "midsummer vacation break", "midsummer vacation", "midsummer break", "summer vacation",
      "july holidays", "വേനൽ അവധി", "വേനലവധി", "गर्मी की छुट्टी",
    ],
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
    aliases: ["marathon season", "fall marathon", "october race", "मैराथन"],
    kind: "milestone",
    dates: {
      "2025": "2025-10-18",
      "2026": "2026-10-18",
      "2027": "2027-10-18",
    },
  },
  {
    name: "Winter Holiday Break",
    aliases: [
      "winter holiday break", "winter break", "winter holidays", "holiday break",
      "end of year break", "christmas holidays", "शीतकालीन अवकाश",
    ],
    kind: "milestone",
    dates: {
      "2025": "2025-12-24",
      "2026": "2026-12-24",
      "2027": "2027-12-24",
    },
  },
  {
    name: "New Year's Eve Gala",
    aliases: [
      "new year's eve", "new years eve", "nye", "dec 31",
      "ന്യൂ ഇയർ ഈവ്", "പുതുവത്സര രാവ്", "न्यू ईयर ईव",
    ],
    kind: "milestone",
    dates: {
      "2025": "2025-12-31",
      "2026": "2026-12-31",
      "2027": "2027-12-31",
    },
  },
  {
    name: "Diwali (Festival of Lights)",
    aliases: [
      "diwali", "deepavali", "दीवाली", "ദീപാവലി", "ദീപാവലിക്ക്",
      "दिवाली", "festival of lights",
    ],
    kind: "milestone",
    dates: {
      "2025": "2025-10-20",
      "2026": "2026-11-08",
      "2027": "2027-10-29",
    },
  },
  {
    name: "Onam (Harvest Festival)",
    aliases: [
      "onam", "thiruvonam", "ഓണം", "ഓണത്തിന്", "തിരുവോണം",
    ],
    kind: "milestone",
    dates: {
      "2025": "2025-09-05",
      "2026": "2026-08-26",
      "2027": "2027-09-12",
    },
  },
  {
    name: "Vishu (New Year)",
    aliases: [
      "vishu", "വിഷു", "വിഷുവിന്",
    ],
    kind: "milestone",
    dates: {
      "2025": "2025-04-14",
      "2026": "2026-04-14",
      "2027": "2027-04-14",
    },
  },
  {
    name: "Holi (Festival of Colours)",
    aliases: [
      "holi", "होली", "ഹോളി",
    ],
    kind: "milestone",
    dates: {
      "2025": "2025-03-14",
      "2026": "2026-03-03",
      "2027": "2027-03-22",
    },
  },
  {
    name: "Christmas",
    aliases: [
      "christmas", "xmas", "ക്രിസ്മസ്", "ക്രിസ്മസിന്", "ക്രിസ്തുമസ്", "क्रिसमस",
    ],
    kind: "milestone",
    dates: {
      "2025": "2025-12-25",
      "2026": "2026-12-25",
      "2027": "2027-12-25",
    },
  },
];

export default MILESTONES_DATA;
