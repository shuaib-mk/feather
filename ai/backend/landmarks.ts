import landmarksData from "./landmarks.json";
export interface Landmark { id: string; names: Record<"en"|"hi"|"ml"|"ta"|"kn", string>; pack: "global"|"india"; dates: Record<string,string>; source: string; verifiedOn: string; }
export const LANDMARKS = landmarksData as Landmark[];
export interface MilestoneItem { name: string; aliases: string[]; kind: string; dates: Record<string,string>; pack?: string; source?: string; }
const EXTRA_ALIASES: Record<string, string[]> = {
  "new-years-day": ["New Year's", "new year", "New Year", "new years", "ന്യൂ ഇയർ", "नया साल", "न्यू ईयर"],
  "valentines-day": ["valentine", "valentines", "വാലന്റൈൻസ്", "वैलेंटाइन"],
  "international-womens-day": ["Women's Day", "womens day", "women day", "വനിതാദിനം"],
  "earth-day": ["अर्थ डे"],
  "christmas": ["xmas", "ക്രിസ്മസിന്", "ക്രിസ്തുമസ്"],
  "new-years-eve": ["new years eve", "nye", "പുതുവത്സര രാവ്"],
  "diwali": ["deepavali", "ദീപാവലിക്ക്", "दिवाली"],
  "onam": ["thiruvonam", "ഓണത്തിന്", "തിരുവോണം"],
  "vishu": ["വിഷുവിന്"],
};
export const MILESTONES_DATA: MilestoneItem[] = LANDMARKS.map((l)=>({ name: l.names.en, aliases: Array.from(new Set([...Object.values(l.names), l.names.en.toLowerCase(), ...(EXTRA_ALIASES[l.id] || [])])), kind: l.pack, dates: l.dates, pack: l.pack, source: l.source }));
export default MILESTONES_DATA;
