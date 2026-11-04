/** Landmark pack preferences (Settings -> Landmark packs).
 * Every pack is ON unless the user switched it off. Gating the India pack on the
 * browser locale (en-IN) hid Onam/Diwali/Vishu from en-US and en-GB browsers, so
 * the headline "two days before Onam" asked "Which date?" for most visitors. */
export type LandmarkPackPrefs = { global: boolean; india: boolean };
export const LANDMARK_PACKS_KEY = "feather_landmark_packs";
export const DEFAULT_LANDMARK_PACKS: LandmarkPackPrefs = { global: true, india: true };

export function loadLandmarkPacks(storage: Pick<Storage, "getItem"> | null = typeof localStorage !== "undefined" ? localStorage : null): LandmarkPackPrefs {
  try {
    const raw = storage?.getItem(LANDMARK_PACKS_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      return { global: p?.global !== false, india: p?.india !== false };
    }
  } catch {}
  return { ...DEFAULT_LANDMARK_PACKS };
}
