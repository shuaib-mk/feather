// Generated self-contained serverless bundle (Vercel & Netlify compatible)

// ai/backend/config.ts
function getConfig() {
  if (typeof process !== "undefined" && typeof process.loadEnvFile === "function") {
    try {
      process.loadEnvFile();
    } catch {
    }
  }
  const env = typeof process !== "undefined" && process?.env ? process.env : {};
  const useBaseten = env.USE_BASETEN === "true";
  const metaApiKey = env.META_API_KEY || "";
  const basetenApiKey = env.BASETEN_API_KEY || "";
  return {
    metaApiKey,
    metaBaseUrl: env.META_BASE_URL || "https://api.meta.ai/v1",
    museVoiceModel: env.MUSE_VOICE_MODEL || "muse-voice-transcribe-1.0",
    museSparkModel: env.MUSE_SPARK_MODEL || "muse-spark-1.3",
    basetenApiKey,
    basetenBaseUrl: env.BASETEN_BASE_URL || "https://bridge.baseten.co/v1",
    useBaseten,
    port: parseInt(env.PORT || "3001", 10)
  };
}

// ai/backend/guardrail.ts
var MEDICAL_REFUSAL_MESSAGE = "I can only help with logging and planning. For health questions, please talk to a doctor.";
var MEDICAL_ADVICE_PATTERNS = [
  // English: Questions asking if a symptom/situation is normal, safe, okay, bad, or concerning
  /\b(?:is\s+(?:this|it|that|there)\s+(?:normal|abnormal|bad|dangerous|concerning|okay|safe))\b/i,
  /\b(?:is\s+(?:it|this|that)\s+(?:normal|safe|okay|bad|dangerous|concerning)\s+to)\b/i,
  /\b(?:is\s+it\s+(?:bad|abnormal|dangerous|concerning|normal)\s+(?:if|that|when))\b/i,
  /\b(?:is\s+(?:my|this)\s+(?:cramp|cramps|pain|period|flow|bleeding|blood|discharge|symptom)\s+(?:normal|abnormal|bad|dangerous|concerning))\b/i,
  /\b(?:is\s+(?:this|the|my)?\s*(?:symptom|cramp|bleeding|discharge)?\s*(?:abnormal\s+or\s+normal|normal\s+or\s+abnormal))\b/i,
  /\b(?:is\s+(?:there\s+)?(?:something|anything)\s+(?:wrong|abnormal|off))\b/i,
  /\b(?:normal\s+or\s+(?:not|abnormal))\b/i,
  /\b(?:abnormal\s+or\s+normal)\b/i,
  /\b(?:should\s+i\s+(?:take|see|visit|worry|stop|start|drink|eat|use|be\s+concerned|go\s+to\s+(?:the\s+)?doctor))\b/i,
  // English: Medication advice, dosage & recommendation inquiries
  /\b(?:what|which)\s+(?:medicine|medication|tablet|pill|drug|painkiller|dosage)\b/i,
  /\b(?:what\s+(?:medicine|pill|tablet)\s+should\s+i\s+take)\b/i,
  /\b(?:best|recommended|good)\s+(?:tablet|pill|medicine|drug|painkiller|remedy)\s+for\s+(?:period|cramp|cramps|pain|bleeding)\b/i,
  /\b(?:how\s+much|how\s+many)\s+(?:paracetamol|ibuprofen|meftal|aspirin|naproxen|dosage|tablets?|pills?|medicine)\b/i,
  /\b(?:recommended\s+dosage|safe\s+dosage|dosage\s+of)\b/i,
  /\b(?:should\s+i\s+take|can\s+i\s+take|do\s+i\s+take|ought\s+i\s+to\s+take|is\s+it\s+(?:safe|okay)\s+to\s+take)\s+(?:[\w\s]{0,20})?\s*(?:paracetamol|ibuprofen|meftal|aspirin|antibiotic|naproxen|painkiller|birth\s+control\s+pill|medicine)\b/i,
  /\b(?:paracetamol|ibuprofen|meftal|aspirin|naproxen|tylenol|advil)(?:\s+\d+)?\s+(?:[\w\s]{0,15}?\s+)?(?:for\s+(?:cramps?|pain|period)\s+(?:ok|okay|safe|good|recommended)\b|\bok\s*\?|\bsafe\s*\?)/i,
  // English: Diagnosis & medical conditions inquiry
  /\b(?:diagnos(?:e|is)|am\s+i\s+sick|what\s+disease\s+do\s+i\s+have)\b/i,
  /\b(?:do\s+i\s+have|could\s+(?:this(?:\s+symptom)?|i)\s+(?:be|have)|might\s+(?:this|i)\s+(?:be|have))\s+(?:a\s+|an\s+)?(?:pcos|pcod|endometriosis|fibroid|infection|cyst|cancer|tumor|disease|miscarriage|yeast\s+infection|vaginosis|disorder|condition)\b/i,
  /\b(?:symptoms?\s+of\s+(?:pcos|pcod|endometriosis|infection|fibroid|cancer|pregnancy|miscarriage|cyst))\b/i,
  // English: Fertility, pregnancy risk & etiology inquiries
  /\b(?:can\s+i\s+get\s+pregnant|could\s+i\s+be\s+pregnant|am\s+i\s+pregnant|risk\s+of\s+pregnancy|prevent\s+pregnancy|contracept(?:ion|ive))\b/i,
  /\b(?:is\s+[\w\s]{0,25}?\s*(?:a\s+)?(?:sign|symptom|indication)s?\s+of\s+(?:pregnancy|disease|infection|miscarriage))\b/i,
  /\b(?:pregnancy\s+advice|fertility\s+treatment|fertile\s+enough\s+to\s+conceive)\b/i,
  /\b(?:what\s+does\s+(?:a|my)?\s*(?:missed|late|delayed|skipped)\s+period\s+mean)\b/i,
  /\b(?:why\s+is\s+(?:my|the)?\s*period\s+(?:so\s+)?(?:late|delayed|missing))\b/i,
  /\b(?:causes?\s+of\s+(?:a\s+)?(?:missed|late|delayed)\s+period)\b/i,
  /\b(?:can\s+(?:stress|diet|exercise|travel|weight|illness|anxiety)\s+(?:delay|stop|cause)\s+(?:my|a)?\s*period)\b/i,
  // English: Symptom interpretation inquiries
  /\b(?:why\s+is\s+(?:my|the)\s+(?:blood|period|cramp|flow|discharge)\s+(?:so|black|brown|smelly|weird|burning|painful))\b/i,
  /\b(?:heavy\s+clots|black\s+blood|brown\s+discharge|smelly\s+discharge|foul\s+odou?r|burning\s+sensation)\b/i,
  /\b(?:can\s+you\s+(?:cure|treat|diagnose|prescribe|interpret))\b/i,
  /\b(?:how\s+to\s+(?:cure|treat|relieve|fix))\b/i,
  // Spanish: Medical, medication, diagnosis, pregnancy risk
  /(?:es\s+normal\s+(?:esto|tener)|deber[ií]a\s+preocuparme|qu[eé]\s+(?:debo\s+tomar|medicina|medicamento|pastilla)|dosis\s+de|dosis\s+recom|puedo\s+quedar\s+embarazada|estoy\s+embarazada|tengo\s+(?:pcos|infecci[oó]n|endometriosis)|s[ií]ntomas\s+de|c[oó]mo\s+curar|c[oó]mo\s+tratar|diagn[oó]stico|qu[eé]\s+enfermedad|debo\s+ir\s+al\s+m[eé]dico)/i,
  // Malayalam: Advice, prescription requests, illness inquiries, pregnancy risk, delay etiology
  /(?:എന്തെങ്കിലും\s+മരുന്ന്\s+കഴിക്കണോ|എന്ത്\s+മരുന്ന്|മരുന്ന്\s+കഴിക്കണോ|ഗുളിക\s+കഴിക്കണോ|ഡോക്ടറെ\s+കാണണോ|ഡോക്ടറോട്\s+ചോദിക്കണോ|വയറുവേദനയ്ക്ക്\s+എന്ത്|എന്ത്\s+കഴിക്കണം|എന്തെങ്കിലും\s+(?:രോഗം|അസുഖം)\s+ആണോ|ഇത്\s+എന്തെങ്കിലും\s+രോഗം|ചികിത്സ\s+(?:വേണമോ|ആവശ്യമുണ്ടോ)|കുഴപ്പമുണ്ടോ|സാധാരണമാണോ|പേടിക്കണോ|ഗർഭിണിയാകുമോ|പിസിഒഡി|പിസിഒഎസ്|അസുഖം\s+ഉണ്ടോ|രോഗം\s+ഉണ്ടോ|പീരിയഡ്\s+(?:വൈകുന്നത്|വൈകാൻ)\s+(?:എന്തുകൊണ്ട്|കാരണം)|വൈകുന്നത്\s+എന്തുകൊണ്ട്)/i,
  // Hindi: Advice, prescription requests, illness inquiries, pregnancy risk, delay etiology
  /(?:दर्द\s+के\s+लिए\s+कौन\s+सी\s+दवा|क्या\s+दवा\s+लूँ|कौन\s+सी\s+दवा|दवा\s+लेनी\s+चाहिए|डॉक्टर\s+को\s+दिखाना\s+चाहिए|डॉक्टर\s+के\s+पास\s+जाना|क्या\s+मुझे\s+कोई\s+बीमारी|क्या\s+यह\s+सामान्य\s+है|क्या\s+मुझे\s+चिंता\s+करनी\s+चाहिए|क्या\s+मैं\s+गर्भवती|कितनी\s+खुराक|खुराक\s+कितनी|इलाज\s+कैसे|पीसीओडी|पीसीओएस|खतरनाक|बीमारी\s+है|पीरियड\s+(?:लेट|देर)\s+क्यों|लेट\s+क्यों\s+हो\s+रहा)/i,
  // Code-Mixed: Advice, medication, pregnancy risk, diagnostic queries
  /(?:which\s+medicine\s+should\s+i\s+take|tablet\s+ethu\s+kazhikkanam|doctor\s+ko\s+dikhana\s+chahiye|risk\s+of\s+pregnancy\s+undo|normal\s+hai\s+ya\s+doctor)/i
];
function checkMedicalAdviceGuardrail(input) {
  const normalized = input.trim();
  if (!normalized) {
    return { isRefusal: false, refusalMessage: null };
  }
  for (const pattern of MEDICAL_ADVICE_PATTERNS) {
    if (pattern.test(normalized)) {
      return {
        isRefusal: true,
        refusalMessage: MEDICAL_REFUSAL_MESSAGE
      };
    }
  }
  return { isRefusal: false, refusalMessage: null };
}

