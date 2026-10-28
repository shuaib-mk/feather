// Medical Safety Guardrail for Feather.
// Strict enforcement: The AI helper never gives medical advice, diagnoses, dosage recommendations,
// or fertility / pregnancy risk guidance.
// Fixed refusal message: "I can only help with logging and planning. For health questions, please talk to a doctor."

export const MEDICAL_REFUSAL_MESSAGE =
  "I can only help with logging and planning. For health questions, please talk to a doctor.";

// Regular expressions and keywords that trigger the medical guardrail refusal.
// Specifically targets advice queries, diagnostic probes, and medication questions
// across English, Spanish, Malayalam, and Hindi while allowing neutral cycle logging.
const MEDICAL_ADVICE_PATTERNS = [
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
];

/**
 * Checks whether user input or transcript contains a request for medical advice,
 * symptom interpretation, diagnosis, medication, or pregnancy/fertility safety.
 */
export function checkMedicalAdviceGuardrail(input: string): {
  isRefusal: boolean;
  refusalMessage: string | null;
} {
  const normalized = input.trim();
  if (!normalized) {
    return { isRefusal: false, refusalMessage: null };
  }

  for (const pattern of MEDICAL_ADVICE_PATTERNS) {
    if (pattern.test(normalized)) {
      return {
        isRefusal: true,
        refusalMessage: MEDICAL_REFUSAL_MESSAGE,
      };
    }
  }

  return { isRefusal: false, refusalMessage: null };
}
