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
var milestonesData_default = MILESTONES_DATA;

// ai/backend/synthesis.ts
function projectPhaseAtDate(targetDateStr, lastPeriodStart, avgCycleLength, avgPeriodLength) {
  if (!lastPeriodStart) {
    return {
      phase: "Luteal",
      risk: "Unlikely to overlap (estimate)",
      note: "Baseline calibrating. Initial cycle tracking in progress."
    };
  }
  const start = new Date(lastPeriodStart).getTime();
  const target = new Date(targetDateStr).getTime();
  const diffDays = Math.round((target - start) / (1e3 * 60 * 60 * 24));
  const cycleDay = (diffDays % avgCycleLength + avgCycleLength) % avgCycleLength;
  if (cycleDay < avgPeriodLength) {
    return {
      phase: "Menstrual",
      risk: "Likely overlap",
      note: `Estimated menstrual phase on Day ${cycleDay + 1}. High likelihood of flow.`
    };
  } else if (cycleDay < avgPeriodLength + 2 || cycleDay >= avgCycleLength - 2) {
    return {
      phase: cycleDay < avgPeriodLength + 2 ? "Follicular" : "Luteal",
      risk: "Possible overlap",
      note: `Adjacent to cycle boundary (Day ${cycleDay + 1}). Possible overlap.`
    };
  } else if (cycleDay >= 12 && cycleDay <= 16) {
    return {
      phase: "Ovulatory",
      risk: "Estimated Ovulatory Window",
      note: `Estimated mid-cycle ovulatory window (Day ${cycleDay + 1}).`
    };
  } else if (cycleDay < 12) {
    return {
      phase: "Follicular",
      risk: "Unlikely to overlap (estimate)",
      note: `Estimated follicular phase (Day ${cycleDay + 1}). Unlikely to overlap.`
    };
  } else {
    return {
      phase: "Luteal",
      risk: "Unlikely to overlap (estimate)",
      note: `Estimated luteal phase (Day ${cycleDay + 1}). Unlikely to overlap.`
    };
  }
}
function getBaselineSynthesis(periods, cycleStats, currentDateOrYear = "2026-10-28") {
  const currentDate = typeof currentDateOrYear === "string" ? currentDateOrYear.length === 4 ? `${currentDateOrYear}-01-01` : currentDateOrYear : typeof currentDateOrYear === "number" ? `${currentDateOrYear}-01-01` : "2026-10-28";
  const baselineMilestones = milestonesData_default.map((f) => {
    const upcomingDates = Object.values(f.dates).filter((d) => typeof d === "string" && d >= currentDate).sort();
    const festDate = upcomingDates.length > 0 ? upcomingDates[0] : f.dates["2027"] || f.dates["2026"];
    const proj = projectPhaseAtDate(
      festDate,
      cycleStats.lastPeriodStart || (periods[0]?.startDate || null),
      cycleStats.avgCycleLength || 28,
      cycleStats.avgPeriodLength || 5
    );
    return {
      milestone: f.name,
      festival: f.name,
      date: festDate,
      phaseAtMilestone: proj.phase,
      phaseAtFestival: proj.phase,
      overlapRisk: proj.risk,
      note: proj.note
    };
  }).sort((a, b) => a.date.localeCompare(b.date));
  return {
    executiveSummary: `Based on an observed ${cycleStats.avgCycleLength || 28}-day cycle cadence, your rhythm displays consistent phase pacing across 12 calendar milestones for personal planning.`,
    regularityScore: Math.min(96, Math.max(78, Math.round(100 - (cycleStats.avgCycleLength - 28) * 1.5))),
    phaseCorrelations: [
      {
        phase: "Menstrual (Days 1\u20135)",
        observedPattern: "Primary flow window based on recorded history.",
        rhythmRecommendation: "Calendar buffer recommended for personal comfort."
      },
      {
        phase: "Follicular (Days 6\u201312)",
        observedPattern: "Post-menstrual interval prior to mid-cycle window.",
        rhythmRecommendation: "Standard scheduling window based on cycle interval."
      },
      {
        phase: "Ovulatory (Days 13\u201316)",
        observedPattern: "Mid-cycle window estimated from historical cadence.",
        rhythmRecommendation: "Standard scheduling window for personal planning."
      },
      {
        phase: "Luteal (Days 17\u201328)",
        observedPattern: "Pre-menstrual interval leading into next cycle.",
        rhythmRecommendation: "Calendar buffer recommended as next cycle boundary approaches."
      }
    ],
    milestoneForecastMatrix: baselineMilestones,
    festivalForecastMatrix: baselineMilestones,
    lifestylePacing: [
      "Plan personal travel and appointments with estimated cycle dates as a reference.",
      "Cycles vary from month to month; treat projected windows as estimates, not guarantees.",
      "Allow buffer days around estimated menstrual onset when scheduling high-priority events.",
      "Cross-reference actual confirmed dates to continuously refine future planning intervals."
    ],
    telemetry: {
      model: "offline-rule-engine",
      provider: "Client Fallback",
      tokensEstimated: 0,
      latencyMs: 15,
      reasoningPasses: 1,
      isLiveApi: false
    }
  };
}
async function runDeepCycleSynthesis(periods, logs, cycleStats, currentDateOrYear = "2026-10-28") {
  const startTime = Date.now();
  const config = getConfig();
  const apiKey = config.useBaseten ? config.basetenApiKey : config.metaApiKey;
  const baseUrl = config.useBaseten ? config.basetenBaseUrl : config.metaBaseUrl;
  const model = config.useBaseten ? "meta-models/muse-spark-open-1026" : config.museSparkModel;
  const provider = config.useBaseten ? "Baseten Bridge" : "Meta Model API";
  const fallbackResult = getBaselineSynthesis(periods, cycleStats, currentDateOrYear);
  if (!apiKey) {
    return fallbackResult;
  }
  const systemPrompt = `You are the Lavender Voice Chronobiology & Rhythm Intelligence Engine.
Analyze the user's historical cycle data, symptom logs, and upcoming cultural calendar.
Output deep pattern synthesis with strict adherence to non-medical personal rhythm planning.
DO NOT provide medical diagnoses or drug prescriptions. For health questions, advise talking to a doctor.

Return ONLY strict valid JSON in this exact structure:
{
  "executiveSummary": "2-3 sentences summarizing biological rhythm, cadence stability, and phase dynamics",
  "regularityScore": 88,
  "phaseCorrelations": [
    {
      "phase": "Phase Name (Days)",
      "observedPattern": "Observed symptom and mood patterns from logged records",
      "rhythmRecommendation": "Practical lifestyle, rest, and scheduling advice"
    }
  ],
  "lifestylePacing": [
    "Pacing suggestion 1",
    "Pacing suggestion 2",
    "Pacing suggestion 3"
  ]
}`;
  const userContext = JSON.stringify({
    stats: cycleStats,
    periodsCount: periods.length,
    recentPeriods: periods.slice(0, 6),
    recentLogs: logs.slice(0, 15),
    currentDate: currentDateOrYear
  });
  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Here is the user's cycle chronology:
${userContext}` }
        ],
        temperature: 0.2
      })
    });
    if (!res.ok) {
      console.warn(`[Synthesis] Baseten/Meta API returned ${res.status}. Falling back to baseline model.`);
      return fallbackResult;
    }
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || "{}";
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || [null, content];
    const parsed = JSON.parse(jsonMatch[1]);
    const latencyMs = Date.now() - startTime;
    const tokensEstimated = data.usage?.total_tokens || 1680;
    return {
      executiveSummary: parsed.executiveSummary || fallbackResult.executiveSummary,
      regularityScore: typeof parsed.regularityScore === "number" ? parsed.regularityScore : 88,
      phaseCorrelations: parsed.phaseCorrelations || fallbackResult.phaseCorrelations,
      milestoneForecastMatrix: fallbackResult.milestoneForecastMatrix,
      festivalForecastMatrix: fallbackResult.festivalForecastMatrix,
      lifestylePacing: parsed.lifestylePacing || fallbackResult.lifestylePacing,
      telemetry: {
        model,
        provider,
        tokensEstimated,
        latencyMs,
        reasoningPasses: 3,
        isLiveApi: true
      }
    };
  } catch (err) {
    console.error("[Synthesis Engine] API execution error:", err);
    return fallbackResult;
  }
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
  const xForwardedFor = headers["x-forwarded-for"] || headers["x-real-ip"] || headers["client-ip"];
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

// api-src/synthesis.ts
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
    endpointName: "synthesis",
    maxBodyBytes: 100 * 1024
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
      const { periods, logs, cycleStats, targetYear } = body;
      const result = await runDeepCycleSynthesis(
        periods || [],
        logs || [],
        cycleStats || {},
        targetYear || 2026
      );
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
        body: JSON.stringify({ error: err.message || "Synthesis failed" })
      };
    }
  }
  if (req.method !== "POST") {
    return sendResponse(res, 405, { error: "Method not allowed" });
  }
  try {
    const body = await getRequestBody(req);
    const { periods, logs, cycleStats, targetYear } = body;
    const result = await runDeepCycleSynthesis(
      periods || [],
      logs || [],
      cycleStats || {},
      targetYear || 2026
    );
    return sendResponse(res, 200, result);
  } catch (err) {
    return sendResponse(res, 500, { error: err.message || "Synthesis failed" });
  }
}
var synthesis_default = handler;
export {
  synthesis_default as default,
  handler
};
