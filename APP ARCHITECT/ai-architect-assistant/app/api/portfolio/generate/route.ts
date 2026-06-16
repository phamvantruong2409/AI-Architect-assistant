import { getGeminiModel } from "@/lib/gemini";
import { geminiErrorCode, geminiErrorMessage } from "@/lib/gemini-error";

export const maxDuration = 120;

// Gemini accepts inline base64 data up to ~20MB per request.
const MAX_INLINE_BASE64_CHARS = 18 * 1024 * 1024;

interface InlineFile {
  mimeType: string;
  data: string;
}

export async function POST(req: Request) {
  const { prompt, images, pdfs, model } = await req.json();

  if (typeof prompt !== "string" || !prompt.trim()) {
    return Response.json({ error: "Thiếu nội dung yêu cầu" }, { status: 400 });
  }

  const parts: Array<{ text: string } | { inlineData: InlineFile }> = [{ text: prompt }];

  let totalChars = prompt.length;
  for (const file of [...(images ?? []), ...(pdfs ?? [])] as InlineFile[]) {
    if (!file?.data || !file?.mimeType) continue;
    totalChars += file.data.length;
    if (totalChars > MAX_INLINE_BASE64_CHARS) break;
    parts.push({ inlineData: { mimeType: file.mimeType, data: file.data } });
  }

  const genModel = getGeminiModel(model);

  let result;
  try {
    result = await genModel.generateContent(parts);
  } catch (error) {
    console.error("Gemini portfolio error:", error);
    return Response.json(
      { error: geminiErrorMessage(error), code: geminiErrorCode(error) },
      { status: 502 }
    );
  }

  const text = result.response.text();
  return new Response(text, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