// ai/backend/milestonesData.ts
var MILESTONES_DATA = [
  {
    name: "New Year's Day",
    aliases: [
      "new year",
      "new year's day",
      "new years",
      "jan 1",
      "\u0D28\u0D4D\u0D2F\u0D42 \u0D07\u0D2F\u0D7C",
      "\u0D2A\u0D41\u0D24\u0D41\u0D35\u0D24\u0D4D\u0D38\u0D30\u0D02",
      "\u0928\u090F \u0938\u093E\u0932",
      "\u0928\u092F\u093E \u0938\u093E\u0932",
      "\u0928\u094D\u092F\u0942 \u0908\u092F\u0930"
    ],
    kind: "milestone",
    dates: {
      "2025": "2025-01-01",
      "2026": "2026-01-01",
      "2027": "2027-01-01"
    }
  },
  {
    name: "Valentine's Day",
    aliases: [
      "valentine",
      "valentines",
      "valentine's day",
      "\u0D35\u0D3E\u0D32\u0D28\u0D4D\u0D31\u0D48\u0D7B\u0D38\u0D4D",
      "\u0935\u0948\u0932\u0947\u0902\u091F\u093E\u0907\u0928 \u0921\u0947",
      "\u0935\u0948\u0932\u0947\u0902\u091F\u093E\u0907\u0928"
    ],
    kind: "milestone",
    dates: {
      "2025": "2025-02-14",
      "2026": "2026-02-14",
      "2027": "2027-02-14"
    }
  },
  {
    name: "International Women's Day",
    aliases: [
      "women's day",
      "womens day",
      "international women's day",
      "iwd",
      "\u0D35\u0D28\u0D3F\u0D24\u0D3E \u0D26\u0D3F\u0D28\u0D02",
      "\u0D35\u0D28\u0D3F\u0D24\u0D3E\u0D26\u0D3F\u0D28\u0D02",
      "\u092E\u0939\u093F\u0932\u093E \u0926\u093F\u0935\u0938"
    ],
    kind: "milestone",
    dates: {
      "2025": "2025-03-08",
      "2026": "2026-03-08",
      "2027": "2027-03-08"
    }
  },
  {
    name: "Spring Equinox (Rejuvenation Window)",
    aliases: ["spring equinox", "vernal equinox", "first day of spring"],
    kind: "milestone",
    dates: {
      "2025": "2025-03-20",
      "2026": "2026-03-20",
      "2027": "2027-03-20"
    }
  },
  {
    name: "Earth Day",
    aliases: ["earth day", "\u0D2D\u0D42\u0D2E\u0D3F \u0D26\u0D3F\u0D28\u0D02", "\u0905\u0930\u094D\u0925 \u0921\u0947", "\u092A\u0943\u0925\u094D\u0935\u0940 \u0926\u093F\u0935\u0938"],
    kind: "milestone",
    dates: {
      "2025": "2025-04-22",
      "2026": "2026-04-22",
      "2027": "2027-04-22"
    }
  },
  {
    name: "Summer Solstice (Peak Travel Season)",
    aliases: ["summer solstice", "longest day", "first day of summer"],
    kind: "milestone",
    dates: {
      "2025": "2025-06-21",
      "2026": "2026-06-21",
      "2027": "2027-06-21"
    }
  },
  {
    name: "Midsummer Vacation Season",
    aliases: [
      "midsummer vacation break",
      "midsummer vacation",
      "midsummer break",
      "summer vacation",
      "july holidays",
      "\u0D35\u0D47\u0D28\u0D7D \u0D05\u0D35\u0D27\u0D3F",
      "\u0D35\u0D47\u0D28\u0D32\u0D35\u0D27\u0D3F",
      "\u0917\u0930\u094D\u092E\u0940 \u0915\u0940 \u091B\u0941\u091F\u094D\u091F\u0940"
    ],
    kind: "milestone",
    dates: {
      "2025": "2025-07-15",
      "2026": "2026-07-15",
      "2027": "2027-07-15"
    }
  },
  {
    name: "Late Summer Getaway",
    aliases: ["late summer", "august getaway", "summer retreat"],
    kind: "milestone",
    dates: {
      "2025": "2025-08-20",
      "2026": "2026-08-20",
      "2027": "2027-08-20"
    }
  },
  {
    name: "Autumn Equinox (Focus Season)",
    aliases: ["autumn equinox", "fall equinox", "first day of fall", "back to school"],
    kind: "milestone",
    dates: {
      "2025": "2025-09-22",
      "2026": "2026-09-22",
      "2027": "2027-09-22"
    }
  },
  {
    name: "Global Marathon Season",
    aliases: ["marathon season", "fall marathon", "october race", "\u092E\u0948\u0930\u093E\u0925\u0928"],
    kind: "milestone",
    dates: {
      "2025": "2025-10-18",
      "2026": "2026-10-18",
      "2027": "2027-10-18"
    }
  },
  {
    name: "Winter Holiday Break",
    aliases: [
      "winter holiday break",
      "winter break",
      "winter holidays",
      "holiday break",
      "end of year break",
      "christmas holidays",
      "\u0936\u0940\u0924\u0915\u093E\u0932\u0940\u0928 \u0905\u0935\u0915\u093E\u0936"
    ],
    kind: "milestone",
    dates: {
      "2025": "2025-12-24",
      "2026": "2026-12-24",
      "2027": "2027-12-24"
    }
  },
  {
    name: "New Year's Eve Gala",
    aliases: [
      "new year's eve",
      "new years eve",
      "nye",
      "dec 31",
      "\u0D28\u0D4D\u0D2F\u0D42 \u0D07\u0D2F\u0D7C \u0D08\u0D35\u0D4D",
      "\u0D2A\u0D41\u0D24\u0D41\u0D35\u0D24\u0D4D\u0D38\u0D30 \u0D30\u0D3E\u0D35\u0D4D",
      "\u0928\u094D\u092F\u0942 \u0908\u092F\u0930 \u0908\u0935"
    ],
    kind: "milestone",
    dates: {
      "2025": "2025-12-31",
      "2026": "2026-12-31",
      "2027": "2027-12-31"
    }
  },
  {
    name: "Diwali (Festival of Lights)",
    aliases: [
      "diwali",
      "deepavali",
      "\u0926\u0940\u0935\u093E\u0932\u0940",
      "\u0D26\u0D40\u0D2A\u0D3E\u0D35\u0D32\u0D3F",
      "\u0D26\u0D40\u0D2A\u0D3E\u0D35\u0D32\u0D3F\u0D15\u0D4D\u0D15\u0D4D",
      "\u0926\u093F\u0935\u093E\u0932\u0940",
      "festival of lights"
    ],
    kind: "milestone",
    dates: {
      "2025": "2025-10-20",
      "2026": "2026-11-08",
      "2027": "2027-10-29"
    }
  },
  {
    name: "Onam (Harvest Festival)",
    aliases: [
      "onam",
      "thiruvonam",
      "\u0D13\u0D23\u0D02",
      "\u0D13\u0D23\u0D24\u0D4D\u0D24\u0D3F\u0D28\u0D4D",
      "\u0D24\u0D3F\u0D30\u0D41\u0D35\u0D4B\u0D23\u0D02"
    ],
    kind: "milestone",
    dates: {
      "2025": "2025-09-05",
      "2026": "2026-08-26",
      "2027": "2027-09-12"
    }
  },
  {
    name: "Vishu (New Year)",
    aliases: [
      "vishu",
      "\u0D35\u0D3F\u0D37\u0D41",
      "\u0D35\u0D3F\u0D37\u0D41\u0D35\u0D3F\u0D28\u0D4D"
    ],
    kind: "milestone",
    dates: {
      "2025": "2025-04-14",
      "2026": "2026-04-14",
      "2027": "2027-04-14"
    }
  },
  {
    name: "Holi (Festival of Colours)",
    aliases: [
      "holi",
      "\u0939\u094B\u0932\u0940",
      "\u0D39\u0D4B\u0D33\u0D3F"
    ],
    kind: "milestone",
    dates: {
      "2025": "2025-03-14",
      "2026": "2026-03-03",
      "2027": "2027-03-22"
    }
  },
  {
    name: "Christmas",
    aliases: [
      "christmas",
      "xmas",
      "\u0D15\u0D4D\u0D30\u0D3F\u0D38\u0D4D\u0D2E\u0D38\u0D4D",
      "\u0D15\u0D4D\u0D30\u0D3F\u0D38\u0D4D\u0D2E\u0D38\u0D3F\u0D28\u0D4D",
      "\u0D15\u0D4D\u0D30\u0D3F\u0D38\u0D4D\u0D24\u0D41\u0D2E\u0D38\u0D4D",
      "\u0915\u094D\u0930\u093F\u0938\u092E\u0938"
    ],
    kind: "milestone",
    dates: {
      "2025": "2025-12-25",
      "2026": "2026-12-25",
      "2027": "2027-12-25"
    }
  }
];

