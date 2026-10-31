// Curated 65-sample landmark recall evaluation benchmark
// Evaluates fuzzy date resolution across English, Malayalam, Hindi, and Code-Mixed dialects
// Anchor Reference Date: 2026-10-28

export interface LandmarkEvalSample {
  id: string;
  phrase: string;
  language: "en" | "ml" | "hi" | "code-mixed";
  expectedDate: string | null; // YYYY-MM-DD, or null when unverified or future log landmark expects clarification
  expectsClarification?: boolean; // true when landmark has no verified date in landmarks.json or is a future log landmark
  landmarkName: string;
}

export const LANDMARK_DATASET: LandmarkEvalSample[] = [
  // --- English (25 samples: 12 resolved to date, 13 expects clarification, no date) ---
  { id: "en-01", phrase: "Period started on New Year's Day", language: "en", expectedDate: "2026-01-01", landmarkName: "New Year's Day" },
  { id: "en-02", phrase: "Two days before New Year's", language: "en", expectedDate: "2025-12-30", landmarkName: "New Year's Day" },
  { id: "en-03", phrase: "The day after New Year's", language: "en", expectedDate: "2026-01-02", landmarkName: "New Year's Day" },
  { id: "en-04", phrase: "Logged period on Valentine's Day", language: "en", expectedDate: "2026-02-14", landmarkName: "Valentine's Day" },
  { id: "en-05", phrase: "Three days before Valentine's Day", language: "en", expectedDate: "2026-02-11", landmarkName: "Valentine's Day" },
  { id: "en-06", phrase: "Around International Women's Day", language: "en", expectedDate: "2026-03-08", landmarkName: "International Women's Day" },
  { id: "en-07", phrase: "The Monday before Women's Day", language: "en", expectedDate: "2026-03-02", landmarkName: "International Women's Day" },
  { id: "en-08", phrase: "Two days after Women's Day", language: "en", expectedDate: "2026-03-10", landmarkName: "International Women's Day" },
  { id: "en-09", phrase: "Spring Equinox cycle start", language: "en", expectedDate: null, expectsClarification: true, landmarkName: "Spring Equinox (unverified — expects clarification, no date)" },
  { id: "en-10", phrase: "Earth Day spotting", language: "en", expectedDate: "2026-04-22", landmarkName: "Earth Day" },
  { id: "en-11", phrase: "Earth Day flow was heavy", language: "en", expectedDate: "2026-04-22", landmarkName: "Earth Day" },
  { id: "en-12", phrase: "Christmas next year", language: "en", expectedDate: null, expectsClarification: true, landmarkName: "Christmas (future landmark log — expects clarification, no date)" },
  { id: "en-13", phrase: "Midsummer vacation break", language: "en", expectedDate: null, expectsClarification: true, landmarkName: "Midsummer Vacation Season (unverified — expects clarification, no date)" },
  { id: "en-14", phrase: "Late summer getaway trip", language: "en", expectedDate: null, expectsClarification: true, landmarkName: "Late Summer Getaway (unverified — expects clarification, no date)" },
  { id: "en-15", phrase: "Autumn Equinox period", language: "en", expectedDate: null, expectsClarification: true, landmarkName: "Autumn Equinox (unverified — expects clarification, no date)" },
  { id: "en-16", phrase: "Global Marathon Season race day", language: "en", expectedDate: null, expectsClarification: true, landmarkName: "Global Marathon Season (unverified — expects clarification, no date)" },
  { id: "en-17", phrase: "Winter Holiday Break start", language: "en", expectedDate: null, expectsClarification: true, landmarkName: "Winter Holiday Break (unverified — expects clarification, no date)" },
  { id: "en-18", phrase: "New Year's Eve gala night", language: "en", expectedDate: null, expectsClarification: true, landmarkName: "New Year's Eve (future landmark log — expects clarification, no date)" },
  { id: "en-19", phrase: "Period started during last Diwali", language: "en", expectedDate: "2025-10-20", landmarkName: "Diwali" },
  { id: "en-20", phrase: "Diwali 2026 celebration", language: "en", expectedDate: null, expectsClarification: true, landmarkName: "Diwali (future landmark log — expects clarification, no date)" },
  { id: "en-21", phrase: "Christmas Day flow", language: "en", expectedDate: null, expectsClarification: true, landmarkName: "Christmas (future landmark log — expects clarification, no date)" },
  { id: "en-22", phrase: "Day before Christmas", language: "en", expectedDate: null, expectsClarification: true, landmarkName: "Christmas (future landmark log — expects clarification, no date)" },
  { id: "en-23", phrase: "Holi festival celebration", language: "en", expectedDate: null, expectsClarification: true, landmarkName: "Holi (unverified — expects clarification, no date)" },
  { id: "en-24", phrase: "One day after Earth Day", language: "en", expectedDate: "2026-04-23", landmarkName: "Earth Day" },
  { id: "en-25", phrase: "Five days before New Year's Eve", language: "en", expectedDate: null, expectsClarification: true, landmarkName: "New Year's Eve (future landmark log — expects clarification, no date)" },

  // --- Malayalam (15 samples: 8 resolved to date, 7 expects clarification, no date) ---
  { id: "ml-01", phrase: "ഓണം സമയത്ത് പീരിയഡ് തുടങ്ങി", language: "ml", expectedDate: "2026-08-26", landmarkName: "Onam" },
  { id: "ml-02", phrase: "വിഷുവിന് രണ്ട് ദിവസം മുൻപ്", language: "ml", expectedDate: "2026-04-12", landmarkName: "Vishu" },
  { id: "ml-03", phrase: "ക്രിസ്മസ് ദിവസം ഫ്ലോ ഉണ്ടായിരുന്നു", language: "ml", expectedDate: null, expectsClarification: true, landmarkName: "Christmas (future landmark log — expects clarification, no date)" },
  { id: "ml-04", phrase: "ദീപാവലി സമയത്ത്", language: "ml", expectedDate: null, expectsClarification: true, landmarkName: "Diwali (future landmark log — expects clarification, no date)" },
  { id: "ml-05", phrase: "തിരുവോണം ദിവസം", language: "ml", expectedDate: "2026-08-26", landmarkName: "Onam" },
  { id: "ml-06", phrase: "ന്യൂ ഇയർ ദിവസം തുടങ്ങി", language: "ml", expectedDate: "2026-01-01", landmarkName: "New Year's Day" },
  { id: "ml-07", phrase: "വിഷു ദിവസം വയറുവേദന", language: "ml", expectedDate: "2026-04-14", landmarkName: "Vishu" },
  { id: "ml-08", phrase: "ക്രിസ്മസിന് ഒരു ദിവസം മുൻപ്", language: "ml", expectedDate: null, expectsClarification: true, landmarkName: "Christmas (future landmark log — expects clarification, no date)" },
  { id: "ml-09", phrase: "ഓണത്തിന് ശേഷം", language: "ml", expectedDate: "2026-08-26", landmarkName: "Onam" },
  { id: "ml-10", phrase: "ദീപാവലിക്ക് രണ്ട് ദിവസം മുൻപ്", language: "ml", expectedDate: null, expectsClarification: true, landmarkName: "Diwali (future landmark log — expects clarification, no date)" },
  { id: "ml-11", phrase: "വനിതാ ദിനം അന്ന് തുടങ്ങി", language: "ml", expectedDate: "2026-03-08", landmarkName: "International Women's Day" },
  { id: "ml-12", phrase: "ഹോളി ആഘോഷം ദിവസം", language: "ml", expectedDate: null, expectsClarification: true, landmarkName: "Holi (unverified — expects clarification, no date)" },
  { id: "ml-13", phrase: "കഴിഞ്ഞ ദീപാവലിക്ക്", language: "ml", expectedDate: "2025-10-20", landmarkName: "Diwali" },
  { id: "ml-14", phrase: "ന്യൂ ഇയർ ഈവ് ദിവസം", language: "ml", expectedDate: null, expectsClarification: true, landmarkName: "New Year's Eve (future landmark log — expects clarification, no date)" },
  { id: "ml-15", phrase: "വേനൽ അവധി സമയത്ത്", language: "ml", expectedDate: null, expectsClarification: true, landmarkName: "Midsummer Vacation Season (unverified — expects clarification, no date)" },

  // --- Hindi (13 samples: 6 resolved to date, 7 expects clarification, no date) ---
  { id: "hi-01", phrase: "दीवाली के दिन पीरियड शुरू हुआ", language: "hi", expectedDate: null, expectsClarification: true, landmarkName: "Diwali (future landmark log — expects clarification, no date)" },
  { id: "hi-02", phrase: "होली के दो दिन पहले", language: "hi", expectedDate: null, expectsClarification: true, landmarkName: "Holi (unverified — expects clarification, no date)" },
  { id: "hi-03", phrase: "नए साल के दिन हेवी फ्लो था", language: "hi", expectedDate: "2026-01-01", landmarkName: "New Year's Day" },
  { id: "hi-04", phrase: "क्रिसमस के दिन सिरदर्द और क्रैम्प्स", language: "hi", expectedDate: null, expectsClarification: true, landmarkName: "Christmas (future landmark log — expects clarification, no date)" },
  { id: "hi-05", phrase: "महिला दिवस के दिन शुरू हुआ", language: "hi", expectedDate: "2026-03-08", landmarkName: "International Women's Day" },
  { id: "hi-06", phrase: "दीवाली से एक दिन पहले", language: "hi", expectedDate: null, expectsClarification: true, landmarkName: "Diwali (future landmark log — expects clarification, no date)" },
  { id: "hi-07", phrase: "होली के दिन थकान थी", language: "hi", expectedDate: null, expectsClarification: true, landmarkName: "Holi (unverified — expects clarification, no date)" },
  { id: "hi-08", phrase: "न्यू ईयर से दो दिन पहले", language: "hi", expectedDate: "2025-12-30", landmarkName: "New Year's Day" },
  { id: "hi-09", phrase: "पिछली दीवाली के समय", language: "hi", expectedDate: "2025-10-20", landmarkName: "Diwali" },
  { id: "hi-10", phrase: "वैलेंटाइन डे पर हल्का फ्लो", language: "hi", expectedDate: "2026-02-14", landmarkName: "Valentine's Day" },
  { id: "hi-11", phrase: "क्रिसमस के बाद", language: "hi", expectedDate: null, expectsClarification: true, landmarkName: "Christmas (future landmark log — expects clarification, no date)" },
  { id: "hi-12", phrase: "अर्थ डे के दिन", language: "hi", expectedDate: "2026-04-22", landmarkName: "Earth Day" },
  { id: "hi-13", phrase: "न्यू ईयर ईव पर स्पॉटिंग", language: "hi", expectedDate: null, expectsClarification: true, landmarkName: "New Year's Eve (future landmark log — expects clarification, no date)" },

  // --- Code-Mixed Dialects (12 samples: 6 resolved to date, 6 expects clarification, no date) ---
  { id: "cm-01", phrase: "Diwali ke 2 days before flow start hua", language: "code-mixed", expectedDate: null, expectsClarification: true, landmarkName: "Diwali (future landmark log — expects clarification, no date)" },
  { id: "cm-02", phrase: "Onam kazhinju 2 days after heavy flow", language: "code-mixed", expectedDate: "2026-08-28", landmarkName: "Onam" },
  { id: "cm-03", phrase: "New Year nu 2 days before cramps undaayirunnu", language: "code-mixed", expectedDate: "2025-12-30", landmarkName: "New Year's Day" },
  { id: "cm-04", phrase: "Women's Day ke time pe cramps the", language: "code-mixed", expectedDate: "2026-03-08", landmarkName: "International Women's Day" },
  { id: "cm-05", phrase: "Vishu kazhinja udane spotting", language: "code-mixed", expectedDate: "2026-04-14", landmarkName: "Vishu" },
  { id: "cm-06", phrase: "Christmas time il severe backache", language: "code-mixed", expectedDate: null, expectsClarification: true, landmarkName: "Christmas (future landmark log — expects clarification, no date)" },
  { id: "cm-07", phrase: "Holi ke day pe headache tha", language: "code-mixed", expectedDate: null, expectsClarification: true, landmarkName: "Holi (unverified — expects clarification, no date)" },
  { id: "cm-08", phrase: "Valentine's Day nu munpe medium flow", language: "code-mixed", expectedDate: "2026-02-13", landmarkName: "Valentine's Day" },
  { id: "cm-09", phrase: "Marathon season ke time cycle", language: "code-mixed", expectedDate: null, expectsClarification: true, landmarkName: "Global Marathon Season (unverified — expects clarification, no date)" },
  { id: "cm-10", phrase: "Diwali kazhinjittu 3 days after", language: "code-mixed", expectedDate: null, expectsClarification: true, landmarkName: "Diwali (future landmark log — expects clarification, no date)" },
  { id: "cm-11", phrase: "Christmas time trip plan und", language: "code-mixed", expectedDate: "2026-12-25", landmarkName: "Christmas (plan phrase)" },
  { id: "cm-12", phrase: "Winter break ke time light spotting", language: "code-mixed", expectedDate: null, expectsClarification: true, landmarkName: "Winter Holiday Break (unverified — expects clarification, no date)" },
];
