import landmarksData from "./landmarks.json";
export interface Landmark { id: string; names: Record<"en"|"hi"|"ml"|"ta"|"kn", string>; pack: "global"|"india"; dates: Record<string,string>; source: string; verifiedOn: string; }
export const LANDMARKS = landmarksData as Landmark[];
export interface MilestoneItem { name: string; aliases: string[]; kind: string; dates: Record<string,string>; pack?: string; source?: string; }
export const MILESTONES_DATA: MilestoneItem[] = LANDMARKS.map((l)=>({ name: l.names.en, aliases: Array.from(new Set([...Object.values(l.names), l.names.en.toLowerCase(), ...(l.id==="international-womens-day"?["Women's Day","womens day","women day"]:[])])), kind: l.pack, dates: l.dates, pack: l.pack, source: l.source }));
export default MILESTONES_DATA;