// ai/backend/dateArithmetic.ts
var WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
function applyDayOffset(isoDate, offsetDays) {
  if (!offsetDays) return isoDate;
  const d = /* @__PURE__ */ new Date(isoDate + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}
function findWeekdayOffset(baseIsoDate, targetWeekdayName, direction) {
  const targetDayIdx = WEEKDAYS.indexOf(targetWeekdayName.toLowerCase());
  if (targetDayIdx === -1) return baseIsoDate;
  const baseDate = /* @__PURE__ */ new Date(baseIsoDate + "T12:00:00Z");
  const baseDayIdx = baseDate.getUTCDay();
  let diffDays = 0;
  if (direction === "before") {
    diffDays = (baseDayIdx - targetDayIdx + 7) % 7;
    if (diffDays === 0) diffDays = 7;
    return applyDayOffset(baseIsoDate, -diffDays);
  } else {
    diffDays = (targetDayIdx - baseDayIdx + 7) % 7;
    if (diffDays === 0) diffDays = 7;
    return applyDayOffset(baseIsoDate, diffDays);
  }
}
function matchesAlias(haystack, needle) {
  if (!needle) return false;
  const lowerNeedle = needle.toLowerCase().trim();
  if (/^[a-z0-9\s'-]+$/i.test(lowerNeedle)) {
    const escaped = lowerNeedle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`\\b${escaped}\\b`, "i").test(haystack);
  }
  return haystack.includes(lowerNeedle);
}
function parseRelativeExpression(text) {
  const lower = text.toLowerCase();
  const weekdayMatch = lower.match(
    /\b(?:the\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s+(before|prior to|ahead of|after|following)\b/i
  );
  if (weekdayMatch) {
    const weekday = weekdayMatch[1].toLowerCase();
    const dirStr = weekdayMatch[2].toLowerCase();
    const direction = dirStr.includes("before") || dirStr.includes("prior") || dirStr.includes("ahead") ? "before" : "after";
    return { days: 0, weekday, direction };
  }
  if (lower.includes("\u0D30\u0D23\u0D4D\u0D1F\u0D4D \u0D26\u0D3F\u0D35\u0D38\u0D02 \u0D2E\u0D41\u0D7B\u0D2A\u0D4D") || lower.includes("2 \u0D26\u0D3F\u0D35\u0D38\u0D02 \u0D2E\u0D41\u0D7B\u0D2A\u0D4D")) return { days: -2, direction: "before" };
  if (lower.includes("\u0D12\u0D30\u0D41 \u0D26\u0D3F\u0D35\u0D38\u0D02 \u0D2E\u0D41\u0D7B\u0D2A\u0D4D") || lower.includes("1 \u0D26\u0D3F\u0D35\u0D38\u0D02 \u0D2E\u0D41\u0D7B\u0D2A\u0D4D")) return { days: -1, direction: "before" };
  if (lower.includes("\u0D2E\u0D42\u0D28\u0D4D\u0D28\u0D4D \u0D26\u0D3F\u0D35\u0D38\u0D02 \u0D2E\u0D41\u0D7B\u0D2A\u0D4D") || lower.includes("3 \u0D26\u0D3F\u0D35\u0D38\u0D02 \u0D2E\u0D41\u0D7B\u0D2A\u0D4D")) return { days: -3, direction: "before" };
  if (lower.includes("\u0D26\u0D3F\u0D35\u0D38\u0D02 \u0D2E\u0D41\u0D7B\u0D2A\u0D4D") || lower.includes("\u0D2E\u0D41\u0D7B\u0D2A\u0D4D") || lower.includes("munpe")) return { days: -1, direction: "before" };
  if (lower.includes("\u0926\u094B \u0926\u093F\u0928 \u092A\u0939\u0932\u0947") || lower.includes("2 \u0926\u093F\u0928 \u092A\u0939\u0932\u0947")) return { days: -2, direction: "before" };
  if (lower.includes("\u090F\u0915 \u0926\u093F\u0928 \u092A\u0939\u0932\u0947") || lower.includes("1 \u0926\u093F\u0928 \u092A\u0939\u0932\u0947") || lower.includes("\u0938\u0947 \u090F\u0915 \u0926\u093F\u0928 \u092A\u0939\u0932\u0947")) return { days: -1, direction: "before" };
  if (lower.includes("\u0924\u0940\u0928 \u0926\u093F\u0928 \u092A\u0939\u0932\u0947") || lower.includes("3 \u0926\u093F\u0928 \u092A\u0939\u0932\u0947")) return { days: -3, direction: "before" };
  if (lower.includes("\u092A\u0939\u0932\u0947") || lower.includes("pehle")) return { days: -1, direction: "before" };
  const offsetRegex = /(?:(\d+|one|two|three|four|five|six|seven|eight|nine|ten|a|an|the)\s+)?days?\s+(before|prior to|ahead of|after|following)/i;
  const m = lower.match(offsetRegex);
  if (m) {
    const numStr = (m[1] || "1").toLowerCase();
    let count = 1;
    const wordMap = {
      one: 1,
      two: 2,
      three: 3,
      four: 4,
      five: 5,
      six: 6,
      seven: 7,
      eight: 8,
      nine: 9,
      ten: 10,
      a: 1,
      an: 1,
      the: 1
    };
    if (/^\d+$/.test(numStr)) {
      count = parseInt(numStr, 10);
    } else if (wordMap[numStr] !== void 0) {
      count = wordMap[numStr];
    }
    const dirStr = m[2].toLowerCase();
    const isBefore = dirStr.includes("before") || dirStr.includes("prior") || dirStr.includes("ahead");
    return { days: isBefore ? -count : count, direction: isBefore ? "before" : "after" };
  }
  const singleDayMatch = lower.match(/\b(?:the\s+)?day\s+(before|after)\b/i);
  if (singleDayMatch) {
    const isBefore = singleDayMatch[1].toLowerCase() === "before";
    return { days: isBefore ? -1 : 1, direction: isBefore ? "before" : "after" };
  }
  if (lower.includes("2 days after") || lower.includes("kazhinju 2 days") || lower.includes("kazhinjittu 3 days")) {
    if (lower.includes("3 days")) return { days: 3, direction: "after" };
    return { days: 2, direction: "after" };
  }
  return { days: 0 };
}
function resolveLandmarkExpression(text, today) {
  const lower = text.toLowerCase();
  const currentYear = parseInt(today.slice(0, 4), 10);
  const sortedMilestones = [...MILESTONES_DATA].sort((a, b) => {
    const maxA = Math.max(a.name.length, ...a.aliases.map((al) => al.length));
    const maxB = Math.max(b.name.length, ...b.aliases.map((al) => al.length));
    return maxB - maxA;
  });
  for (const fest of sortedMilestones) {
    const matchesLandmark = matchesAlias(lower, fest.name) || fest.aliases.some((a) => matchesAlias(lower, a));
    if (matchesLandmark) {
      let baseDate = null;
      const explicitYearMatch = lower.match(/\b(202[5-7])\b/);
      if (explicitYearMatch && fest.dates[explicitYearMatch[1]]) {
        baseDate = fest.dates[explicitYearMatch[1]];
      } else if (lower.includes("next year")) {
        const nextYear = String(currentYear + 1);
        baseDate = fest.dates[nextYear] || fest.dates["2027"];
      } else if (lower.includes("last ") || lower.includes("past ") || lower.includes("\u0D15\u0D34\u0D3F\u0D1E\u0D4D\u0D1E") || lower.includes("\u092A\u093F\u091B\u0932\u0940")) {
        const pastDates = Object.values(fest.dates).filter((d) => typeof d === "string" && d <= today).sort();
        baseDate = pastDates.length > 0 ? pastDates[pastDates.length - 1] : null;
      } else if (fest.dates[String(currentYear)]) {
        baseDate = fest.dates[String(currentYear)];
      } else {
        const allDates = Object.values(fest.dates).sort();
        baseDate = allDates[0] || null;
      }
      if (!baseDate) continue;
      const rel = parseRelativeExpression(lower);
      let finalDate = baseDate;
      if (rel.weekday && rel.direction) {
        finalDate = findWeekdayOffset(baseDate, rel.weekday, rel.direction);
      } else if (rel.days !== 0) {
        finalDate = applyDayOffset(baseDate, rel.days);
      }
      return {
        found: true,
        landmarkName: fest.name,
        baseDate,
        resolvedDate: finalDate,
        isApproximate: true
      };
    }
  }
  return {
    found: false,
    landmarkName: null,
    baseDate: null,
    resolvedDate: null,
    isApproximate: false
  };
}
function applySlipCorrections(current, correctionText) {
  const updated = { ...current, symptoms: [...current.symptoms || []] };
  const lower = correctionText.toLowerCase();
  const changes = [];
  const dayMatch = lower.match(
    /\b(?:no,?\s+)?(?:make\s+it\s+(?:the\s+)?|change\s+(?:the\s+)?date\s+to\s+(?:the\s+)?|actually\s+(?:it\s+was\s+)?(?:the\s+)?|set\s+date\s+to\s+(?:the\s+)?|on\s+the\s+)(\d{1,2})(?:st|nd|rd|th)?\b/i
  );
  if (dayMatch) {
    const dayNum = parseInt(dayMatch[1], 10);
    if (dayNum >= 1 && dayNum <= 31) {
      const parts = (updated.date || (/* @__PURE__ */ new Date()).toISOString().slice(0, 10)).split("-");
      const year = parts[0];
      const month = parts[1];
      const newDayStr = String(dayNum).padStart(2, "0");
      updated.date = `${year}-${month}-${newDayStr}`;
      changes.push(`Date updated to ${updated.date}`);
    }
  }
  const flowMatch = lower.match(/\b(?:change\s+flow\s+to|flow\s+(?:to|is|was)|make\s+flow)\s+(none|spotting|light|medium|heavy)\b/i);
  if (flowMatch) {
    updated.flow = flowMatch[1].toLowerCase();
    changes.push(`Flow updated to ${updated.flow}`);
  } else {
    if (lower.includes("heavy flow") || lower.includes("flow heavy")) {
      updated.flow = "heavy";
      changes.push("Flow set to heavy");
    } else if (lower.includes("light flow") || lower.includes("flow light")) {
      updated.flow = "light";
      changes.push("Flow set to light");
    } else if (lower.includes("medium flow") || lower.includes("flow medium")) {
      updated.flow = "medium";
      changes.push("Flow set to medium");
    } else if (lower.includes("spotting")) {
      updated.flow = "spotting";
      changes.push("Flow set to spotting");
    }
  }
  for (const sym of VALID_SYMPTOMS) {
    const symKey = sym.replace("_", " ");
    const addPattern = new RegExp(`\\b(?:add|include|also\\s+had|and)\\s+${symKey}\\b`, "i");
    if (addPattern.test(lower) || lower.includes(symKey) && !lower.includes(`remove ${symKey}`) && !lower.includes(`no ${symKey}`)) {
      if (!updated.symptoms.includes(sym)) {
        updated.symptoms.push(sym);
        changes.push(`Added symptom: ${symKey}`);
      }
    }
  }
  for (const sym of VALID_SYMPTOMS) {
    const symKey = sym.replace("_", " ");
    const removePattern = new RegExp(`\\b(?:remove|delete|no|without)\\s+${symKey}\\b`, "i");
    if (removePattern.test(lower)) {
      const idx = updated.symptoms.indexOf(sym);
      if (idx !== -1) {
        updated.symptoms.splice(idx, 1);
        changes.push(`Removed symptom: ${symKey}`);
      }
    }
  }
  const moodWords = ["Great", "Good", "Okay", "Low", "Irritable", "Anxious", "Emotional", "Calm"];
  for (const m of moodWords) {
    if (lower.includes(m.toLowerCase())) {
      updated.mood = m;
      changes.push(`Mood updated to ${m}`);
      break;
    }
  }
  const energyMatch = lower.match(/\benergy\s+(?:is|to|level)?\s*([1-5])\b/i);
  if (energyMatch) {
    updated.energy = parseInt(energyMatch[1], 10);
    changes.push(`Energy level set to ${updated.energy}`);
  }
  return { updated, changes };
}

// ai/backend/agent.ts
var VALID_SYMPTOMS = [
  "cramps",
  "headache",
  "backache",
  "bloating",
  "breast_tenderness",
  "acne",
  "fatigue",
  "cravings",
  "nausea",
  "mood_swings",
  "anxiety",
  "insomnia",
  "dizziness",
  "appetite_change"
];
var TOOLS = [
  {
    type: "function",
    function: {
      name: "log_entry",
      description: "Creates or updates a structured cycle/daily log entry from user's voice message.",
      parameters: {
        type: "object",
        properties: {
          date: {
            type: "string",
            description: "Calendar date in YYYY-MM-DD format. Defaults to current date if not specified."
          },
          flow: {
            type: "string",
            enum: ["none", "spotting", "light", "medium", "heavy"],
            description: "Menstrual flow level."
          },
          symptoms: {
            type: "array",
            items: {
              type: "string",
              enum: VALID_SYMPTOMS
            },
            description: "List of symptoms from the app's 14 supported keys."
          },
          mood: {
            type: "string",
            description: "User mood (e.g., Great, Good, Okay, Low, Irritable, Anxious, Emotional, Calm)."
          },
          energy: {
            type: "integer",
            minimum: 1,
            maximum: 5,
            description: "Energy rating from 1 (lowest) to 5 (highest)."
          },
          sleep: {
            type: "number",
            description: "Hours of sleep."
          },
          notes: {
            type: "string",
            description: "Any extra notes or transcribed remarks."
          },
          isApproximate: {
            type: "boolean",
            description: "Set to true if date was recalled relative to a milestone or life event."
          },
          landmarkName: {
            type: "string",
            description: "Name of calendar landmark or life event if applicable (e.g. New Year's Day, Marathon, Flight)."
          }
        },
        required: ["date"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "update_entry",
      description: "Applies conversational corrections to a pending Accession Slip (e.g. date change, adding/removing symptoms, modifying flow).",
      parameters: {
        type: "object",
        properties: {
          date: { type: "string", description: "YYYY-MM-DD" },
          flow: { type: "string", enum: ["none", "spotting", "light", "medium", "heavy"] },
          addSymptoms: { type: "array", items: { type: "string", enum: VALID_SYMPTOMS } },
          removeSymptoms: { type: "array", items: { type: "string", enum: VALID_SYMPTOMS } },
          mood: { type: "string" },
          energy: { type: "integer", minimum: 1, maximum: 5 }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "milestone_lookup",
      description: "Looks up dates for global calendar and seasonal milestones in 2025, 2026, and 2027 for landmark date recall (e.g. New Year's Day, Valentine's Day, International Women's Day, Spring Equinox, Summer Solstice, Global Marathon Season, Autumn Equinox, Winter Holiday Break, New Year's Eve).",
      parameters: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description: "Name of milestone (e.g. New Year's Day, International Women's Day, Summer Solstice, Winter Holiday Break, New Year's Eve)."
          },
          year: {
            type: "integer",
            description: "Year (2025, 2026, or 2027). Defaults to current or most recent year."
          }
        },
        required: ["name"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_cycle_history",
      description: "Retrieves user's cycle averages, past periods, and predicted next window.",
      parameters: {
        type: "object",
        properties: {}
      }
    }
  },
  {
    type: "function",
    function: {
      name: "check_overlap",
      description: "Checks whether upcoming life events (marathons, flights, exams, vacations, weddings) overlap the predicted period window.",
      parameters: {
        type: "object",
        properties: {
          events: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                date: { type: "string", description: "YYYY-MM-DD" }
              },
              required: ["name", "date"]
            }
          }
        },
        required: ["events"]
      }
    }
  }
];
var SYSTEM_PROMPT = `You are Feather, a voice-first menstrual logging and planning companion built for women globally.
You help women log their cycle, recall past periods relative to universal calendar landmarks (Landmark Recall), and plan around upcoming life events such as flights, marathons, work sprints, exams, and vacations (Plan Around It).
You support natural conversational speech in any language with seamless multilingual recognition.

CRITICAL NON-NEGOTIABLE SAFETY RULES:
1. STRICT MEDICAL & HEALTH REFUSAL:
   - NEVER give medical advice, interpret symptoms, diagnose conditions, recommend medication or dosages, or provide fertility, contraception, or pregnancy-risk guidance.
   - You MUST NEVER use words like "safe", "guaranteed", "clear window", or anything implying pregnancy or fertility safety.
   - If the user asks ANY question seeking medical diagnosis, symptom interpretation, medication, treatment, or pregnancy risk, you MUST refuse immediately with this exact fixed message and nothing else:
     "I can only help with logging and planning. For health questions, please talk to a doctor."

2. PURE LOGGING & PLANNING CAPABILITIES:
   - Voice Logging: Extract date, flow, symptoms, mood, energy (1-5), sleep (hours), and notes. Call tool \`log_entry\`.
   - Slip Correction: If the user provides conversational corrections to a pending slip ("no, make it the 3rd", "add headache", "change flow to light"), call \`update_entry\`.
   - Landmark Recall: If user gives fuzzy dates ("around New Year's", "after International Women's Day", "two days before vacation"), call tool \`milestone_lookup\`. If ambiguous, ask a polite, concise clarifying question ("Was it before or after New Year's?").
   - Plan Around It: If user mentions upcoming events ("marathon on Nov 15, flight to Tokyo on Dec 4, exam on Oct 10"), call \`check_overlap\`. Use ONLY neutral scheduling language: "Likely overlap", "Possible overlap", or "Unlikely to overlap (estimate)". Never imply certainty or guarantees.

Tone: Warm, respectful, concise, neutral, non-medical.`;
async function runLavenderAgent(userPrompt, context = {}, conversationHistory = []) {
  const startTime = Date.now();
  const activityTrail = [];
  const toolCallsRecorded = [];
  const guardrailCheck = checkMedicalAdviceGuardrail(userPrompt);
  if (guardrailCheck.isRefusal) {
    activityTrail.push({
      step: "Safety Guardrail",
      detail: "Medical advice request intercepted",
      status: "done"
    });
    return {
      message: MEDICAL_REFUSAL_MESSAGE,
      needsClarification: false,
      activityTrail,
      toolCalls: toolCallsRecorded
    };
  }
  const today = context.currentDate || (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  if (context.pendingEntry) {
    const correctionRes = applySlipCorrections(context.pendingEntry, userPrompt);
    if (correctionRes.changes.length > 0) {
      toolCallsRecorded.push({
        id: "call_update_" + Date.now(),
        toolName: "update_entry",
        args: { userCorrection: userPrompt },
        result: { updated: correctionRes.updated, changes: correctionRes.changes },
        latencyMs: Math.max(1, Date.now() - startTime),
        model: context.provider === "baseten" ? "meta-models/muse-spark-open-1026" : "muse-spark-1.3"
      });
      activityTrail.push({
        step: "Accession Slip Correction",
        detail: correctionRes.changes.join("; "),
        status: "done"
      });
      return {
        message: "I've updated your Accession Slip with your corrections. Please review below.",
        entry: correctionRes.updated,
        needsClarification: false,
        activityTrail,
        toolCalls: toolCallsRecorded
      };
    }
  }
  activityTrail.push({
    step: "Processing Speech",
    detail: "Parsing voice input with Muse Spark",
    status: "pending"
  });
  const fallbackResult = parseLocally(userPrompt, today, context);
  const config = getConfig();
  const isBaseten = context.provider === "baseten" || config.useBaseten;
  const apiKey = isBaseten ? config.basetenApiKey : config.metaApiKey || config.basetenApiKey;
  const baseUrl = isBaseten ? config.basetenBaseUrl : config.metaBaseUrl;
  const model = isBaseten ? "meta-models/muse-spark-open-1026" : config.museSparkModel;
  if (!apiKey) {
    activityTrail.forEach((a) => a.status = "done");
    return fallbackResult;
  }
  const messages = [
    { role: "system", content: `${SYSTEM_PROMPT}
Today's date is ${today}.` },
    ...conversationHistory,
    { role: "user", content: userPrompt }
  ];
  let structuredEntry = null;
  let planOverlaps = void 0;
  let needsClarification = false;
  let clarificationQuestion = null;
  let finalMessage = "";
  const MAX_STEPS = 5;
  let stepCount = 0;
  try {
    while (stepCount < MAX_STEPS) {
      stepCount++;
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model,
          messages,
          tools: TOOLS,
          tool_choice: "auto",
          temperature: 0.2
        })
      });
      if (!res.ok) {
        const errorText = await res.text();
        console.error(`[Muse Spark] API call failed ${res.status}:`, errorText);
        return fallbackResult;
      }
      const data = await res.json();
      const choice = data.choices?.[0];
      const message = choice?.message;
      if (!message) break;
      messages.push(message);
      const toolCalls = message.tool_calls;
      if (!toolCalls || toolCalls.length === 0) {
        finalMessage = message.content || "";
        break;
      }
      for (const call of toolCalls) {
        const toolCallStart = Date.now();
        const fnName = call.function.name;
        let fnArgs = {};
        try {
          fnArgs = JSON.parse(call.function.arguments);
        } catch {
          fnArgs = {};
        }
        let toolResponseContent = "";
        let toolResultObj = {};
        if (fnName === "milestone_lookup" || fnName === "festival_lookup") {
          const festName = (fnArgs.name || "").toLowerCase();
          let yr = fnArgs.year ? String(fnArgs.year) : void 0;
          activityTrail.push({
            step: "Landmark Recall",
            detail: `Looking up calendar milestone "${fnArgs.name}" for ${yr || "recent"}`,
            status: "done"
          });
          const landmarkRes = resolveLandmarkExpression(fnArgs.name, today);
          if (landmarkRes.found) {
            toolResultObj = {
              milestone: landmarkRes.landmarkName,
              year: yr || landmarkRes.resolvedDate?.slice(0, 4),
              date: landmarkRes.resolvedDate,
              found: true
            };
          } else {
            toolResultObj = {
              found: false,
              message: `Milestone "${fnArgs.name}" date not found in 2025-2027 calendar.`
            };
          }
          toolResponseContent = JSON.stringify(toolResultObj);
        } else if (fnName === "get_cycle_history") {
          activityTrail.push({
            step: "Cycle Baseline",
            detail: "Reading historical cycle pattern",
            status: "done"
          });
          toolResultObj = {
            avgCycleLength: context.cycleStats?.avgCycleLength || 28,
            avgPeriodLength: context.cycleStats?.avgPeriodLength || 5,
            lastPeriodStart: context.cycleStats?.lastPeriodStart || null,
            nextPeriodEarliest: context.cycleStats?.nextPeriodEarliest || null,
            nextPeriodLatest: context.cycleStats?.nextPeriodLatest || null
          };
          toolResponseContent = JSON.stringify(toolResultObj);
        } else if (fnName === "check_overlap") {
          activityTrail.push({
            step: "Plan Around It",
            detail: `Evaluating cycle overlap for ${fnArgs.events?.length || 0} events`,
            status: "done"
          });
          const overlaps = evaluateOverlaps(fnArgs.events || [], context);
          planOverlaps = overlaps;
          toolResultObj = { overlaps };
          toolResponseContent = JSON.stringify(toolResultObj);
        } else if (fnName === "log_entry") {
          activityTrail.push({
            step: "Structured Entry",
            detail: `Prepared log for ${fnArgs.date}`,
            status: "done"
          });
          structuredEntry = {
            date: fnArgs.date || today,
            flow: fnArgs.flow || null,
            symptoms: (fnArgs.symptoms || []).filter((s) => VALID_SYMPTOMS.includes(s)),
            mood: fnArgs.mood || null,
            energy: fnArgs.energy || null,
            sleep: fnArgs.sleep || null,
            notes: fnArgs.notes || null,
            isApproximate: fnArgs.isApproximate || false,
            landmarkName: fnArgs.landmarkName || null
          };
          toolResultObj = { success: true, entry: structuredEntry };
          toolResponseContent = JSON.stringify(toolResultObj);
        } else if (fnName === "update_entry") {
          if (context.pendingEntry) {
            const slipRes = applySlipCorrections(context.pendingEntry, userPrompt);
            structuredEntry = slipRes.updated;
            toolResultObj = { success: true, entry: structuredEntry, changes: slipRes.changes };
          } else {
            toolResultObj = { success: false, error: "No pending slip to update" };
          }
          toolResponseContent = JSON.stringify(toolResultObj);
        }
        toolCallsRecorded.push({
          id: call.id || "call_" + Date.now(),
          toolName: fnName,
          args: fnArgs,
          result: toolResultObj,
          latencyMs: Date.now() - toolCallStart,
          model
        });
        messages.push({
          role: "tool",
          tool_call_id: call.id,
          content: toolResponseContent
        });
      }
    }
    const outputGuard = checkMedicalAdviceGuardrail(finalMessage);
    if (outputGuard.isRefusal) {
      return {
        message: MEDICAL_REFUSAL_MESSAGE,
        needsClarification: false,
        activityTrail,
        toolCalls: toolCallsRecorded
      };
    }
    if (finalMessage.includes("?") || finalMessage.toLowerCase().includes("before or after") || finalMessage.toLowerCase().includes("which day")) {
      needsClarification = true;
      clarificationQuestion = finalMessage;
    }
    return {
      message: finalMessage || fallbackResult.message,
      entry: structuredEntry || fallbackResult.entry,
      needsClarification,
      clarificationQuestion,
      activityTrail,
      toolCalls: toolCallsRecorded.length > 0 ? toolCallsRecorded : fallbackResult.toolCalls,
      planOverlaps: planOverlaps || fallbackResult.planOverlaps
    };
  } catch (err) {
    console.error("[Lavender Agent] Error in runLavenderAgent:", err);
    return fallbackResult;
  }
}
function parseLocally(text, today, context) {
  const startTime = Date.now();
  const lower = text.toLowerCase();
  const currentYear = parseInt(today.slice(0, 4), 10);
  const activityTrail = [
    { step: "Processing Speech", detail: "Extracted keywords from voice transcript", status: "done" }
  ];
  const toolCalls = [];
  if (checkMedicalAdviceGuardrail(text).isRefusal) {
    return {
      message: MEDICAL_REFUSAL_MESSAGE,
      needsClarification: false,
      activityTrail: [{ step: "Safety Guardrail", detail: "Medical advice refusal", status: "done" }],
      toolCalls: []
    };
  }
  if (context.pendingEntry) {
    const correctionRes = applySlipCorrections(context.pendingEntry, text);
    if (correctionRes.changes.length > 0) {
      toolCalls.push({
        id: "call_update_" + Date.now(),
        toolName: "update_entry",
        args: { correction: text },
        result: { updated: correctionRes.updated, changes: correctionRes.changes },
        latencyMs: Math.max(1, Date.now() - startTime),
        model: "offline-rule-engine"
      });
      activityTrail.push({
        step: "Accession Slip Correction",
        detail: correctionRes.changes.join("; "),
        status: "done"
      });
      return {
        message: "I've updated your Accession Slip with your corrections. Please review below.",
        entry: correctionRes.updated,
        needsClarification: false,
        activityTrail,
        toolCalls
      };
    }
  }
  const eventMatches = [];
  const eventRegex = /(?:exam|wedding|trip|interview|party|flight|vacation|marathon|race|conference|presentation)(?:\s+(?:to|in|for)\s+[a-zA-Z]+)?\s+(?:on|at)?\s*([a-zA-Z]+\s+\d{1,2}|\d{4}-\d{2}-\d{2})/gi;
  let match;
  while ((match = eventRegex.exec(text)) !== null) {
    const rawDate = match[1];
    let resolvedDate = rawDate;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
      const parsed = /* @__PURE__ */ new Date(`${rawDate} ${currentYear}`);
      if (!isNaN(parsed.getTime())) {
        resolvedDate = parsed.toISOString().slice(0, 10);
      }
    }
    eventMatches.push({ name: match[0].split(/\s+(?:on|at)/)[0] || "Event", date: resolvedDate });
  }
  let planOverlaps = void 0;
  if (eventMatches.length > 0) {
    activityTrail.push({ step: "Plan Around It", detail: `Found ${eventMatches.length} events`, status: "done" });
    planOverlaps = evaluateOverlaps(eventMatches, context);
    toolCalls.push({
      id: "call_overlap_" + Date.now(),
      toolName: "check_overlap",
      args: { events: eventMatches },
      result: { overlaps: planOverlaps },
      latencyMs: Math.max(1, Date.now() - startTime),
      model: "offline-rule-engine"
    });
  }
  let landmarkDate = null;
  let landmarkName = null;
  let isApproximate = false;
  const landmarkRes = resolveLandmarkExpression(text, today);
  if (landmarkRes.found && landmarkRes.resolvedDate) {
    landmarkName = landmarkRes.landmarkName;
    landmarkDate = landmarkRes.resolvedDate;
    isApproximate = true;
    activityTrail.push({
      step: "Landmark Recall",
      detail: `Found calendar milestone: ${landmarkName} -> ${landmarkDate}`,
      status: "done"
    });
    toolCalls.push({
      id: "call_milestone_" + Date.now(),
      toolName: "milestone_lookup",
      args: { landmarkName, anchorDate: today },
      result: { baseDate: landmarkRes.baseDate, resolvedDate: landmarkDate },
      latencyMs: Math.max(1, Date.now() - startTime),
      model: "offline-rule-engine"
    });
  }
  const detectedSymptoms = [];
  if (lower.includes("cramp") || lower.includes("\u0D35\u0D2F\u0D31\u0D41\u0D35\u0D47\u0D26\u0D28") || lower.includes("\u0926\u0930\u094D\u0926")) detectedSymptoms.push("cramps");
  if (lower.includes("headache") || lower.includes("\u0D24\u0D32\u0D35\u0D47\u0D26\u0D28") || lower.includes("\u0938\u093F\u0930\u0926\u0930\u094D\u0926")) detectedSymptoms.push("headache");
  if (lower.includes("back") || lower.includes("\u0D28\u0D1F\u0D41\u0D35\u0D47\u0D26\u0D28") || lower.includes("\u0915\u092E\u0930 \u0926\u0930\u094D\u0926")) detectedSymptoms.push("backache");
  if (lower.includes("bloat") || lower.includes("\u0D35\u0D2F\u0D31\u0D4D \u0D35\u0D40\u0D7C\u0D24\u0D4D\u0D24\u0D41") || lower.includes("\u092A\u0947\u091F \u092B\u0942\u0932\u0928\u093E")) detectedSymptoms.push("bloating");
  if (lower.includes("breast") || lower.includes("\u0D38\u0D4D\u0D24\u0D28")) detectedSymptoms.push("breast_tenderness");
  if (lower.includes("acne") || lower.includes("breakout") || lower.includes("\u0D2E\u0D41\u0D16\u0D15\u0D4D\u0D15\u0D41\u0D30\u0D41")) detectedSymptoms.push("acne");
  if (lower.includes("fatigue") || lower.includes("tired") || lower.includes("\u0D15\u0D4D\u0D37\u0D40\u0D23\u0D02") || lower.includes("\u0925\u0915\u093E\u0928")) detectedSymptoms.push("fatigue");
  if (lower.includes("craving") || lower.includes("\u0D2E\u0D27\u0D41\u0D30\u0D02 \u0D15\u0D34\u0D3F\u0D15\u0D4D\u0D15\u0D3E\u0D7B")) detectedSymptoms.push("cravings");
  if (lower.includes("nausea") || lower.includes("\u0D1B\u0D7C\u0D26\u0D4D\u0D26\u0D3F") || lower.includes("\u0909\u0932\u094D\u091F\u0940")) detectedSymptoms.push("nausea");
  if (lower.includes("mood swing") || lower.includes("\u0D38\u0D19\u0D4D\u0D15\u0D1F\u0D02")) detectedSymptoms.push("mood_swings");
  if (lower.includes("anxious") || lower.includes("anxiety") || lower.includes("\u0D06\u0D36\u0D19\u0D4D\u0D15")) detectedSymptoms.push("anxiety");
  if (lower.includes("sleep") || lower.includes("insomnia") || lower.includes("\u0D09\u0D31\u0D15\u0D4D\u0D15\u0D2E\u0D3F\u0D32\u0D4D\u0D32\u0D3E\u0D2F\u0D4D\u0D2E")) detectedSymptoms.push("insomnia");
  if (lower.includes("dizz") || lower.includes("\u0D24\u0D32\u0D15\u0D31\u0D15\u0D4D\u0D15\u0D02") || lower.includes("\u091A\u0915\u094D\u0915\u0930")) detectedSymptoms.push("dizziness");
  if (lower.includes("appetite") || lower.includes("\u0D35\u0D3F\u0D36\u0D2A\u0D4D\u0D2A\u0D4D")) detectedSymptoms.push("appetite_change");
  let flow = null;
  if (lower.includes("heavy") || lower.includes("\u0D15\u0D42\u0D1F\u0D41\u0D24\u0D7D") || lower.includes("\u091C\u094D\u092F\u093E\u0926\u093E")) flow = "heavy";
  else if (lower.includes("medium") || lower.includes("\u0D38\u0D3E\u0D27\u0D3E\u0D30\u0D23") || lower.includes("\u092E\u0927\u094D\u092F\u092E")) flow = "medium";
  else if (lower.includes("light") || lower.includes("\u0D15\u0D41\u0D31\u0D35\u0D4D") || lower.includes("\u0915\u092E")) flow = "light";
  else if (lower.includes("spotting") || lower.includes("\u0D21\u0D4D\u0D30\u0D4B\u0D2A\u0D4D\u0D2A\u0D4D") || lower.includes("\u0938\u094D\u092A\u0949\u091F\u093F\u0902\u0917")) flow = "spotting";
  else if (lower.includes("period started") || lower.includes("period") || lower.includes("\u0D24\u0D41\u0D1F\u0D19\u0D4D\u0D19\u0D3F")) flow = "medium";
  let mood = null;
  if (lower.includes("great") || lower.includes("\u0D28\u0D32\u0D4D\u0D32 \u0D38\u0D28\u0D4D\u0D24\u0D4B\u0D37\u0D02")) mood = "Great";
  else if (lower.includes("good") || lower.includes("\u0D28\u0D32\u0D4D\u0D32\u0D24\u0D4D")) mood = "Good";
  else if (lower.includes("low") || lower.includes("\u0D38\u0D19\u0D4D\u0D15\u0D1F\u0D02") || lower.includes("\u0909\u0926\u093E\u0938")) mood = "Low";
  else if (lower.includes("irritable") || lower.includes("\u0D26\u0D47\u0D37\u0D4D\u0D2F\u0D02")) mood = "Irritable";
  else if (lower.includes("calm") || lower.includes("\u0D36\u0D3E\u0D28\u0D4D\u0D24\u0D02")) mood = "Calm";
  else if (lower.includes("okay") || lower.includes("\u0D15\u0D41\u0D34\u0D2A\u0D4D\u0D2A\u0D2E\u0D3F\u0D32\u0D4D\u0D32")) mood = "Okay";
  let energy = null;
  if (lower.includes("energy 1") || lower.includes("very tired")) energy = 1;
  else if (lower.includes("energy 2") || lower.includes("tired")) energy = 2;
  else if (lower.includes("energy 3") || lower.includes("moderate energy")) energy = 3;
  else if (lower.includes("energy 4") || lower.includes("good energy")) energy = 4;
  else if (lower.includes("energy 5") || lower.includes("full of energy")) energy = 5;
  const entryDate = landmarkDate || today;
  const entry = {
    date: entryDate,
    flow,
    symptoms: detectedSymptoms,
    mood,
    energy,
    sleep: null,
    notes: text,
    isApproximate,
    landmarkName
  };
  toolCalls.push({
    id: "call_log_" + Date.now(),
    toolName: "log_entry",
    args: { date: entryDate, flow, symptoms: detectedSymptoms, mood, energy },
    result: { entry },
    latencyMs: Math.max(1, Date.now() - startTime),
    model: "offline-rule-engine"
  });
  const message = isApproximate ? `I found ${landmarkName} on ${landmarkDate}. Would you like to confirm this period entry?` : `I've prepared your log for ${entryDate}. Please review and confirm below.`;
  return {
    message,
    entry,
    needsClarification: isApproximate,
    clarificationQuestion: isApproximate ? `Did your period start before, on, or after ${landmarkName}?` : null,
    activityTrail,
    toolCalls,
    planOverlaps
  };
}
function evaluateOverlaps(events, context) {
  const avgCycle = context.cycleStats?.avgCycleLength || 28;
  const avgPeriod = context.cycleStats?.avgPeriodLength || 5;
  const lastStart = context.cycleStats?.lastPeriodStart;
  const periods = context.periods || [];
  return events.map((ev) => {
    let overlap = "unknown";
    let overlapNote = "Log a past period first so predictions can be checked against this date.";
    const inActual = periods.some(
      (p) => ev.date >= p.startDate && (p.endDate ? ev.date <= p.endDate : ev.date === p.startDate)
    );
    if (inActual) {
      overlap = "period-day";
      overlapNote = "This date falls inside a period you have already logged.";
    } else if (lastStart) {
      overlap = "unlikely";
      overlapNote = "Based on your pattern, your period is not expected to overlap this date.";
      const lastDate = new Date(lastStart);
      for (let k = 1; k <= 12; k++) {
        const predStart = new Date(lastDate.getTime() + avgCycle * k * 864e5);
        const coreEnd = new Date(predStart.getTime() + (avgPeriod - 1) * 864e5);
        const winStart = new Date(predStart.getTime() - 3 * 864e5);
        const winEnd = new Date(coreEnd.getTime() + 3 * 864e5);
        const evDate = new Date(ev.date);
        if (evDate >= predStart && evDate <= coreEnd) {
          overlap = "likely";
          overlapNote = `Your period is predicted around ${predStart.toISOString().slice(0, 10)} to ${coreEnd.toISOString().slice(0, 10)}, so it will very likely overlap.`;
          break;
        }
        if (evDate >= winStart && evDate <= winEnd) {
          overlap = "possible";
          overlapNote = `This date falls in your wider prediction window (${winStart.toISOString().slice(0, 10)} to ${winEnd.toISOString().slice(0, 10)}). Overlap is possible.`;
          break;
        }
      }
    }
    return {
      name: ev.name,
      eventDate: ev.date,
      overlap,
      overlapNote
    };
  });
}

