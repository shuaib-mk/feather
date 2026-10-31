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
var SEVERE_SYMPTOM_ESCALATION_MESSAGE = "Important safety notice: Symptoms like fainting, chest pain, soaking through pads hourly, severe pain, high fever, or thoughts of self-harm need prompt medical care \u2014 if this is happening right now, please seek urgent or emergency medical help.";
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
  /(?:which\s+medicine\s+should\s+i\s+take|tablet\s+ethu\s+kazhikkanam|doctor\s+ko\s+dikhana\s+chahiye|risk\s+of\s+pregnancy\s+undo|normal\s+hai\s+ya\s+doctor)/i,
  // Disguised medical advice: third-party attribution ("my friend said..."), declarative "I should take...", or "log that..." around medication / cycle manipulation
  /\b(?:i|you|we|she)\s+should\s+(?:take|use|try|start|stop)\s+(?:[\w\s]{0,25}?\s+)?(?:pill|pills|tablet|tablets|medicine|medication|drug|hormone|norethisterone|primolut|ibuprofen|paracetamol|meftal|advil|tylenol|aspirin|naproxen|antibiotic|contraceptive|supplement)\b/i,
  /\b(?:take|taking|use|using|try|trying|eat|drink)\s+(?:this|that|a|an|some|the|any|my)?\s*(?:[\w\s]{0,15}?\s+)?(?:pill|pills|tablet|tablets|medicine|medication|drug|remedy|herb)s?\s+to\s+(?:delay|postpone|stop|skip|induce|start|bring\s+on|regulate|end)\s+(?:my|the|a|her)?\s*(?:period|cycle|bleeding|menses|flow)\b/i,
  /\b(?:how\s+to|can\s+i|ways\s+to|pill\s+to|medicine\s+to|tablet\s+to)\s+(?:delay|postpone|stop|skip|induce)\s+(?:my|a|the)?\s*period\b/i,
  /\b(?:friend|mom|mother|sister|aunt|partner|coworker|someone|people|internet|tiktok|google|reddit)\s+(?:said|told\s+me|suggested|recommended|says|thinks)\s+(?:that\s+)?(?:i\s+should|to\s+take|to\s+use|taking|it'?s\s+(?:normal|safe|okay|bad|dangerous))\b/i,
  /\b(?:log|note|record|save|remember)\s+that\s+i\s+(?:should|need\s+to|ought\s+to|can)\s+(?:take|use|try|stop|start)\s+(?:this|that|a|an|the|my|some)?\s*(?:pill|pills|tablet|tablets|medicine|medication|drug|painkiller|antibiotic|dose|dosage)\b/i
];
var SEVERE_SYMPTOM_PATTERNS = [
  // Fainting / passed out / syncope
  /\b(?:faint(?:ed|ing|s)?|passed\s+out|passing\s+out|blacked\s+out|blacking\s+out|lost\s+consciousness|unconscious|syncope)\b/i,
  // Chest pain / breathing difficulty
  /\b(?:chest\s+(?:pain|tightness|pressure|hurts)|short(?:ness)?\s+of\s+breath|trouble\s+breathing|difficulty\s+breathing|can'?t\s+breathe)\b/i,
  // Severe / heavy bleeding soaking through pads or tampons
  /\b(?:soak(?:ed|ing|s)?\s+through\s+(?:a\s+|my\s+|\d+\s+)?(?:pad|tampon|pads|tampons)|bleed(?:ing)?\s+through\s+(?:a\s+|my\s+|\d+\s+)?(?:pad|tampon|pads|tampons)|hemorrhag(?:e|ing)|flooding\s+(?:through\s+)?(?:pad|pads|tampon|tampons))\b/i,
  // Severe / unbearable / excruciating pain
  /\b(?:severe\s+(?:pain|abdominal\s+pain|pelvic\s+pain|stomach\s+pain|cramp|cramps)|unbearable\s+(?:pain|cramp|cramps)|excruciating\s+(?:pain|cramp|cramps)|worst\s+pain\s+of\s+my\s+life)\b/i,
  // High fever with pain, chills, or discharge
  /\b(?:high\s+fever|fever\s+(?:with|and)\s+(?:[\w\s]{0,20}?\s+)?(?:pain|cramps|chills|discharge|bleeding|vomiting|dizziness)|(?:pain|cramps|chills|discharge|bleeding)\s+(?:with|and)\s+(?:a\s+)?(?:high\s+)?fever)\b/i,
  // Suicidal thoughts / self-harm
  /\b(?:suicid(?:al|e)|thoughts?\s+of\s+(?:self[-\s]?harm|hurting\s+myself|ending\s+my\s+life|dying)|want(?:ing)?\s+to\s+(?:die|hurt\s+myself|end\s+it\s+all)|self[-\s]?harm)\b/i
];
function checkSevereSymptomEscalation(input) {
  const normalized = input.trim();
  if (!normalized) {
    return { isSevere: false, escalationMessage: null };
  }
  for (const pattern of SEVERE_SYMPTOM_PATTERNS) {
    if (pattern.test(normalized)) {
      return {
        isSevere: true,
        escalationMessage: SEVERE_SYMPTOM_ESCALATION_MESSAGE
      };
    }
  }
  return { isSevere: false, escalationMessage: null };
}
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

// client/src/lib/localDate.ts
var MONTH_NAMES = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12
};
function isValidDateKey(key) {
  if (typeof key !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(key)) return false;
  try {
    parseDateKey(key);
    return true;
  } catch {
    return false;
  }
}
function parseDateKey(key) {
  if (typeof key !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(key)) {
    throw new Error(`Invalid date format: ${key}`);
  }
  const [year = 1970, month = 1, day = 1] = key.split("-").map(Number);
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (probe.getUTCFullYear() !== year || probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) {
    throw new Error(`Invalid calendar date: ${key}`);
  }
  return { year, month, day };
}
function formatDateKey(year, month, day) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
function dateKeyToUTCDate(key) {
  const { year, month, day } = parseDateKey(key);
  return new Date(Date.UTC(year, month - 1, day));
}
function utcDateToDateKey(date) {
  return formatDateKey(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}
function toLocalKey(date) {
  return formatDateKey(date.getFullYear(), date.getMonth() + 1, date.getDate());
}
function todayLocal(now = /* @__PURE__ */ new Date()) {
  return toLocalKey(now);
}
function addDaysToKey(key, amount) {
  if (!Number.isInteger(amount)) throw new Error("Day offset must be an integer");
  const date = dateKeyToUTCDate(key);
  date.setUTCDate(date.getUTCDate() + amount);
  return utcDateToDateKey(date);
}
function diffDateKeys(from, to) {
  return Math.round((dateKeyToUTCDate(to).getTime() - dateKeyToUTCDate(from).getTime()) / 864e5);
}
function weekdayOfKey(key) {
  return dateKeyToUTCDate(key).getUTCDay();
}
function parseMonthDay(text, year) {
  if (!Number.isInteger(year)) return null;
  const cleaned = text.trim().toLowerCase().replace(/,/g, " ").replace(/\s+/g, " ");
  const monthFirst = cleaned.match(/^([a-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?$/);
  const dayFirst = cleaned.match(/^(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]+)$/);
  let month;
  let day;
  if (monthFirst) {
    month = MONTH_NAMES[monthFirst[1]];
    day = Number(monthFirst[2]);
  } else if (dayFirst) {
    day = Number(dayFirst[1]);
    month = MONTH_NAMES[dayFirst[2]];
  } else {
    return null;
  }
  if (!month || !day) return null;
  const key = formatDateKey(year, month, day);
  return isValidDateKey(key) ? key : null;
}

// client/src/lib/periodEngine.ts
function isBleedingFlow(flow) {
  return flow === "light" || flow === "medium" || flow === "heavy";
}
function lastBleedingDayForPeriod(record, observations, nextStartDate) {
  let last = record.endDate ?? null;
  for (const obs of observations) {
    if (obs.date < record.startDate) continue;
    if (nextStartDate && obs.date >= nextStartDate) continue;
    const bleeding = obs.flow ? isBleedingFlow(obs.flow) : obs.bleeding;
    if (bleeding && (!last || obs.date > last)) last = obs.date;
  }
  return last;
}
function effectivePeriodEnd(record, observations, asOfDate, nextStartDate) {
  if (record.endDate) return record.endDate;
  const lastBleeding = lastBleedingDayForPeriod(record, observations, nextStartDate);
  if (!lastBleeding) return null;
  if (nextStartDate) return lastBleeding;
  if (asOfDate && dayDifference(lastBleeding, asOfDate) >= 3) return lastBleeding;
  return null;
}
var DEFAULT_SETTINGS = {
  defaultCycleLength: 28,
  defaultPeriodDuration: 5,
  historyWindow: 6
};
var DAY_MS = 864e5;
function toDate(key) {
  if (typeof key !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(key)) {
    throw new Error(`Invalid date format: ${key}`);
  }
  parseDateKey(key);
  return dateKeyToUTCDate(key);
}
function dateKey(date) {
  return utcDateToDateKey(date);
}
function addDays(key, amount) {
  if (!Number.isInteger(amount)) {
    throw new Error("Day offset must be an integer");
  }
  const date = toDate(key);
  date.setUTCDate(date.getUTCDate() + amount);
  return dateKey(date);
}
function dayDifference(from, to) {
  return Math.round((toDate(to).getTime() - toDate(from).getTime()) / DAY_MS);
}
function median(values) {
  if (!values.length) {
    throw new Error("Cannot calculate median of empty data");
  }
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}
function roundDay(value) {
  return Math.round(value);
}
function validateRecords(records) {
  const ids = /* @__PURE__ */ new Set();
  for (const record of records) {
    if (!record || typeof record.id !== "string" || !record.id.trim()) {
      throw new Error(`Missing or invalid record ID: ${record?.id}`);
    }
    if (ids.has(record.id)) {
      throw new Error(`Duplicate record ID: ${record.id}`);
    }
    ids.add(record.id);
    toDate(record.startDate);
    if (record.endDate) {
      toDate(record.endDate);
      if (record.endDate < record.startDate) {
        throw new Error(`End date precedes start date: ${record.id}`);
      }
    }
  }
  const sorted = [...records].sort((a, b) => {
    const cmp = a.startDate.localeCompare(b.startDate);
    return cmp !== 0 ? cmp : a.id.localeCompare(b.id);
  });
  const confirmed = sorted.filter((r) => r.confirmed);
  for (let i = 1; i < confirmed.length; i++) {
    const previous = confirmed[i - 1];
    const current = confirmed[i];
    if (previous.startDate === current.startDate) {
      throw new Error(`Duplicate period start date: ${current.startDate}`);
    }
    if (previous.endDate && current.startDate <= previous.endDate) {
      throw new Error(
        `Overlapping period records: ${previous.id} (${previous.startDate}..${previous.endDate}) and ${current.id} (${current.startDate})`
      );
    }
  }
  return sorted;
}
function reconstructCycles(records) {
  const sorted = validateRecords(records);
  const confirmed = sorted.filter((r) => r.confirmed);
  return confirmed.map((record, index) => {
    const next = confirmed[index + 1];
    const length = next ? dayDifference(record.startDate, next.startDate) : null;
    let quality = "incomplete";
    if (length !== null) {
      if (length < 15 || length > 90) {
        quality = "anomalous";
      } else if (length < 21) {
        quality = "short";
      } else if (length > 38) {
        quality = "long";
      } else {
        quality = "valid";
      }
    }
    return {
      startDate: record.startDate,
      nextStartDate: next?.startDate ?? null,
      lengthDays: length,
      quality
    };
  });
}
function getCycleStatistics(records, settings = DEFAULT_SETTINGS, observations = [], asOfDate) {
  const cycles = reconstructCycles(records);
  const completed = cycles.filter((c) => c.lengthDays !== null);
  const eligible = completed.filter(
    (c) => c.lengthDays >= 15 && c.lengthDays <= 90
  );
  const recent = eligible.slice(-settings.historyWindow).map((c) => c.lengthDays);
  const allLengths = completed.map((c) => c.lengthDays);
  const sorted = validateRecords(records);
  const confirmed = sorted.filter((r) => r.confirmed);
  const durations = confirmed.map((r, i) => {
    const end = effectivePeriodEnd(r, observations, asOfDate, confirmed[i + 1]?.startDate ?? null);
    return end ? dayDifference(r.startDate, end) + 1 : null;
  }).filter((d) => d !== null);
  const hasUnknownEndDates = confirmed.some((r) => !r.endDate);
  const averageBleedingDuration = durations.length ? roundDay(durations.reduce((a, b) => a + b, 0) / durations.length) : null;
  return {
    cycles,
    completedCycleCount: completed.length,
    eligibleCycleCount: eligible.length,
    excludedForEstimationCount: completed.length - eligible.length,
    averageCycleLength: allLengths.length ? roundDay(allLengths.reduce((a, b) => a + b, 0) / allLengths.length) : null,
    medianCycleLength: allLengths.length ? roundDay(median(allLengths)) : null,
    shortestCycle: allLengths.length ? Math.min(...allLengths) : null,
    longestCycle: allLengths.length ? Math.max(...allLengths) : null,
    allCycleLengths: allLengths,
    recentCycleLengths: recent,
    averageBleedingDuration,
    hasUnknownEndDates
  };
}
function evaluateEventOverlap(eventDate, records, today, settings = DEFAULT_SETTINGS) {
  toDate(eventDate);
  toDate(today);
  const sorted = validateRecords(records);
  const confirmed = sorted.filter((r) => r.confirmed);
  for (const r of confirmed) {
    const end = r.endDate ?? r.startDate;
    if (eventDate >= r.startDate && eventDate <= end) {
      return {
        status: "logged",
        window: { start: r.startDate, end },
        note: "This date falls inside a period you have already logged."
      };
    }
  }
  if (eventDate < today) {
    return {
      status: "past",
      window: { start: eventDate, end: eventDate },
      note: "This date has already passed."
    };
  }
  const stats = getCycleStatistics(confirmed, settings);
  if (stats.completedCycleCount < 2 || !stats.medianCycleLength) {
    return {
      status: "unknown",
      window: null,
      note: "Not enough data yet: log more cycles to check overlap for this date."
    };
  }
  const last = confirmed[confirmed.length - 1];
  const cycleLength = stats.medianCycleLength;
  const lengths = stats.recentCycleLengths.length ? stats.recentCycleLengths : stats.allCycleLengths;
  const deviations = lengths.map((len) => Math.abs(len - cycleLength));
  const variability = deviations.length ? median(deviations) : 0;
  const bleedingDays = stats.averageBleedingDuration ?? settings.defaultPeriodDuration;
  const approxHalfWidth = last.startEarliest && last.startLatest && last.startEarliest < last.startLatest ? Math.ceil(dayDifference(last.startEarliest, last.startLatest) / 2) : 0;
  const anchorStart = approxHalfWidth ? addDays(last.startEarliest, Math.floor(dayDifference(last.startEarliest, last.startLatest) / 2)) : last.startDate;
  const k = Math.max(1, Math.round(dayDifference(anchorStart, eventDate) / cycleLength));
  const expectedStart = addDays(anchorStart, cycleLength * k);
  const coreEnd = addDays(expectedStart, Math.max(0, bleedingDays - 1));
  const baseHalf = Math.max(3, Math.ceil(1.5 * variability));
  const halfWidth = Math.ceil(baseHalf * Math.sqrt(k)) + approxHalfWidth;
  const window = { start: addDays(expectedStart, -halfWidth), end: addDays(coreEnd, halfWidth) };
  if (eventDate >= expectedStart && eventDate <= coreEnd) {
    return {
      status: "likely",
      window,
      note: `Likely overlap: a period is estimated around ${expectedStart} to ${coreEnd}.`,
      cyclesAhead: k,
      expectedStart
    };
  }
  if (eventDate >= window.start && eventDate <= window.end) {
    return {
      status: "possible",
      window,
      note: `Possible overlap: this date is inside the wider estimate window ${window.start} to ${window.end}.`,
      cyclesAhead: k,
      expectedStart
    };
  }
  return {
    status: "unlikely",
    window,
    note: `Unlikely to overlap (estimate): the estimated window for that cycle is ${window.start} to ${window.end}.`,
    cyclesAhead: k,
    expectedStart
  };
}

// ai/backend/landmarks.json
var landmarks_default = [
  {
    id: "new-years-day",
    names: {
      en: "New Year's Day",
      hi: "\u0928\u090F \u0938\u093E\u0932",
      ml: "\u0D2A\u0D41\u0D24\u0D41\u0D35\u0D24\u0D4D\u0D38\u0D30\u0D02",
      ta: "New Year's Day",
      kn: "New Year's Day"
    },
    pack: "global",
    dates: {
      "2025": "2025-01-01",
      "2026": "2026-01-01",
      "2027": "2027-01-01"
    },
    source: "https://www.timeanddate.com/holidays/common/new-year-day",
    verifiedOn: "2026-10-30"
  },
  {
    id: "valentines-day",
    names: {
      en: "Valentine's Day",
      hi: "\u0935\u0948\u0932\u0947\u0902\u091F\u093E\u0907\u0928 \u0921\u0947",
      ml: "\u0D35\u0D3E\u0D32\u0D28\u0D4D\u0D31\u0D48\u0D7B\u0D38\u0D4D",
      ta: "Valentine's Day",
      kn: "Valentine's Day"
    },
    pack: "global",
    dates: {
      "2025": "2025-02-14",
      "2026": "2026-02-14",
      "2027": "2027-02-14"
    },
    source: "https://www.timeanddate.com/holidays/fun/valentines-day",
    verifiedOn: "2026-10-30"
  },
  {
    id: "international-womens-day",
    names: {
      en: "International Women's Day",
      hi: "\u092E\u0939\u093F\u0932\u093E \u0926\u093F\u0935\u0938",
      ml: "\u0D35\u0D28\u0D3F\u0D24\u0D3E \u0D26\u0D3F\u0D28\u0D02",
      ta: "International Women's Day",
      kn: "International Women's Day"
    },
    pack: "global",
    dates: {
      "2025": "2025-03-08",
      "2026": "2026-03-08",
      "2027": "2027-03-08"
    },
    source: "https://www.un.org/en/observances/womens-day",
    verifiedOn: "2026-10-30"
  },
  {
    id: "earth-day",
    names: {
      en: "Earth Day",
      hi: "\u092A\u0943\u0925\u094D\u0935\u0940 \u0926\u093F\u0935\u0938",
      ml: "\u0D2D\u0D42\u0D2E\u0D3F \u0D26\u0D3F\u0D28\u0D02",
      ta: "Earth Day",
      kn: "Earth Day"
    },
    pack: "global",
    dates: {
      "2025": "2025-04-22",
      "2026": "2026-04-22",
      "2027": "2027-04-22"
    },
    source: "https://www.earthday.org/earth-day-2026/",
    verifiedOn: "2026-10-30"
  },
  {
    id: "christmas",
    names: {
      en: "Christmas",
      hi: "\u0915\u094D\u0930\u093F\u0938\u092E\u0938",
      ml: "\u0D15\u0D4D\u0D30\u0D3F\u0D38\u0D4D\u0D2E\u0D38\u0D4D",
      ta: "Christmas",
      kn: "Christmas"
    },
    pack: "global",
    dates: {
      "2025": "2025-12-25",
      "2026": "2026-12-25",
      "2027": "2027-12-25"
    },
    source: "https://www.timeanddate.com/holidays/common/christmas-day",
    verifiedOn: "2026-10-30"
  },
  {
    id: "new-years-eve",
    names: {
      en: "New Year's Eve",
      hi: "\u0928\u094D\u092F\u0942 \u0908\u092F\u0930 \u0908\u0935",
      ml: "\u0D28\u0D4D\u0D2F\u0D42 \u0D07\u0D2F\u0D7C \u0D08\u0D35\u0D4D",
      ta: "New Year's Eve",
      kn: "New Year's Eve"
    },
    pack: "global",
    dates: {
      "2025": "2025-12-31",
      "2026": "2026-12-31",
      "2027": "2027-12-31"
    },
    source: "https://www.timeanddate.com/holidays/common/new-year-eve",
    verifiedOn: "2026-10-30"
  },
  {
    id: "diwali",
    names: {
      en: "Diwali",
      hi: "\u0926\u0940\u0935\u093E\u0932\u0940",
      ml: "\u0D26\u0D40\u0D2A\u0D3E\u0D35\u0D32\u0D3F",
      ta: "Diwali",
      kn: "Diwali"
    },
    pack: "india",
    dates: {
      "2025": "2025-10-20",
      "2026": "2026-11-08",
      "2027": "2027-10-29"
    },
    source: "https://www.timeanddate.com/holidays/india/diwali",
    verifiedOn: "2026-10-30"
  },
  {
    id: "onam",
    names: {
      en: "Onam",
      hi: "\u0913\u0923\u092E",
      ml: "\u0D13\u0D23\u0D02",
      ta: "Onam",
      kn: "Onam"
    },
    pack: "india",
    dates: {
      "2025": "2025-09-05",
      "2026": "2026-08-26"
    },
    source: "https://www.timeanddate.com/holidays/india/onam",
    verifiedOn: "2026-10-30"
  },
  {
    id: "vishu",
    names: {
      en: "Vishu",
      hi: "\u0935\u093F\u0936\u0941",
      ml: "\u0D35\u0D3F\u0D37\u0D41",
      ta: "Vishu",
      kn: "Vishu"
    },
    pack: "india",
    dates: {
      "2025": "2025-04-14",
      "2026": "2026-04-14",
      "2027": "2027-04-14"
    },
    source: "https://www.timeanddate.com/holidays/india/vishu",
    verifiedOn: "2026-10-30"
  }
];

// ai/backend/landmarks.ts
var LANDMARKS = landmarks_default;
var EXTRA_ALIASES = {
  "new-years-day": ["New Year's", "new year", "New Year", "new years", "\u0D28\u0D4D\u0D2F\u0D42 \u0D07\u0D2F\u0D7C", "\u0928\u092F\u093E \u0938\u093E\u0932", "\u0928\u094D\u092F\u0942 \u0908\u092F\u0930"],
  "valentines-day": ["valentine", "valentines", "\u0D35\u0D3E\u0D32\u0D28\u0D4D\u0D31\u0D48\u0D7B\u0D38\u0D4D", "\u0935\u0948\u0932\u0947\u0902\u091F\u093E\u0907\u0928"],
  "international-womens-day": ["Women's Day", "womens day", "women day", "\u0D35\u0D28\u0D3F\u0D24\u0D3E\u0D26\u0D3F\u0D28\u0D02"],
  "earth-day": ["\u0905\u0930\u094D\u0925 \u0921\u0947"],
  "christmas": ["xmas", "\u0D15\u0D4D\u0D30\u0D3F\u0D38\u0D4D\u0D2E\u0D38\u0D3F\u0D28\u0D4D", "\u0D15\u0D4D\u0D30\u0D3F\u0D38\u0D4D\u0D24\u0D41\u0D2E\u0D38\u0D4D"],
  "new-years-eve": ["new years eve", "nye", "\u0D2A\u0D41\u0D24\u0D41\u0D35\u0D24\u0D4D\u0D38\u0D30 \u0D30\u0D3E\u0D35\u0D4D"],
  "diwali": ["deepavali", "\u0D26\u0D40\u0D2A\u0D3E\u0D35\u0D32\u0D3F\u0D15\u0D4D\u0D15\u0D4D", "\u0926\u093F\u0935\u093E\u0932\u0940"],
  "onam": ["thiruvonam", "\u0D13\u0D23\u0D24\u0D4D\u0D24\u0D3F\u0D28\u0D4D", "\u0D24\u0D3F\u0D30\u0D41\u0D35\u0D4B\u0D23\u0D02"],
  "vishu": ["\u0D35\u0D3F\u0D37\u0D41\u0D35\u0D3F\u0D28\u0D4D"]
};
var MILESTONES_DATA = LANDMARKS.map((l) => ({ name: l.names.en, aliases: Array.from(/* @__PURE__ */ new Set([...Object.values(l.names), l.names.en.toLowerCase(), ...EXTRA_ALIASES[l.id] || []])), kind: l.pack, dates: l.dates, pack: l.pack, source: l.source }));

// ai/backend/dateArithmetic.ts
var WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
function applyDayOffset(isoDate, offsetDays) {
  if (!offsetDays) return isoDate;
  return addDaysToKey(isoDate, offsetDays);
}
function findWeekdayOffset(baseIsoDate, targetWeekdayName, direction) {
  const targetDayIdx = WEEKDAYS.indexOf(targetWeekdayName.toLowerCase());
  if (targetDayIdx === -1) return baseIsoDate;
  const baseDayIdx = weekdayOfKey(baseIsoDate);
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
  const matchedMilestones = MILESTONES_DATA.map((fest) => {
    const candidates = [fest.name, ...fest.aliases].filter((a) => matchesAlias(lower, a));
    const maxMatchedLen = candidates.length > 0 ? Math.max(...candidates.map((c) => c.trim().length)) : 0;
    return { fest, maxMatchedLen };
  }).filter((m) => m.maxMatchedLen > 0).sort((a, b) => b.maxMatchedLen - a.maxMatchedLen);
  for (const { fest } of matchedMilestones) {
    {
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
      const parts = (updated.date || todayLocal()).split("-");
      const year = parts[0];
      const month = parts[1];
      const newDayStr = String(dayNum).padStart(2, "0");
      updated.date = `${year}-${month}-${newDayStr}`;
      changes.push(`Date updated to ${updated.date}`);
    }
  }
  const flowContrastMatch = lower.match(/\b(none|spotting|light|medium|heavy)\s*(?:,|\s+)?(?:and\s+)?not\s+(none|spotting|light|medium|heavy)\b/i);
  const flowContrastMatch2 = lower.match(/\bnot\s+(none|spotting|light|medium|heavy)\s*(?:,|\s+)?(?:but\s+|actually\s+|it\s+was\s+)?(none|spotting|light|medium|heavy)\b/i);
  const flowMatch = lower.match(/\b(?:change\s+flow\s+to|flow\s+(?:to|is|was)|make\s+(?:it\s+)?flow|actually\s+(?:it\s+was\s+)?|it\s+was|make\s+it|change\s+(?:it\s+)?to)\s+(none|spotting|light|medium|heavy)\b/i);
  if (flowContrastMatch) {
    updated.flow = flowContrastMatch[1].toLowerCase();
    changes.push(`Flow updated to ${updated.flow}`);
  } else if (flowContrastMatch2) {
    updated.flow = flowContrastMatch2[2].toLowerCase();
    changes.push(`Flow updated to ${updated.flow}`);
  } else if (flowMatch) {
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
var NUMBER_WORDS = {
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
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  twenty: 20,
  "\u090F\u0915": 1,
  "\u0926\u094B": 2,
  "\u0924\u0940\u0928": 3,
  "\u091A\u093E\u0930": 4,
  "\u092A\u093E\u0901\u091A": 5,
  "\u091B\u0939": 6,
  "\u0938\u093E\u0924": 7,
  "\u0D12\u0D28\u0D4D\u0D28\u0D4D": 1,
  "\u0D30\u0D23\u0D4D\u0D1F\u0D4D": 2,
  "\u0D2E\u0D42\u0D28\u0D4D\u0D28\u0D4D": 3,
  "\u0D28\u0D3E\u0D32\u0D4D": 4,
  "\u0D05\u0D1E\u0D4D\u0D1A\u0D4D": 5,
  "\u0D06\u0D31\u0D4D": 6,
  "\u0B92\u0BA9\u0BCD\u0BB1\u0BC1": 1,
  "\u0B87\u0BB0\u0BA3\u0BCD\u0B9F\u0BC1": 2,
  "\u0BAE\u0BC2\u0BA9\u0BCD\u0BB1\u0BC1": 3,
  "\u0BA8\u0BBE\u0BA9\u0BCD\u0B95\u0BC1": 4,
  "\u0B90\u0BA8\u0BCD\u0BA4\u0BC1": 5,
  "\u0B86\u0BB1\u0BC1": 6,
  "\u0C92\u0C82\u0CA6\u0CC1": 1,
  "\u0C8E\u0CB0\u0CA1\u0CC1": 2,
  "\u0CAE\u0CC2\u0CB0\u0CC1": 3,
  "\u0CA8\u0CBE\u0CB2\u0CCD\u0C95\u0CC1": 4,
  "\u0B90\u0CA6\u0CC1": 5,
  "\u0C86\u0CB0\u0CC1": 6
};
function numberValue(token) {
  if (/^\d+$/.test(token)) return parseInt(token, 10);
  return NUMBER_WORDS[token.toLowerCase()] ?? null;
}
function explain(key) {
  const d = /* @__PURE__ */ new Date(key + "T12:00:00Z");
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}
function resolveDateExpression(text, today) {
  const lower = ` ${text.toLowerCase()} `;
  const none = { date: null, confidence: "none", explanation: "" };
  const landmarkRes = resolveLandmarkExpression(text, today);
  const hasAfterWithoutNumber = /\bafter\b/.test(lower) && !/\d|one|two|three|four|five|six|seven|day after|week after/.test(lower);
  const rangeMatch = lower.match(/(?:from\s+)?(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)?\s*(?:to|-|–)\s*(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)?(?:\s+of)?\s*([a-z]+)?/);
  if (rangeMatch && /(from|to the|to \d)/.test(lower)) {
    const monthName = rangeMatch[3];
    const year = parseInt(today.slice(0, 4), 10);
    let start = monthName ? parseMonthDay(`${rangeMatch[1]} ${monthName}`, year) : null;
    let end = monthName ? parseMonthDay(`${rangeMatch[2]} ${monthName}`, year) : null;
    if (!start) {
      const base = `${today.slice(0, 7)}-${String(rangeMatch[1]).padStart(2, "0")}`;
      const baseEnd = `${today.slice(0, 7)}-${String(rangeMatch[2]).padStart(2, "0")}`;
      if (isValidDateKey(base) && isValidDateKey(baseEnd)) {
        start = base;
        end = baseEnd;
      }
    }
    if (start && end) {
      if (start > today) {
        start = addDaysToKey(start, -365);
        end = addDaysToKey(end, -365);
      }
      return { date: start, confidence: "medium", window: { start, end }, explanation: `${explain(start)} to ${explain(end)}` };
    }
  }
  if (/\b(today|this morning|now|tonight)\b/.test(lower)) {
    return { date: today, confidence: "high", explanation: `today = ${explain(today)}` };
  }
  if (/\blast night\b/.test(lower)) {
    const d = addDaysToKey(today, -1);
    return { date: d, confidence: "medium", explanation: `last night = ${explain(d)}` };
  }
  if (/\bday before yesterday\b/.test(lower)) {
    const d = addDaysToKey(today, -2);
    return { date: d, confidence: "high", explanation: `day before yesterday = ${explain(d)}` };
  }
  if (/\byesterday\b/.test(lower)) {
    const d = addDaysToKey(today, -1);
    return { date: d, confidence: "high", explanation: `yesterday = ${explain(d)}` };
  }
  const agoMatch = lower.match(/([a-z\u0900-\u0D7F]+|\d+)\s*(days?|weeks?)\s+ago\b/) || lower.match(/(\d+)\s*(days?|weeks?)\s+ago\b/);
  if (agoMatch) {
    const n = numberValue(agoMatch[1]);
    if (n !== null) {
      const days = agoMatch[2].startsWith("week") ? n * 7 : n;
      const d = addDaysToKey(today, -days);
      return { date: d, confidence: "high", explanation: `${n} ${agoMatch[2]} ago = ${explain(d)}` };
    }
  }
  const backMatch = lower.match(/(\d+)\s*(days?|weeks?)\s+back\b/);
  if (backMatch) {
    const n = parseInt(backMatch[1], 10);
    const d = addDaysToKey(today, backMatch[2].startsWith("week") ? -n * 7 : -n);
    return { date: d, confidence: "high", explanation: `${n} ${backMatch[2]} back = ${explain(d)}` };
  }
  const weekdayMatch = lower.match(/\b(last|this)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/);
  if (weekdayMatch) {
    const target = WEEKDAYS.indexOf(weekdayMatch[2]);
    const todayIdx = weekdayOfKey(today);
    let diff = (todayIdx - target + 7) % 7;
    if (weekdayMatch[1] === "last" && diff === 0) diff = 7;
    const d = addDaysToKey(today, -diff);
    return { date: d, confidence: "high", explanation: `${weekdayMatch[1]} ${weekdayMatch[2]} = ${explain(d)}` };
  }
  const numericMatch = lower.match(/\b(\d{1,2})[\/-](\d{1,2})(?:[\/-](\d{2,4}))?\b/);
  if (numericMatch) {
    const a = parseInt(numericMatch[1], 10);
    const b = parseInt(numericMatch[2], 10);
    const yr = numericMatch[3] ? numericMatch[3].length === 2 ? 2e3 + parseInt(numericMatch[3], 10) : parseInt(numericMatch[3], 10) : parseInt(today.slice(0, 4), 10);
    let day, month;
    if (a > 12 && b <= 12) {
      day = a;
      month = b;
    } else if (b > 12 && a <= 12) {
      month = a;
      day = b;
    } else {
      return { date: null, confidence: "none", explanation: "", needsClarification: true, clarificationQuestion: `Is ${numericMatch[1]}/${numericMatch[2]} day/month or month/day?` };
    }
    const key = `${yr}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    if (!isValidDateKey(key)) return { ...none, needsClarification: true, clarificationQuestion: "That date does not exist. Which date did you mean?" };
    if (key > today) {
      return { date: null, confidence: "none", explanation: "", needsClarification: true, clarificationQuestion: `Did you mean last year's ${explain(key)}?` };
    }
    return { date: key, confidence: "high", explanation: `${numericMatch[0]} = ${explain(key)}` };
  }
  const ordinalMatch = lower.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\b/) || lower.match(/\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\s+(\d{1,2})(?:st|nd|rd|th)?\b/);
  if (ordinalMatch && !landmarkRes.found) {
    const year = parseInt(today.slice(0, 4), 10);
    let key = parseMonthDay(ordinalMatch[0].trim(), year);
    if (key) {
      const explicitYear = lower.match(/\b(20\d{2})\b/);
      if (explicitYear) {
        key = parseMonthDay(ordinalMatch[0].trim(), parseInt(explicitYear[1], 10));
        if (key && key > today) {
          return { date: null, confidence: "none", explanation: "", needsClarification: true, clarificationQuestion: `Did you mean last year's ${explain(key)}?` };
        }
      } else if (key > today) {
        key = parseMonthDay(ordinalMatch[0].trim(), year - 1);
      }
      if (key && !explicitYear && diffDateKeys(key, today) > 182) {
        return { date: null, confidence: "none", explanation: "", needsClarification: true, clarificationQuestion: `Did you mean ${explain(key)}? That is more than 6 months ago \u2014 please confirm the date.` };
      }
      if (key) return { date: key, confidence: "high", explanation: `${ordinalMatch[0].trim()} = ${explain(key)}` };
    }
  }
  if (landmarkRes.found && landmarkRes.landmarkName) {
    if (hasAfterWithoutNumber && /\bafter\b/.test(lower) && !/weekday/.test(lower) && !/days? after/.test(lower)) {
      if (/\bafter\s+[a-z]/.test(lower) && !/\d\s*days?\s+after|day after|week after/.test(lower)) {
        return { date: null, confidence: "none", explanation: "", needsClarification: true, clarificationQuestion: `How many days after ${landmarkRes.landmarkName}?` };
      }
    }
    let base = landmarkRes.baseDate;
    let resolved = landmarkRes.resolvedDate;
    if (resolved && resolved > today && !/next|upcoming|planning/.test(lower)) {
      const lastRes = resolveLandmarkExpression(`last ${landmarkRes.landmarkName}`, today);
      if (lastRes.found && lastRes.resolvedDate) {
        const offset = base && resolved ? diffDateKeys(base, resolved) : 0;
        base = lastRes.baseDate;
        resolved = lastRes.resolvedDate ? addDaysToKey(lastRes.resolvedDate, offset - (lastRes.baseDate && lastRes.resolvedDate ? diffDateKeys(lastRes.baseDate, lastRes.resolvedDate) : 0)) : resolved;
        if (base && lastRes.baseDate) {
          const origOffset = landmarkRes.baseDate && landmarkRes.resolvedDate ? diffDateKeys(landmarkRes.baseDate, landmarkRes.resolvedDate) : 0;
          resolved = addDaysToKey(lastRes.baseDate, origOffset);
        }
      }
    }
    if (resolved && resolved > today && !/next|upcoming|planning/.test(lower)) {
      return { date: null, confidence: "none", explanation: "", needsClarification: true, clarificationQuestion: `Did you mean last year's ${landmarkRes.landmarkName}?` };
    }
    if (resolved) {
      const around = /\baround\b|\bnear\b/.test(lower);
      const weekOf = /\bweek of\b/.test(lower);
      const window = around ? { start: addDaysToKey(resolved, -3), end: addDaysToKey(resolved, 3) } : weekOf ? { start: resolved, end: addDaysToKey(resolved, 6) } : void 0;
      const offsetDays = base ? diffDateKeys(base, resolved) : 0;
      const offsetLabel = offsetDays === 0 ? "" : offsetDays < 0 ? ` (${Math.abs(offsetDays)} day${Math.abs(offsetDays) === 1 ? "" : "s"} before)` : ` (${offsetDays} day${offsetDays === 1 ? "" : "s"} after)`;
      const baseLabel = base ? ` (${explain(base)})` : "";
      return {
        date: resolved,
        confidence: around || weekOf ? "medium" : "high",
        window,
        explanation: `Landmark: ${landmarkRes.landmarkName}${baseLabel} \u2192 Resolved date: ${explain(resolved)}${offsetLabel}${window ? ` (window ${explain(window.start)} to ${explain(window.end)})` : ""}`
      };
    }
  }
  return none;
}

// ai/backend/intent.ts
var EVENT_WORDS = ["exam", "wedding", "trip", "interview", "party", "flight", "vacation", "marathon", "race", "conference", "presentation", "holiday", "flight", "travel", "plan", "planning"];
var LOG_WORDS = ["flow", "cramps", "cramp", "headache", "backache", "bloating", "fatigue", "tired", "mood", "energy", "slept", "sleep", "spotting", "bleeding", "period", "log", "dizzy", "dizziness", "nausea", "nauseous", "acne", "cravings", "insomnia", "anxious", "anxiety", "tender", "\u0926\u0930\u094D\u0926", "\u0925\u0915\u093E\u0928", "\u0938\u093F\u0930\u0926\u0930\u094D\u0926", "\u0CA4\u0CB2\u0CC6\u0CA8\u0CCB\u0CB5\u0CC1", "\u0BA4\u0BB2\u0BC8\u0BB5\u0BB2\u0BBF", "\u0D24\u0D32\u0D35\u0D47\u0D26\u0D28"];
function classifyIntent(text, hasPendingEntry = false) {
  const lower = ` ${text.toLowerCase().trim()} `;
  if (checkMedicalAdviceGuardrail(text).isRefusal) return "medical_question";
  if (hasPendingEntry && /\b(change|make it|actually|remove|add|instead|no,|correction|update)\b/.test(lower)) return "correction";
  if (/\bperiod\s+(is\s+)?late\b|\blate\s+period\b|\bmissed\s+(my\s+)?period\b/.test(lower) && !/started|flow|log/.test(lower)) return "other";
  const hasEvent = EVENT_WORDS.some((w) => new RegExp(`\\b${w}\\b`, "i").test(lower));
  const hasLog = LOG_WORDS.some((w) => lower.includes(w)) || /\benergy\s*[1-5]\b/.test(lower) || checkSevereSymptomEscalation(text).isSevere;
  if (hasEvent && !hasLog) return "plan_event";
  if (/\bperiod\s+(ended|stopped|finished)\b|\bflow\s+stopped\b/.test(lower)) return "period_end";
  if (/\bperiod\s+(started|began|came)\b|\bstarted\s+my\s+period\b|\bgot\s+my\s+period\b/.test(lower)) return "period_start";
  if (hasLog) return "daily_log";
  if (hasEvent) return "plan_event";
  return "other";
}

// ai/backend/lexicon/en.ts
var en = {
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
    appetite_change: ["appetite change", "increased appetite", "no appetite"]
  },
  flow: {
    heavy: ["heavy flow", "heavy bleeding", "heavy"],
    medium: ["medium flow", "moderate flow", "normal flow", "medium"],
    light: ["light flow", "light bleeding", "light"],
    spotting: ["spotting"],
    none: ["no flow", "no bleeding"]
  },
  mood: {
    Great: ["great", "fantastic"],
    Good: ["good"],
    Okay: ["okay", "ok", "fine"],
    Low: ["low mood", "feeling low", "sad"],
    Irritable: ["irritable", "irritated"],
    Anxious: ["anxious mood"],
    Calm: ["calm"],
    Emotional: ["emotional"]
  },
  periodStart: ["period started", "period start", "started my period", "my period came", "got my period", "period began"],
  periodEnd: ["period ended", "period stopped", "period finished", "flow stopped"],
  negations: ["no", "not", "without", "never"]
};

// ai/backend/lexicon/hi.ts
var hi = {
  symptoms: {
    cramps: ["\u0910\u0902\u0920\u0928", "\u092A\u0947\u091F \u0926\u0930\u094D\u0926"],
    headache: ["\u0938\u093F\u0930\u0926\u0930\u094D\u0926", "\u0938\u093F\u0930 \u0926\u0930\u094D\u0926"],
    backache: ["\u0915\u092E\u0930 \u0926\u0930\u094D\u0926", "\u092A\u0940\u0920 \u0926\u0930\u094D\u0926"],
    bloating: ["\u092A\u0947\u091F \u092B\u0942\u0932\u0928\u093E", "\u092B\u0942\u0932\u0928\u093E"],
    breast_tenderness: ["\u0938\u094D\u0924\u0928 \u0926\u0930\u094D\u0926"],
    acne: ["\u092E\u0941\u0902\u0939\u093E\u0938\u0947"],
    fatigue: ["\u0925\u0915\u093E\u0928", "\u0925\u0915\u0940", "\u0925\u0915\u093E"],
    cravings: ["\u0916\u093E\u0928\u0947 \u0915\u0940 \u0907\u091A\u094D\u091B\u093E"],
    nausea: ["\u0909\u0932\u094D\u091F\u0940", "\u091C\u0940 \u092E\u093F\u091A\u0932\u093E\u0928\u093E", "\u092E\u0924\u0932\u0940"],
    mood_swings: ["\u092E\u0942\u0921 \u092C\u0926\u0932\u0928\u093E"],
    anxiety: ["\u091A\u093F\u0902\u0924\u093E", "\u0918\u092C\u0930\u093E\u0939\u091F"],
    insomnia: ["\u0928\u0940\u0902\u0926 \u0928\u0939\u0940\u0902", "\u0905\u0928\u093F\u0926\u094D\u0930\u093E"],
    dizziness: ["\u091A\u0915\u094D\u0915\u0930"],
    appetite_change: ["\u092D\u0942\u0916 \u092C\u0926\u0932\u0928\u093E"]
  },
  flow: {
    heavy: ["\u091C\u094D\u092F\u093E\u0926\u093E \u0916\u0942\u0928", "\u092D\u093E\u0930\u0940"],
    medium: ["\u092E\u0927\u094D\u092F\u092E"],
    light: ["\u0915\u092E \u0916\u0942\u0928", "\u0939\u0932\u094D\u0915\u093E"],
    spotting: ["\u0938\u094D\u092A\u0949\u091F\u093F\u0902\u0917"],
    none: ["\u0915\u094B\u0908 \u0916\u0942\u0928 \u0928\u0939\u0940\u0902", "\u092B\u094D\u0932\u094B \u0928\u0939\u0940\u0902"]
  },
  mood: { Low: ["\u0909\u0926\u093E\u0938"], Calm: ["\u0936\u093E\u0902\u0924"], Good: ["\u0905\u091A\u094D\u091B\u093E"], Okay: ["\u0920\u0940\u0915"] },
  periodStart: ["\u092A\u0940\u0930\u093F\u092F\u0921 \u0936\u0941\u0930\u0942 \u0939\u0941\u0906", "\u092A\u0940\u0930\u093F\u092F\u0921 \u0906\u092F\u093E"],
  periodEnd: ["\u092A\u0940\u0930\u093F\u092F\u0921 \u0916\u0924\u094D\u092E \u0939\u0941\u0906", "\u092A\u0940\u0930\u093F\u092F\u0921 \u092C\u0902\u0926 \u0939\u0941\u0906"],
  negations: ["\u0928\u0939\u0940\u0902", "\u092C\u093F\u0928\u093E", "\u0915\u094B\u0908 \u0928\u0939\u0940\u0902"]
};

// ai/backend/lexicon/ml.ts
var ml = {
  symptoms: {
    cramps: ["\u0D35\u0D2F\u0D31\u0D41\u0D35\u0D47\u0D26\u0D28", "\u0D35\u0D2F\u0D31\u0D4D \u0D35\u0D47\u0D26\u0D28"],
    headache: ["\u0D24\u0D32\u0D35\u0D47\u0D26\u0D28"],
    backache: ["\u0D28\u0D1F\u0D41\u0D35\u0D47\u0D26\u0D28", "\u0D2A\u0D41\u0D31\u0D02 \u0D35\u0D47\u0D26\u0D28"],
    bloating: ["\u0D35\u0D2F\u0D31\u0D4D \u0D35\u0D40\u0D7C\u0D24\u0D4D\u0D24\u0D41"],
    breast_tenderness: ["\u0D38\u0D4D\u0D24\u0D28 \u0D35\u0D47\u0D26\u0D28"],
    acne: ["\u0D2E\u0D41\u0D16\u0D15\u0D4D\u0D15\u0D41\u0D30\u0D41"],
    fatigue: ["\u0D15\u0D4D\u0D37\u0D40\u0D23\u0D02", "\u0D15\u0D4D\u0D37\u0D40\u0D23\u0D3F\u0D1A\u0D4D\u0D1A\u0D41"],
    cravings: ["\u0D2E\u0D27\u0D41\u0D30\u0D02 \u0D15\u0D34\u0D3F\u0D15\u0D4D\u0D15\u0D3E\u0D7B \u0D24\u0D4B\u0D28\u0D4D\u0D28\u0D41\u0D28\u0D4D\u0D28\u0D41"],
    nausea: ["\u0D1B\u0D7C\u0D26\u0D4D\u0D26\u0D3F", "\u0D13\u0D15\u0D4D\u0D15\u0D3E\u0D28\u0D02"],
    mood_swings: ["\u0D2E\u0D42\u0D21\u0D4D \u0D2E\u0D3E\u0D31\u0D4D\u0D31\u0D02"],
    anxiety: ["\u0D06\u0D36\u0D19\u0D4D\u0D15", "\u0D09\u0D24\u0D4D\u0D15\u0D23\u0D4D\u0D20"],
    insomnia: ["\u0D09\u0D31\u0D15\u0D4D\u0D15\u0D2E\u0D3F\u0D32\u0D4D\u0D32\u0D3E\u0D2F\u0D4D\u0D2E"],
    dizziness: ["\u0D24\u0D32\u0D15\u0D31\u0D15\u0D4D\u0D15\u0D02"],
    appetite_change: ["\u0D35\u0D3F\u0D36\u0D2A\u0D4D\u0D2A\u0D4D \u0D2E\u0D3E\u0D31\u0D4D\u0D31\u0D02"]
  },
  flow: {
    heavy: ["\u0D15\u0D42\u0D1F\u0D41\u0D24\u0D7D \u0D30\u0D15\u0D4D\u0D24\u0D02", "\u0D15\u0D42\u0D1F\u0D41\u0D24\u0D7D"],
    medium: ["\u0D38\u0D3E\u0D27\u0D3E\u0D30\u0D23"],
    light: ["\u0D15\u0D41\u0D31\u0D35\u0D4D", "\u0D15\u0D41\u0D31\u0D1E\u0D4D\u0D1E"],
    spotting: ["\u0D21\u0D4D\u0D30\u0D4B\u0D2A\u0D4D\u0D2A\u0D4D", "\u0D38\u0D4D\u0D2A\u0D4B\u0D1F\u0D4D\u0D1F\u0D3F\u0D02\u0D17\u0D4D"],
    none: ["\u0D2B\u0D4D\u0D32\u0D4B \u0D07\u0D32\u0D4D\u0D32"]
  },
  mood: { Great: ["\u0D28\u0D32\u0D4D\u0D32 \u0D38\u0D28\u0D4D\u0D24\u0D4B\u0D37\u0D02"], Good: ["\u0D28\u0D32\u0D4D\u0D32\u0D24\u0D4D"], Low: ["\u0D38\u0D19\u0D4D\u0D15\u0D1F\u0D02"], Irritable: ["\u0D26\u0D47\u0D37\u0D4D\u0D2F\u0D02"], Calm: ["\u0D36\u0D3E\u0D28\u0D4D\u0D24\u0D02"], Okay: ["\u0D15\u0D41\u0D34\u0D2A\u0D4D\u0D2A\u0D2E\u0D3F\u0D32\u0D4D\u0D32"] },
  periodStart: ["\u0D2A\u0D40\u0D30\u0D3F\u0D2F\u0D21\u0D4D \u0D24\u0D41\u0D1F\u0D19\u0D4D\u0D19\u0D3F"],
  periodEnd: ["\u0D2A\u0D40\u0D30\u0D3F\u0D2F\u0D21\u0D4D \u0D15\u0D34\u0D3F\u0D1E\u0D4D\u0D1E\u0D41"],
  negations: ["\u0D07\u0D32\u0D4D\u0D32", "\u0D07\u0D32\u0D4D\u0D32\u0D3E\u0D24\u0D46"]
};

// ai/backend/lexicon/ta.ts
var ta = {
  symptoms: {
    cramps: ["\u0B85\u0B9F\u0BBF\u0BB5\u0BAF\u0BBF\u0BB1\u0BCD\u0BB1\u0BC1 \u0BB5\u0BB2\u0BBF", "\u0BB5\u0BAF\u0BBF\u0BB1\u0BCD\u0BB1\u0BC1 \u0BB5\u0BB2\u0BBF"],
    headache: ["\u0BA4\u0BB2\u0BC8\u0BB5\u0BB2\u0BBF"],
    backache: ["\u0BAE\u0BC1\u0BA4\u0BC1\u0B95\u0BC1 \u0BB5\u0BB2\u0BBF"],
    bloating: ["\u0BB5\u0BAF\u0BBF\u0BB1\u0BC1 \u0BB5\u0BC0\u0B95\u0BCD\u0B95\u0BAE\u0BCD"],
    breast_tenderness: ["\u0BAE\u0BBE\u0BB0\u0BCD\u0BAA\u0BC1 \u0BB5\u0BB2\u0BBF"],
    acne: ["\u0BAE\u0BC1\u0B95\u0BAA\u0BCD\u0BAA\u0BB0\u0BC1"],
    fatigue: ["\u0B9A\u0BCB\u0BB0\u0BCD\u0BB5\u0BC1", "\u0B9A\u0BCB\u0BB0\u0BCD\u0BB5\u0BBE\u0B95"],
    cravings: ["\u0B9A\u0BBE\u0BAA\u0BCD\u0BAA\u0BBF\u0B9F \u0B86\u0B9A\u0BC8"],
    nausea: ["\u0BB5\u0BBE\u0BA8\u0BCD\u0BA4\u0BBF", "\u0B95\u0BC1\u0BAE\u0B9F\u0BCD\u0B9F\u0BB2\u0BCD"],
    mood_swings: ["\u0BAE\u0BA9\u0BA8\u0BBF\u0BB2\u0BC8 \u0BAE\u0BBE\u0BB1\u0BCD\u0BB1\u0BAE\u0BCD"],
    anxiety: ["\u0B95\u0BB5\u0BB2\u0BC8", "\u0BAA\u0BA4\u0BB1\u0BCD\u0BB1\u0BAE\u0BCD"],
    insomnia: ["\u0BA4\u0BC2\u0B95\u0BCD\u0B95\u0BAE\u0BBF\u0BA9\u0BCD\u0BAE\u0BC8"],
    dizziness: ["\u0BA4\u0BB2\u0BC8\u0B9A\u0BCD\u0B9A\u0BC1\u0BB1\u0BCD\u0BB1\u0BB2\u0BCD"],
    appetite_change: ["\u0BAA\u0B9A\u0BBF \u0BAE\u0BBE\u0BB1\u0BCD\u0BB1\u0BAE\u0BCD"]
  },
  flow: {
    heavy: ["\u0B85\u0BA4\u0BBF\u0B95 \u0B87\u0BB0\u0BA4\u0BCD\u0BA4\u0BAE\u0BCD"],
    medium: ["\u0BA8\u0B9F\u0BC1\u0BA4\u0BCD\u0BA4\u0BB0"],
    light: ["\u0B95\u0BC1\u0BB1\u0BC8\u0BA8\u0BCD\u0BA4 \u0B87\u0BB0\u0BA4\u0BCD\u0BA4\u0BAE\u0BCD", "\u0B95\u0BC1\u0BB1\u0BC8\u0BB5\u0BC1"],
    spotting: ["\u0BB8\u0BCD\u0BAA\u0BBE\u0B9F\u0BCD\u0B9F\u0BBF\u0B99\u0BCD"],
    none: ["\u0B83\u0BAA\u0BCD\u0BB3\u0BCB \u0B87\u0BB2\u0BCD\u0BB2\u0BC8"]
  },
  mood: { Low: ["\u0B9A\u0BCB\u0B95\u0BAE\u0BCD"], Calm: ["\u0B85\u0BAE\u0BC8\u0BA4\u0BBF"], Good: ["\u0BA8\u0BB2\u0BCD\u0BB2\u0BA4\u0BC1"], Okay: ["\u0B9A\u0BB0\u0BBF"] },
  periodStart: ["\u0BAE\u0BBE\u0BA4\u0BB5\u0BBF\u0B9F\u0BBE\u0BAF\u0BCD \u0BA4\u0BCA\u0B9F\u0B99\u0BCD\u0B95\u0BBF\u0BAF\u0BA4\u0BC1"],
  periodEnd: ["\u0BAE\u0BBE\u0BA4\u0BB5\u0BBF\u0B9F\u0BBE\u0BAF\u0BCD \u0BAE\u0BC1\u0B9F\u0BBF\u0BA8\u0BCD\u0BA4\u0BA4\u0BC1"],
  negations: ["\u0B87\u0BB2\u0BCD\u0BB2\u0BC8", "\u0B87\u0BB2\u0BCD\u0BB2\u0BBE\u0BAE\u0BB2\u0BCD"]
};

// ai/backend/lexicon/kn.ts
var kn = {
  symptoms: {
    cramps: ["\u0CB9\u0CCA\u0C9F\u0CCD\u0C9F\u0CC6 \u0CA8\u0CCB\u0CB5\u0CC1"],
    headache: ["\u0CA4\u0CB2\u0CC6\u0CA8\u0CCB\u0CB5\u0CC1"],
    backache: ["\u0CAC\u0CC6\u0CA8\u0CCD\u0CA8\u0CC1 \u0CA8\u0CCB\u0CB5\u0CC1"],
    bloating: ["\u0CB9\u0CCA\u0C9F\u0CCD\u0C9F\u0CC6 \u0C8A\u0CA4"],
    breast_tenderness: ["\u0CB8\u0CCD\u0CA4\u0CA8 \u0CA8\u0CCB\u0CB5\u0CC1"],
    acne: ["\u0CAE\u0CCA\u0CA1\u0CB5\u0CC6"],
    fatigue: ["\u0C86\u0CAF\u0CBE\u0CB8", "\u0CA6\u0CA3\u0CBF\u0CB5\u0CC1"],
    cravings: ["\u0CA4\u0CBF\u0CA8\u0CCD\u0CA8\u0CB2\u0CC1 \u0C86\u0CB8\u0CC6"],
    nausea: ["\u0CB5\u0CBE\u0C82\u0CA4\u0CBF", "\u0CB5\u0CBE\u0C95\u0CB0\u0CBF\u0C95\u0CC6"],
    mood_swings: ["\u0CAE\u0CA8\u0CB8\u0CCD\u0CA5\u0CBF\u0CA4\u0CBF \u0CAC\u0CA6\u0CB2\u0CBE\u0CB5\u0CA3\u0CC6"],
    anxiety: ["\u0C86\u0CA4\u0C82\u0C95", "\u0C9A\u0CBF\u0C82\u0CA4\u0CC6"],
    insomnia: ["\u0CA8\u0CBF\u0CA6\u0CCD\u0CB0\u0CBE\u0CB9\u0CC0\u0CA8\u0CA4\u0CC6"],
    dizziness: ["\u0CA4\u0CB2\u0CC6\u0CB8\u0CC1\u0CA4\u0CCD\u0CA4\u0CC1"],
    appetite_change: ["\u0CB9\u0CB8\u0CBF\u0CB5\u0CC1 \u0CAC\u0CA6\u0CB2\u0CBE\u0CB5\u0CA3\u0CC6"]
  },
  flow: {
    heavy: ["\u0CB9\u0CC6\u0C9A\u0CCD\u0C9A\u0CC1 \u0CB0\u0C95\u0CCD\u0CA4"],
    medium: ["\u0CAE\u0CA7\u0CCD\u0CAF\u0CAE"],
    light: ["\u0C95\u0CA1\u0CBF\u0CAE\u0CC6 \u0CB0\u0C95\u0CCD\u0CA4", "\u0C95\u0CA1\u0CBF\u0CAE\u0CC6"],
    spotting: ["\u0CB8\u0CCD\u0CAA\u0CBE\u0C9F\u0CBF\u0C82\u0C97\u0CCD"],
    none: ["\u0CAB\u0CCD\u0CB2\u0CCB \u0C87\u0CB2\u0CCD\u0CB2"]
  },
  mood: { Low: ["\u0CA6\u0CC1\u0C83\u0C96"], Calm: ["\u0CB6\u0CBE\u0C82\u0CA4"], Good: ["\u0C92\u0CB3\u0CCD\u0CB3\u0CC6\u0CAF\u0CA6\u0CC1"], Okay: ["\u0CB8\u0CB0\u0CBF"] },
  periodStart: ["\u0CAE\u0CC1\u0C9F\u0CCD\u0C9F\u0CC1 \u0CAA\u0CCD\u0CB0\u0CBE\u0CB0\u0C82\u0CAD\u0CB5\u0CBE\u0CAF\u0CBF\u0CA4\u0CC1"],
  periodEnd: ["\u0CAE\u0CC1\u0C9F\u0CCD\u0C9F\u0CC1 \u0CAE\u0CC1\u0C97\u0CBF\u0CAF\u0CBF\u0CA4\u0CC1"],
  negations: ["\u0C87\u0CB2\u0CCD\u0CB2", "\u0C87\u0CB2\u0CCD\u0CB2\u0CA6\u0CC6"]
};

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
function negatedFlowValue(text) {
  const lower = text.toLowerCase();
  const m1 = lower.match(/\b(none|spotting|light|medium|heavy)\s*,?\s*(?:and\s+)?not\s+(none|spotting|light|medium|heavy)\b/);
  if (m1) return m1[2];
  const m2 = lower.match(/\bnot\s+(none|spotting|light|medium|heavy)\b[^.]*?\b(none|spotting|light|medium|heavy)\b/);
  if (m2) return m2[1];
  return null;
}
function selectCorrectionTarget(text, pending, recent, candidates) {
  if (pending) return pending;
  const pool = candidates && candidates.length ? candidates : recent ? [recent] : [];
  if (!pool.length) return recent ?? null;
  const neg = negatedFlowValue(text);
  if (neg) {
    const hit = pool.find((e) => (e.flow || "").toLowerCase() === neg);
    if (hit) return hit;
  }
  return pool[0] ?? recent ?? null;
}
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
          },
          kind: { type: "string", enum: ["period_started", "period_ended", "daily_log"], description: "Entry kind." }
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
          symptoms_add: { type: "array", items: { type: "string", enum: VALID_SYMPTOMS } },
          symptoms_remove: { type: "array", items: { type: "string", enum: VALID_SYMPTOMS } },
          addSymptoms: { type: "array", items: { type: "string", enum: VALID_SYMPTOMS } },
          removeSymptoms: { type: "array", items: { type: "string", enum: VALID_SYMPTOMS } },
          mood: { type: "string" },
          energy: { type: "integer", minimum: 1, maximum: 5 },
          sleep: { type: "number" },
          notes: { type: "string" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "milestone_lookup",
      description: "Looks up dates for verified calendar landmarks in 2025, 2026, and 2027 for landmark date recall (e.g. New Year's Day, Valentine's Day, International Women's Day, New Year's Eve).",
      parameters: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description: "Name of milestone (e.g. New Year's Day, International Women's Day, New Year's Eve)."
          },
          year: {
            type: "integer",
            description: "Year (2025, 2026, or 2027). Defaults to current or most recent year."
          },
          offsetDays: { type: "integer", description: "Days to add to the landmark date (negative for before)." }
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
  },
  {
    type: "function",
    function: {
      name: "find_calendar_events",
      description: "Returns only the personal calendar events the client matched and consented to share in context.matchedEvents. Never invent events.",
      parameters: { type: "object", properties: { query: { type: "string" } } }
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

Tone: Warm, respectful, concise, neutral, non-medical.
Reply in the user's language (context locale) when known. When a pending entry exists, call update_entry with a patch; do not ask the user to re-log.`;
function recordsFromContext(context) {
  const periods = context.periods && context.periods.length > 0 ? context.periods : context.cycleStats?.lastPeriodStart ? [{ startDate: context.cycleStats.lastPeriodStart, endDate: null }] : [];
  return periods.map((per, i) => ({
    id: `ctx-${i}`,
    startDate: per.startDate,
    endDate: per.endDate || void 0,
    confirmed: true,
    source: "manual",
    createdAt: "",
    updatedAt: ""
  }));
}
function evaluateContextOverlaps(events, context, today) {
  const records = recordsFromContext(context);
  return events.map((ev) => {
    const result = evaluateEventOverlap(ev.date, records, today);
    return {
      name: ev.name,
      eventDate: ev.date,
      overlap: result.status === "logged" ? "period-day" : result.status,
      overlapNote: result.note,
      window: result.window
    };
  });
}
var OVERLAP_RANK = { past: 0, unlikely: 1, unknown: 2, possible: 3, likely: 4, "period-day": 5 };
var OVERLAP_VERDICT_LABELS = { logged: "Logged period", "period-day": "Logged period", likely: "Likely overlap", possible: "Possible overlap", unlikely: "Unlikely to overlap (estimate)", past: "Past", unknown: "Not enough data yet" };
var SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function shortDateLabel(dateKey2) {
  const m = parseInt(dateKey2.slice(5, 7), 10);
  const d = parseInt(dateKey2.slice(8, 10), 10);
  return `${SHORT_MONTHS[(m || 1) - 1]} ${d}`;
}
function isCompareIntent(text) {
  return /\b(which is safer|which date is safer|which is better|which date is better|compare|safer)\b/i.test(text);
}
function scanComparisonDates(text, today) {
  const MONTH_RE = "january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec";
  const re = new RegExp(`\\b(?:\\d{1,2}(?:st|nd|rd|th)?\\s+(?:${MONTH_RE})|(?:${MONTH_RE})\\s+\\d{1,2}(?:st|nd|rd|th)?)(?:,?\\s+\\d{4})?\\b|\\b\\d{4}-\\d{2}-\\d{2}\\b`, "gi");
  const currentYear = parseInt(today.slice(0, 4), 10);
  const out = [];
  let m;
  while ((m = re.exec(text)) !== null) {
    const raw = m[0];
    let resolved;
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) resolved = isValidDateKey(raw) ? raw : null;
    else {
      const explicitYear = /\b\d{4}\b/.test(raw) ? parseInt(raw.match(/\b\d{4}\b/)[0], 10) : null;
      const noYear = raw.replace(/,?\s+\b\d{4}\b/, "");
      resolved = parseMonthDay(noYear, explicitYear ?? currentYear);
      if (resolved && explicitYear === null && resolved < today) resolved = parseMonthDay(noYear, currentYear + 1);
    }
    if (resolved && isValidDateKey(resolved) && !out.includes(resolved)) out.push(resolved);
  }
  return out;
}
function buildDateComparison(text, today, context) {
  const dates = scanComparisonDates(text, today);
  if (dates.length < 2) return null;
  const pair = dates.slice(0, 2);
  const overlaps = evaluateContextOverlaps(pair.map((d) => ({ name: shortDateLabel(d), date: d })), context, today);
  const verdicts = overlaps.map((o) => ({ date: o.eventDate, label: shortDateLabel(o.eventDate), status: o.overlap, note: o.overlapNote, window: o.window ?? null }));
  const summary = (OVERLAP_RANK[verdicts[0].status] ?? 2) === (OVERLAP_RANK[verdicts[1].status] ?? 2) ? "Both look similar." : `${(OVERLAP_RANK[verdicts[0].status] ?? 2) < (OVERLAP_RANK[verdicts[1].status] ?? 2) ? verdicts[0].label : verdicts[1].label} overlaps less (estimate)`;
  const message = `${verdicts.map((v) => `${v.label}: ${OVERLAP_VERDICT_LABELS[v.status] || v.status}`).join(" \xB7 ")}. ${summary}`;
  return { dates: verdicts, summary, message };
}
function hasAnyLoggingOrPlanningCue(text) {
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (/^[\s\d\/\-\.,:;]+$/.test(trimmed)) return false;
  const stripped = trimmed.toLowerCase().replace(/\b\d+(?:st|nd|rd|th)?\b/g, " ").replace(
    /\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec|monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun|today|yesterday|tomorrow|tonight|morning|evening|night|day|days|week|weeks|month|months|year|years|ago|back|last|this|next|on|the|of|in|at|for|to|from|and|or)\b/g,
    " "
  ).replace(/[\s\d\/\-\.,:;'"!?()]+/g, "").trim();
  return stripped.length > 0;
}
var COVERAGE_EVENT_NOUNS = [
  "wedding",
  "exam",
  "trip",
  "interview",
  "party",
  "flight",
  "vacation",
  "conference",
  "presentation",
  "dinner",
  "meeting",
  "birthday",
  "anniversary",
  "marathon",
  "race",
  "appointment"
];
var COVERAGE_MONTHS = "jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec";
var COVERAGE_DATE_RE = new RegExp(`(\\d{4}-\\d{2}-\\d{2}|\\b\\d{1,2}(?:st|nd|rd|th)?\\s+(?:${COVERAGE_MONTHS})[a-z]*\\b|\\b(?:${COVERAGE_MONTHS})[a-z]*\\s+\\d{1,2}(?:st|nd|rd|th)?\\b)`, "gi");
var COVERAGE_FLOW_RE = /\b(none|spotting|light|medium|heavy)\b/i;
var DAY_WORD_NUMBERS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7 };
function clauseAround(text, index, length) {
  const start = Math.max(0, text.lastIndexOf(".", index - 1) + 1, text.lastIndexOf("!", index - 1) + 1, text.lastIndexOf("?", index - 1) + 1, text.lastIndexOf(";", index - 1) + 1, text.lastIndexOf("\n", index - 1) + 1);
  const stops = [text.indexOf(".", index + length), text.indexOf("!", index + length), text.indexOf("?", index + length), text.indexOf(";", index + length), text.indexOf("\n", index + length)].filter((i) => i !== -1);
  return text.slice(start, stops.length ? Math.min(...stops) : text.length);
}
function findStatedDatedFacts(userPrompt, today) {
  const text = userPrompt || "";
  const lower = text.toLowerCase();
  const facts = [];
  const push = (fact) => {
    if (!isValidDateKey(fact.date)) return;
    if (!facts.some((f) => f.date === fact.date && f.flow === fact.flow && f.eventNoun === fact.eventNoun)) facts.push(fact);
  };
  const yesterdayKey = addDaysToKey(today, -1);
  const yIdx = lower.search(/\byesterday\b/);
  if (yIdx !== -1) {
    const clause = clauseAround(text, yIdx, "yesterday".length);
    const flowMatch = clause.match(/\b(none|spotting|light|medium|heavy)\s+(?:flow\s+)?yesterday\b/i) || clause.match(/\byesterday\b[^.!?;\n]{0,60}?\b(?:flow\s+was\s+)?(none|spotting|light|medium|heavy)\b/i);
    if (flowMatch) {
      push({ date: yesterdayKey, flow: flowMatch[1].toLowerCase(), label: `${flowMatch[1].toLowerCase()} flow yesterday (${yesterdayKey}) as a separate day` });
    } else {
      const symptoms = extractWithLexicon(clause).symptoms;
      if (symptoms.length > 0) {
        push({ date: yesterdayKey, symptoms: [...symptoms], label: `${symptoms.join(" and ")} yesterday (${yesterdayKey}) as a separate day` });
      }
    }
  }
  COVERAGE_DATE_RE.lastIndex = 0;
  let m;
  while ((m = COVERAGE_DATE_RE.exec(text)) !== null) {
    const raw = m[1];
    const clause = clauseAround(text, m.index, raw.length);
    const before = text.slice(Math.max(0, m.index - 120), m.index);
    const nouns = [...before.matchAll(new RegExp(`\\b(${COVERAGE_EVENT_NOUNS.join("|")})\\b`, "gi"))];
    const eventNoun = nouns.length ? nouns[nouns.length - 1][1].toLowerCase() : void 0;
    const currentYear = Number(today.slice(0, 4));
    let resolved = null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) resolved = isValidDateKey(raw) ? raw : null;
    else {
      const noYear = raw.replace(/,?\s+\b\d{4}\b/, "");
      resolved = parseMonthDay(noYear, currentYear);
      if (resolved) {
        if (eventNoun) {
          if (resolved < today) resolved = parseMonthDay(noYear, currentYear + 1);
        } else if (resolved > today) {
          resolved = parseMonthDay(noYear, currentYear - 1);
        }
      }
    }
    if (!resolved) continue;
    if (eventNoun) {
      push({ date: resolved, eventNoun, label: `${eventNoun} on ${resolved}` });
      continue;
    }
    const flowMatch = clause.match(COVERAGE_FLOW_RE);
    if (flowMatch) {
      push({ date: resolved, flow: flowMatch[1].toLowerCase(), label: `${flowMatch[1].toLowerCase()} flow (${resolved}) as a separate day` });
    } else if (/\bperiod\s+(started|began|came)\b/i.test(clause)) {
      push({ date: resolved, label: `period start (${resolved}) as a separate day` });
    }
  }
  const agoRe = /\b(\d+|one|two|three|four|five|six|seven)\s+days?\s+ago\b/gi;
  let a;
  while ((a = agoRe.exec(text)) !== null) {
    const clause = clauseAround(text, a.index, a[0].length);
    const flowMatch = clause.match(COVERAGE_FLOW_RE);
    if (!flowMatch) continue;
    const n = /^\d+$/.test(a[1]) ? Number(a[1]) : DAY_WORD_NUMBERS[a[1].toLowerCase()] || 0;
    if (n <= 0) continue;
    const date = addDaysToKey(today, -n);
    push({ date, flow: flowMatch[1].toLowerCase(), label: `${flowMatch[1].toLowerCase()} flow (${date}) as a separate day` });
  }
  return facts;
}
function structuredEntriesOf(result) {
  const entries = [];
  if (result.entry) entries.push(result.entry);
  for (const call of result.toolCalls || []) {
    const entry = call?.result?.entry;
    if (entry && typeof entry.date === "string" && !entries.some((e) => e.date === entry.date && e.flow === entry.flow)) entries.push(entry);
  }
  return entries;
}
function factIsPlaced(fact, entries, events) {
  if (fact.eventNoun) {
    return events.some((e) => e.date === fact.date && (e.title || "").toLowerCase().includes(fact.eventNoun));
  }
  return entries.some((e) => e.date === fact.date && (!fact.flow || e.flow === fact.flow) && (!fact.symptoms?.length || fact.symptoms.every((sym) => (e.symptoms || []).includes(sym))));
}
function ensureFactCoverageDisclosure(result, userPrompt, today) {
  if (!result || typeof result.message !== "string" || result.needsClarification) return result;
  const facts = findStatedDatedFacts(userPrompt, today);
  if (facts.length === 0) return result;
  const entries = structuredEntriesOf(result);
  const events = result.plannedEvents || [];
  let message = result.message;
  for (const fact of facts) {
    if (factIsPlaced(fact, entries, events)) continue;
    if (message.includes("couldn't place") && message.includes(fact.date)) continue;
    message += fact.eventNoun ? ` I couldn't place: ${fact.label} \u2014 add it from the calendar if you want it saved.` : ` I couldn't place: ${fact.label} \u2014 log that day separately if you want it saved.`;
  }
  return message === result.message ? result : { ...result, message };
}
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
  const today = context.currentDate || todayLocal();
  const severeCheck = checkSevereSymptomEscalation(userPrompt);
  if (severeCheck.isSevere) {
    activityTrail.push({
      step: "Safety Escalation",
      detail: "Red-flag symptom detected \u2014 care-seeking signpost prepended",
      status: "done"
    });
  }
  activityTrail.push({
    step: "Processing Speech",
    detail: "Parsing voice input with Muse Spark",
    status: "pending"
  });
  const fallbackResult = parseLocally(userPrompt, today, context);
  if (!hasAnyLoggingOrPlanningCue(userPrompt)) {
    return { ...fallbackResult, mode: "offline", modeReason: "Offline parser \u2014 Meta model not used (bare numbers or date without cycle/event cue)" };
  }
  if (/\bperiod\s+(is\s+)?late\b|\blate period\b|\bmissed\s+(my\s+)?period\b/i.test(userPrompt) && !/started|flow/i.test(userPrompt)) {
    return { ...fallbackResult, mode: "offline", modeReason: "Offline parser \u2014 Meta model not used (late-period question answered directly; no entry created)" };
  }
  if (fallbackResult.comparison) {
    return { ...fallbackResult, mode: "offline", modeReason: "Offline parser \u2014 Meta model not used (date comparison answered directly; nothing saved)" };
  }
  const config = getConfig();
  const isBaseten = context.provider === "baseten" || config.useBaseten;
  const apiKey = isBaseten ? config.basetenApiKey : config.metaApiKey || config.basetenApiKey;
  const baseUrl = isBaseten ? config.basetenBaseUrl : config.metaBaseUrl;
  const model = isBaseten ? "meta-models/muse-spark-open-1026" : config.museSparkModel;
  if (!apiKey) {
    activityTrail.forEach((a) => a.status = "done");
    return { ...fallbackResult, mode: "offline", modeReason: "Offline parser \u2014 Meta model not used (Meta API key not configured)" };
  }
  const isCorrectionPhrase = /\b(actually|make it\s+(?:light|heavy|medium|spotting|none)|change\s+(?:the\s+)?(?:date|flow)|(?:light|medium|heavy|spotting)\s*,?\s*not\s+(?:light|medium|heavy|spotting)|not\s+(?:light|medium|heavy|spotting)\s*,?\s*(?:but|actually)?\s*(?:light|medium|heavy|spotting))\b/i.test(userPrompt);
  const targetEntry = context.pendingEntry || (isCorrectionPhrase ? selectCorrectionTarget(userPrompt, null, context.recentEntry, context.recentEntries) : null);
  let livePlannedEvents = [];
  if (!targetEntry && isCorrectionPhrase && !/\bperiod\s+(?:started|ended)\b/i.test(userPrompt)) {
    return {
      message: "I couldn't find a recent entry to correct.",
      entry: null,
      needsClarification: false,
      activityTrail: [{ step: "Correction Lookup", detail: "No recent entry found to correct", status: "done" }],
      toolCalls: [],
      mode: "live",
      modeReason: null
    };
  }
  const messages = [
    { role: "system", content: `${SYSTEM_PROMPT}
Today's date is ${today}. Locale: ${context.locale || "en"}. Reply in the user's language.${targetEntry ? `
Pending or recent entry to correct if asked: ${JSON.stringify(targetEntry)}. Call update_entry with a patch (date, flow, symptoms_add, symptoms_remove, mood, energy, sleep, notes).` : ""}${context.matchedEvents && context.matchedEvents.length ? `
Client-matched personal events (consented): ${JSON.stringify(context.matchedEvents)}. Use find_calendar_events for these.` : ""}` },
    ...conversationHistory,
    { role: "user", content: userPrompt }
  ];
  let usedPersonalAnchorLive = false;
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
        return { ...fallbackResult, mode: "offline", modeReason: `Offline parser \u2014 Meta model not used (Meta API error ${res.status})` };
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
        if (fnName === "find_calendar_events") {
          const events = context.matchedEvents || [];
          toolResultObj = { events, source: "context.matchedEvents" };
          if (events.length) usedPersonalAnchorLive = true;
          toolResponseContent = JSON.stringify(toolResultObj);
        } else if (fnName === "milestone_lookup" || fnName === "festival_lookup") {
          const festName = (fnArgs.name || "").toLowerCase();
          let yr = fnArgs.year ? String(fnArgs.year) : void 0;
          activityTrail.push({
            step: "Landmark Recall",
            detail: `Looking up calendar milestone "${fnArgs.name}" for ${yr || "recent"}`,
            status: "done"
          });
          const landmarkRes = resolveLandmarkExpression(fnArgs.name, today);
          if (landmarkRes.found) {
            const baseDate = landmarkRes.resolvedDate;
            const offsetDate = baseDate && fnArgs.offsetDays ? applyDayOffset(baseDate, Number(fnArgs.offsetDays) || 0) : baseDate;
            toolResultObj = {
              milestone: landmarkRes.landmarkName,
              year: yr || landmarkRes.resolvedDate?.slice(0, 4),
              date: offsetDate,
              baseDate,
              source: "landmarks data (verified dates in landmarks.json / milestones data)",
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
            avgCycleLength: context.cycleStats?.avgCycleLength ?? null,
            avgPeriodLength: context.cycleStats?.avgPeriodLength ?? null,
            lastPeriodStart: context.cycleStats?.lastPeriodStart || null,
            nextPeriodEarliest: context.cycleStats?.nextPeriodEarliest || null,
            nextPeriodLatest: context.cycleStats?.nextPeriodLatest || null,
            isDefault: context.cycleStats?.isDefault ?? context.cycleStatsIsDefault ?? false,
            note: context.cycleStats?.isDefault ?? context.cycleStatsIsDefault ? "Not enough data yet \u2014 these are defaults, not learned from logged cycles." : void 0
          };
          toolResponseContent = JSON.stringify(toolResultObj);
        } else if (fnName === "check_overlap") {
          activityTrail.push({
            step: "Plan Around It",
            detail: `Evaluating cycle overlap for ${fnArgs.events?.length || 0} events`,
            status: "done"
          });
          const badEvent = (fnArgs.events || []).find((e) => !e || typeof e.date !== "string" || !isValidDateKey(e.date));
          if (badEvent) {
            toolResultObj = { error: "Invalid event date: expected YYYY-MM-DD." };
            toolResponseContent = JSON.stringify(toolResultObj);
          }
          const overlaps = badEvent ? [] : evaluateContextOverlaps(fnArgs.events || [], context, today);
          planOverlaps = overlaps;
          const rawEvents = (fnArgs.events || []).filter((e) => e && typeof e.date === "string" && isValidDateKey(e.date));
          livePlannedEvents = rawEvents.map((e) => ({ title: e.name || e.title || "Event", date: e.date }));
          toolResultObj = { overlaps };
          toolResponseContent = JSON.stringify(toolResultObj);
        } else if (fnName === "log_entry") {
          const validationError = validateEntryArgs(fnArgs, today);
          if (validationError) {
            toolResultObj = { error: validationError };
          } else {
            activityTrail.push({ step: "Structured Entry", detail: `Prepared log for ${fnArgs.date}`, status: "done" });
            structuredEntry = {
              date: fnArgs.date || today,
              flow: fnArgs.flow || null,
              symptoms: (fnArgs.symptoms || []).filter((s) => VALID_SYMPTOMS.includes(s)),
              mood: fnArgs.mood || null,
              energy: fnArgs.energy ?? null,
              sleep: fnArgs.sleep ?? null,
              notes: fnArgs.notes || null,
              isApproximate: fnArgs.isApproximate || false,
              landmarkName: fnArgs.landmarkName || null,
              kind: fnArgs.kind || "daily_log"
            };
            toolResultObj = { success: true, entry: structuredEntry };
          }
          toolResponseContent = JSON.stringify(toolResultObj);
        } else if (fnName === "update_entry") {
          const entryToPatch = targetEntry;
          if (!entryToPatch) {
            toolResultObj = { success: false, error: "No pending slip to update" };
          } else {
            const patched = applyModelPatch(entryToPatch, fnArgs, today);
            if (patched.error) toolResultObj = { error: patched.error };
            else {
              structuredEntry = patched.entry;
              toolResultObj = { success: true, entry: structuredEntry };
            }
          }
          toolResponseContent = JSON.stringify(toolResultObj);
        }
        toolCallsRecorded.push({
          id: call.id || "call_" + Date.now(),
          toolName: fnName,
          args: fnArgs,
          result: toolResultObj,
          latencyMs: Date.now() - toolCallStart,
          model,
          executedBy: "meta-model"
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
    if (severeCheck.isSevere) {
      if (!structuredEntry && fallbackResult.entry) {
        structuredEntry = fallbackResult.entry;
      }
      const cleanTail = !finalMessage.trim() || finalMessage.includes("talk to a doctor") ? `I've prepared your log for ${structuredEntry?.date || today}. Please review and confirm below.` : finalMessage.trim();
      finalMessage = cleanTail.startsWith(SEVERE_SYMPTOM_ESCALATION_MESSAGE) ? cleanTail : `${SEVERE_SYMPTOM_ESCALATION_MESSAGE} ${cleanTail}`;
    }
    return ensureFactCoverageDisclosure({
      message: finalMessage,
      entry: structuredEntry,
      needsClarification,
      clarificationQuestion,
      activityTrail,
      toolCalls: toolCallsRecorded,
      planOverlaps,
      plannedEvents: livePlannedEvents.length > 0 ? livePlannedEvents : planOverlaps?.length ? planOverlaps.map((o) => ({ title: o.name, date: o.eventDate })) : void 0,
      mode: "live",
      modeReason: null,
      usedPersonalAnchor: usedPersonalAnchorLive
    }, userPrompt, today);
  } catch (err) {
    console.error("[Lavender Agent] Error in runLavenderAgent:", err);
    return { ...fallbackResult, mode: "offline", modeReason: `Offline parser \u2014 Meta model not used (${err?.message || "Meta API request failed"})` };
  }
}
var VALID_MOODS = ["Great", "Good", "Okay", "Low", "Irritable", "Anxious", "Emotional", "Calm"];
var LEXICONS = [en, hi, ml, ta, kn];
function phraseIndex(lower, phrase) {
  const p = phrase.toLowerCase().trim();
  if (!p) return -1;
  if (/^[a-z0-9\s'-]+$/i.test(p)) {
    const escaped = p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const m = new RegExp(`\\b${escaped}\\b`, "i").exec(lower);
    return m ? m.index : -1;
  }
  return lower.indexOf(p);
}
function isNegatedAt(lower, idx) {
  if (idx < 0) return false;
  const before = lower.slice(Math.max(0, idx - 32), idx);
  if (/\b(no|not|without|never)\s+([\p{L}0-9]+\s+){0,3}$/iu.test(before)) return true;
  for (const lex of LEXICONS) for (const neg of lex.negations) {
    if (neg && before.trimEnd().endsWith(neg)) return true;
  }
  return false;
}
function extractWithLexicon(text) {
  const lower = text.toLowerCase();
  const symptoms = [];
  for (const key of VALID_SYMPTOMS) {
    let found = false;
    for (const lex of LEXICONS) {
      for (const phrase of lex.symptoms[key] || []) {
        const idx = phraseIndex(lower, phrase);
        if (idx >= 0 && !isNegatedAt(lower, idx)) {
          found = true;
          break;
        }
      }
      if (found) break;
    }
    if (found) symptoms.push(key);
  }
  let flow = null;
  if (/\bno (flow|bleeding)\b/i.test(lower)) flow = "none";
  else {
    const order = ["heavy", "medium", "light", "spotting"];
    outer: for (const level of order) {
      for (const lex of LEXICONS) {
        for (const phrase of lex.flow[level] || []) {
          const idx = phraseIndex(lower, phrase);
          if (idx >= 0 && !isNegatedAt(lower, idx)) {
            flow = level;
            break outer;
          }
        }
      }
    }
    if (!flow) for (const lex of LEXICONS) for (const phrase of lex.flow.none || []) {
      if (phraseIndex(lower, phrase) >= 0) {
        flow = "none";
        break;
      }
    }
  }
  let mood = null;
  const moodCandidates = [];
  for (const lex of LEXICONS) for (const [m, phrases] of Object.entries(lex.mood)) for (const phrase of phrases) moodCandidates.push({ mood: m, phrase });
  moodCandidates.sort((a, b) => b.phrase.length - a.phrase.length);
  for (const c of moodCandidates) {
    const idx = phraseIndex(lower, c.phrase);
    if (idx >= 0 && !isNegatedAt(lower, idx)) {
      mood = c.mood;
      break;
    }
  }
  let periodStart = false, periodEnd = false;
  for (const lex of LEXICONS) {
    if (lex.periodStart.some((ph) => phraseIndex(lower, ph) >= 0)) periodStart = true;
    if (lex.periodEnd.some((ph) => phraseIndex(lower, ph) >= 0)) periodEnd = true;
  }
  if (/\bperiod\s+(started|began|came)\b|\bstarted my period\b|\bgot my period\b/i.test(lower)) periodStart = true;
  if (/\bperiod\s+(ended|stopped|finished)\b|\bflow stopped\b/i.test(lower)) periodEnd = true;
  return { symptoms, flow, mood, periodStart, periodEnd };
}
function validateEntryArgs(args, today) {
  if (args.date !== void 0) {
    if (typeof args.date !== "string" || !isValidDateKey(args.date)) return "Invalid date: expected YYYY-MM-DD calendar date.";
    const min = addDaysToKey(today, -731);
    if (args.date < min || args.date > today) return `Invalid date: must be between ${min} and ${today} (today).`;
  }
  if (args.flow !== void 0 && args.flow !== null && !["none", "spotting", "light", "medium", "heavy"].includes(args.flow)) return "Invalid flow value.";
  if (args.kind !== void 0 && !["period_started", "period_ended", "daily_log"].includes(args.kind)) return "Invalid kind value.";
  if (args.mood !== void 0 && args.mood !== null && !VALID_MOODS.includes(args.mood)) return "Invalid mood value.";
  if (args.energy !== void 0 && args.energy !== null && (!Number.isInteger(args.energy) || args.energy < 1 || args.energy > 5)) return "Invalid energy: must be an integer 1-5.";
  if (args.sleep !== void 0 && args.sleep !== null && (typeof args.sleep !== "number" || args.sleep < 0 || args.sleep > 24)) return "Invalid sleep: must be 0-24 hours.";
  const symptomLists = [args.symptoms, args.symptoms_add, args.symptoms_remove, args.addSymptoms, args.removeSymptoms];
  for (const list of symptomLists) if (list !== void 0 && (!Array.isArray(list) || list.some((s) => !VALID_SYMPTOMS.includes(s)))) return "Invalid symptoms: must be a subset of the supported symptoms.";
  return null;
}
function applyModelPatch(pending, patch, today) {
  const err = validateEntryArgs(patch, today);
  if (err) return { error: err };
  const updated = { ...pending, symptoms: [...pending.symptoms] };
  if (patch.date) updated.date = patch.date;
  if (patch.flow !== void 0) updated.flow = patch.flow;
  if (patch.kind) updated.kind = patch.kind;
  if (patch.mood !== void 0) updated.mood = patch.mood;
  if (patch.energy !== void 0) updated.energy = patch.energy;
  if (patch.sleep !== void 0) updated.sleep = patch.sleep;
  if (patch.notes !== void 0) updated.notes = patch.notes;
  const add = patch.symptoms_add || patch.addSymptoms || [];
  const remove = patch.symptoms_remove || patch.removeSymptoms || [];
  for (const s of add) if (!updated.symptoms.includes(s)) updated.symptoms.push(s);
  updated.symptoms = updated.symptoms.filter((s) => !remove.includes(s));
  return { entry: updated };
}
function entryDateMatchesLandmark(lm, date) {
  if (!date) return false;
  if (lm.resolvedDate === date) return true;
  return Math.abs(diffDateKeys(lm.resolvedDate || date, date)) <= 370;
}
function findMatchedEvent(text, matched) {
  if (!matched || matched.length === 0) return null;
  const lower = text.toLowerCase();
  let best = null;
  let bestScore = 0;
  for (const ev of matched) {
    const tokens = ev.title.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2);
    const score = tokens.filter((w) => lower.includes(w)).length;
    if (score > bestScore) {
      bestScore = score;
      best = ev;
    }
  }
  return bestScore > 0 ? best : null;
}
function parseLocally(text, today, context) {
  const startTime = Date.now();
  const lower = text.toLowerCase();
  const currentYear = parseInt(today.slice(0, 4), 10);
  const activityTrail = [
    { step: "Processing Speech", detail: "Extracted keywords from voice transcript", status: "done" }
  ];
  const toolCalls = [];
  const offline = { mode: "offline", modeReason: "Offline parser \u2014 Meta model not used (offline rule engine)" };
  if (checkMedicalAdviceGuardrail(text).isRefusal) {
    return { message: MEDICAL_REFUSAL_MESSAGE, needsClarification: false, activityTrail: [{ step: "Safety Guardrail", detail: "Medical advice refusal", status: "done" }], toolCalls: [], ...offline };
  }
  const severeCheck = checkSevereSymptomEscalation(text);
  if (severeCheck.isSevere) {
    activityTrail.push({ step: "Safety Escalation", detail: "Red-flag symptom detected \u2014 care-seeking signpost prepended", status: "done" });
  }
  if (!hasAnyLoggingOrPlanningCue(text)) {
    const q = "I didn't catch anything I can log from that \u2014 try something like 'period started yesterday, medium flow'.";
    return { message: q, entry: null, needsClarification: true, clarificationQuestion: q, activityTrail, toolCalls, ...offline };
  }
  const isExplicitCorrection = /^\s*no[,.!?\s]/i.test(text) || /\bactually\b/i.test(text) || /\bmake it\b/i.test(text) || /\bchange\s+(?:the\s+)?(?:date|flow|mood|energy|it|to)\b/i.test(text) || /\b(?:add|remove|delete)\b/i.test(text) || /\balso had\b/i.test(text) || /\bset\s+(?:the\s+)?date\b/i.test(text) || /\b(?:none|spotting|light|medium|heavy)\s*,?\s*(?:and\s+)?not\s+(?:none|spotting|light|medium|heavy)\b/i.test(text) || /\bnot\s+(?:none|spotting|light|medium|heavy)\b/i.test(text);
  const targetSlip = context.pendingEntry || (isExplicitCorrection ? selectCorrectionTarget(text, null, context.recentEntry, context.recentEntries) : null);
  if (targetSlip && (context.pendingEntry || isExplicitCorrection)) {
    const correctionRes = applySlipCorrections(targetSlip, text);
    if (correctionRes.changes.length > 0) {
      toolCalls.push({ id: "call_update_" + Date.now(), toolName: "update_entry", args: { correction: text }, result: { updated: correctionRes.updated, changes: correctionRes.changes }, latencyMs: Math.max(1, Date.now() - startTime), model: "offline-rule-engine", executedBy: "offline-rule-engine" });
      activityTrail.push({ step: "Accession Slip Correction", detail: correctionRes.changes.join("; "), status: "done" });
      return { message: "I've updated your Accession Slip with your corrections. Please review below.", entry: correctionRes.updated, needsClarification: false, activityTrail, toolCalls, ...offline };
    }
  }
  const isCorrectionAttempt = /\b(actually|make it\s+(?:light|heavy|medium|spotting|none)|change\s+(?:the\s+)?(?:date|flow)|(?:light|medium|heavy|spotting)\s*,?\s*not\s+(?:light|medium|heavy|spotting)|not\s+(?:light|medium|heavy|spotting)\s*,?\s*(?:but|actually)?\s*(?:light|medium|heavy|spotting))\b/i.test(text);
  if (!targetSlip && isCorrectionAttempt && !/\bperiod\s+(?:started|ended)\b/i.test(text)) {
    return {
      message: "I couldn't find a recent entry to correct.",
      entry: null,
      needsClarification: false,
      activityTrail: [{ step: "Correction Lookup", detail: "No recent entry found to correct", status: "done" }],
      toolCalls: [],
      ...offline
    };
  }
  if (isCompareIntent(text)) {
    const comparison = buildDateComparison(text, today, context);
    if (!comparison) {
      const q = "Which two dates should I compare? Give both dates, like Nov 14 and Nov 21.";
      return { message: q, entry: null, needsClarification: true, clarificationQuestion: q, activityTrail, toolCalls, ...offline };
    }
    activityTrail.push({ step: "Date Comparison", detail: comparison.message, status: "done" });
    toolCalls.push({ id: "call_compare_" + Date.now(), toolName: "check_overlap", args: { dates: comparison.dates.map((d) => d.date) }, result: { comparison }, latencyMs: Math.max(1, Date.now() - startTime), model: "offline-rule-engine", executedBy: "offline-rule-engine" });
    return { message: comparison.message, entry: null, needsClarification: false, activityTrail, toolCalls, comparison: { dates: comparison.dates, summary: comparison.summary }, plannedEvents: [], ...offline };
  }
  const intent = classifyIntent(text, !!targetSlip && (Boolean(context.pendingEntry) || isExplicitCorrection));
  const extraction = extractWithLexicon(text);
  const energyMatch = lower.match(/\benergy\s*(?:is|level|:)?\s*([1-5])\b/);
  const energy = energyMatch ? parseInt(energyMatch[1], 10) : null;
  const sleepMatch = lower.match(/\b(?:slept|sleep)\s*(?:for\s*)?(\d+(?:\.\d+)?)\s*(?:h|hours?)\b/) || lower.match(/\b(\d+(?:\.\d+)?)\s*(?:h|hours?)\s+of\s+sleep\b/);
  const sleep = sleepMatch ? parseFloat(sleepMatch[1]) : null;
  const MONTH_RE = "january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec";
  const planDateRe = new RegExp(`\\b(?:\\d{1,2}(?:st|nd|rd|th)?\\s+(?:${MONTH_RE})|(?:${MONTH_RE})\\s+\\d{1,2}(?:st|nd|rd|th)?)(?:,?\\s+\\d{4})?\\b|\\b\\d{4}-\\d{2}-\\d{2}\\b`, "gi");
  const eventMatches = [];
  const planDateSpans = [];
  let planDateInvalid = false;
  const passedPlanCandidates = [];
  {
    let m;
    let prevEnd = 0;
    const cleanTitle = (seg) => {
      let t = seg.split(/[.!?\n;]+/).pop() || seg;
      t = t.split(/,|\band\b/i).pop() || t;
      t = t.replace(/[,";]+\s*$/g, "").trim();
      t = t.replace(/^[\s,.;:!?\-&]+/, "").trim();
      t = t.replace(/^\s*(?:and|&|also|plus|then)\s+/i, "");
      let prevLead = "";
      while (prevLead !== t) {
        prevLead = t;
        t = t.replace(
          /^\s*(?:i\s+also\s+have|i\s+have|i've\s+got|ive\s+got|i\s+got|there\s+is|there's|we\s+have|we've\s+got|i\s+am\s+(?:worried|nervous|anxious|excited|stressed|thinking|planning|going|preparing)\s+(?:about|for|to)|i'm\s+(?:worried|nervous|anxious|excited|stressed|thinking|planning|going|preparing)\s+(?:about|for|to)|im\s+(?:worried|nervous|anxious|excited|stressed|thinking|planning|going|preparing)\s+(?:about|for|to)|worried\s+about|nervous\s+about|excited\s+for|preparing\s+for|planning\s+for|going\s+to)\s+/i,
          ""
        ).trim();
      }
      let prev = "";
      while (prev !== t) {
        prev = t;
        t = t.replace(/\s*(?:\b(?:is|was|scheduled|planned|happening|coming up|on|at|for|to attend)\b)\s*$/i, "").trim();
      }
      t = t.replace(/\bcoming up\b/gi, "").replace(/\s+/g, " ").trim();
      t = t.replace(/^\s*(?:an?|the|my|our|his|her|their)\s+/i, "").trim();
      return t;
    };
    while ((m = planDateRe.exec(text)) !== null) {
      const rawDate = m[0];
      const explicitYear = /\b\d{4}\b/.test(rawDate) && !/^\d{4}-/.test(rawDate) ? parseInt(rawDate.match(/\b\d{4}\b/)[0], 10) : /^\d{4}-/.test(rawDate) ? parseInt(rawDate.slice(0, 4), 10) : null;
      let resolvedDate;
      const dateNoYear = rawDate.replace(/,?\s+\b\d{4}\b/, "");
      if (/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) resolvedDate = isValidDateKey(rawDate) ? rawDate : null;
      else {
        resolvedDate = parseMonthDay(dateNoYear, explicitYear ?? currentYear);
      }
      const seg = text.slice(prevEnd, m.index);
      const sentenceStart = Math.max(
        0,
        text.lastIndexOf(".", m.index - 1) + 1,
        text.lastIndexOf("!", m.index - 1) + 1,
        text.lastIndexOf("?", m.index - 1) + 1,
        text.lastIndexOf("\n", m.index - 1) + 1,
        text.lastIndexOf(";", m.index - 1) + 1
      );
      const nextStops = [
        text.indexOf(".", m.index + rawDate.length),
        text.indexOf("!", m.index + rawDate.length),
        text.indexOf("?", m.index + rawDate.length),
        text.indexOf("\n", m.index + rawDate.length),
        text.indexOf(";", m.index + rawDate.length)
      ].filter((idx) => idx !== -1);
      const sentenceEnd = nextStops.length > 0 ? Math.min(...nextStops) : text.length;
      const localSentence = text.slice(sentenceStart, sentenceEnd);
      const clauseBeforeDate = text.slice(Math.max(prevEnd, sentenceStart), m.index);
      prevEnd = m.index + rawDate.length;
      const hasEventNounInClauseOrSentence = /\b(exam|wedding|trip|interview|party|flight|vacation|marathon|race|conference|presentation|dinner|event|appointment|birthday|anniversary|deadline|meeting|travel|holiday|plan|planning)\b/i.test(localSentence);
      const hasCycleOrSymptomInSentence = /\b(period|flow|spotting|bleeding|menstruat|cramps|headache|nausea|fatigue|bloating|back pain|tender breasts|mood|acne|insomnia|cravings|diarrhea|constipation|dizziness|hot flashes)\b/i.test(localSentence);
      const cleanedCandidate = cleanTitle(clauseBeforeDate);
      if (!hasEventNounInClauseOrSentence && (cleanedCandidate === "" || hasCycleOrSymptomInSentence)) continue;
      if (/\b(period|flow|spotting|bleeding|menstruat)/i.test(clauseBeforeDate) && !/\b(exam|wedding|trip|interview|party|flight|vacation|marathon|race|conference|presentation|dinner|event|appointment|birthday|anniversary|deadline|meeting|travel|holiday)\b/i.test(clauseBeforeDate)) continue;
      const title = cleanedCandidate || "Event";
      if (!resolvedDate || !isValidDateKey(resolvedDate)) {
        planDateInvalid = true;
        continue;
      }
      if (explicitYear === null && resolvedDate < today) {
        const nextYear = parseMonthDay(dateNoYear, currentYear + 1);
        if (nextYear) passedPlanCandidates.push({ name: title, thisYear: resolvedDate, nextYear });
        planDateSpans.push({ index: m.index, length: rawDate.length });
        continue;
      }
      planDateSpans.push({ index: m.index, length: rawDate.length });
      eventMatches.push({ name: title, date: resolvedDate });
    }
  }
  const EVENT_NOUNS = [
    "wedding",
    "exam",
    "trip",
    "interview",
    "party",
    "flight",
    "vacation",
    "conference",
    "presentation",
    "dinner",
    "meeting",
    "birthday",
    "anniversary",
    "marathon",
    "race",
    "appointment"
  ];
  const unplacedEvents = [];
  const eventNounRe = new RegExp(`\\b(${EVENT_NOUNS.join("|")})\\b`, "gi");
  let em;
  while ((em = eventNounRe.exec(text)) !== null) {
    const kw = em[1].toLowerCase();
    const alreadyMatched = eventMatches.some((e) => e.name.toLowerCase().includes(kw)) || passedPlanCandidates.some((c) => c.name.toLowerCase().includes(kw));
    if (!alreadyMatched && !unplacedEvents.includes(kw)) {
      unplacedEvents.push(kw);
    }
  }
  if (planDateInvalid && eventMatches.length === 0 && extractWithLexicon(text).symptoms.length === 0) {
    const q = "Which date did you mean for that event? Please give the day and month.";
    return { message: q, entry: null, needsClarification: true, clarificationQuestion: q, activityTrail, toolCalls, ...offline };
  }
  let planOverlaps = void 0;
  if (eventMatches.length > 0) {
    activityTrail.push({ step: "Plan Around It", detail: `Found ${eventMatches.length} events`, status: "done" });
    try {
      const bad = eventMatches.find((e) => !isValidDateKey(e.date));
      if (bad) throw new Error(`Unparsed event date: ${bad.date}`);
      planOverlaps = evaluateContextOverlaps(eventMatches, context, today);
    } catch {
      const q = "Which date did you mean for that event? Please give the day and month.";
      return { message: q, entry: null, needsClarification: true, clarificationQuestion: q, activityTrail, toolCalls, ...offline };
    }
    toolCalls.push({ id: "call_overlap_" + Date.now(), toolName: "check_overlap", args: { events: eventMatches }, result: { overlaps: planOverlaps }, latencyMs: Math.max(1, Date.now() - startTime), model: "offline-rule-engine", executedBy: "offline-rule-engine" });
  }
  const hasLogContent = extraction.symptoms.length > 0 || extraction.flow !== null || extraction.mood !== null || energy !== null || sleep !== null || extraction.periodStart || extraction.periodEnd || severeCheck.isSevere;
  const matchedEvent = findMatchedEvent(text, context.matchedEvents);
  const usedPersonalAnchor = !!matchedEvent && /\b(after|before|around|week of)\b/.test(lower) && !!matchedEvent;
  const earlyLandmark = resolveLandmarkExpression(text, today);
  const isLandmarkPlan = /\b(plan|planning)\b/i.test(lower) && !hasLogContent && eventMatches.length === 0 && earlyLandmark.found && !!earlyLandmark.resolvedDate;
  if (isLandmarkPlan && earlyLandmark.resolvedDate) {
    if (earlyLandmark.resolvedDate >= today) {
      eventMatches.push({ name: earlyLandmark.landmarkName || "Event", date: earlyLandmark.resolvedDate });
      unplacedEvents.length = 0;
      activityTrail.push({ step: "Plan Around It", detail: `Found ${eventMatches.length} events`, status: "done" });
      planOverlaps = evaluateContextOverlaps(eventMatches, context, today);
      toolCalls.push({ id: "call_overlap_" + Date.now(), toolName: "check_overlap", args: { events: eventMatches }, result: { overlaps: planOverlaps }, latencyMs: Math.max(1, Date.now() - startTime), model: "offline-rule-engine", executedBy: "offline-rule-engine" });
    } else {
      const nextLm = resolveLandmarkExpression(`${earlyLandmark.landmarkName} next year`, today);
      if (nextLm.found && nextLm.resolvedDate && nextLm.resolvedDate > today) {
        passedPlanCandidates.push({ name: earlyLandmark.landmarkName || "Event", thisYear: earlyLandmark.resolvedDate, nextYear: nextLm.resolvedDate });
        unplacedEvents.length = 0;
      }
    }
  }
  if (intent === "other" || !hasLogContent && intent !== "plan_event") {
    if (eventMatches.length === 0 && !matchedEvent && !earlyLandmark.found) {
      if (unplacedEvents.length > 0) {
        const q2 = `I couldn't place a date for: ${unplacedEvents.join(", ")}`;
        return { message: q2, entry: null, needsClarification: true, clarificationQuestion: q2, activityTrail, toolCalls, planOverlaps, ...offline };
      }
      const late = /\bperiod\s+(is\s+)?late\b|\blate period\b|\bmissed\s+(my\s+)?period\b/i.test(lower);
      const q = late ? "I can't tell if your period is late without a logged start \u2014 did it start? Tell me when, or say 'period started today' to log it." : "I didn't catch anything I can log from that \u2014 try something like 'period started yesterday, medium flow'.";
      return { message: q, entry: null, needsClarification: true, clarificationQuestion: q, activityTrail, toolCalls, planOverlaps, ...offline };
    }
  }
  const planPassedQuestion = passedPlanCandidates.length > 0 && eventMatches.length === 0 ? `Did you mean ${passedPlanCandidates[0].thisYear} (already passed) or ${passedPlanCandidates[0].nextYear}?` : null;
  if (planPassedQuestion && !hasLogContent) {
    return { message: planPassedQuestion, entry: null, needsClarification: true, clarificationQuestion: planPassedQuestion, activityTrail, toolCalls, planOverlaps, ...offline };
  }
  if ((intent === "plan_event" || eventMatches.length > 0) && !hasLogContent) {
    const isBareLandmark = eventMatches.length === 0;
    if (!isBareLandmark) {
      const msg = unplacedEvents.length > 0 ? `I couldn't place a date for: ${unplacedEvents.join(", ")}` : eventMatches.map((e) => `${e.name} on ${e.date}`).join("; ");
      return { message: msg, entry: null, needsClarification: false, activityTrail, toolCalls, planOverlaps, plannedEvents: eventMatches.map((e) => ({ title: e.name, date: e.date })), usedPersonalAnchor, ...offline };
    }
  }
  let logDateText = text;
  if (planDateSpans.length > 0) {
    for (const span of [...planDateSpans].sort((a, b) => b.index - a.index)) {
      logDateText = logDateText.slice(0, span.index) + " " + logDateText.slice(span.index + span.length);
    }
  }
  const logLandmark = resolveLandmarkExpression(logDateText, today);
  if (logLandmark.found && (logLandmark.baseDate && logLandmark.baseDate > today || logLandmark.resolvedDate && logLandmark.resolvedDate > today)) {
    const lmName = logLandmark.landmarkName || "Landmark";
    const futureBase = logLandmark.baseDate || logLandmark.resolvedDate;
    const futureYear = futureBase.slice(0, 4);
    const pastLm = resolveLandmarkExpression(`last ${lmName}`, today);
    const pastBase = pastLm.found ? pastLm.baseDate || pastLm.resolvedDate : null;
    const pastYear = pastBase ? pastBase.slice(0, 4) : null;
    const q = pastBase && pastYear && pastBase <= today ? `${lmName} ${futureYear} is on ${futureBase}, which hasn't happened yet. Did you mean ${lmName} ${pastYear} (${pastBase})?` : `${lmName} ${futureYear} is on ${futureBase}, which hasn't happened yet. Which past date did you mean?`;
    return { message: q, entry: null, needsClarification: true, clarificationQuestion: q, activityTrail, toolCalls, planOverlaps, ...offline };
  }
  const resolved = resolveDateExpression(logDateText, today);
  if (resolved.needsClarification) {
    return { message: resolved.clarificationQuestion || "Which date?", entry: null, needsClarification: true, clarificationQuestion: resolved.clarificationQuestion || "Which date?", activityTrail, toolCalls, planOverlaps, ...offline };
  }
  let entryDate = resolved.date;
  let dateExplanation = resolved.explanation || null;
  let dateWindow = resolved.window || null;
  let landmarkName = earlyLandmark.found && entryDateMatchesLandmark(earlyLandmark, resolved.date) ? earlyLandmark.landmarkName || null : null;
  let isApproximate = !!resolved.window || (landmarkName ? /\baround\b|\bnear\b/.test(lower) : false);
  if (!entryDate && matchedEvent && usedPersonalAnchor) {
    const off = parseRelativeExpression(text);
    entryDate = off.weekday ? matchedEvent.date : applyDayOffset(matchedEvent.date, off.days || 0);
    landmarkName = matchedEvent.title;
    dateExplanation = `${matchedEvent.title} = ${matchedEvent.date}`;
    isApproximate = true;
  }
  if (!entryDate && earlyLandmark.found && earlyLandmark.resolvedDate && earlyLandmark.resolvedDate <= today) {
    entryDate = earlyLandmark.resolvedDate;
    landmarkName = earlyLandmark.landmarkName || null;
    isApproximate = true;
    dateExplanation = landmarkName ? `${landmarkName} = ${entryDate}` : dateExplanation;
  }
  if (!entryDate) {
    const clearlyToday = /\b(today|now|this morning|tonight|right now)\b/.test(lower);
    const pastMarkers = /\b(started|began|came|ended|stopped|was|had|yesterday|ago|tha|the|thi|hua|hui|undaayirunnu|kazhinju|kazhinjittu|munpe|pehle|during|around|before|after|holi|equinox|solstice|midsummer|getaway|marathon)\b/i.test(lower) || /\b(ke\s+(?:day|time|din|baad|pehle)|time\s+il|winter\s+(?:holiday\s+)?break)\b/i.test(lower) || /(थी|था|थे|हुआ|हुई|के दिन|के समय|से .* पहले|के बाद|होली|ആയിരുന്നു|തുടങ്ങി|സമയത്ത്|ദിവസം|മുൻപ്|ശേഷം|ഹോളി|വേനൽ\s+അവധി)/.test(text);
    if (clearlyToday) entryDate = today;
    else if (hasLogContent && !pastMarkers) entryDate = today;
    else {
      const q = "Which date?";
      return { message: q, entry: null, needsClarification: true, clarificationQuestion: q, activityTrail, toolCalls, planOverlaps, ...offline };
    }
  }
  if (entryDate > today) {
    const q = `Did you mean last year's date? That date is in the future.`;
    return { message: q, entry: null, needsClarification: true, clarificationQuestion: q, activityTrail, toolCalls, planOverlaps, ...offline };
  }
  let unplacedNote = null;
  if (extraction.periodStart) {
    const frag = text.match(/(?:period\s+(?:started|began|came)|started\s+my\s+period|got\s+my\s+period)\s+([^,.;!?\n]+?)(?=\s+and\s|\s+but\s|\s+with\s|[,.;!?\n]|$)/i)?.[1];
    if (frag) {
      const r = resolveDateExpression(`period started ${frag}`, today);
      if (r.date) {
        entryDate = r.date;
        dateExplanation = r.explanation || dateExplanation;
      }
    }
    const firstDayFlow = lower.match(/\bflow\s+was\s+(light|medium|heavy)\s+on\s+the\s+first\s+day\b/) || lower.match(/\b(light|medium|heavy)\s+on\s+the\s+first\s+day\b/);
    if (firstDayFlow) extraction.flow = firstDayFlow[1];
    const yesterdayFlow = lower.match(/\b(light|medium|heavy)\s+yesterday\b/) || lower.match(/\byesterday\s+(?:flow\s+was\s+)?(light|medium|heavy)\b/);
    const yesterdayKey = addDaysToKey(today, -1);
    if (entryDate !== yesterdayKey && /\byesterday\b/i.test(text)) {
      const yesterdayMatch = text.match(/(?:but\s+|and\s+|,)?\s*(?:(?:flow\s+was\s+)?(?:none|spotting|light|medium|heavy)\s+)?yesterday\b[^.]*?(?=\s+and\s+(?:i\s+also\s+have|i\s+have|there\s+is|we\s+have|an?\s+(?:exam|wedding|trip|dinner|flight|party))|\s*\.|$)/i);
      const yesterdayClause = yesterdayMatch ? yesterdayMatch[0] : "";
      const yesterdaySymptoms = yesterdayClause ? extractWithLexicon(yesterdayClause).symptoms : [];
      if (yesterdaySymptoms.length > 0) {
        extraction.symptoms = extraction.symptoms.filter((s) => !yesterdaySymptoms.includes(s));
      }
      const yFlow = yesterdayFlow ? yesterdayFlow[1] : null;
      if (yFlow || yesterdaySymptoms.length > 0) {
        const parts = [];
        if (yFlow) parts.push(`${yFlow} flow`);
        if (yesterdaySymptoms.length > 0) parts.push(`with ${yesterdaySymptoms.join(" and ")}`);
        unplacedNote = `${parts.join(" ")} yesterday (${yesterdayKey}) as a separate day`;
      }
    } else if (yesterdayFlow && yesterdayFlow[1] !== extraction.flow) {
      unplacedNote = `${yesterdayFlow[1]} flow yesterday (${yesterdayKey}) as a separate day`;
    }
  }
  {
    const clauseParts = logDateText.split(
      /(?:[.!?\n;]+|,\s*(?=(?:and\s+|but\s+)?(?:on\s+|yesterday\b|today\b|last\s+night\b|day\s+before\s+yesterday\b|the\s+next\s+day\b|day\s*[2-7]\b|\d+\s+days?\s+ago\b|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2}\b|\d{1,2}(?:st|nd|rd|th)?\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b))|\b(?:and|but)\s+(?=(?:on\s+|yesterday\b|today\b|last\s+night\b|the\s+next\s+day\b|day\s*[2-7]\b|\d+\s+days?\s+ago\b)))/i
    ).map((s) => s.trim()).filter(Boolean);
    if (clauseParts.length >= 2) {
      const parsedClauses = clauseParts.map((cl) => {
        const clRes = resolveDateExpression(cl, today);
        let clDate = clRes.date;
        const clExplanation = clRes.explanation;
        if (!clDate && entryDate) {
          if (/\b(?:the\s+next\s+day|on\s+day\s*2|on\s+the\s+(?:2nd|second)\s+day|day\s*2)\b/i.test(cl)) clDate = addDaysToKey(entryDate, 1);
          else if (/\b(?:on\s+day\s*3|on\s+the\s+(?:3rd|third)\s+day|day\s*3)\b/i.test(cl)) clDate = addDaysToKey(entryDate, 2);
          else if (/\b(?:on\s+day\s*4|on\s+the\s+(?:4th|fourth)\s+day|day\s*4)\b/i.test(cl)) clDate = addDaysToKey(entryDate, 3);
        }
        const clExt = extractWithLexicon(cl);
        const hasClLog = clExt.periodStart || clExt.periodEnd || clExt.flow !== null || clExt.symptoms.length > 0 || clExt.mood !== null;
        return { text: cl, date: clDate, explanation: clExplanation, ext: clExt, hasClLog };
      });
      const datedLogClauses = parsedClauses.filter((c) => c.hasClLog && c.date !== null && c.date <= today);
      if (datedLogClauses.length >= 2) {
        const primaryClause = datedLogClauses.find((c) => c.ext.periodStart) || datedLogClauses[0];
        if (!extraction.periodStart && primaryClause.date) {
          entryDate = primaryClause.date;
          dateExplanation = primaryClause.explanation || dateExplanation;
        }
        const otherDated = datedLogClauses.filter((c) => c.date !== entryDate);
        const yesterdayKey = addDaysToKey(today, -1);
        const isMultiOrNonYesterday = otherDated.length > 1 || otherDated.length === 1 && (otherDated[0].date !== yesterdayKey || !unplacedNote);
        if (otherDated.length > 0 && isMultiOrNonYesterday) {
          const sameDateClauses = parsedClauses.filter((c) => c.date === entryDate || c.date === null && c.hasClLog);
          const sameDateFlows = sameDateClauses.map((c) => c.ext.flow).filter(Boolean);
          const firstDayFlowMatch = lower.match(/\bflow\s+was\s+(light|medium|heavy)\s+on\s+the\s+first\s+day\b/) || lower.match(/\b(light|medium|heavy)\s+on\s+the\s+first\s+day\b/);
          extraction.flow = firstDayFlowMatch ? firstDayFlowMatch[1] : sameDateFlows[0] ?? null;
          const sameDateSymptoms = [];
          for (const c of sameDateClauses) {
            for (const s of c.ext.symptoms) {
              if (!sameDateSymptoms.includes(s)) sameDateSymptoms.push(s);
            }
          }
          extraction.symptoms = sameDateSymptoms;
          const sameDateMoods = sameDateClauses.map((c) => c.ext.mood).filter(Boolean);
          extraction.mood = sameDateMoods[0] ?? null;
          const unplacedDescriptions = [];
          for (const c of otherDated) {
            const parts = [];
            if (c.ext.flow) parts.push(`${c.ext.flow} flow`);
            if (c.ext.symptoms.length > 0) {
              const symLabels = c.ext.symptoms.map((s) => s.replace(/_/g, " ")).join(" and ");
              parts.push(c.ext.flow ? `with ${symLabels}` : symLabels);
            }
            if (c.ext.mood) parts.push(`mood ${c.ext.mood.toLowerCase()}`);
            if (parts.length === 0 && c.ext.periodEnd) parts.push("period ended");
            if (parts.length > 0) {
              const dayWord = /\byesterday\b/i.test(c.text) ? `yesterday (${c.date})` : /\btoday\b/i.test(c.text) ? `today (${c.date})` : `(${c.date})`;
              unplacedDescriptions.push(`${parts.join(" ")} ${dayWord}`);
            }
          }
          if (unplacedDescriptions.length > 0) {
            unplacedNote = `${unplacedDescriptions.join("; ")} as ${unplacedDescriptions.length === 1 ? "a separate day" : "separate days"}`;
          }
        }
      }
    }
  }
  const kind = intent === "period_end" || extraction.periodEnd ? "period_ended" : intent === "period_start" || extraction.periodStart ? "period_started" : "daily_log";
  const entry = {
    date: entryDate,
    flow: extraction.flow,
    symptoms: extraction.symptoms,
    mood: extraction.mood,
    energy,
    sleep,
    notes: text,
    isApproximate,
    landmarkName,
    kind,
    dateExplanation,
    dateWindow
  };
  toolCalls.push({ id: "call_log_" + Date.now(), toolName: "log_entry", args: { date: entryDate, flow: extraction.flow, symptoms: extraction.symptoms, mood: extraction.mood, energy, kind }, result: { entry }, latencyMs: Math.max(1, Date.now() - startTime), model: "offline-rule-engine", executedBy: "offline-rule-engine" });
  const baseMessage = isApproximate && landmarkName ? `I found ${landmarkName} on ${entryDate}. Would you like to confirm this period entry?` : `I've prepared your log for ${entryDate}. Please review and confirm below.`;
  let message = unplacedNote ? `${baseMessage} I couldn't place: ${unplacedNote} \u2014 log that day separately if you want it saved.` : baseMessage;
  if (unplacedEvents.length > 0) {
    message += ` I couldn't place a date for: ${unplacedEvents.join(", ")}.`;
  }
  if (severeCheck.isSevere && !message.startsWith(SEVERE_SYMPTOM_ESCALATION_MESSAGE)) {
    message = `${SEVERE_SYMPTOM_ESCALATION_MESSAGE} ${message}`;
  }
  return { message, entry, needsClarification: isApproximate && !!landmarkName || !!planPassedQuestion, clarificationQuestion: planPassedQuestion ?? (isApproximate && landmarkName ? `Did your period start before, on, or after ${landmarkName}?` : null), activityTrail, toolCalls, planOverlaps, plannedEvents: eventMatches.map((e) => ({ title: e.name, date: e.date })), usedPersonalAnchor, ...offline };
}

// ai/backend/protection.ts
var minuteHits = /* @__PURE__ */ new Map();
var dailyHits = /* @__PURE__ */ new Map();
var globalDailyTracker = { count: 0, day: todayLocal() };
var LIMIT_PER_MINUTE = 20;
var LIMIT_PER_DAY_IP = 150;
var DEFAULT_GLOBAL_DAILY_CAP = 500;
function getTodayString() {
  return todayLocal();
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
function requestHost(req) {
  const h = req && req.headers || {};
  const raw = h["x-forwarded-host"] || h["host"] || "";
  return String(Array.isArray(raw) ? raw[0] : raw).split(",")[0].trim().toLowerCase();
}
function configuredAllowedOrigins() {
  return (process.env.ALLOWED_ORIGINS || process.env.ALLOWED_ORIGIN || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
}
function isOriginAllowed(originOrReferer, reqOrHost) {
  if (!originOrReferer) return true;
  let originHost = "";
  try {
    originHost = new URL(originOrReferer).host.toLowerCase();
  } catch {
    return false;
  }
  const ownHost = typeof reqOrHost === "string" ? reqOrHost.toLowerCase() : reqOrHost ? requestHost(reqOrHost) : "";
  if (ownHost && originHost === ownHost) return true;
  return configuredAllowedOrigins().some((entry) => {
    try {
      return new URL(entry.includes("://") ? entry : `https://${entry}`).host.toLowerCase() === originHost;
    } catch {
      return entry === originHost;
    }
  });
}
function corsAllowOrigin(req) {
  const origin = req?.headers?.origin;
  if (!origin) return void 0;
  return isOriginAllowed(origin, req) ? origin : void 0;
}
function checkStatelessProtection(req, options) {
  const headers = req.headers || {};
  const origin = headers["origin"] || headers["referer"];
  if (!isOriginAllowed(origin, req)) {
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
    const _aco = corsAllowOrigin(res?.req);
    if (_aco) res.setHeader("Access-Control-Allow-Origin", _aco);
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
      "Access-Control-Allow-Origin": corsAllowOrigin(res?.req) || "null",
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
      const _aco = corsAllowOrigin(res?.req);
      if (_aco) res.setHeader("Access-Control-Allow-Origin", _aco);
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
        "Access-Control-Allow-Origin": corsAllowOrigin(res?.req) || "null",
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
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": corsAllowOrigin(res?.req) || "null" },
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
          "Access-Control-Allow-Origin": corsAllowOrigin(res?.req) || "null"
        },
        body: JSON.stringify(result)
      };
    } catch (err) {
      console.error("[api] upstream error:", err?.message || err);
      return {
        statusCode: 500,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Something went wrong \u2014 please try again" })
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
    console.error("[agent] upstream error:", err?.message || err);
    return sendResponse(res, 500, { error: "Something went wrong \u2014 please try again" });
  }
}
var agent_default = handler;
export {
  agent_default as default,
  handler
};
