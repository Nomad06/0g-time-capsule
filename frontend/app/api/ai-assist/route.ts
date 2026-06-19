import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

// 0G Compute is OpenAI-compatible. Set ZG_COMPUTE_URL + ZG_COMPUTE_API_KEY
// to route through 0G Compute network instead of any centralized API.
const ZG_COMPUTE_URL    = process.env.ZG_COMPUTE_URL    ?? "";
const ZG_COMPUTE_KEY    = process.env.ZG_COMPUTE_API_KEY ?? "";

// Fallback: Anthropic-compatible via openai SDK (claude-sonnet-4-6)
const ANTHROPIC_KEY     = process.env.ANTHROPIC_API_KEY  ?? "";
const ANTHROPIC_BASE    = "https://api.anthropic.com/v1";
const ANTHROPIC_MODEL   = "claude-sonnet-4-6";

// 0G Compute testnet model
const ZG_MODEL = process.env.ZG_COMPUTE_MODEL ?? "Qwen/Qwen2.5-7B-Instruct";

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
    const { prompt, template } = await req.json() as { prompt: string; template?: string };

    if (!prompt?.trim()) {
      return NextResponse.json({ error: "prompt required" }, { status: 400 });
    }

    const userMessage = template
      ? `Template: "${template}"\nUser description: ${prompt}`
      : prompt;

    // Prefer 0G Compute; fall back to Anthropic
    const use0G = !!(ZG_COMPUTE_URL && ZG_COMPUTE_KEY);

    const client = use0G
      ? new OpenAI({ baseURL: `${ZG_COMPUTE_URL}/v1`, apiKey: ZG_COMPUTE_KEY })
      : new OpenAI({ baseURL: ANTHROPIC_BASE, apiKey: ANTHROPIC_KEY, defaultHeaders: { "anthropic-version": "2023-06-01" } });

    const model = use0G ? ZG_MODEL : ANTHROPIC_MODEL;

    const completion = await client.chat.completions.create({
      model,
      max_tokens: 600,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user",   content: userMessage   },
      ],
    });

    const text = completion.choices[0]?.message?.content ?? "";
    return NextResponse.json({ text, provider: use0G ? "0g-compute" : "anthropic" });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