// ai/backend/protection.ts
var minuteHits = /* @__PURE__ */ new Map();
var dailyHits = /* @__PURE__ */ new Map();
var globalDailyTracker = { count: 0, day: (/* @__PURE__ */ new Date()).toISOString().slice(0, 10) };
var LIMIT_PER_MINUTE = 20;
var LIMIT_PER_DAY_IP = 150;
var DEFAULT_GLOBAL_DAILY_CAP = 500;
function getTodayString() {
  return (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
}
function extractClientIp(req) {
  if (!req) return "127.0.0.1";
  const headers = req.headers || {};
  const vercelRealIp = headers["x-real-ip"] || headers["x-vercel-forwarded-for"];
  if (vercelRealIp) {
    const ip = typeof vercelRealIp === "string" ? vercelRealIp.split(",")[0].trim() : String(vercelRealIp);
    if (ip) return ip;
  }
  const xForwardedFor = headers["x-forwarded-for"] || headers["client-ip"];
  if (xForwardedFor) {
    const ip = typeof xForwardedFor === "string" ? xForwardedFor.split(",")[0].trim() : String(xForwardedFor);
    if (ip) return ip;
  }
  if (req.socket?.remoteAddress) {
    return req.socket.remoteAddress;
  }
  if (req.connection?.remoteAddress) {
    return req.connection.remoteAddress;
  }
  return "127.0.0.1";
}
function isOriginAllowed(originOrReferer) {
  if (!originOrReferer) return true;
  try {
    const url = new URL(originOrReferer);
    const host = url.hostname.toLowerCase();
    if (host === "localhost" || host === "127.0.0.1" || host === "::1") {
      return true;
    }
    if (host.endsWith(".vercel.app")) {
      return true;
    }
    const configuredAllowed = process.env.ALLOWED_ORIGIN;
    if (configuredAllowed && (originOrReferer.includes(configuredAllowed) || host.includes(configuredAllowed))) {
      return true;
    }
    return false;
  } catch {
    if (originOrReferer.includes("localhost") || originOrReferer.includes(".vercel.app")) {
      return true;
    }
    return false;
  }
}
function checkStatelessProtection(req, options) {
  const headers = req.headers || {};
  const origin = headers["origin"] || headers["referer"];
  if (!isOriginAllowed(origin)) {
    return {
      allowed: false,
      statusCode: 403,
      error: "Cross-origin request forbidden. Unauthorized origin.",
      code: "ORIGIN_FORBIDDEN"
    };
  }
  const contentLength = parseInt(headers["content-length"] || "0", 10);
  const maxBodyBytes = options.maxBodyBytes || (options.endpointName === "transcribe" || options.endpointName === "vision" ? 4 * 1024 * 1024 : 50 * 1024);
  if (contentLength > maxBodyBytes) {
    return {
      allowed: false,
      statusCode: 413,
      error: `Payload too large (max ${Math.round(maxBodyBytes / 1024)} KB)`,
      code: "PAYLOAD_TOO_LARGE"
    };
  }
  const clientIp = extractClientIp(req);
  const now = Date.now();
  const today = getTodayString();
  if (globalDailyTracker.day !== today) {
    globalDailyTracker = { count: 0, day: today };
  }
  const globalCap = parseInt(process.env.DAILY_REQUEST_CAP || String(DEFAULT_GLOBAL_DAILY_CAP), 10);
  if (globalDailyTracker.count >= globalCap) {
    return {
      allowed: false,
      statusCode: 429,
      error: "Daily demo limit reached (server cap). Please try again tomorrow.",
      code: "DAILY_CAP_EXCEEDED",
      clientIp
    };
  }
  const windowMs = 60 * 1e3;
  let timestamps = minuteHits.get(clientIp) || [];
  timestamps = timestamps.filter((t) => now - t < windowMs);
  if (timestamps.length >= LIMIT_PER_MINUTE) {
    return {
      allowed: false,
      statusCode: 429,
      error: "Demo limit reached, try again in a minute.",
      code: "RATE_LIMIT_MINUTE",
      clientIp
    };
  }
  const dailyRecord = dailyHits.get(clientIp);
  if (dailyRecord && dailyRecord.day === today) {
    if (dailyRecord.count >= LIMIT_PER_DAY_IP) {
      return {
        allowed: false,
        statusCode: 429,
        error: "Per-IP daily limit reached (150 requests/day). Please try again tomorrow.",
        code: "RATE_LIMIT_DAILY",
        clientIp
      };
    }
  }
  timestamps.push(now);
  minuteHits.set(clientIp, timestamps);
  if (!dailyRecord || dailyRecord.day !== today) {
    dailyHits.set(clientIp, { count: 1, day: today });
  } else {
    dailyRecord.count += 1;
  }
  globalDailyTracker.count += 1;
  if (minuteHits.size > 2e3) {
    for (const [ip, ts] of minuteHits.entries()) {
      if (ts.every((t) => now - t > windowMs)) {
        minuteHits.delete(ip);
      }
    }
  }
  return { allowed: true, clientIp };
}
function validateTextLength(text, maxChars = 1e3) {
  if (text && text.length > maxChars) {
    return {
      valid: false,
      error: `Input text exceeds maximum allowed length of ${maxChars} characters (provided: ${text.length}).`
    };
  }
  return { valid: true };
}

// api-src/agent.ts
function sendResponse(res, statusCode, data) {
  if (res.setHeader) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  }
  if (typeof res.status === "function") {
    const s = res.status(statusCode);
    if (s && typeof s.json === "function") {
      return s.json(data);
    }
    if (s && typeof s.send === "function") {
      return s.send(JSON.stringify(data));
    }
    if (s && typeof s.end === "function") {
      return s.end(JSON.stringify(data));
    }
  }
  if (typeof res.json === "function") {
    return res.json(data);
  }
  if (typeof res.writeHead === "function") {
    res.writeHead(statusCode, {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization"
    });
    return res.end(JSON.stringify(data));
  }
  if (typeof res.end === "function") {
    return res.end(JSON.stringify(data));
  }
}
async function getRequestBody(req) {
  if (req.body) {
    if (typeof req.body === "string") {
      try {
        return JSON.parse(req.body);
      } catch {
        return {};
      }
    }
    return req.body;
  }
  try {
    const chunks = [];
    for await (const chunk of req) chunks.push(Buffer.from(chunk));
    const str = Buffer.concat(chunks).toString("utf8");
    return str ? JSON.parse(str) : {};
  } catch {
    return {};
  }
}
async function handler(req, res) {
  if (req.method === "OPTIONS" || req.httpMethod === "OPTIONS") {
    if (res && res.setHeader) {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
      if (typeof res.status === "function") return res.status(204).end();
      if (typeof res.writeHead === "function") {
        res.writeHead(204);
        return res.end();
      }
    }
    return {
      statusCode: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization"
      },
      body: ""
    };
  }
  const protection = checkStatelessProtection(req, {
    endpointName: "agent",
    maxBodyBytes: 50 * 1024
  });
  if (!protection.allowed) {
    const status = protection.statusCode || 429;
    const errorBody = { error: protection.error, code: protection.code };
    if (!res && req && req.httpMethod) {
      return {
        statusCode: status,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify(errorBody)
      };
    }
    return sendResponse(res, status, errorBody);
  }
  if (!res && req && req.httpMethod) {
    if (req.httpMethod !== "POST") {
      return {
        statusCode: 405,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Method not allowed" })
      };
    }
    try {
      const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
      const { message, context, conversationHistory, provider } = body;
      if (!message) {
        return {
          statusCode: 400,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ error: "Missing 'message' field" })
        };
      }
      const textCheck = validateTextLength(message, 1e3);
      if (!textCheck.valid) {
        return {
          statusCode: 400,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ error: textCheck.error, code: "TEXT_TOO_LONG" })
        };
      }
      const agentContext = { ...context || {}, provider: provider || context?.provider };
      const result = await runLavenderAgent(message, agentContext, conversationHistory || []);
      return {
        statusCode: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        },
        body: JSON.stringify(result)
      };
    } catch (err) {
      return {
        statusCode: 500,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: err.message || "Agent execution failed" })
      };
    }
  }
  if (req.method !== "POST") {
    return sendResponse(res, 405, { error: "Method not allowed" });
  }
  try {
    const body = await getRequestBody(req);
    const { message, context, conversationHistory, provider } = body;
    if (!message) {
      return sendResponse(res, 400, { error: "Missing 'message' field" });
    }
    const textCheck = validateTextLength(message, 1e3);
    if (!textCheck.valid) {
      return sendResponse(res, 400, { error: textCheck.error, code: "TEXT_TOO_LONG" });
    }
    const agentContext = { ...context || {}, provider: provider || context?.provider };
    const result = await runLavenderAgent(message, agentContext, conversationHistory || []);
    return sendResponse(res, 200, result);
  } catch (err) {
    return sendResponse(res, 500, { error: err.message || "Agent execution failed" });
  }
}
var agent_default = handler;
export {
  agent_default as default,
  handler
};
