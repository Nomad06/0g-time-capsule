import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { guard } from "@/lib/api-guard";

const MAX_PROMPT = 2000;
const MAX_TEMPLATE = 200;

// 0G Compute Router — OpenAI-compatible, TEE-verified inference.
// API key + balance from https://pc.0g.ai. Model catalog: GET /v1/models.
const ZG_API_KEY = process.env.ZG_API_KEY ?? "";
const ZG_BASE_URL = process.env.ZG_BASE_URL ?? "https://router-api.0g.ai/v1";

// 0G Compute model — set ZG_MODEL env var to override
const ZG_MODEL = process.env.ZG_MODEL ?? "deepseek-v3";

const SYSTEM_PROMPT = `You are a time capsule assistant helping users write meaningful, heartfelt, or strategic messages to seal on the 0G blockchain — to be revealed in the future.

Your job: craft a compelling, personal, and well-structured capsule message based on the user's description.

Guidelines:
- Be thoughtful, specific, and emotionally resonant
- Match the tone to the use case (personal letter = warm; investment thesis = analytical; announcement = professional)
- Write in first person from the user's perspective
- Include reflection on the present moment and hopes/predictions for the future
- Keep it concise but meaningful (150–400 words ideal)
- Do NOT add meta-commentary like "Here is your message:" — output the message text directly`;

export async function POST(req: NextRequest) {
  try {
    // Paid endpoint (drains ZG_API_KEY) — gate before any work.
    const blocked = guard(req, "ai-assist", { limit: 5, windowMs: 60_000 });
    if (blocked) return blocked;

    const { prompt, template } = await req.json() as { prompt: string; template?: string };

    if (!prompt?.trim()) {
      return NextResponse.json({ error: "prompt required" }, { status: 400 });
    }
    if (prompt.length > MAX_PROMPT || (template && template.length > MAX_TEMPLATE)) {
      return NextResponse.json({ error: "Input too long" }, { status: 413 });
    }

    const userMessage = template
      ? `Template: "${template}"\nUser description: ${prompt}`
      : prompt;

    if (!ZG_API_KEY) {
      return NextResponse.json({ error: "ZG_API_KEY not configured" }, { status: 503 });
    }

    const client = new OpenAI({ baseURL: ZG_BASE_URL, apiKey: ZG_API_KEY });
    const model = ZG_MODEL;

    const completion = await client.chat.completions.create({
      model,
      max_tokens: 600,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user",   content: userMessage   },
      ],
    });

    const text = completion.choices[0]?.message?.content ?? "";
    return NextResponse.json({ text, provider: "0g-compute" });
  } catch (e: unknown) {
    console.error("[ai-assist]", e);
    return NextResponse.json({ error: "AI assist failed" }, { status: 500 });
  }
}
