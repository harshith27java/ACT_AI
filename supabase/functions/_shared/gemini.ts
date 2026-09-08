// Server-side Gemini client. The API key lives only in Edge Function
// secrets (GEMINI_API_KEY) and is never exposed to the browser.
const MODEL = "gemini-3.8-flash";

export class GeminiError extends Error {
  status: number;
  constructor(message: string, status = 500) {
    super(message);
    this.status = status;
  }
}

function apiKey(): string {
  const key = Deno.env.get("GEMINI_API_KEY");
  if (!key) {
    throw new GeminiError(
      "Gemini API key is not configured. Set GEMINI_API_KEY as a Supabase secret.",
      503,
    );
  }
  return key;
}

/** Generate text (optionally JSON-mode) from Gemini. */
export async function generateContent(
  prompt: string,
  opts: { json?: boolean; system?: string } = {},
): Promise<string> {
  const body: Record<string, unknown> = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 8192,
      ...(opts.json ? { responseMimeType: "application/json" } : {}),
    },
  };
  if (opts.system) {
    body.systemInstruction = { parts: [{ text: opts.system }] };
  }

  let lastError: GeminiError | null = null;
  // Google's free tier intermittently returns 429/503 under load; retry
  // a few times with short backoff before surfacing the error.
  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, attempt * 4000));
    try {
      return await callGemini(body);
    } catch (e) {
      if (e instanceof GeminiError && (e.status === 429 || e.status === 503)) {
        lastError = e;
        continue;
      }
      throw e;
    }
  }
  throw lastError ?? new GeminiError("Gemini is unavailable.", 503);
}

async function callGemini(body: Record<string, unknown>): Promise<string> {
  let resp: Response;
  try {
    resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey()}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );
  } catch (_e) {
    throw new GeminiError("Gemini API is unreachable.", 502);
  }

  if (resp.status === 400 || resp.status === 401 || resp.status === 403) {
    throw new GeminiError(
      "Gemini rejected the request. Check that GEMINI_API_KEY is valid.",
      502,
    );
  }
  if (resp.status === 429) {
    throw new GeminiError("Gemini rate limit reached. Try again shortly.", 429);
  }
  if (!resp.ok) {
    throw new GeminiError(`Gemini error (HTTP ${resp.status}).`, 502);
  }

  const data = await resp.json();
  const text = data?.candidates?.[0]?.content?.parts
    ?.map((p: { text?: string }) => p.text ?? "")
    .join("");
  if (!text) {
    throw new GeminiError("Gemini returned an empty response.", 502);
  }
  return text;
}

/** Generate and parse a JSON response, tolerating markdown code fences. */
export async function generateStructured<T>(
  prompt: string,
  system?: string,
): Promise<T> {
  const raw = await generateContent(prompt, { json: true, system });
  let text = raw.trim();
  if (text.startsWith("```")) {
    text = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  }
  try {
    return JSON.parse(text) as T;
  } catch (_e) {
    throw new GeminiError("Gemini returned malformed JSON.", 502);
  }
}
