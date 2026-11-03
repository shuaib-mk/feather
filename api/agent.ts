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
  /\b(?:is\s+[\w\s]{0,25}?\s*(?:a\s+)?(?:sign|symptom|indication)s?\s+of\s+(?:pregnancy|disease|infection|miscarriage|cancer))\b/i,
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
  /\b(?:log|note|record|save|remember)\s+that\s+i\s+(?:should|need\s+to|ought\s+to|can)\s+(?:take|use|try|stop|start)\s+(?:this|that|a|an|the|my|some)?\s*(?:pill|pills|tablet|tablets|medicine|medication|drug|painkiller|antibiotic|dose|dosage)\b/i,
  // Q3: "does X mean I have <condition>" diagnostic probes.
  /\bmean\s+i\s+have\s+(?:a\s+|an\s+)?(?:pcos|pcod|endometriosis|fibroid|infection|cyst|cancer|tumor|disease|miscarriage|vaginosis|yeast\s+infection|disorder|condition)\b/i,
  // Q3: multilingual medicine questions and "is it normal".
  // Tamil: marundu (medicine), mathirai (tablet), "normal ah", satharanama.
  /(?:\bmarundu\b|\bmathirai\b|\bnormal\s+ah\b|\bsatharanama\b)/i,
  // Kannada: aushadhi/aushadha (medicine), matre (tablet), "idu normal", sahaja.
  /(?:\baushadh[ai]\b|\bmatre\b|\bidu\s+normal\b|\bsahaja\b)/i,
  // Malayalam: marunnu (medicine), gulika (tablet), "normal ano/ana", sadharana.
  /(?:\bmarunnu\b|\bgulika\b|\bnormal\s+an[oa]\b|\bsadharana\b)/i,
  // Hindi romanized extras: dava/davai/goli (medicine/tablet), "kya ye normal hai".
  /(?:\bdava\b|\bdavai\b|\bgoli\b|\bkya\s+yeh?\s+normal\s+hai\b)/i
];
var REDIRECT_MESSAGES = {
  fertility: "I can't help with that, but I can log how you feel or show your logged cycles.",
  verdict: "I can't help with that, but I can show your logged cycles or log how you feel today.",
  diet_exercise: "I can't help with that, but I can log how you feel or show your logged cycles.",
  phase: "I can't help with that, but I can log how you feel or show your logged cycles."
};
var FERTILITY_PATTERNS = [
  /\bwhen\s+am\s+i\s+ovulat/i,
  /\bovulat(?:ion|ing|e)\s+(?:date|day|window|time|happen)/i,
  /\bfertile\s+(?:window|days?|period)\b/i,
  /\bmy\s+fertility\b/i,
  /\bbest\s+days?\s+to\s+conceive\b/i,
  /\bdays?\s+to\s+avoid\s+pregnancy\b/i,
  /\bsafe\s+days?\b/i,
  /\bcan\s+i\s+get\s+pregnant\s+on\s+day\s*\d+\b/i,
  /\bis\s+it\s+safe\s+to\s+have\s+sex\b/i,
  /\bovulation\b/i,
  /\bfertile\b/i,
  /\u0905\u0902\u0921\u094b\u0924\u094d\u0938\u0930\u094d\u0917/,
  /\u0909\u092a\u091c\u093e\u090a\u20ac?\s*\u0926\u093f\u0928/
];
var VERDICT_PATTERNS = [
  /\bis\s+\d+\s*days?\s+normal\b(?!\s+for\s+me\b)/i,
  /\bis\s+(?:my\s+)?(?:cycle\s+length|period\s+length)\s+(?:healthy|normal|regular|okay|ok|fine)\b/i,
  /\bhow\s+many\s+days\s+is\s+a\s+normal\s+period\b/i,
  /\bwhat(?:'s|\s+is)\s+a?\s*normal\s+cycle\s+length\b/i,
  /\u0938\u093e\u092e\u093e\u0928\u094d\u092f\s+\u091a\u0915\u094d\u0930/
];
var SYMPTOM_VERDICT_PATTERNS = [
  /\bis\s+(?:this|my|the)?\s*(?:cramp|cramps|pain|bleeding|flow|discharge|symptom|blood)\b[^.?!]*\b(?:normal|abnormal|healthy|regular|okay|ok|fine|bad|dangerous|concerning)\b/i,
  /\bis\s+this\s+(?:cramp|cramps|pain)\s+normal\b/i,
  /\bshould\s+i\s+(?:be\s+)?(?:worried|worry)\b/i,
  /\bmean\s+something\s+is\s+wrong\b/i
];
var DIET_EXERCISE_PATTERNS = [
  /\bwhat\s+(?:to|should\s+i)\s+(?:eat|drink|avoid)\b[^.?!]*\bperiod\b/i,
  /\bexercise\s+(?:during|on|while)\b[^.?!]*\bperiod\b/i,
  /\bcan\s+i\s+exercise\b[^.?!]*\bperiod\b/i,
  /\bhome\s+remedy\s+for\s+(?:cramps?|period\s+pain|pain)\b/i,
  /\bdiet\s+for\s+(?:pcos|pcod|period|cramps?)\b/i,
  /\bfoods?\s+to\s+(?:eat|avoid)\b[^.?!]*\bperiod\b/i,
  /\u092a\u0940\u0930\u093f\u092f\u0921\s+\u092e\u0947\u0902\s+\u0915\u094d\u092f\u093e\s+\u0916\u093e\u0928\u093e/
];
var PHASE_PATTERNS = [
  /\bwhat\s+does\s+(?:my\s+)?cycle\s+phase\s+mean\b/i,
  /\bwhat\s+phase\s+am\s+i\s+in\b/i,
  /\b(?:luteal|follicular)\b/i,
  /\bcycle\s+phase\s+mean/i,
  /\u091a\u0915\u094d\u0930\s+\u091a\u0930\u0923/
];
var CATEGORY_PATTERNS = [
  ["fertility", FERTILITY_PATTERNS],
  ["verdict", VERDICT_PATTERNS],
  ["diet_exercise", DIET_EXERCISE_PATTERNS],
  ["phase", PHASE_PATTERNS]
];
function classifyGuardrailCategory(input) {
  const t = input.trim();
  if (!t) return null;
  if (SYMPTOM_VERDICT_PATTERNS.some((p) => p.test(t))) return "medical";
  for (const [cat, pats] of CATEGORY_PATTERNS) {
    if (pats.some((p) => p.test(t))) return cat;
  }
  return checkMedicalAdviceGuardrail(t).isRefusal ? "medical" : null;
}
function getGuardrailResponseMessage(input) {
  const cat = classifyGuardrailCategory(input);
  if (!cat || cat === "medical") return MEDICAL_REFUSAL_MESSAGE;
  return REDIRECT_MESSAGES[cat];
}
var BANNED_OUTPUT_PATTERNS = [
  /\bovulat\w*\b/i,
  /\bfertil\w*\b/i,
  /\b(?:is|are|was|were)\b[^.?!]{0,40}\b(?:normal|healthy|safe|fine|okay|ok)\b/i,
  /\bit(?:'s|s)?\b[^.?!]{0,20}\b(?:normal|healthy|safe|fine)\b/i,
  /\b(?:completely|totally|perfectly|entirely)\s+(?:normal|healthy|safe|fine)\b/i,
  /\bguaranteed\b/i,
  /\bclear\s+window\b/i,
  /\bsafe\s+days?\b/i
];
function checkModelOutputGuard(text) {
  const blocked = BANNED_OUTPUT_PATTERNS.some((p) => p.test(text || ""));
  return { blocked, message: blocked ? REDIRECT_MESSAGES.verdict : text };
}
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
  // v2: soaking a pad/tampon every hour or two; fainting with bleeding; severe pain with fever
  /\bsoak(?:ing|ed|s)?\s+(?:through\s+)?(?:a\s+|my\s+|\d+\s+)?(?:pad|tampon|pads|tampons)\s+(?:every|each)\s+(?:hour|1\s*hour|two\s+hours|2\s*hours)\b/i,
  /\b(?:faint\w*|pass(?:ed|ing)?\s+out|black\w*\s+out)\b[^.?!]*\b(?:bleed\w*|blood)\b/i,
  /\bsevere\s+(?:pain|cramps?)\b[^.?!]*\bfever\b/i,
  /\bfever\b[^.?!]*\bsevere\s+(?:pain|cramps?)\b/i,
  // Suicidal thoughts / self-harm
  /\b(?:suicid(?:al|e)|thoughts?\s+of\s+(?:self[-\s]?harm|hurting\s+myself|ending\s+my\s+life|dying)|want(?:ing)?\s+to\s+(?:die|hurt\s+myself|end\s+it\s+all)|self[-\s]?harm)\b/i,
  // Q3: fainting / dizziness / chest pain in Hindi, Tamil, Kannada, Malayalam (romanized).
  // Hindi: behosh/behoshi (faint), chakkar (dizzy), seene me(a)dard (chest pain).
  /\b(?:behosh(?:i)?|chakkar|seene\s+me(?:in)?\s+dard)\b/i,
  // Tamil: mayakkam (faint/dizzy), nenju vali / nenj vali (chest pain).
  /\b(?:mayakkam|nenju\s+vali|nenj\s+vali)\b/i,
  // Kannada: talasutti (dizzy), ede novu / ede nov (chest pain).
  /\b(?:talasutti|ede\s+novu?)\b/i,
  // Malayalam: thalakarakkam (dizzy), mayakkam (faint), nenjuvedana (chest pain).
  /\b(?:thalakarakkam|thalakarakam|mayakkam|nenjuvedana|nenjuv\s+vedana)\b/i
];
var SEVERE_FALL_CARE_MESSAGE = "I'm sorry that happened. If you fell, feel faint, or the bleeding is very heavy, please get help now from a trusted adult or a doctor, or call your local emergency number (112 in India). I can't give medical advice, but I can log this for you.";
var FALL_STANDALONE_PATTERNS = [
  /\bfell\s+down\b/i,
  /\bcollapsed\b/i,
  /\bblacked\s*out\b/i,
  /\bgir\s+ga(?:ya|yi|ye)\b/i
];
var FALL_OR_BLEED_PATTERNS = [
  /\bfell\s+down\b/i,
  /\bfell\s+on\s+the\s+(?:ground|floor)\b/i,
  /\bfell\s+and\b/i,
  /\bcollapsed\b/i,
  /\bblacked\s*out\b/i,
  /\bcan(?:'?t|\s+not)\s+stand\b/i,
  /\ba\s+lot\s+of\s+blood\b/i,
  /\bso\s+much\s+blood\b/i,
  /\bbleeding\s+a\s+lot\b/i,
  /\bbahut\s+(?:khoon|blood|bleeding)\b/i,
  /\bgir\s+ga(?:ya|yi|ye)\b/i
];
var FALL_PAIN_OR_DISTRESS_PATTERNS = [
  /\bpain(?:ful)?\b/i,
  /\bhurt(?:s|ing)?\b/i,
  /\bcramps?\b/i,
  /\bso\s+painful\b/i,
  /\bi\s+(?:do\s+not|don'?t)\s+know\s+what\s+to\s+do\b/i,
  /\bscared\b/i,
  /\bafraid\b/i,
  /\bplease\s+help\b/i,
  /\bfaint\b/i,
  /\bdizzy\b/i
];
function checkFallSevereInput(input) {
  const t = input.trim();
  if (!t) return false;
  if (FALL_STANDALONE_PATTERNS.some((p) => p.test(t))) return true;
  if (!FALL_OR_BLEED_PATTERNS.some((p) => p.test(t))) return false;
  return FALL_PAIN_OR_DISTRESS_PATTERNS.some((p) => p.test(t));
}
function checkSevereSymptomEscalation(input) {
  const normalized = input.trim();
  if (!normalized) {
    return { isSevere: false, escalationMessage: null };
  }
  if (/(hospital|emergency(?:\s+room)?|urgent\s+care)/i.test(normalized) && /(heavy|bleed\w*|soak\w*|spotting|hemorrhag|flooding|flow)/i.test(normalized)) {
    return { isSevere: true, escalationMessage: SEVERE_SYMPTOM_ESCALATION_MESSAGE };
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
  for (const pattern of [...MEDICAL_ADVICE_PATTERNS, ...FERTILITY_PATTERNS, ...VERDICT_PATTERNS, ...SYMPTOM_VERDICT_PATTERNS, ...DIET_EXERCISE_PATTERNS, ...PHASE_PATTERNS]) {
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
  const window2 = { start: addDays(expectedStart, -halfWidth), end: addDays(coreEnd, halfWidth) };
  if (eventDate >= expectedStart && eventDate <= coreEnd) {
    return {
      status: "likely",
      window: window2,
      note: `Likely overlap: a period is estimated around ${expectedStart} to ${coreEnd}.`,
      cyclesAhead: k,
      expectedStart
    };
  }
  if (eventDate >= window2.start && eventDate <= window2.end) {
    return {
      status: "possible",
      window: window2,
      note: `Possible overlap: this date is inside the wider estimate window ${window2.start} to ${window2.end}.`,
      cyclesAhead: k,
      expectedStart
    };
  }
  return {
    status: "unlikely",
    window: window2,
    note: `Unlikely to overlap (estimate): the estimated window for that cycle is ${window2.start} to ${window2.end}.`,
    cyclesAhead: k,
    expectedStart
  };
}

// ai/backend/intent.ts
var OWN_EVENTS_TOPIC_SRC = "exam|wedding|trip|interview|party|flight|vacation|marathon|race|conference|presentation|dinner|event|appointment|birthday|anniversary|deadline|meeting|travel|holiday|shaadi|sangeet";
var OWN_EVENTS_MONTH_SRC = "january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec";
var OWN_EVENTS_DATE_HINT_RE = new RegExp(
  "\\b(?:\\d{1,2}(?:st|nd|rd|th)?\\s+(?:" + OWN_EVENTS_MONTH_SRC + ")|(?:" + OWN_EVENTS_MONTH_SRC + ")\\s+\\d{1,2}(?:st|nd|rd|th)?)(?:,?\\s+\\d{4})?\\b|\\b\\d{4}-\\d{2}-\\d{2}\\b",
  "i"
);
var OWN_EVENTS_LOG_CUE_RE = /\bperiod\s+(?:started|ended|began|came|stopped|finished)\b|\b(?:flow|cramps?|headaches?|nausea|fatigue|bloating|spotting|bleeding|back\s+pain|mood|tender|acne|cravings|insomnia)\b|\benergy\s*(?:is|level|:)?\s*[1-5]\b|\b(?:slept|sleep)\b/i;
var EVENT_WORDS = ["exam", "wedding", "trip", "interview", "party", "flight", "vacation", "marathon", "race", "conference", "presentation", "holiday", "flight", "travel", "plan", "planning"];
var LOG_WORDS = ["flow", "cramps", "cramp", "headache", "backache", "bloating", "fatigue", "tired", "mood", "energy", "slept", "sleep", "spotting", "bleeding", "period", "log", "dizzy", "dizziness", "nausea", "nauseous", "acne", "cravings", "insomnia", "anxious", "anxiety", "tender", "\u0926\u0930\u094D\u0926", "\u0925\u0915\u093E\u0928", "\u0938\u093F\u0930\u0926\u0930\u094D\u0926", "\u0CA4\u0CB2\u0CC6\u0CA8\u0CCB\u0CB5\u0CC1", "\u0BA4\u0BB2\u0BC8\u0BB5\u0BB2\u0BBF", "\u0D24\u0D32\u0D35\u0D47\u0D26\u0D28"];
var OWN_DATA_PATTERNS = [
  /\bwhat(?:'s|\s+is)\s+my\s+(?:average|avg)\s+cycle\b/i,
  /\bmy\s+(?:average|avg)\s+cycle\b/i,
  /\bhow\s+long\s+are\s+my\s+periods\b/i,
  /\bhow\s+long\s+do\s+my\s+periods\s+last\b/i,
  /\bhow\s+long\s+are\s+my\s+cycles\b/i,
  /\bwhen\s+is\s+my\s+next\s+period\b/i,
  /\bmy\s+next\s+period\b/i,
  /\b(?:longest|shortest)\s+(?:cycle|period)\b/i,
  /\bhow\s+many\s+(?:cycles|periods)\s+have\s+i\s+logged\b/i,
  /\bwhen\s+did\s+my\s+last\s+period\s+start\b/i,
  /\bwhen\s+was\s+my\s+last\s+period\b/i,
  /\bwhen\s+my\s+last\s+period\s+(?:was|started)\b/i,
  /\blast\s+period\s+start\b/i,
  /\bdid\s+i\s+log\s+anything\s+in\s+[a-z]+\b/i,
  /\bis\s+\d+\s*days?\s+normal\s+for\s+me\b/i,
  /\bis\s+my\s+cycle\s+regular\b/i,
  /\bshow\s+(?:me\s+)?my\s+(?:logged\s+)?cycles\b/i
];
function isOwnDataQuestion(text) {
  const t = text.trim();
  if (!t) return false;
  return OWN_DATA_PATTERNS.some((p) => p.test(t));
}
function classifyIntent(text, hasPendingEntry = false) {
  const lower = ` ${text.toLowerCase().trim()} `;
  if (checkMedicalAdviceGuardrail(text).isRefusal) return "medical_question";
  if (isOwnDataQuestion(text)) return "own_data_question";
  if (isOwnEventsQuestion(text)) return "own_events_question";
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
var OWN_EVENTS_CALENDAR_Q_RES = [
  /\bis\s+there\s+any\b/i,
  /\bare\s+there\s+any\b/i,
  /\bis\s+there\s+anything\b/i,
  /\bdo\s+i\s+have\b/i,
  /\bhave\s+i\s+got\b/i,
  /\bwhat(?:'s|\s+is)\s+(?:on\s+my\s+calendar|coming(?:\s+up)?)\b/i,
  /\bwhat\s+do\s+i\s+have\b/i,
  /\bwhat\s+is\s+on\s+my\s+calendar\b/i,
  /\bwhen\s+is\s+my\b/i,
  /\bwhen's\s+my\b/i,
  /\bhow\s+many\s+events\b/i,
  /\bcalendar\s+mein\s+kya\s+hai\b/i,
  /\bkab\s+hai\b/i
];
var OWN_EVENTS_OVERLAP_WORD_RE = /\b(clash(?:es|ed|ing)?|overlap(?:s|ped|ping)?|coincid(?:e|es|ing)|during)\b/i;
function isOverlapQuestion(text) {
  return /\bperiod\b/i.test(text) && OWN_EVENTS_OVERLAP_WORD_RE.test(text) && new RegExp("\\b(" + OWN_EVENTS_TOPIC_SRC + ")s?\\b", "i").test(text);
}
function isOwnEventsQuestion(text) {
  if (OWN_EVENTS_DATE_HINT_RE.test(text)) return false;
  if (OWN_EVENTS_LOG_CUE_RE.test(text)) return false;
  if (isOverlapQuestion(text)) return true;
  return OWN_EVENTS_CALENDAR_Q_RES.some((p) => p.test(text));
}

// ai/backend/ownDataAnswer.ts
var OVERLAP_DISCLAIMER_TEXT = "Estimates based on your logged cycles. Cycles vary, so this is not a guarantee and not contraception or medical advice.";
var NOT_ENOUGH_DATA_MESSAGE = "Not enough data yet. Log at least 2 more periods and I can show your numbers.";
var VERDICT_TAIL = "Whether that is typical for you is a question for a doctor. I can only log and plan.";
var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
var MONTH_NUM = {
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12,
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  sept: 9,
  oct: 10,
  nov: 11,
  dec: 12
};
var MONTH_FULL = {
  january: "January",
  february: "February",
  march: "March",
  april: "April",
  may: "May",
  june: "June",
  july: "July",
  august: "August",
  september: "September",
  october: "October",
  november: "November",
  december: "December",
  jan: "January",
  feb: "February",
  mar: "March",
  apr: "April",
  jun: "June",
  jul: "July",
  aug: "August",
  sep: "September",
  sept: "September",
  oct: "October",
  nov: "November",
  dec: "December"
};
function label(key) {
  const m = parseInt(key.slice(5, 7), 10), d = parseInt(key.slice(8, 10), 10);
  return MONTHS[(m || 1) - 1] + " " + d;
}
function addDaysKey(key, days) {
  const dt = new Date(Date.UTC(+key.slice(0, 4), +key.slice(5, 7) - 1, +key.slice(8, 10)) + days * 864e5);
  const p = (n) => String(n).padStart(2, "0");
  return dt.getUTCFullYear() + "-" + p(dt.getUTCMonth() + 1) + "-" + p(dt.getUTCDate());
}
function computeOwnDataStats(ctx) {
  const starts = [...new Set((ctx.periods || []).map((p) => p.startDate).filter(Boolean))].sort();
  const lengths = [];
  for (let i = 1; i < starts.length; i++) {
    const diff = Math.round((Date.parse(starts[i]) - Date.parse(starts[i - 1])) / 864e5);
    if (diff > 0) lengths.push(diff);
  }
  let avgPeriodDays = ctx.cycleStats?.avgPeriodLength ?? null;
  if (avgPeriodDays == null) {
    const durs = (ctx.periods || []).filter((p) => p.endDate && p.endDate >= p.startDate).map((p) => Math.round((Date.parse(p.endDate) - Date.parse(p.startDate)) / 864e5) + 1);
    avgPeriodDays = durs.length ? Math.round(durs.reduce((a, b) => a + b, 0) / durs.length * 10) / 10 : null;
  }
  return {
    completedCycles: lengths.length,
    medianDays: lengths.length ? median(lengths) : null,
    minDays: lengths.length ? Math.min(...lengths) : null,
    maxDays: lengths.length ? Math.max(...lengths) : null,
    avgPeriodDays,
    lastStart: starts.length ? starts[starts.length - 1] : null
  };
}
function buildOwnDataAnswer(text, ctx) {
  if (!isOwnDataQuestion(text)) return null;
  const s = computeOwnDataStats(ctx);
  if (/\bwhen\s+did\s+my\s+last\s+period\s+start\b|\bwhen\s+was\s+my\s+last\s+period\b|\bwhen\s+my\s+last\s+period\s+(?:was|started)\b|\blast\s+period\s+start\b/i.test(text)) {
    if (!s.lastStart) return { kind: "own_data_answer", message: "You have not logged any periods yet. Log your first period to get started.", usedLiveModel: false };
    return { kind: "own_data_answer", message: "Your last logged period started " + label(s.lastStart) + ".", usedLiveModel: false };
  }
  const monthQ = text.toLowerCase().match(/\bdid\s+i\s+log\s+anything\s+in\s+([a-z]+)\b/);
  if (monthQ && MONTH_NUM[monthQ[1]]) {
    const m = MONTH_NUM[monthQ[1]];
    const monthDates = [.../* @__PURE__ */ new Set([...(ctx.periods || []).map((p) => p.startDate), ...(ctx.logs || []).map((l) => l.logDate)])].filter((d) => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d) && +d.slice(5, 7) === m).sort().map((d) => label(d));
    const monthName = MONTH_FULL[monthQ[1]];
    if (monthDates.length === 0) return { kind: "own_data_answer", message: "Nothing logged in " + monthName + ".", usedLiveModel: false };
    return { kind: "own_data_answer", message: "Logged in " + monthName + ": " + monthDates.join(", ") + ".", usedLiveModel: false };
  }
  if (s.completedCycles < 2 || s.medianDays == null) {
    return { kind: "own_data_answer", message: NOT_ENOUGH_DATA_MESSAGE, usedLiveModel: false };
  }
  const stats = "From your " + s.completedCycles + " logged cycles: median " + s.medianDays + " days (range " + s.minDays + " to " + s.maxDays + " days)." + (s.avgPeriodDays != null ? " Periods last about " + s.avgPeriodDays + " days." : "");
  if (/\bwhen\s+is\s+my\s+next\s+period\b|\bmy\s+next\s+period\b/i.test(text) && s.lastStart) {
    const earliest = ctx.cycleStats?.nextPeriodEarliest || addDaysKey(s.lastStart, s.minDays);
    const latest = ctx.cycleStats?.nextPeriodLatest || addDaysKey(s.lastStart, s.maxDays);
    return { kind: "own_data_answer", message: "Your next period estimated window is between " + label(earliest) + " and " + label(latest) + ". " + OVERLAP_DISCLAIMER_TEXT, usedLiveModel: false };
  }
  if (/\bis\s+\d+\s*days?\s+normal\s+for\s+me\b|\bis\s+my\s+cycle\s+regular\b/i.test(text)) {
    return { kind: "own_data_answer", message: stats + " " + VERDICT_TAIL, usedLiveModel: false };
  }
  return { kind: "own_data_answer", message: stats, usedLiveModel: false };
}

// client/src/lib/demoMode.ts
var DEMO_ACTIVE_KEY = "feather_demo_active";
var DEMO_EVENTS_KEY = "feather_demo_events_v1";
function getStorage() {
  try {
    if (typeof window !== "undefined" && window.localStorage) return window.localStorage;
    if (typeof globalThis !== "undefined" && globalThis.localStorage) return globalThis.localStorage;
  } catch {
  }
  return null;
}
function buildDemoData(today = todayLocal()) {
  const lengths = [38, 26, 33, 29, 36, 28, 31];
  const starts = [];
  let cursor = addDays(today, -221);
  for (const len of lengths) {
    starts.push(cursor);
    cursor = addDays(cursor, len);
  }
  const periods = starts.map((s, i) => ({ id: 9e3 + i, startDate: s, endDate: addDays(s, 4), isApproximate: false }));
  const logs = [];
  let id = 9e3;
  for (const s of starts) {
    logs.push({ id: id++, logDate: s, flow: "heavy", symptoms: ["cramps"], mood: "Okay", energy: 3, sleepHours: 7, notes: "Demo log (fictional)" });
    logs.push({ id: id++, logDate: addDays(s, 1), flow: "medium", symptoms: ["fatigue"], mood: null, energy: null, sleepHours: null, notes: null });
  }
  const events = [
    { id: "demo-event-1", title: "Demo exam (fictional)", date: addDays(today, 20), source: "manual", demo: true },
    { id: "demo-event-2", title: "Demo trip (fictional)", date: addDays(today, 45), source: "manual", demo: true }
  ];
  return { periods, logs, events };
}
function isDemoActive() {
  try {
    return getStorage()?.getItem(DEMO_ACTIVE_KEY) === "1";
  } catch {
    return false;
  }
}

// client/src/lib/events.ts
var REAL_EVENTS_KEY = "feather_events_v1";
function store() {
  try {
    if (typeof window !== "undefined" && window.localStorage) return window.localStorage;
    if (typeof globalThis !== "undefined" && globalThis.localStorage) return globalThis.localStorage;
  } catch {
  }
  return null;
}
function isLeakedDemoEventInRealMode(e) {
  if (!e) return false;
  if (e.demo === true) return true;
  if (typeof e.id === "string" && e.id.startsWith("demo-event-")) return true;
  if (typeof e.title === "string" && /\(fictional\)/i.test(e.title)) return true;
  if (e.demo === void 0 && e.title === "exam" && e.date === "2026-11-20" && e.source === "voice") return true;
  return false;
}
function loadEvents() {
  try {
    const demoMode = isDemoActive();
    const key = demoMode ? DEMO_EVENTS_KEY : REAL_EVENTS_KEY;
    const ls = store();
    let raw = ls?.getItem(key) ?? null;
    if (demoMode && raw === null) {
      const seeded = buildDemoData().events;
      try {
        ls?.setItem(DEMO_EVENTS_KEY, JSON.stringify(seeded));
      } catch {
      }
      raw = JSON.stringify(seeded);
    }
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    const valid = parsed.filter(
      (e) => e && typeof e.title === "string" && /^\d{4}-\d{2}-\d{2}$/.test(e.date)
    );
    if (demoMode) {
      return valid.filter((e) => e.demo !== false);
    }
    const cleaned = valid.filter((e) => !isLeakedDemoEventInRealMode(e));
    if (cleaned.length !== valid.length) {
      try {
        ls?.setItem(REAL_EVENTS_KEY, JSON.stringify(cleaned));
      } catch {
      }
    }
    return cleaned;
  } catch {
    return [];
  }
}
function fuzzyMatchEvents(phrase, events) {
  const stop = /* @__PURE__ */ new Set(["the", "of", "my", "a", "an", "week", "after", "before", "on", "at", "around"]);
  const tokens = (s) => Array.from(new Set(s.toLowerCase().replace(/[^\p{L}\p{N}\s']/gu, " ").split(/\s+/).filter((w) => w.length > 1 && !stop.has(w))));
  const pt = tokens(phrase);
  if (!pt.length) return [];
  return events.map((e) => {
    const et = tokens(e.title);
    const score = pt.filter((w) => et.some((x) => x === w || x.startsWith(w) || w.startsWith(x))).length;
    return { e, score };
  }).filter((x) => x.score > 0 && x.score >= Math.min(1, pt.length)).sort((a, b) => b.score - a.score).slice(0, 3).map((x) => x.e);
}

// ai/backend/eventAnswers.ts
var EVENT_TOPIC_SRC = "exam|wedding|trip|interview|party|flight|vacation|marathon|race|conference|presentation|dinner|event|appointment|birthday|anniversary|deadline|meeting|travel|holiday|shaadi|sangeet";
function cleanKeyword(s) {
  const t = s.toLowerCase().replace(/[?.!]+$/g, "").replace(/^(an?\s+|the\s+|my\s+)/, "").trim();
  if (!t || /^(anything|something|events?|plans?|coming|up|next|this|next\s+week|this\s+week|tomorrow)$/.test(t)) return null;
  return t;
}
function extractKeyword(text) {
  let m = text.match(/\bis\s+there\s+any\s+(.+?)\s+coming\b/i) || text.match(/\bare\s+there\s+any\s+(.+?)\s+coming\b/i);
  if (m) return cleanKeyword(m[1]);
  m = text.match(
    /\bdo\s+i\s+have\s+(?:an?\s+|any\s+)?(.+?)\s+(?:coming\s+up|coming|this\s+week|tomorrow|next\s+(?:week|month)|on\s+my\s+calendar)\b/i
  );
  if (m) return cleanKeyword(m[1]);
  m = text.match(/\bwhen's?(?:\s+is)?\s+my\s+(.+?)[?.!]*$/i) || text.match(/\bwhen\s+is\s+my\s+(.+?)[?.!]*$/i);
  if (m) return cleanKeyword(m[1]);
  m = text.match(/([a-z]+)\s+kab\s+hai\b/i);
  if (m) return m[1].toLowerCase();
  m = text.match(new RegExp("\\b(" + EVENT_TOPIC_SRC + ")s?\\b", "i"));
  if (m && (isOverlapQuestion(text) || /\bexam\b/i.test(text))) return m[1].toLowerCase();
  return null;
}
var SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function label2(key) {
  return SHORT_MONTHS[parseInt(key.slice(5, 7), 10) - 1] + " " + parseInt(key.slice(8, 10), 10);
}
function fmt(ev) {
  const base = ev.title + " on " + label2(ev.date);
  return ev.endDate && ev.endDate !== ev.date ? base + " to " + label2(ev.endDate) : base;
}
function upcomingFirst(list, today) {
  const up = (e) => (e.endDate || e.date) >= today;
  return [...list].sort((a, b) => Number(up(b)) - Number(up(a)) || a.date.localeCompare(b.date));
}
function recordsFor(ctx) {
  const starts = [...(ctx.periods || []).map((p) => p.startDate).filter(Boolean)];
  if (ctx.cycleStats && ctx.cycleStats.lastPeriodStart) starts.push(ctx.cycleStats.lastPeriodStart);
  return [...new Set(starts)].map((s, i) => ({
    id: "ctx-" + i,
    startDate: s,
    endDate: void 0,
    confirmed: true,
    source: "manual",
    createdAt: "",
    updatedAt: ""
  }));
}
var OVERLAP_RANK = {
  past: 0,
  unlikely: 1,
  unknown: 2,
  possible: 3,
  likely: 4,
  "period-day": 5,
  logged: 5
};
function overlapNoteFor(ev, records, today) {
  let best = evaluateEventOverlap(ev.date, records, today);
  if (ev.endDate && ev.endDate > ev.date) {
    let d = addDaysToKey(ev.date, 1);
    let guard = 0;
    while (d <= ev.endDate && guard < 366) {
      const r = evaluateEventOverlap(d, records, today);
      if ((OVERLAP_RANK[r.status] ?? 0) > (OVERLAP_RANK[best.status] ?? 0)) best = r;
      d = addDaysToKey(d, 1);
      guard++;
    }
  }
  return best.note;
}
function rangeFor(text, today) {
  if (/\btomorrow\b/i.test(text)) {
    const d = addDaysToKey(today, 1);
    return { start: d, end: d, label: "tomorrow" };
  }
  if (/\bthis\s+week\b/i.test(text)) return { start: today, end: addDaysToKey(today, 7), label: "this week" };
  if (/\bnext\s+week\b/i.test(text)) {
    return { start: addDaysToKey(today, 7), end: addDaysToKey(today, 14), label: "next week" };
  }
  if (/\bnext\s+month\b/i.test(text)) {
    let y = parseInt(today.slice(0, 4), 10);
    let m = parseInt(today.slice(5, 7), 10) + 1;
    if (m === 13) {
      m = 1;
      y += 1;
    }
    const first = y + "-" + String(m).padStart(2, "0") + "-01";
    let nm = m + 1;
    let ny = y;
    if (nm === 13) {
      nm = 1;
      ny += 1;
    }
    const last = addDaysToKey(ny + "-" + String(nm).padStart(2, "0") + "-01", -1);
    return { start: first, end: last, label: "next month" };
  }
  return null;
}
function countSuffix(n) {
  return n > 0 ? " You have " + n + " upcoming event" + (n === 1 ? "" : "s") + "." : "";
}
function noMatchMessage(kw, upcomingCount) {
  return "I don't see an event matching '" + kw + "' in your calendar. Add one by saying '" + kw + " on Nov 20'." + countSuffix(upcomingCount);
}
function buildOwnEventsAnswer(text, ctx) {
  if (!isOwnEventsQuestion(text)) return null;
  const today = ctx.today || todayLocal();
  let pool;
  try {
    const src = ctx.events ? ctx.events : loadEvents();
    pool = (src || []).map((e) => ({
      id: e.id || e.title + "@" + e.date,
      title: String(e.title),
      date: e.date,
      endDate: e.endDate,
      source: e.source || "manual"
    }));
  } catch {
    pool = [];
  }
  const upcoming = pool.filter((e) => (e.endDate || e.date) >= today).sort((a, b) => a.date.localeCompare(b.date));
  const past = pool.filter((e) => (e.endDate || e.date) < today).sort((a, b) => b.date.localeCompare(a.date));
  const kwRaw = extractKeyword(text);
  const nextOnly = kwRaw === "next event";
  if (isOverlapQuestion(text)) {
    const topic = kwRaw;
    const matches = topic ? upcomingFirst(fuzzyMatchEvents(topic, pool), today) : [];
    if (!matches.length) {
      const shown = topic || "that";
      return { kind: "own_data_answer", message: noMatchMessage(shown, upcoming.length), usedLiveModel: false };
    }
    const ev = matches[0];
    const note = overlapNoteFor(ev, recordsFor(ctx), today);
    return {
      kind: "own_data_answer",
      message: fmt(ev) + ": " + note + " " + OVERLAP_DISCLAIMER_TEXT,
      usedLiveModel: false
    };
  }
  const kw = nextOnly ? null : kwRaw;
  if (kw) {
    const matches = upcomingFirst(fuzzyMatchEvents(kw, pool), today);
    if (!matches.length) {
      return { kind: "own_data_answer", message: noMatchMessage(kw, upcoming.length), usedLiveModel: false };
    }
    return {
      kind: "own_data_answer",
      message: matches.map(fmt).join("; "),
      usedLiveModel: false
    };
  }
  if (nextOnly) {
    if (!upcoming.length) {
      let msg = "Nothing coming up in your calendar.";
      if (past.length) msg += " You have " + past.length + " past event" + (past.length === 1 ? "" : "s") + ".";
      return { kind: "own_data_answer", message: msg, usedLiveModel: false };
    }
    return {
      kind: "own_data_answer",
      message: "Your next event is " + fmt(upcoming[0]) + ".",
      usedLiveModel: false
    };
  }
  const range = rangeFor(text, today);
  if (range) {
    const inRange = upcoming.filter((e) => e.date <= range.end && (e.endDate || e.date) >= range.start);
    if (!inRange.length) {
      return {
        kind: "own_data_answer",
        message: "Nothing " + range.label + " in your calendar." + countSuffix(upcoming.length),
        usedLiveModel: false
      };
    }
    const cap = range.label.charAt(0).toUpperCase() + range.label.slice(1);
    return {
      kind: "own_data_answer",
      message: cap + ": " + inRange.map(fmt).join("; "),
      usedLiveModel: false
    };
  }
  if (!upcoming.length) {
    let msg = "Nothing coming up in your calendar.";
    if (past.length) msg += " You have " + past.length + " past event" + (past.length === 1 ? "" : "s") + ".";
    return { kind: "own_data_answer", message: msg, usedLiveModel: false };
  }
  if (/\bhow\s+many\b/i.test(text)) {
    return {
      kind: "own_data_answer",
      message: "You have " + upcoming.length + " upcoming event" + (upcoming.length === 1 ? "" : "s") + ": " + upcoming.map(fmt).join("; ") + ".",
      usedLiveModel: false
    };
  }
  return {
    kind: "own_data_answer",
    message: upcoming.map(fmt).join("; "),
    usedLiveModel: false
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
function isLeapYear(year) {
  return year % 4 === 0 && year % 100 !== 0 || year % 400 === 0;
}
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
function resolveLandmarkExpression(text, today, packs) {
  const lower = text.toLowerCase();
  const currentYear = parseInt(today.slice(0, 4), 10);
  const enabledPacks = packs ? new Set(["global", "india"].filter((p) => packs[p] !== false)) : null;
  const landmarkPool = enabledPacks ? MILESTONES_DATA.filter((m) => enabledPacks.has(m.pack || "global")) : MILESTONES_DATA;
  const matchedMilestones = landmarkPool.map((fest) => {
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
    /\b(?:no,?\s+)?(?:make\s+it\s+(?:the\s+)?|change\s+(?:the\s+)?date\s+to\s+(?:the\s+)?|actually\s+(?:it\s+was\s+)?(?:the\s+)?|set\s+date\s+to\s+(?:the\s+)?|on\s+the\s+|no\s+wait,?\s+(?:it\s+was\s+)?(?:the\s+)?|i\s+meant\s+(?:it\s+was\s+)?(?:the\s+)?|move\s+(?:it\s+)?to\s+(?:the\s+)?)(\d{1,2})(?:st|nd|rd|th)?\b/i
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
  const meantMonthDay = lower.match(/\bi\s+meant\s+(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\s+(\d{1,2})(?:st|nd|rd|th)?\b/i);
  if (meantMonthDay) {
    const mm = MONTH_NAME_TO_NUM[meantMonthDay[1]];
    const dd = parseInt(meantMonthDay[2], 10);
    if (mm) {
      const y = (updated.date || todayLocal()).slice(0, 4);
      const k = `${y}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
      if (isValidDateKey(k)) {
        updated.date = k;
        changes.push(`Date updated to ${updated.date}`);
      }
    }
  }
  if (/\ba\s+day\s+later\b/i.test(lower)) {
    updated.date = addDaysToKey(updated.date || todayLocal(), 1);
    changes.push(`Date updated to ${updated.date}`);
  }
  const flowContrastMatch = lower.match(/\b(none|spotting|light|medium|heavy)\s*(?:,|\s+)?(?:and\s+)?not\s+(none|spotting|light|medium|heavy)\b/i);
  const flowContrastMatch2 = lower.match(/\bnot\s+(none|spotting|light|medium|heavy)\s*(?:,|\s+)?(?:but\s+|actually\s+|it\s+was\s+)?(none|spotting|light|medium|heavy)\b/i);
  const flowMatch = lower.match(/\b(?:change\s+flow\s+to|flow\s+(?:to|is|was)|make\s+(?:it\s+)?flow|actually\s+(?:it\s+was\s+)?|it\s+was|make\s+it|change\s+(?:it\s+)?to)\s*(none|spotting|light|medium|heavy)\b/i);
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
    if (new RegExp(`\\b${m.toLowerCase()}\\b`, "i").test(lower)) {
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
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  thirty: 30,
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
function shortMonthDay(key) {
  const d = /* @__PURE__ */ new Date(key + "T12:00:00Z");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}
function capWeekday(w) {
  return w.charAt(0).toUpperCase() + w.slice(1);
}
var MONTH_NAME_TO_NUM = {
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12,
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  sept: 9,
  oct: 10,
  nov: 11,
  dec: 12
};
function daysInMonth(year, month) {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}
function addMonthsToKey(key, months) {
  let y = parseInt(key.slice(0, 4), 10);
  let m = parseInt(key.slice(5, 7), 10) + months;
  y += Math.floor((m - 1) / 12);
  m = ((m - 1) % 12 + 12) % 12 + 1;
  const d = Math.min(parseInt(key.slice(8, 10), 10), daysInMonth(y, m));
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}
var ONES_ORDINAL = {
  first: 1,
  second: 2,
  third: 3,
  fourth: 4,
  fifth: 5,
  sixth: 6,
  seventh: 7,
  eighth: 8,
  ninth: 9,
  tenth: 10,
  eleventh: 11,
  twelfth: 12,
  thirteenth: 13,
  fourteenth: 14,
  fifteenth: 15,
  sixteenth: 16,
  seventeenth: 17,
  eighteenth: 18,
  nineteenth: 19
};
var TENS_WORD = { twenty: 20, thirty: 30 };
function spelledDayValue(phrase) {
  const t = phrase.trim().toLowerCase().replace(/-/g, " ").replace(/\s+/g, " ");
  if (ONES_ORDINAL[t] !== void 0) return ONES_ORDINAL[t];
  if (t === "twentieth") return 20;
  if (t === "thirtieth") return 30;
  if (t === "thirty first") return 31;
  const parts = t.split(" ");
  if (parts.length === 2 && TENS_WORD[parts[0]] !== void 0 && ONES_ORDINAL[parts[1]] !== void 0) {
    return TENS_WORD[parts[0]] + ONES_ORDINAL[parts[1]];
  }
  return null;
}
function mostRecentDayOfMonth(day, today) {
  let y = parseInt(today.slice(0, 4), 10);
  let m = parseInt(today.slice(5, 7), 10);
  for (let i = 0; i < 14; i++) {
    if (day <= daysInMonth(y, m)) {
      const key = `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      if (key <= today) return key;
    }
    m -= 1;
    if (m === 0) {
      m = 12;
      y -= 1;
    }
  }
  return null;
}
var SPELLED_DAY_SRC = "(?:thirty[\\s-]+first|twenty[\\s-]+(?:first|second|third|fourth|fifth|sixth|seventh|eighth|ninth)|twentieth|thirtieth|twenty|thirty|(?:first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|eleventh|twelfth|thirteenth|fourteenth|fifteenth|sixteenth|seventeenth|eighteenth|nineteenth))";
function resolveDateExpression(text, today, packs) {
  const lower = ` ${text.toLowerCase()} `;
  const none = { date: null, confidence: "none", explanation: "" };
  const landmarkRes = resolveLandmarkExpression(text, today, packs);
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
  if (/\bearlier\s+this\s+month\b/.test(lower)) {
    return { date: null, confidence: "none", explanation: "", needsClarification: true, clarificationQuestion: "Which day earlier this month did you mean?" };
  }
  const aAgoMatch = lower.match(/\b(?:a|an)\s+(day|week|fortnight|month)\s+(?:ago|back)\b/);
  if (aAgoMatch) {
    const unit = aAgoMatch[1];
    if (unit === "month") {
      const d2 = addMonthsToKey(today, -1);
      return { date: d2, confidence: "high", explanation: `a month ago = ${explain(d2)}` };
    }
    const days = unit === "day" ? 1 : unit === "week" ? 7 : 14;
    const d = addDaysToKey(today, -days);
    return { date: d, confidence: "high", explanation: `a ${unit} ago = ${explain(d)}` };
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
  const backMatch = lower.match(/([a-z\u0900-\u0D7F]+|\d+)\s*(days?|weeks?)\s+back\b/);
  if (backMatch) {
    const backN = numberValue(backMatch[1]);
    if (backN === null) return { date: null, confidence: "none", explanation: "", needsClarification: true, clarificationQuestion: "How many days back did you mean?" };
    const n = backN;
    const d = addDaysToKey(today, backMatch[2].startsWith("week") ? -n * 7 : -n);
    return { date: d, confidence: "high", explanation: `${n} ${backMatch[2]} back = ${explain(d)}` };
  }
  const nextWeekdayMatch = lower.match(/\bnext\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/);
  if (nextWeekdayMatch) {
    const target = WEEKDAYS.indexOf(nextWeekdayMatch[1]);
    const todayIdx = weekdayOfKey(today);
    let diff = (target - todayIdx + 7) % 7;
    if (diff === 0) diff = 7;
    const first = addDaysToKey(today, diff);
    const second = addDaysToKey(first, 7);
    const name = capWeekday(nextWeekdayMatch[1]);
    const q = `This coming ${name} ${shortMonthDay(first)}, or ${name} ${shortMonthDay(second)}?`;
    return { date: null, confidence: "none", explanation: "", needsClarification: true, clarificationQuestion: q };
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
  const onWeekdayMatch = lower.match(/\bon\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/);
  if (onWeekdayMatch) {
    const target = WEEKDAYS.indexOf(onWeekdayMatch[1]);
    const todayIdx = weekdayOfKey(today);
    const diff = (todayIdx - target + 7) % 7;
    const d = addDaysToKey(today, -diff);
    return { date: d, confidence: "high", explanation: `on ${onWeekdayMatch[1]} = ${explain(d)}` };
  }
  const dottedMatch = lower.match(/\b(\d{1,2})\.(\d{1,2})(?:\.(\d{2,4}))?\b/);
  if (dottedMatch) {
    const day = parseInt(dottedMatch[1], 10);
    const month = parseInt(dottedMatch[2], 10);
    let yr = dottedMatch[3] ? dottedMatch[3].length === 2 ? 2e3 + parseInt(dottedMatch[3], 10) : parseInt(dottedMatch[3], 10) : parseInt(today.slice(0, 4), 10);
    let key = `${yr}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    if (!isValidDateKey(key)) return { date: null, confidence: "none", explanation: "", needsClarification: true, clarificationQuestion: "That date does not exist. Which date did you mean?" };
    if (!dottedMatch[3] && key > today) yr -= 1;
    key = `${yr}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    if (key > today) {
      return { date: null, confidence: "none", explanation: "", needsClarification: true, clarificationQuestion: `Did you mean last year${String.fromCharCode(39)}s ${explain(key)}?` };
    }
    return { date: key, confidence: "high", explanation: `${dottedMatch[0]} = ${explain(key)}` };
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
  const spelledMonthNames = "january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec";
  const spelledMonthFirst = lower.match(new RegExp(`\\b(${spelledMonthNames})\\s+(${SPELLED_DAY_SRC})\\b`));
  const spelledOfMonth = !spelledMonthFirst ? lower.match(new RegExp(`\\b(${SPELLED_DAY_SRC})\\s+of\\s+(${spelledMonthNames})\\b`)) : null;
  const spelledHit = spelledMonthFirst ? { month: spelledMonthFirst[1], day: spelledDayValue(spelledMonthFirst[2]), raw: spelledMonthFirst[0].trim() } : spelledOfMonth ? { month: spelledOfMonth[2], day: spelledDayValue(spelledOfMonth[1]), raw: spelledOfMonth[0].trim() } : null;
  if (spelledHit && spelledHit.day !== null && !landmarkRes.found) {
    const mm = MONTH_NAME_TO_NUM[spelledHit.month];
    if (mm) {
      const year = parseInt(today.slice(0, 4), 10);
      const explicitYear = lower.match(/\b(20\d{2})\b/);
      let spelledKey = null;
      const trySpelledKey = (y) => {
        const k = `${y}-${String(mm).padStart(2, "0")}-${String(spelledHit.day).padStart(2, "0")}`;
        return isValidDateKey(k) ? k : null;
      };
      if (explicitYear) {
        spelledKey = trySpelledKey(parseInt(explicitYear[1], 10));
        if (spelledKey && spelledKey > today) {
          return { date: null, confidence: "none", explanation: "", needsClarification: true, clarificationQuestion: `Did you mean last year${String.fromCharCode(39)}s ${explain(spelledKey)}?` };
        }
      } else {
        spelledKey = trySpelledKey(year);
        if (spelledKey && spelledKey > today) spelledKey = trySpelledKey(year - 1);
      }
      if (spelledKey && !explicitYear && diffDateKeys(spelledKey, today) > 182) {
        return { date: null, confidence: "none", explanation: "", needsClarification: true, clarificationQuestion: `Did you mean ${explain(spelledKey)}? That is more than 6 months ago - please confirm the date.` };
      }
      if (spelledKey) return { date: spelledKey, confidence: "high", explanation: `${spelledHit.raw} = ${explain(spelledKey)}` };
    }
  }
  const bareSpelled = lower.match(new RegExp(`\\bthe\\s+(${SPELLED_DAY_SRC})\\b`));
  if (bareSpelled && !spelledHit && !landmarkRes.found) {
    const bareDay = spelledDayValue(bareSpelled[1]);
    if (bareDay !== null) {
      const bareKey = mostRecentDayOfMonth(bareDay, today);
      if (bareKey) return { date: bareKey, confidence: "high", explanation: `${bareSpelled[0].trim()} = ${explain(bareKey)}` };
    }
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
      const lastRes = resolveLandmarkExpression(`last ${landmarkRes.landmarkName}`, today, packs);
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
      const window2 = around ? { start: addDaysToKey(resolved, -3), end: addDaysToKey(resolved, 3) } : weekOf ? { start: resolved, end: addDaysToKey(resolved, 6) } : void 0;
      const offsetDays = base ? diffDateKeys(base, resolved) : 0;
      const offsetLabel = offsetDays === 0 ? "" : offsetDays < 0 ? ` (${Math.abs(offsetDays)} day${Math.abs(offsetDays) === 1 ? "" : "s"} before)` : ` (${offsetDays} day${offsetDays === 1 ? "" : "s"} after)`;
      const baseLabel = base ? ` (${explain(base)})` : "";
      return {
        date: resolved,
        confidence: around || weekOf ? "medium" : "high",
        window: window2,
        explanation: `Landmark: ${landmarkRes.landmarkName}${baseLabel} \u2192 Resolved date: ${explain(resolved)}${offsetLabel}${window2 ? ` (window ${explain(window2.start)} to ${explain(window2.end)})` : ""}`
      };
    }
  }
  return none;
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
    heavy: ["heavy flow", "heavy bleeding", "heavy", "a lot of blood", "so much blood", "bleeding a lot"],
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
  periodStart: ["period started", "period start", "started my period", "my period came", "got my period", "period began", "had my period", "had my first period", "first period", "my first period", "got my first period", "cycle started", "my cycle started", "cycle began"],
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
function namesNonTodayDate(text, today, packs) {
  const stripped = text.replace(/\b(today|tonight|this morning|right now)\b/gi, " ");
  return resolveDateExpression(stripped, today, packs).date;
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
          endDate: {
            type: "string",
            description: "Optional period end date (YYYY-MM-DD) when the user gives a range, e.g. from October 2 to October 6. Only for period starts."
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
   - NEVER state whether a cycle length, period length, flow or symptom is normal, healthy or abnormal. NEVER give ovulation or fertile-window information. For such questions reply only with: "I can't help with that, but I can log how you feel or show your logged cycles."
   - If the user asks ANY question seeking medical diagnosis, symptom interpretation, medication, treatment, or pregnancy risk, you MUST refuse immediately with this exact fixed message and nothing else:
     "I can only help with logging and planning. For health questions, please talk to a doctor."

2. PURE LOGGING & PLANNING CAPABILITIES:
   - Voice Logging: Extract date, flow, symptoms, mood, energy (1-5), sleep (hours), and notes. Call tool \`log_entry\`.
   - Slip Correction: If the user provides conversational corrections to a pending slip ("no, make it the 3rd", "add headache", "change flow to light"), call \`update_entry\`.
   - Landmark Recall: If user gives fuzzy dates ("around New Year's", "after International Women's Day", "two days before vacation"), call tool \`milestone_lookup\`. If ambiguous, ask a polite, concise clarifying question ("Was it before or after New Year's?").
   - Plan Around It: If user mentions upcoming events ("marathon on Nov 15, flight to Tokyo on Dec 4, exam on Oct 10"), call \`check_overlap\`. Use ONLY neutral scheduling language: "Likely overlap", "Possible overlap", or "Unlikely to overlap (estimate)". Never imply certainty or guarantees.
   - Backfill (several past periods in one message): call one log_entry per period, each with its own date and kind "period_started". If the user lists several periods, log them ALL (one call each), never just the first. If she gives a start and an end ("from October 2 to October 6", "started Sept 9 and ended Sept 13"), put the start in date and the end in endDate on a single period_started call.

   - Next-weekday ambiguity: if she says "next <weekday>" (for example "next Tuesday"), do NOT call log_entry yet. Ask which one she means: the coming <weekday> (<month> <day>) or the one a week later (<month> <day>), computing both dates from today, and wait for her answer.

Tone: Warm, respectful, concise, neutral, non-medical.
Reply in the user's language (context locale) when known. When a pending entry exists, call update_entry with a patch; do not ask the user to re-log.

If the user states that a period started (including 'first period'), ALWAYS call log_entry, even if they sound upset. Keep any text to one or two short sentences. Never say whether something is normal, abnormal, healthy or safe. If the message describes fainting, falling, or heavy bleeding with severe pain, the app shows a care message; do not give advice yourself.

Dynamic understanding: every message is different \u2014 never rely on fixed phrases. If the user is simply chatting (greetings, thanks, questions about what you can do), reply naturally and call no tools. Only call log_entry, update_entry or check_overlap when the user's actual intention is to record, correct or plan something; a mere mention of a period, symptom, wedding or date is not an instruction to create a record. Never invent a date: if no date can be determined, ask. If one message asks for several things, do each part (multiple tool calls in one turn are fine).

Tool-call discipline: if the user asks to log something with a date but gives no flow or symptoms, still call log_entry with just the date and kind (period_started for a period log) \u2014 never invent flow or symptoms, and never silently substitute today. Never return an empty message: if you cannot act on a message, ask one specific clarifying question instead.`;
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
  const rankOf = (s) => OVERLAP_RANK2[s] ?? (s === "logged" ? 5 : 0);
  return events.map((ev) => {
    let result = evaluateEventOverlap(ev.date, records, today);
    if (ev.endDate && ev.endDate > ev.date) {
      let d = addDaysToKey(ev.date, 1);
      let guard = 0;
      while (d <= ev.endDate && guard < 366) {
        const r = evaluateEventOverlap(d, records, today);
        if (rankOf(r.status) > rankOf(result.status)) result = r;
        d = addDaysToKey(d, 1);
        guard++;
      }
    }
    return {
      name: ev.name,
      eventDate: ev.date,
      overlap: result.status === "logged" ? "period-day" : result.status,
      overlapNote: result.note,
      window: result.window
    };
  });
}
var OVERLAP_RANK2 = { past: 0, unlikely: 1, unknown: 2, possible: 3, likely: 4, "period-day": 5 };
var OVERLAP_VERDICT_LABELS = { logged: "Logged period", "period-day": "Logged period", likely: "Likely overlap", possible: "Possible overlap", unlikely: "Unlikely to overlap (estimate)", past: "Past", unknown: "Not enough data yet" };
var SHORT_MONTHS2 = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function shortDateLabel(dateKey2) {
  const m = parseInt(dateKey2.slice(5, 7), 10);
  const d = parseInt(dateKey2.slice(8, 10), 10);
  return `${SHORT_MONTHS2[(m || 1) - 1]} ${d}`;
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
  const summary = (OVERLAP_RANK2[verdicts[0].status] ?? 2) === (OVERLAP_RANK2[verdicts[1].status] ?? 2) ? "Both look similar." : `${(OVERLAP_RANK2[verdicts[0].status] ?? 2) < (OVERLAP_RANK2[verdicts[1].status] ?? 2) ? verdicts[0].label : verdicts[1].label} overlaps less (estimate)`;
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
  "appointment",
  "shaadi",
  "sangeet"
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
function subClauseAround(text, index, length) {
  const before = text.slice(0, index);
  const after = text.slice(index + length);
  const startCut = Math.max(before.lastIndexOf(","), before.lastIndexOf(";"), before.lastIndexOf("."), before.lastIndexOf("\n"), Math.max(before.toLowerCase().lastIndexOf(" and "), before.toLowerCase().lastIndexOf(" but ")));
  const afterLow = after.toLowerCase();
  const stops = [afterLow.indexOf(","), afterLow.indexOf(";"), afterLow.indexOf("."), afterLow.indexOf("\n"), afterLow.indexOf(" and "), afterLow.indexOf(" but ")].filter((i) => i !== -1);
  const endCut = stops.length ? index + length + Math.min(...stops) : text.length;
  return text.slice(startCut + 1, endCut);
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
      const rangeShape = /\bfrom\b[\s\S]{0,60}?\b(to|till|through|until)\b/i.test(clause) || /\b\d{1,2}(?:st|nd|rd|th)?\s*[-–]\s*\d{1,2}(?:st|nd|rd|th)?\b/.test(clause);
      const periodWord = /\bperiod\b/i.test(clause);
      if (resolved) {
        if (eventNoun) {
          if (resolved < today) resolved = parseMonthDay(noYear, currentYear + 1);
        } else if (rangeShape && !periodWord) {
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
    } else {
      push({ date: resolved, multiDateOnly: true, label: `period date (${resolved})` });
    }
  }
  const agoRe = /\b(\d+|one|two|three|four|five|six|seven)\s+days?\s+ago\b/gi;
  let a;
  while ((a = agoRe.exec(text)) !== null) {
    const clause = subClauseAround(text, a.index, a[0].length);
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
  if (result.entries && result.entries.length > 0) return result.entries;
  return result.entry ? [result.entry] : [];
}
function factIsPlaced(fact, entries, events) {
  if (fact.eventNoun) {
    return events.some((e) => e.date === fact.date && (e.title || "").toLowerCase().includes(fact.eventNoun));
  }
  return entries.some((e) => (e.date === fact.date || e.endDate != null && e.endDate === fact.date) && (!fact.flow || e.flow === fact.flow) && (!fact.symptoms?.length || fact.symptoms.every((sym) => (e.symptoms || []).includes(sym))));
}
function ensureFactCoverageDisclosure(result, userPrompt, today) {
  if (!result || typeof result.message !== "string") return withIntent(result, userPrompt);
  if (!result.entry && !(result.plannedEvents && result.plannedEvents.length > 0)) return withIntent(result, userPrompt);
  const facts = findStatedDatedFacts(userPrompt, today);
  if (facts.length === 0) return withIntent(result, userPrompt);
  const entries = structuredEntriesOf(result);
  const events = result.plannedEvents || [];
  let message = result.message;
  for (const fact of facts) {
    if (fact.multiDateOnly) continue;
    if (factIsPlaced(fact, entries, events)) continue;
    if (message.includes("couldn't place") && message.includes(fact.date)) continue;
    message += fact.eventNoun ? ` I couldn't place: ${fact.label} \u2014 add it from the calendar if you want it saved.` : ` I couldn't place: ${fact.label} \u2014 log that day separately if you want it saved.`;
  }
  if (result.mode === "live") {
    const stated = [...new Set(facts.filter((f) => f.multiDateOnly && !f.eventNoun).map((f) => f.date))].sort();
    if (stated.length >= 2) {
      const placedDates = /* @__PURE__ */ new Set();
      for (const ev of events) {
        if (!ev.date) continue;
        placedDates.add(ev.date);
        const spanEnd = ev.endDate;
        if (spanEnd && spanEnd > ev.date) {
          let sd = addDaysToKey(ev.date, 1);
          let sguard = 0;
          while (sd <= spanEnd && sguard < 366) {
            placedDates.add(sd);
            sd = addDaysToKey(sd, 1);
            sguard++;
          }
        }
      }
      for (const e of entries) {
        placedDates.add(e.date);
        if (e.endDate) placedDates.add(e.endDate);
      }
      const missing = stated.filter((d) => !placedDates.has(d));
      if (missing.length > 0) {
        message += " I only prepared " + (stated.length - missing.length) + " of " + stated.length + " dates: " + missing.join(", ") + ". Say the rest again.";
      }
    }
  }
  return withIntent(message === result.message ? result : { ...result, message }, userPrompt);
}
function isPeriodStartStatement(text) {
  return extractWithLexicon(text).periodStart;
}
function severeTier(text) {
  const classic = checkSevereSymptomEscalation(text);
  if (classic.isSevere) return { isSevere: true, message: classic.escalationMessage };
  if (checkFallSevereInput(text)) return { isSevere: true, message: SEVERE_FALL_CARE_MESSAGE };
  return { isSevere: false, message: null };
}
async function runLavenderAgent(userPrompt, context = {}, conversationHistory = []) {
  const startTime = Date.now();
  const activityTrail = [];
  const toolCallsRecorded = [];
  const severeLive = severeTier(userPrompt);
  const severeWinsLive = severeLive.isSevere && hasClearLogStatement(userPrompt);
  const guardrailCheck = severeWinsLive ? { isRefusal: false, refusalMessage: null } : checkMedicalAdviceGuardrail(userPrompt);
  if (guardrailCheck.isRefusal) {
    activityTrail.push({
      step: "Safety Guardrail",
      detail: "Medical advice request intercepted",
      status: "done"
    });
    if (hasClearLogStatement(userPrompt)) {
      const fb = parseLocally(userPrompt, context.currentDate || todayLocal(), context);
      return { ...fb, mode: "offline", modeReason: "Offline parser - medical part refused; log handled by offline rules" };
    }
    return withIntent({
      message: getGuardrailResponseMessage(userPrompt),
      needsClarification: false,
      activityTrail,
      toolCalls: toolCallsRecorded
    }, userPrompt);
  }
  const today = context.currentDate || todayLocal();
  const severeCheck = severeLive;
  if (severeCheck.isSevere) {
    activityTrail.push({
      step: "Safety Escalation",
      detail: "Red-flag symptom detected \u2014 care-seeking signpost prepended",
      status: "done"
    });
  }
  if (/\bremind(?:er)?\b/i.test(userPrompt) && /\bperiod\b/i.test(userPrompt) && (/\bbefore\b/i.test(userPrompt) || /\bnext\b/i.test(userPrompt))) {
    return { message: "I can't set reminders yet; you can export the calendar (.ics) from Settings.", needsClarification: false, activityTrail, toolCalls: toolCallsRecorded, mode: "offline", modeReason: "Offline parser \u2014 reminders are not supported" };
  }
  if (!severeCheck.isSevere) {
    const ownLive = buildOwnDataAnswer(userPrompt, context);
    if (ownLive) {
      activityTrail.push({ step: "Your Logged Data", detail: "Answered from your own logs, no model call", status: "done" });
      activityTrail.forEach((a) => a.status = "done");
      return { message: ownLive.message, kind: ownLive.kind, usedLiveModel: false, entry: null, needsClarification: false, activityTrail, toolCalls: toolCallsRecorded, mode: "offline", modeReason: "Answered from your own logs, no model call" };
    }
    const ownEventsLive = buildOwnEventsAnswer(userPrompt, {
      events: context.events,
      periods: context.periods,
      cycleStats: context.cycleStats ? { lastPeriodStart: context.cycleStats.lastPeriodStart ?? null } : void 0,
      today
    });
    if (ownEventsLive) {
      activityTrail.push({ step: "Your Calendar", detail: "Answered from your own calendar, no model call", status: "done" });
      activityTrail.forEach((a) => a.status = "done");
      return { message: ownEventsLive.message, kind: ownEventsLive.kind, usedLiveModel: false, entry: null, needsClarification: false, activityTrail, toolCalls: toolCallsRecorded, mode: "offline", modeReason: "Answered from your own calendar, no model call" };
    }
  }
  activityTrail.push({
    step: "Processing Speech",
    detail: "Parsing voice input with Muse Spark",
    status: "pending"
  });
  const fallbackResult = parseLocally(userPrompt, today, context);
  const liveNegation = detectNegationOnly(userPrompt, today, context);
  if (liveNegation?.kind === "ask") {
    return {
      message: liveNegation.question,
      entry: null,
      needsClarification: true,
      clarificationQuestion: liveNegation.question,
      activityTrail,
      toolCalls: toolCallsRecorded,
      mode: "live",
      modeReason: "Negated symptom needs confirmation; model not called"
    };
  }
  if (liveNegation?.kind === "noted") {
    return {
      message: "Noted, nothing to log.",
      entry: null,
      needsClarification: false,
      activityTrail,
      toolCalls: toolCallsRecorded,
      mode: "live",
      modeReason: "Negation-only message logged nothing; model not called"
    };
  }
  if (!hasAnyLoggingOrPlanningCue(userPrompt)) {
    return { ...fallbackResult, mode: "offline", modeReason: "Offline parser \u2014 Meta model not used (bare numbers or date without cycle/event cue)" };
  }
  if (/\bperiod\s+(is\s+)?late\b|\blate period\b|\bmissed\s+(my\s+)?period\b|\bam\s+i\s+late\b/i.test(userPrompt) && !/started|flow/i.test(userPrompt)) {
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
  const calendarVisibilityNote = context.calendarVisible === false ? "\nYou cannot see the user's calendar; never say they have no events. Say you can't see it here." : "";
  const messages = [
    { role: "system", content: `${SYSTEM_PROMPT}
Today's date is ${today}. Locale: ${context.locale || "en"}. Reply in the user's language.${targetEntry ? `
Pending or recent entry to correct if asked: ${JSON.stringify(targetEntry)}. Call update_entry with a patch (date, flow, symptoms_add, symptoms_remove, mood, energy, sleep, notes).` : ""}${context.matchedEvents && context.matchedEvents.length ? `
Client-matched personal events (consented): ${JSON.stringify(context.matchedEvents)}. Use find_calendar_events for these.` : ""}${calendarVisibilityNote}${context.defaultDate ? `
The user opened voice from the calendar on ${context.defaultDate}. If they do not state a date, log for ${context.defaultDate}; a date they state wins.` : ""}` },
    ...conversationHistory,
    { role: "user", content: userPrompt }
  ];
  let usedPersonalAnchorLive = false;
  let structuredEntry = null;
  let replacedViaCorrection = false;
  const structuredEntries = [];
  const backfillShape = extractBackfillDates(userPrompt, today);
  const collectBackfillEntries = backfillShape !== null && backfillShape.seeds.length > 0;
  let planOverlaps = void 0;
  let needsClarification = false;
  let clarificationQuestion = null;
  let finalMessage = "";
  const MODEL_CALL_TIMEOUT_MS = 4e4;
  const OVERALL_MODEL_BUDGET_MS = 5e4;
  const modelDeadline = startTime + OVERALL_MODEL_BUDGET_MS;
  let modelCallMsTotal = 0;
  const modelTimedOut = () => {
    activityTrail.push({ step: "Total Model Time", detail: modelCallMsTotal + " ms", status: "done" });
    return {
      message: "The AI took too long, please try again",
      entry: null,
      needsClarification: false,
      activityTrail,
      toolCalls: toolCallsRecorded,
      mode: "offline",
      modeReason: "Meta model call timed out (overall 50s budget)"
    };
  };
  const MAX_STEPS = 5;
  let stepCount = 0;
  try {
    while (stepCount < MAX_STEPS) {
      stepCount++;
      const remainingMs = modelDeadline - Date.now();
      if (remainingMs <= 0) return modelTimedOut();
      const modelCallStart = Date.now();
      const callController = new AbortController();
      const callTimer = setTimeout(() => callController.abort(), Math.min(MODEL_CALL_TIMEOUT_MS, remainingMs));
      let res;
      try {
        res = await fetch(`${baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`
          },
          signal: callController.signal,
          body: JSON.stringify({
            model,
            messages,
            tools: TOOLS,
            tool_choice: "auto",
            temperature: 0.2,
            max_tokens: 600
          })
        });
      } catch (callErr) {
        clearTimeout(callTimer);
        if (callErr && callErr.name === "AbortError") return modelTimedOut();
        throw callErr;
      }
      clearTimeout(callTimer);
      modelCallMsTotal += Date.now() - modelCallStart;
      activityTrail.push({
        step: "Model Call " + stepCount,
        detail: Date.now() - modelCallStart + " ms",
        status: "done"
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
          const landmarkRes = resolveLandmarkExpression(fnArgs.name, today, context.landmarkPacks);
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
          livePlannedEvents = rawEvents.map((e) => ({ title: e.name || e.title || "Event", date: e.date, ...e.endDate && e.endDate !== e.date ? { endDate: e.endDate } : {} }));
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
              endDate: fnArgs.endDate || null,
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
            if (collectBackfillEntries) structuredEntries.push(structuredEntry);
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
              replacedViaCorrection = true;
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
    activityTrail.push({
      step: "Total Model Time",
      detail: modelCallMsTotal + " ms",
      status: "done"
    });
    let firstToolError = null;
    for (const c of toolCallsRecorded) {
      const e = c.result?.error;
      if (!firstToolError && typeof e === "string" && e) firstToolError = e;
    }
    const slipClaimed = /updated your (accession )?slip|slip[^.?!]{0,40}\bupdated\b|made those changes|correction (?:has been |is )?(?:saved|applied)/i.test(finalMessage);
    const updateSucceeded = toolCallsRecorded.some((c) => c.toolName === "update_entry" && c.result?.success);
    if (!structuredEntry && structuredEntries.length === 0 && livePlannedEvents.length === 0 && !(planOverlaps && planOverlaps.length > 0)) {
      if (slipClaimed && !updateSucceeded) {
        finalMessage = "There's no entry to change.";
      } else if (firstToolError) {
        finalMessage = "I could not save that: " + firstToolError + ". Which date did you mean?";
      } else if (/logged|saved|done|all set|good to go|prepared/i.test(finalMessage)) {
        finalMessage = "I could not save that: no valid entry or event. Which date did you mean?";
      }
    }
    const runCorrectiveLogCall = async () => {
      const severeHead = severeLive.isSevere ? severeLive.message : null;
      const head = severeHead || "I can log this for you";
      const failRedirect = severeHead ? severeHead : bannedOut.blocked ? REDIRECT_MESSAGES.verdict : MEDICAL_REFUSAL_MESSAGE;
      const failResult = (why) => ({
        message: failRedirect + " Please try again.",
        entry: null,
        needsClarification: false,
        activityTrail,
        toolCalls: toolCallsRecorded,
        mode: "offline",
        modeReason: "Output guard tripped (" + why + "); corrective log call failed"
      });
      const correctRemaining = modelDeadline - Date.now();
      if (correctRemaining <= 5e3) return failResult("no time left in budget");
      const cc = new AbortController();
      const ct = setTimeout(() => cc.abort(), Math.min(4e4, correctRemaining));
      const callStart = Date.now();
      try {
        const cres = await fetch(`${baseUrl}/chat/completions`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
          signal: cc.signal,
          body: JSON.stringify({
            model,
            messages: [...messages, { role: "user", content: "Call log_entry now with the facts in the user's message. No commentary." }],
            tools: TOOLS,
            tool_choice: { type: "function", function: { name: "log_entry" } },
            temperature: 0.2,
            max_tokens: 600
          })
        });
        clearTimeout(ct);
        if (!cres.ok) return failResult("corrective call failed");
        const cdata = await cres.json();
        const cmsg = cdata.choices && cdata.choices[0] && cdata.choices[0].message || {};
        const tcalls = cmsg.tool_calls || [];
        let centry = null;
        for (const call of tcalls) {
          let cargs = {};
          try {
            cargs = JSON.parse(call.function.arguments);
          } catch {
            cargs = {};
          }
          if (!call.function || call.function.name !== "log_entry") continue;
          const verr = validateEntryArgs(cargs, today);
          if (verr) {
            toolCallsRecorded.push({ id: call.id || "call_corrective", toolName: "log_entry", args: cargs, result: { error: verr }, latencyMs: Date.now() - callStart, model, executedBy: "meta-model" });
            continue;
          }
          centry = {
            date: cargs.date || today,
            endDate: cargs.endDate || null,
            flow: cargs.flow || null,
            symptoms: (cargs.symptoms || []).filter((st) => VALID_SYMPTOMS.includes(st)),
            mood: cargs.mood || null,
            energy: cargs.energy ?? null,
            sleep: cargs.sleep ?? null,
            notes: cargs.notes || null,
            isApproximate: cargs.isApproximate || false,
            landmarkName: cargs.landmarkName || null,
            kind: cargs.kind || "daily_log"
          };
          toolCallsRecorded.push({ id: call.id || "call_corrective", toolName: "log_entry", args: cargs, result: { success: true, entry: centry }, latencyMs: Date.now() - callStart, model, executedBy: "meta-model" });
        }
        if (!centry) return failResult("no valid entry returned");
        activityTrail.push({ step: "Corrective Log Call", detail: "Blocked model reply replaced by a forced log_entry call", status: "done" });
        const tail = "I've prepared your log for " + centry.date + ". Please review and confirm below.";
        return ensureFactCoverageDisclosure({
          message: head + " " + tail,
          entry: centry,
          needsClarification: false,
          clarificationQuestion: null,
          activityTrail,
          toolCalls: toolCallsRecorded,
          mode: "live",
          modeReason: "Corrective log_entry after blocked model reply"
        }, userPrompt, today);
      } catch (e) {
        clearTimeout(ct);
        return failResult("corrective call timed out");
      }
    };
    const bannedOut = checkModelOutputGuard(finalMessage);
    if (bannedOut.blocked) {
      const hasResults = !!structuredEntry || structuredEntries.length > 0 || livePlannedEvents.length > 0 || planOverlaps !== void 0 && planOverlaps.length > 0;
      if (!hasResults) {
        if (isPeriodStartStatement(userPrompt) || severeLive.isSevere) {
          return await runCorrectiveLogCall();
        }
        activityTrail.push({ step: "Output Guard", detail: "Model reply replaced by fixed redirect (banned wording)", status: "done" });
        return { message: REDIRECT_MESSAGES.verdict, needsClarification: false, activityTrail, toolCalls: toolCallsRecorded, mode: "live", modeReason: "Output guard replaced the model reply" };
      }
      const summaryEntry = collectBackfillEntries && structuredEntries.length > 0 ? structuredEntries[0] : structuredEntry;
      let summary = summaryEntry ? "Prepared your log for " + shortDateLabel(summaryEntry.date) + ". Please confirm." : "Prepared your log. Please confirm.";
      if (livePlannedEvents.length > 0) summary += " Prepared " + livePlannedEvents.length + " event" + (livePlannedEvents.length === 1 ? "" : "s") + ".";
      if (planOverlaps && planOverlaps.length > 0) summary += " Overlap checked.";
      finalMessage = summary;
      activityTrail.push({ step: "Output Guard", detail: "Model reply replaced with neutral summary (verdict wording removed)", status: "done" });
    }
    const outputGuard = checkMedicalAdviceGuardrail(finalMessage);
    if (outputGuard.isRefusal) {
      if (!structuredEntry && structuredEntries.length === 0 && livePlannedEvents.length === 0 && !(planOverlaps && planOverlaps.length > 0) && (isPeriodStartStatement(userPrompt) || severeLive.isSevere)) {
        return await runCorrectiveLogCall();
      }
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
        if (fallbackResult.entries && fallbackResult.entries.length > 0) structuredEntries.push(...fallbackResult.entries);
      }
      const severeMsg = severeCheck.message || SEVERE_SYMPTOM_ESCALATION_MESSAGE;
      const cleanTail = !finalMessage.trim() || finalMessage.includes("talk to a doctor") ? `I've prepared your log for ${structuredEntry?.date || today}. Please review and confirm below.` : finalMessage.trim();
      finalMessage = cleanTail.startsWith(severeMsg) ? cleanTail : `${severeMsg} ${cleanTail}`;
    }
    return ensureFactCoverageDisclosure({
      message: finalMessage,
      entry: collectBackfillEntries && structuredEntries.length > 0 ? structuredEntries[0] : structuredEntry,
      replacesExisting: replacedViaCorrection || void 0,
      entries: structuredEntries.length > 0 ? structuredEntries : void 0,
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
  if (/\bperiod\s+(started|began|came)\b|\bstarted my period\b|\bgot my period\b|\bhad\s+(?:my\s+)?(?:first\s+)?period\b|\b(?:my\s+)?first\s+period\b|\bgot\s+my\s+first\s+period\b|\b(?:my\s+)?cycle\s+(?:started|began|came)\b/i.test(lower)) periodStart = true;
  if (/\bperiod\s+(ended|stopped|finished)\b|\bflow stopped\b/i.test(lower)) periodEnd = true;
  return { symptoms, flow, mood, periodStart, periodEnd };
}
function validateEntryArgs(args, today) {
  const min = addDaysToKey(today, -731);
  if (args.date !== void 0) {
    if (typeof args.date !== "string" || !isValidDateKey(args.date)) return "Invalid date: expected YYYY-MM-DD calendar date.";
    if (args.date < min || args.date > today) return `Invalid date: must be between ${min} and ${today} (today).`;
  }
  if (args.endDate !== void 0 && args.endDate !== null) {
    if (typeof args.endDate !== "string" || !isValidDateKey(args.endDate)) return "Invalid endDate: expected YYYY-MM-DD calendar date.";
    if (typeof args.date === "string" && isValidDateKey(args.date) && args.endDate < args.date) return "Invalid endDate: must not be before date.";
    if (args.endDate > today || args.endDate < min) return "Invalid endDate: must be within the past 731 days and not in the future.";
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
  if (patch.endDate !== void 0) updated.endDate = patch.endDate;
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
var BACKFILL_MAX_ENTRIES = 12;
var BACKFILL_MONTHS = "january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec";
var BACKFILL_EVENT_NOUNS = "exam|wedding|trip|interview|party|flight|vacation|marathon|race|conference|presentation|dinner|event|appointment|birthday|anniversary|deadline|meeting|travel|holiday|shaadi|sangeet";
var BACKFILL_NUMBER_WORDS = {
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
  twelve: 12
};
var BACKFILL_MONTH_FULL = {
  jan: "January",
  january: "January",
  feb: "February",
  february: "February",
  mar: "March",
  march: "March",
  apr: "April",
  april: "April",
  may: "May",
  jun: "June",
  june: "June",
  jul: "July",
  july: "July",
  aug: "August",
  august: "August",
  sep: "September",
  sept: "September",
  september: "September",
  oct: "October",
  october: "October",
  nov: "November",
  november: "November",
  dec: "December",
  december: "December"
};
function backfillNumber(token) {
  const t = token.toLowerCase().trim();
  if (/^\d+$/.test(t)) return parseInt(t, 10);
  return BACKFILL_NUMBER_WORDS[t] ?? null;
}
function resolveBackfillDate(seg, today) {
  const year = parseInt(today.slice(0, 4), 10);
  const iso = seg.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (iso) {
    const key = iso[1] + "-" + iso[2] + "-" + iso[3];
    if (!isValidDateKey(key)) return { none: true };
    if (key > today) return { future: key };
    return { date: key };
  }
  const ago = seg.match(/\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s+(days?|weeks?)\s+ago\b/i);
  if (ago) {
    const n = backfillNumber(ago[1]);
    if (n === null) return { none: true };
    const days = /week/i.test(ago[2]) ? n * 7 : n;
    return { date: addDaysToKey(today, -days) };
  }
  if (/\byesterday\b/i.test(seg)) return { date: addDaysToKey(today, -1) };
  if (/\btoday\b/i.test(seg)) return { date: today };
  const md = seg.match(new RegExp("\\b(\\d{1,2}(?:st|nd|rd|th)?\\s+(?:" + BACKFILL_MONTHS + ")\\b|\\b(?:" + BACKFILL_MONTHS + ")\\s+\\d{1,2}(?:st|nd|rd|th)?)", "i"));
  if (md) {
    const raw = md[1].replace(/,/g, " ").replace(/\s+/g, " ").trim();
    const explicit = seg.match(/\b(20\d{2})\b/);
    if (explicit) {
      const key2 = parseMonthDay(raw, parseInt(explicit[1], 10));
      if (!key2) return { none: true };
      if (key2 > today) return { future: key2 };
      return { date: key2 };
    }
    let key = parseMonthDay(raw, year);
    if (!key) return { none: true };
    if (key > today) key = parseMonthDay(raw, year - 1);
    if (!key) return { none: true };
    return { date: key };
  }
  return { none: true };
}
function backfillBareMonth(seg) {
  let c = " " + seg.toLowerCase() + " ";
  c = c.replace(/\b(i|we|my|our|the|last|this|had|have|has|got|periods|period|started|starts|began|came|were|was|on|in|for|and|then|also)\b/g, " ");
  c = c.replace(/[^a-z]/g, " ").replace(/\s+/g, " ").trim();
  if (!/^[a-z]+$/.test(c)) return null;
  return BACKFILL_MONTH_FULL[c] || null;
}
function backfillRangeSeed(text, today) {
  const lower = text.toLowerCase();
  const finish = (a, b) => {
    const r1 = resolveBackfillDate(a, today);
    const r2 = resolveBackfillDate(b, today);
    if (!r1.date || !r2.date) return null;
    if (!(r1.date < r2.date) || r2.date > today) return null;
    return { date: r1.date, endDate: r2.date };
  };
  const started = lower.match(/\bstarted\s+(.+?)\s+and\s+ended\s+(.+)/);
  if (started) return finish(started[1], started[2]);
  const fromTo = lower.match(/\bfrom\s+(.+?)\s+(?:to|till|until|through)\s+(.+)/);
  if (fromTo) return finish(fromTo[1], fromTo[2]);
  const till = lower.match(/\b(.+?)\s+till\s+(.+)/);
  if (till) return finish(till[1], till[2]);
  const parts = text.split(/\s+[-\u2013\u2014]\s+/);
  if (parts.length === 2) return finish(parts[0], parts[1]);
  return null;
}
function extractBackfillDates(text, today) {
  if (!/\bperiods?\b/i.test(text)) return null;
  const ext = extractWithLexicon(text);
  const lower = text.toLowerCase();
  const hasDetail = ext.symptoms.length > 0 || ext.flow !== null || ext.mood !== null || /\benergy\s*(?:is|level|:)?\s*([1-5])\b/i.test(lower) || /(?:slept|sleep)\s*(?:for\s*)?(\d+(?:\.\d+)?)\s*(?:h|hours?)\b/i.test(lower) || /\b(\d+(?:\.\d+)?)\s*(?:h|hours?)\s+of\s+sleep\b/i.test(lower);
  if (hasDetail) return null;
  const range = backfillRangeSeed(text, today);
  if (range) return { seeds: [range], warnings: [], monthAsk: null };
  const eventRe = new RegExp("\\b(" + BACKFILL_EVENT_NOUNS + ")\\b", "i");
  const segments = text.split(/(?:,|;|&|\bthen\b|\balso\b|\band\b)/i).map((s) => s.trim()).filter(Boolean);
  const dates = [];
  const warnings = [];
  const bareMonths = [];
  for (const seg of segments) {
    if (eventRe.test(seg)) continue;
    const bare = backfillBareMonth(seg);
    if (bare) {
      if (!bareMonths.includes(bare)) bareMonths.push(bare);
      continue;
    }
    const r = resolveBackfillDate(seg, today);
    if (r.date) {
      dates.push(r.date);
      continue;
    }
    if (r.future) {
      warnings.push(r.future + " is in the future, so I left it out.");
      continue;
    }
    if (/\d/.test(seg) || new RegExp("\\b(?:" + BACKFILL_MONTHS + ")\\b", "i").test(seg)) {
      warnings.push("I could not place a date for: " + seg);
    }
  }
  const dupes = dates.length - new Set(dates).size;
  const unique = [...new Set(dates)].sort();
  if (dupes > 0) warnings.push("One date was mentioned twice, so I counted it once.");
  if (unique.length > BACKFILL_MAX_ENTRIES) {
    const dropped = unique.length - BACKFILL_MAX_ENTRIES;
    warnings.push("Keeping the " + BACKFILL_MAX_ENTRIES + " most recent of " + unique.length + " dates (" + dropped + " oldest left out).");
  }
  const seeds = unique.slice(Math.max(0, unique.length - BACKFILL_MAX_ENTRIES)).map((d) => ({ date: d }));
  if (seeds.length >= 2 && bareMonths.length > 0) {
    warnings.push(bareMonths[0] + " still needs a day: add it like " + bareMonths[0] + " 9.");
  }
  if (seeds.length >= 2) return { seeds, warnings, monthAsk: null };
  if (seeds.length === 1 && warnings.length > 0) return { seeds, warnings, monthAsk: null };
  if (bareMonths.length > 0) return { seeds: [], warnings, monthAsk: bareMonths[0] };
  return null;
}
function hasClearLogStatement(text) {
  const t = text.trim();
  if (/^(did|do|does|is|are|was|were|will|would|could|should|can|when|where|why|how|what|which|who|am|has|have)\b/i.test(t)) return false;
  if (/\b(?:my\s+period|period)\s+(?:started|began|came|ended|stopped|finished)\b/i.test(t)) return true;
  if (/\b(?:started|got)\s+my\s+period\b/i.test(t)) return true;
  if (/\bhad\s+(?:my\s+)?(?:first\s+)?period\b/i.test(t)) return true;
  if (/\b(?:my\s+)?cycle\s+(?:started|began|came)\b/i.test(t)) return true;
  if (/\b(?:my\s+)?first\s+period\b/i.test(t)) return true;
  if (/\bgot\s+my\s+first\s+period\b/i.test(t)) return true;
  if (/\b(?:heavy|medium|light|spotting|none)\s+flow\b/i.test(t)) return true;
  if (/\bflow\s+(?:was|is)\s+(?:very|really|so|quite|pretty\s+)?(?:heavy|medium|light|spotting|none)\b/i.test(t)) return true;
  if (/\bhad\s+spotting\b/i.test(t)) return true;
  const symptomHit = /\b(?:cramps?|headaches?|nausea|fatigue|bloating|back\s+pain|tender|acne|cravings|insomnia|dizziness|hot\s+flashes|spotting|bleeding)\b/i.test(t);
  if (!symptomHit) return false;
  if (/\b(?:today|tonight|yesterday|this\s+morning|last\s+night|tomorrow)\b/i.test(t)) return true;
  if (/\bago\b/i.test(t)) return true;
  if (/\b(?:last|this|next)\s+(?:week|month|night)\b/i.test(t)) return true;
  if (/\b(?:january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\b/i.test(t)) return true;
  if (/\b(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i.test(t)) return true;
  if (/\bhaving\b/i.test(t)) return true;
  return false;
}
function detectNegationOnly(text, today, context) {
  if (context.pendingEntry) return null;
  const negatedToday = [];
  for (const sym of VALID_SYMPTOMS) {
    const symKey = sym.replace(/_/g, " ");
    if (new RegExp(`\\bno\\s+${symKey}\\b`, "i").test(text)) negatedToday.push(symKey);
  }
  const hasPositiveContent = (() => {
    const ext = extractWithLexicon(text);
    return ext.symptoms.length > 0 || ext.flow !== null || ext.mood !== null || ext.periodStart || ext.periodEnd;
  })();
  const mentionsToday = /\b(today|tonight|this morning|right now)\b/i.test(text);
  if (negatedToday.length === 0 || !mentionsToday || hasPositiveContent) return null;
  const pool = [...context.recentEntries || [], ...context.recentEntry ? [context.recentEntry] : []];
  const todayEntry = pool.find((e) => e && e.date === today);
  const onNote = todayEntry ? (todayEntry.symptoms || []).map((s) => String(s).replace(/_/g, " ").toLowerCase()) : [];
  const present = negatedToday.filter((s) => onNote.indexOf(s.toLowerCase()) !== -1);
  if (present.length > 0) {
    return { kind: "ask", question: "Remove " + present.join(" and ") + " from today's note?" };
  }
  return { kind: "noted" };
}
var CONVERSATION_PATTERNS = [
  /\bhow are (you|u)\b/i,
  /\bhow('s| is) it going\b/i,
  /\bwhat'?s (good|up|new|happening)\b/i,
  /\bwhat can you do\b/i,
  /\bwhat do you do\b/i,
  /^\s*help\s*[?!.,]*\s*$/i,
  /\bhelp me\b/i,
  /\bhelp me understand\b/i,
  /\bthank(s| you| you so much| you very much)\b/i,
  /^(bye+|goodbye|good ?night|see you|take care)\b/i,
  /^(good ?morning|good ?afternoon|good ?evening)\b[?!.,]*$/i,
  /\bwho are you\b|\byour name\b|\bwhat are you\b/i,
  /\bwhat (is|are) feather\b/i,
  /\bexplain\b.*\bfeather\b/i,
  /\bhow\b[^.?!]*\bworks?\b/i,
  /\babout feather\b/i,
  /\bwhat (is|are) (this|this app)\b/i
];
var CONVERSATION_BLOCK_NOUNS = /\b(exam|wedding|trip|interview|party|flight|vacation|conference|presentation|dinner|meeting|birthday|anniversary|marathon|race|appointment|dentist|doctor|hospital|clinic|period|flow|bleed|blood|cramps?|pain|pill|tablet|medicine|pregnan|ovulat|fertil|normal|safe|should|would|could|can i|do i|what (if|about)|log|logged|logging|record|save|delete|cycle|symptom)\b/i;
var CONVERSATION_DATE_RE = /\b\d\b|\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\b/i;
function isConversationalMessage(text) {
  const t = text.trim();
  if (!t || t.length > 200) return false;
  if (!CONVERSATION_PATTERNS.some((p) => p.test(t))) return false;
  let rest = t;
  for (const p of CONVERSATION_PATTERNS) rest = rest.replace(p, " ");
  rest = rest.replace(/[?!.,\u2014-]+/g, " ").replace(/\s+/g, " ").trim();
  if (!rest) return true;
  const ext = extractWithLexicon(rest);
  if (ext.symptoms.length > 0 || ext.flow !== null || ext.mood !== null || ext.periodStart || ext.periodEnd) return false;
  if (CONVERSATION_BLOCK_NOUNS.test(rest)) return false;
  if (CONVERSATION_DATE_RE.test(rest)) return false;
  if (checkMedicalAdviceGuardrail(rest).isRefusal) return false;
  if (checkFallSevereInput(rest)) return false;
  return true;
}
function conversationalReply() {
  return "Hi! I'm Feather, your private cycle companion. I can track your periods and symptoms, answer questions from your own past entries, and help you plan around events \u2014 all on this device. Try 'my period started yesterday', or ask me anything.";
}
function withIntent(result, userPrompt) {
  const r = result;
  if (!r.responseType) {
    const entry = r.entry;
    const entries = r.entries || [];
    const toolCalls = r.toolCalls || [];
    const validated = toolCalls.filter((c) => c && c.result && (c.result.success || c.result.entry || c.result.overlaps || c.result.events));
    const tools = validated.map((c) => c.toolName);
    const hasSevere = typeof r.message === "string" && (r.message.indexOf("please get help now from a trusted adult") !== -1 || r.message.indexOf("Important safety notice") !== -1);
    const isRefusalMsg = typeof r.message === "string" && (r.message === MEDICAL_REFUSAL_MESSAGE || Object.values(REDIRECT_MESSAGES).includes(r.message));
    if (r.replacesExisting && entry) {
      r.responseType = "correction";
    } else if (entries.length > 1) {
      r.responseType = "backfill";
    } else if (entry && (r.planOverlaps && r.planOverlaps.length > 0 || r.plannedEvents && r.plannedEvents.length > 0)) {
      r.responseType = "log";
    } else if (entry) {
      r.responseType = "log";
    } else if (r.planOverlaps && r.planOverlaps.length > 0 || r.plannedEvents && r.plannedEvents.length > 0) {
      r.responseType = tools.includes("check_overlap") ? "plan" : "event";
    } else if (r.needsClarification) {
      r.responseType = "clarification";
    } else if (isRefusalMsg) {
      r.responseType = "refusal";
    } else if (isConversationalMessage(userPrompt)) {
      r.responseType = "conversation";
    } else {
      r.responseType = "question";
    }
    const intentions = [];
    for (const c of validated) {
      if (c.toolName === "log_entry" && c.result.entry) intentions.push("log_entry:" + (c.result.entry.kind || "daily_log") + ":" + c.result.entry.date);
      else if (c.toolName === "update_entry") intentions.push("update_entry");
      else if (c.toolName === "check_overlap") intentions.push("check_overlap");
      else intentions.push(c.toolName);
    }
    if (hasSevere) intentions.push("severe-care-shown");
    if (isRefusalMsg) intentions.push("refusal");
    if (r.responseType === "conversation") intentions.push("conversational-reply");
    if (r.responseType === "clarification") intentions.push("clarify");
    r.intentions = intentions;
  }
  return result;
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
  const severeLocal = severeTier(text);
  const severeWinsLocal = severeLocal.isSevere && hasClearLogStatement(text);
  let medicalTail = null;
  if (!severeWinsLocal && checkMedicalAdviceGuardrail(text).isRefusal) {
    if (!hasClearLogStatement(text)) {
      return withIntent({ message: getGuardrailResponseMessage(text), needsClarification: false, activityTrail: [{ step: "Safety Guardrail", detail: "Medical advice refusal", status: "done" }], toolCalls: [], ...offline }, text);
    }
    medicalTail = " I can" + String.fromCharCode(39) + "t say whether that" + String.fromCharCode(39) + "s normal; please talk to a doctor.";
  }
  const severeCheck = severeLocal;
  if (severeCheck.isSevere) {
    activityTrail.push({ step: "Safety Escalation", detail: "Red-flag symptom detected \u2014 care-seeking signpost prepended", status: "done" });
  }
  if (/\bremind(?:er)?\b/i.test(text) && /\bperiod\b/i.test(text) && (/\bbefore\b/i.test(text) || /\bnext\b/i.test(text))) {
    return { message: "I can" + String.fromCharCode(39) + "t set reminders yet; you can export the calendar (.ics) from Settings.", entry: null, needsClarification: false, activityTrail, toolCalls, ...offline };
  }
  const ownData = buildOwnDataAnswer(text, context);
  if (ownData) {
    activityTrail.push({ step: "Your Logged Data", detail: "Answered from your own logs, no model call", status: "done" });
    return { message: ownData.message, kind: ownData.kind, usedLiveModel: false, entry: null, needsClarification: false, activityTrail, toolCalls, ...offline };
  }
  const negationOnly = detectNegationOnly(text, today, context);
  if (negationOnly?.kind === "ask") {
    return { message: negationOnly.question, entry: null, needsClarification: true, clarificationQuestion: negationOnly.question, activityTrail, toolCalls, ...offline };
  }
  if (negationOnly?.kind === "noted") {
    return { message: "Noted, nothing to log.", entry: null, needsClarification: false, activityTrail, toolCalls, ...offline };
  }
  if (isConversationalMessage(text)) {
    activityTrail.push({ step: "Conversation", detail: "Greeting/help answered directly, no log created", status: "done" });
    return withIntent({ message: conversationalReply(), entry: null, needsClarification: false, activityTrail, toolCalls, ...offline }, text);
  }
  if (!hasAnyLoggingOrPlanningCue(text)) {
    const q = "I didn't catch anything I can log from that \u2014 try something like 'period started yesterday, medium flow'.";
    return { message: q, entry: null, needsClarification: true, clarificationQuestion: q, activityTrail, toolCalls, ...offline };
  }
  if (/\bdelete\s+(?:my\s+)?last\s+entry\b/i.test(text)) {
    return { message: "Open Chronicle or Calendar to delete entries.", entry: null, needsClarification: false, activityTrail, toolCalls, ...offline };
  }
  if (/\b(?:undo\s+that|cancel\s+that|don't\s+log\s+that|discard\s+(?:that|the)\s+slip)\b/i.test(text)) {
    if (context.pendingEntry) {
      activityTrail.push({ step: "Slip Discarded", detail: "Pending slip cancelled by user", status: "done" });
      return { message: "Okay, I discarded that slip. Nothing was saved.", entry: null, needsClarification: false, activityTrail, toolCalls, ...offline };
    }
    return { message: "There's no pending slip to discard.", entry: null, needsClarification: false, activityTrail, toolCalls, ...offline };
  }
  const ownEvents = buildOwnEventsAnswer(text, {
    events: context.events,
    periods: context.periods,
    cycleStats: context.cycleStats ? { lastPeriodStart: context.cycleStats.lastPeriodStart ?? null } : void 0,
    today
  });
  if (ownEvents) {
    activityTrail.push({ step: "Your Calendar", detail: "Answered from your own calendar, no model call", status: "done" });
    return { message: ownEvents.message, kind: ownEvents.kind, usedLiveModel: false, entry: null, needsClarification: false, activityTrail, toolCalls, ...offline };
  }
  const isExplicitCorrection = /^\s*no[,.!?\s]/i.test(text) || /\bactually\b/i.test(text) || /\bmake it\b/i.test(text) || /\bchange\s+(?:the\s+)?(?:date|flow|mood|energy|it|to)\b/i.test(text) || /\b(?:add|remove|delete)\b/i.test(text) || /\balso had\b/i.test(text) || /\bset\s+(?:the\s+)?date\b/i.test(text) || /\b(?:none|spotting|light|medium|heavy)\s*,?\s*(?:and\s+)?not\s+(?:none|spotting|light|medium|heavy)\b/i.test(text) || /\bnot\s+(?:none|spotting|light|medium|heavy)\b/i.test(text) || /\bi\s+meant\b/i.test(text) || /\bmove\s+(?:it\s+)?to\b/i.test(text) || /\b(?:a\s+)?day\s+later\b/i.test(text) || /\bno\s+wait\b/i.test(text);
  const lastEntryMentioned = /\b(?:my\s+)?last\s+entry\b/i.test(text);
  const hasCorrectionVerb = /\b(change|changed|correct|correction|fix|fixed|update|updated|edit|edited)\b/i.test(text);
  const namedDate = (isExplicitCorrection || lastEntryMentioned || hasCorrectionVerb) && !context.pendingEntry ? namesNonTodayDate(text, today, context.landmarkPacks) : null;
  const mentionsToday = /\b(today|tonight|this morning|right now)\b/i.test(text);
  const todayOnlyStatement = mentionsToday && !namedDate && !lastEntryMentioned;
  let targetSlip = context.pendingEntry ?? null;
  let namedDateMatched = false;
  if (!targetSlip && (isExplicitCorrection || lastEntryMentioned || hasCorrectionVerb && namedDate) && !todayOnlyStatement) {
    if (namedDate) {
      const pool = context.recentEntries && context.recentEntries.length ? context.recentEntries : context.recentEntry ? [context.recentEntry] : [];
      const namedHit = pool.find((e) => e.date === namedDate) ?? null;
      if (namedHit) {
        targetSlip = namedHit;
        namedDateMatched = true;
      }
    } else {
      targetSlip = selectCorrectionTarget(text, null, context.recentEntry, context.recentEntries);
    }
  }
  if (targetSlip && (context.pendingEntry || isExplicitCorrection || lastEntryMentioned || namedDateMatched)) {
    const correctionRes = applySlipCorrections(targetSlip, text);
    if (correctionRes.changes.length > 0) {
      toolCalls.push({ id: "call_update_" + Date.now(), toolName: "update_entry", args: { correction: text }, result: { updated: correctionRes.updated, changes: correctionRes.changes }, latencyMs: Math.max(1, Date.now() - startTime), model: "offline-rule-engine", executedBy: "offline-rule-engine" });
      activityTrail.push({ step: "Accession Slip Correction", detail: correctionRes.changes.join("; "), status: "done" });
      return withIntent({ message: "I've updated your Accession Slip with your corrections. Please review below." + (medicalTail || ""), entry: correctionRes.updated, needsClarification: false, replacesExisting: true, activityTrail, toolCalls, ...offline }, text);
    }
  }
  const isCorrectionAttempt = /\b(actually|make it\s+(?:light|heavy|medium|spotting|none)|change\s+(?:the\s+)?(?:date|flow)|(?:light|medium|heavy|spotting)\s*,?\s*not\s+(?:light|medium|heavy|spotting)|not\s+(?:light|medium|heavy|spotting)\s*,?\s*(?:but|actually)?\s*(?:light|medium|heavy|spotting)|move\s+(?:it\s+)?to|i\s+meant|(?:a\s+)?day\s+later|no\s+wait)\b/i.test(text);
  const namesExplicitDay = /\b(?:january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\b/i.test(text) || /\b\d{4}-\d{2}-\d{2}\b/.test(text) || /\b(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i.test(text);
  const isDateCorrection = namesExplicitDay && /\b(change|move|correct|fix|update|edit|meant|later|wait)\b/i.test(text);
  const namesEventForEdit = /\b(wedding|exam|trip|interview|party|flight|vacation|conference|presentation|dinner|meeting|birthday|anniversary|marathon|race|appointment|shaadi|sangeet)\b/i.test(text);
  if (!targetSlip && (isCorrectionAttempt || isDateCorrection) && !/\bperiod\s+(?:started|ended)\b/i.test(text) && !namesEventForEdit) {
    const noEntryMsg = namesExplicitDay ? "There's no entry to change." : "I couldn't find a recent entry to correct.";
    return withIntent({
      message: noEntryMsg,
      entry: null,
      needsClarification: false,
      activityTrail: [{ step: "Correction Lookup", detail: "No recent entry found to correct", status: "done" }],
      toolCalls: [],
      ...offline
    }, text);
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
    "appointment",
    "shaadi",
    "sangeet"
  ];
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
        t = t.replace(/\s*(?:\b(?:is|was|scheduled|planned|happening|coming up|on|at|for|from|to attend)\b)\s*$/i, "").trim();
      }
      t = t.replace(/\bcoming up\b/gi, "").replace(/\s+/g, " ").trim();
      t = t.replace(/^\s*(?:an?|the|my|our|his|her|their|meri|mere|mera|hamari|apni|apne|yeh|ye|woh|wo|ek)\s+/i, "").trim();
      return t;
    };
    const focusNounTitle = (candidate, sentence) => {
      if (!/\bperiod\b/i.test(sentence)) return candidate;
      const focus = candidate.match(new RegExp(`\\b(?:my|the|a|an|during(?:\\s+my)?|for(?:\\s+my)?)\\s+(${EVENT_NOUNS.join("|")})\\b`, "i"));
      return focus ? focus[1].toLowerCase() : candidate;
    };
    const rangeSpans = [];
    {
      const DATE_ALT = `(?:\\d{1,2}(?:st|nd|rd|th)?\\s+(?:${MONTH_RE})|(?:${MONTH_RE})\\s+\\d{1,2}(?:st|nd|rd|th)?)(?:,?\\s+\\d{4})?|\\d{4}-\\d{2}-\\d{2}`;
      const rangeRe = new RegExp(`\\bfrom\\s+(${DATE_ALT})\\s+(?:to|till|through|-|\\u2013)\\s+(${DATE_ALT})|\\b(${DATE_ALT})\\s*(?:-|\\u2013|\\btill\\b)\\s+(${DATE_ALT})`, "gi");
      const resolveRangeDate = (raw) => {
        const t = raw.trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return { key: isValidDateKey(t) ? t : null, explicitYear: true };
        const yMatch = t.match(/\b(\d{4})\b/);
        const noYear = t.replace(/,?\s+\b\d{4}\b/, "");
        return { key: parseMonthDay(noYear, yMatch ? parseInt(yMatch[1], 10) : currentYear), explicitYear: !!yMatch };
      };
      let rm;
      while ((rm = rangeRe.exec(text)) !== null) {
        const startRaw = (rm[1] ?? rm[3] ?? "").trim();
        const endRaw = (rm[2] ?? rm[4] ?? "").trim();
        if (!startRaw || !endRaw) continue;
        const s = resolveRangeDate(startRaw);
        const e = resolveRangeDate(endRaw);
        if (!s.key || !e.key) continue;
        let start = s.key;
        let end = e.key;
        if (!s.explicitYear && !e.explicitYear && start < today) {
          const ns = resolveRangeDate(startRaw + " " + (currentYear + 1));
          const ne = resolveRangeDate(endRaw + " " + (currentYear + 1));
          if (!ns.key || !ne.key) continue;
          start = ns.key;
          end = ne.key;
        }
        if (end < start) continue;
        const sStart = Math.max(text.lastIndexOf(".", rm.index - 1) + 1, text.lastIndexOf("!", rm.index - 1) + 1, text.lastIndexOf("?", rm.index - 1) + 1, text.lastIndexOf("\n", rm.index - 1) + 1, text.lastIndexOf(";", rm.index - 1) + 1, 0);
        const rangeSentence = text.slice(sStart, rm.index + rm[0].length);
        const rangeTitle = focusNounTitle(cleanTitle(text.slice(sStart, rm.index)) || "Event", rangeSentence);
        eventMatches.push({ name: rangeTitle, date: start, endDate: end });
        rangeSpans.push({ index: rm.index, length: rm[0].length });
        planDateSpans.push({ index: rm.index, length: rm[0].length });
      }
    }
    while ((m = planDateRe.exec(text)) !== null) {
      if (rangeSpans.some((s) => m.index >= s.index && m.index < s.index + s.length)) continue;
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
      const hasEventNounInClauseOrSentence = /\b(exam|wedding|trip|interview|party|flight|vacation|marathon|race|conference|presentation|dinner|event|appointment|birthday|anniversary|deadline|meeting|travel|holiday|plan|planning|shaadi|sangeet)\b/i.test(localSentence);
      const hasCycleOrSymptomInSentence = /\b(period|flow|spotting|bleeding|menstruat|cramps|headache|nausea|fatigue|bloating|back pain|tender breasts|mood|acne|insomnia|cravings|diarrhea|constipation|dizziness|hot flashes)\b/i.test(localSentence);
      const cleanedCandidate = cleanTitle(clauseBeforeDate);
      if (!hasEventNounInClauseOrSentence && (cleanedCandidate === "" || hasCycleOrSymptomInSentence)) continue;
      if (/\b(period|flow|spotting|bleeding|menstruat)/i.test(clauseBeforeDate) && !/\b(exam|wedding|trip|interview|party|flight|vacation|marathon|race|conference|presentation|dinner|event|appointment|birthday|anniversary|deadline|meeting|travel|holiday|shaadi|sangeet)\b/i.test(clauseBeforeDate)) continue;
      const title = focusNounTitle(cleanedCandidate || "Event", localSentence);
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
  for (let i = passedPlanCandidates.length - 1; i >= 0; i--) {
    const c = passedPlanCandidates[i];
    if (/\b(birthday|anniversary)\b/i.test(c.name)) {
      eventMatches.push({ name: c.name, date: c.nextYear });
      passedPlanCandidates.splice(i, 1);
    }
  }
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
  const earlyLandmark = resolveLandmarkExpression(text, today, context.landmarkPacks);
  const isLandmarkPlan = /\b(plan|planning)\b/i.test(lower) && !hasLogContent && eventMatches.length === 0 && earlyLandmark.found && !!earlyLandmark.resolvedDate;
  if (isLandmarkPlan && earlyLandmark.resolvedDate) {
    if (earlyLandmark.resolvedDate >= today) {
      eventMatches.push({ name: earlyLandmark.landmarkName || "Event", date: earlyLandmark.resolvedDate });
      unplacedEvents.length = 0;
      activityTrail.push({ step: "Plan Around It", detail: `Found ${eventMatches.length} events`, status: "done" });
      planOverlaps = evaluateContextOverlaps(eventMatches, context, today);
      toolCalls.push({ id: "call_overlap_" + Date.now(), toolName: "check_overlap", args: { events: eventMatches }, result: { overlaps: planOverlaps }, latencyMs: Math.max(1, Date.now() - startTime), model: "offline-rule-engine", executedBy: "offline-rule-engine" });
    } else {
      const nextLm = resolveLandmarkExpression(`${earlyLandmark.landmarkName} next year`, today, context.landmarkPacks);
      if (nextLm.found && nextLm.resolvedDate && nextLm.resolvedDate > today) {
        passedPlanCandidates.push({ name: earlyLandmark.landmarkName || "Event", thisYear: earlyLandmark.resolvedDate, nextYear: nextLm.resolvedDate });
        unplacedEvents.length = 0;
      }
    }
  }
  const EVENT_NOUN_RE = /\b(exam|party|trip|appointment|wedding|interview|birthday|dentist|flight|conference|presentation|holiday|vacation|marathon|race|dinner|event|meeting)\b/i;
  if (!hasLogContent && eventMatches.length === 0 && earlyLandmark.found && earlyLandmark.resolvedDate && (intent === "plan_event" || EVENT_NOUN_RE.test(lower))) {
    let evDate = earlyLandmark.resolvedDate;
    if (evDate && evDate < today) {
      const lmName = earlyLandmark.landmarkName || "Event";
      const nextLm = resolveLandmarkExpression(`${lmName} next year`, today, context.landmarkPacks);
      if (nextLm.found && nextLm.baseDate) {
        const off = earlyLandmark.baseDate ? Math.round((Date.parse(earlyLandmark.resolvedDate) - Date.parse(earlyLandmark.baseDate)) / 864e5) : 0;
        evDate = applyDayOffset(nextLm.baseDate, off);
      } else {
        evDate = null;
      }
    }
    if (evDate && evDate >= today) {
      let title = text.replace(/\b(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+days?\s+(?:before|after)\b/gi, " ");
      if (earlyLandmark.landmarkName) title = title.replace(new RegExp(earlyLandmark.landmarkName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"), " ");
      title = title.replace(/\b(on|is|starts?|at|coming up)\b/gi, " ").replace(/[^a-zA-Z' ]+/g, " ").replace(/\s+/g, " ").trim().replace(/^(my|the|a|an)\s+/i, "");
      if (!title) title = "Event";
      eventMatches.push({ name: title, date: evDate });
      planOverlaps = evaluateContextOverlaps(eventMatches, context, today);
      activityTrail.push({ step: "Plan Around It", detail: `Found ${eventMatches.length} events`, status: "done" });
      toolCalls.push({ id: "call_overlap_" + Date.now(), toolName: "check_overlap", args: { events: eventMatches }, result: { overlaps: planOverlaps }, latencyMs: Math.max(1, Date.now() - startTime), model: "offline-rule-engine", executedBy: "offline-rule-engine" });
      return withIntent({ message: eventMatches.map((e) => `${e.name} on ${e.date}`).join("; "), entry: null, needsClarification: false, activityTrail, toolCalls, planOverlaps, plannedEvents: eventMatches.map((e) => ({ title: e.name, date: e.date })), usedPersonalAnchor, ...offline }, text);
    }
  }
  const backfill = extractBackfillDates(text, today);
  if (backfill) {
    if (backfill.monthAsk) {
      const q = "Which day in " + backfill.monthAsk + '? Reply like "period started ' + backfill.monthAsk + ' 9".';
      return { message: q, entry: null, entries: [], needsClarification: true, clarificationQuestion: q, activityTrail, toolCalls, planOverlaps, usedPersonalAnchor, ...offline };
    }
    const seeds = backfill.seeds;
    const dated = seeds.map((s) => s.date);
    const rangeNote = seeds.length === 1 && seeds[0].endDate ? " to " + seeds[0].endDate : "";
    const baseMsg = seeds.length === 1 ? "I found 1 period: " + dated[0] + rangeNote + ". Review and confirm below." : "I found " + seeds.length + " period starts: " + dated.join(", ") + ". Review and confirm below.";
    const warnMsg = backfill.warnings.length > 0 ? " " + backfill.warnings.join(" ") : "";
    const entries = seeds.map((s) => ({
      date: s.date,
      endDate: s.endDate || null,
      flow: null,
      symptoms: [],
      mood: null,
      energy: null,
      sleep: null,
      notes: text,
      isApproximate: false,
      landmarkName: null,
      kind: "period_started",
      dateExplanation: null,
      dateWindow: null
    }));
    for (const e of entries) {
      toolCalls.push({ id: "call_backfill_" + Date.now() + "_" + e.date, toolName: "log_entry", args: { date: e.date, kind: "period_started" }, result: { entry: { date: e.date } }, latencyMs: 1, model: "offline-rule-engine", executedBy: "offline-rule-engine" });
    }
    activityTrail.push({ step: "Backfill", detail: "Extracted " + seeds.length + " past period date" + (seeds.length === 1 ? "" : "s"), status: "done" });
    return ensureFactCoverageDisclosure({
      message: baseMsg + warnMsg,
      entry: entries[0],
      entries,
      needsClarification: false,
      activityTrail,
      toolCalls,
      planOverlaps,
      plannedEvents: eventMatches.map((e) => ({ title: e.name, date: e.date })),
      usedPersonalAnchor,
      ...offline
    }, text, today);
  }
  let logDatePeriodStart = false;
  if (!hasLogContent && intent !== "plan_event") {
    if (eventMatches.length === 0 && !matchedEvent && !earlyLandmark.found) {
      if (unplacedEvents.length > 0) {
        const q = `I couldn't place a date for: ${unplacedEvents.join(", ")}`;
        return { message: q, entry: null, needsClarification: true, clarificationQuestion: q, activityTrail, toolCalls, planOverlaps, ...offline };
      }
      const late = /\bperiod\s+(is\s+)?late\b|\blate period\b|\bmissed\s+(my\s+)?period\b|\bam\s+i\s+late\b/i.test(lower);
      const isQuestionLike = /\?\s*$/.test(text.trim()) || /^(did|do|does|is|are|was|were|will|would|could|should|can|when|where|why|how|what|which|who|am|has|have)\b/i.test(text.trim());
      const visitLog = !late && !isQuestionLike && /\bdoctor|clinic|appointment|check-?up|nurse|hospital\b/i.test(text) ? resolveDateExpression(text, today, context.landmarkPacks) : null;
      const isDatedVisitNote = !!visitLog && !visitLog.needsClarification && !!visitLog.date && visitLog.date <= today;
      const logDateResolved = !late && !isQuestionLike && /\b(log|record|note|save|add)\b/i.test(text) && !/(pill|tablet|medicine|medication|drug|dose|dosage|remind|delete|cancel|undo|discard)\b/i.test(text) ? resolveDateExpression(text, today, context.landmarkPacks) : null;
      const isLogDateRequest = !!logDateResolved && !logDateResolved.needsClarification && !!logDateResolved.date && logDateResolved.date <= today;
      if (isLogDateRequest) logDatePeriodStart = true;
      const startedFromEntries = [...context.recentEntries || [], ...context.recentEntry ? [context.recentEntry] : [], ...context.pendingEntry && context.pendingEntry.kind === "period_started" ? [context.pendingEntry] : []].filter((e) => e && e.kind === "period_started" && e.date).map((e) => e.date);
      const startedFromLogs = (context.logs || []).filter((g) => g && g.kind === "period_started" && g.logDate).map((g) => g.logDate);
      const lastStart = [...(context.periods || []).map((x) => x.startDate).filter(Boolean), ...context.cycleStats?.lastPeriodStart ? [context.cycleStats.lastPeriodStart] : [], ...startedFromEntries, ...startedFromLogs].filter(Boolean).sort().pop() || null;
      if (!isDatedVisitNote && !isLogDateRequest) {
        const q = late ? lastStart ? `Your last logged period started ${shortDateLabel(lastStart)}. Has a new one started since, or is that the one you mean?` : "I can't tell if your period is late without a logged start \u2014 did it start? Tell me when, or say 'period started today' to log it." : "I didn't catch anything I can log from that - try something like 'period started yesterday, medium flow'.";
        return { message: q, entry: null, needsClarification: true, clarificationQuestion: q, activityTrail, toolCalls, planOverlaps, ...offline };
      }
    }
  }
  const planPassedQuestion = passedPlanCandidates.length > 0 && eventMatches.length === 0 ? `Did you mean ${passedPlanCandidates[0].thisYear} (already passed) or ${passedPlanCandidates[0].nextYear}?` : null;
  if (planPassedQuestion && !hasLogContent) {
    return { message: planPassedQuestion, entry: null, needsClarification: true, clarificationQuestion: planPassedQuestion, activityTrail, toolCalls, planOverlaps, ...offline };
  }
  if ((intent === "plan_event" || eventMatches.length > 0) && !hasLogContent) {
    const isBareLandmark = eventMatches.length === 0;
    if (!isBareLandmark && !hasLogContent) {
      const isOverlapQuestion2 = /\bperiod\b/i.test(text) && /\b(during|clash(?:es|ed|ing)?|overlap(?:s|ped|ping)?|coincid(?:e|es|ing)|safe)\b/i.test(text);
      const describeEvent = (e) => {
        const base = e.endDate && e.endDate !== e.date ? `${e.name} on ${e.date} to ${e.endDate}` : `${e.name} on ${e.date}`;
        if (!isOverlapQuestion2) return base;
        const hit = (planOverlaps || []).find((o) => o.eventDate === e.date && o.name === e.name);
        return hit && hit.overlapNote ? `${base}: ${hit.overlapNote}` : base;
      };
      const msg = unplacedEvents.length > 0 ? `I couldn't place a date for: ${unplacedEvents.join(", ")}` : eventMatches.map(describeEvent).join("; ");
      return withIntent({ message: msg, entry: null, needsClarification: false, activityTrail, toolCalls, planOverlaps, plannedEvents: eventMatches.map((e) => ({ title: e.name, date: e.date, ...e.endDate && e.endDate !== e.date ? { endDate: e.endDate } : {} })), usedPersonalAnchor, ...offline }, text);
    }
  }
  let logDateText = text;
  if (planDateSpans.length > 0) {
    for (const span of [...planDateSpans].sort((a, b) => b.index - a.index)) {
      logDateText = logDateText.slice(0, span.index) + " " + logDateText.slice(span.index + span.length);
    }
  }
  const logLandmark = resolveLandmarkExpression(logDateText, today, context.landmarkPacks);
  if (logLandmark.found && (logLandmark.baseDate && logLandmark.baseDate > today || logLandmark.resolvedDate && logLandmark.resolvedDate > today)) {
    const lmName = logLandmark.landmarkName || "Landmark";
    const futureBase = logLandmark.baseDate || logLandmark.resolvedDate;
    const futureYear = futureBase.slice(0, 4);
    const pastLm = resolveLandmarkExpression(`last ${lmName}`, today, context.landmarkPacks);
    const pastBase = pastLm.found ? pastLm.baseDate || pastLm.resolvedDate : null;
    const pastYear = pastBase ? pastBase.slice(0, 4) : null;
    const q = pastBase && pastYear && pastBase <= today ? `${lmName} ${futureYear} is on ${futureBase}, which hasn't happened yet. Did you mean ${lmName} ${pastYear} (${pastBase})?` : `${lmName} ${futureYear} is on ${futureBase}, which hasn't happened yet. Which past date did you mean?`;
    return { message: q, entry: null, needsClarification: true, clarificationQuestion: q, activityTrail, toolCalls, planOverlaps, ...offline };
  }
  const resolved = resolveDateExpression(logDateText, today, context.landmarkPacks);
  if (resolved.needsClarification) {
    const dateQ = resolved.clarificationQuestion || "Which date?";
    const dateQMsg = severeCheck.isSevere ? `${severeCheck.message || SEVERE_SYMPTOM_ESCALATION_MESSAGE} ${dateQ}` : dateQ;
    return { message: dateQMsg, entry: null, needsClarification: true, clarificationQuestion: dateQ, activityTrail, toolCalls, planOverlaps, ...offline };
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
    const presetDefault = context.defaultDate && /^\d{4}-\d{2}-\d{2}$/.test(context.defaultDate) && isValidDateKey(context.defaultDate) && context.defaultDate <= today ? context.defaultDate : null;
    if (clearlyToday) entryDate = today;
    else if (presetDefault) entryDate = presetDefault;
    else if (hasLogContent && !pastMarkers) entryDate = today;
    else {
      const q = "Which date?";
      const qMsg = severeCheck.isSevere ? `${severeCheck.message || SEVERE_SYMPTOM_ESCALATION_MESSAGE} ${q}` : q;
      return { message: qMsg, entry: null, needsClarification: true, clarificationQuestion: q, activityTrail, toolCalls, planOverlaps, ...offline };
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
      const r = resolveDateExpression(`period started ${frag}`, today, context.landmarkPacks);
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
        const clRes = resolveDateExpression(cl, today, context.landmarkPacks);
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
  const kind = intent === "period_end" || extraction.periodEnd ? "period_ended" : intent === "period_start" || extraction.periodStart || logDatePeriodStart ? "period_started" : "daily_log";
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
  if (severeCheck.isSevere && !message.startsWith(severeCheck.message || SEVERE_SYMPTOM_ESCALATION_MESSAGE)) {
    message = `${severeCheck.message || SEVERE_SYMPTOM_ESCALATION_MESSAGE} ${message}`;
  }
  if (medicalTail) message += medicalTail;
  return withIntent({ message, entry, needsClarification: isApproximate && !!landmarkName || !!planPassedQuestion, clarificationQuestion: planPassedQuestion ?? (isApproximate && landmarkName ? `Did your period start before, on, or after ${landmarkName}?` : null), activityTrail, toolCalls, planOverlaps, plannedEvents: eventMatches.map((e) => ({ title: e.name, date: e.date })), usedPersonalAnchor, ...offline }, text);
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
