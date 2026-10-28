import { runDeepCycleSynthesis } from "../ai/backend/synthesis";
import { checkStatelessProtection } from "../ai/backend/protection";

function sendResponse(res: any, statusCode: number, data: any) {
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
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    });
    return res.end(JSON.stringify(data));
  }
  if (typeof res.end === "function") {
    return res.end(JSON.stringify(data));
  }
}

async function getRequestBody(req: any) {
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
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(Buffer.from(chunk));
    const str = Buffer.concat(chunks).toString("utf8");
    return str ? JSON.parse(str) : {};
  } catch {
    return {};
  }
}

export async function handler(req: any, res?: any) {
  // CORS Preflight
  if (req.method === "OPTIONS" || (req.httpMethod === "OPTIONS")) {
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
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
      body: "",
    };
  }

  // Stateless Protection (Rate limits, Origin, Max payload 100KB)
  const protection = checkStatelessProtection(req, {
    endpointName: "synthesis",
    maxBodyBytes: 100 * 1024,
  });

  if (!protection.allowed) {
    const status = protection.statusCode || 429;
    const errorBody = { error: protection.error, code: protection.code };
    if (!res && req && req.httpMethod) {
      return {
        statusCode: status,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify(errorBody),
      };
    }
    return sendResponse(res, status, errorBody);
  }

  // Netlify Lambda handler(event, context)
  if (!res && req && req.httpMethod) {
    if (req.httpMethod !== "POST") {
      return {
        statusCode: 405,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Method not allowed" }),
      };
    }
    try {
      const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
      const { periods, logs, cycleStats, targetYear } = body;
      const result = await runDeepCycleSynthesis(
        periods || [],
        logs || [],
        cycleStats || {},
        targetYear || 2026,
      );
      return {
        statusCode: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify(result),
      };
    } catch (err: any) {
      return {
        statusCode: 500,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: err.message || "Synthesis failed" }),
      };
    }
  }

  // Vercel / Node HTTP handler(req, res)
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
      targetYear || 2026,
    );
    return sendResponse(res, 200, result);
  } catch (err: any) {
    return sendResponse(res, 500, { error: err.message || "Synthesis failed" });
  }
}

export default handler;
