export interface LanguageLexicon {
  symptoms: Record<string, string[]>;
  flow: Record<"heavy" | "medium" | "light" | "spotting" | "none", string[]>;
  mood: Record<string, string[]>;
  periodStart: string[];
  periodEnd: string[];
  negations: string[];
}

export const en: LanguageLexicon = {
  symptoms: {
    cramps: ["cramps", "cramp", "cramping"],
    headache: ["headache", "head ache"],
    backache: ["backache", "back ache", "back pain", "lower back pain"],
    bloating: ["bloating", "bloated"],
    breast_tenderness: ["breast tenderness", "tender breasts", "breast pain", "sore breasts"],
    acne: ["acne", "breakout", "pimples"],
    fatigue: ["fatigue", "tired", "exhausted", "low energy feeling"],
    cravings: ["cravings", "craving"],
    nausea: ["nausea", "nauseous", "queasy"],
    mood_swings: ["mood swings", "mood swing"],
    anxiety: ["anxiety", "anxious"],
    insomnia: ["insomnia", "cannot sleep", "could not sleep", "sleepless"],
    dizziness: ["dizziness", "dizzy"],
    appetite_change: ["appetite change", "increased appetite", "no appetite"],
  },
  flow: {
    heavy: ["heavy flow", "heavy bleeding", "heavy"],
    medium: ["medium flow", "moderate flow", "normal flow", "medium"],
    light: ["light flow", "light bleeding", "light"],
    spotting: ["spotting"],
    none: ["no flow", "no bleeding"],
  },
  mood: {
    Great: ["great", "fantastic"],
    Good: ["good"],
    Okay: ["okay", "ok", "fine"],
    Low: ["low mood", "feeling low", "sad"],
    Irritable: ["irritable", "irritated"],
    Anxious: ["anxious mood"],
    Calm: ["calm"],
    Emotional: ["emotional"],
  },
  periodStart: ["period started", "period start", "started my period", "my period came", "got my period", "period began"],
  periodEnd: ["period ended", "period stopped", "period finished", "flow stopped"],
  negations: ["no", "not", "without", "never"],
};
