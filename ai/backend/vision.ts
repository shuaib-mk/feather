// Vision service using Muse Spark (multimodal) for paper diary / wall calendar import.
// Extracts circled or marked period start/end dates from photos into an editable preview table.

import { getConfig } from "./config";
import { todayLocal } from "../../client/src/lib/localDate";

export interface ExtractedPeriod {
  startDate: string; // YYYY-MM-DD
  endDate?: string | null;
  notes?: string;
  confidence: number;
}

export interface VisionDiaryResult {
  periods: ExtractedPeriod[];
  summary: string;
}

/**
 * Extracts period dates from a photo of a wall calendar or paper diary using Muse Spark Vision.
 */
export async function extractDiaryDates(
  imageBase64: string,
  mimeType: string = "image/jpeg",
): Promise<VisionDiaryResult> {
  const config = getConfig();
  const apiKey = config.useBaseten ? config.basetenApiKey : (config.metaApiKey || config.basetenApiKey);
  const baseUrl = config.useBaseten ? config.basetenBaseUrl : config.metaBaseUrl;
  const model = config.useBaseten ? "meta-models/muse-spark-open-1026" : config.museSparkModel;

  if (!apiKey) {
    return { periods: [], summary: "Vision is unavailable because no model API key is configured. No dates were extracted." };
  }

  const prompt = `You are analyzing a photo of a handwritten paper diary or wall calendar to extract marked or circled period dates.
Extract each contiguous sequence of marked dates as a period cycle.
Return ONLY valid JSON in this exact structure:
{
  "periods": [
    {
      "startDate": "YYYY-MM-DD",
      "endDate": "YYYY-MM-DD",
      "notes": "brief description of mark (e.g., circled in red, dotted)",
      "confidence": 0.95
    }
  ],
  "summary": "Short explanation of what was found"
}
If month or year is visible, use it; otherwise assume the current year. Do not provide medical advice.`;

  const payload = {
    model,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          {
            type: "image_url",
            image_url: {
              url: imageBase64.startsWith("data:") ? imageBase64 : `data:${mimeType};base64,${imageBase64}`,
            },
          },
        ],
      },
    ],
    temperature: 0.1,
  };

  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      throw new Error(`Vision API error: ${res.status} ${await res.text()}`);
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || "{}";

    // Extract JSON block if wrapped in markdown fences
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || [null, content];
    const parsed = JSON.parse(jsonMatch[1]);

    return {
      periods: parsed.periods || [],
      summary: parsed.summary || "Extracted period entries from paper diary photo.",
    };
  } catch (err) {
    console.error("[Vision Service] Error extracting dates:", err);
    throw err;
  }
}
