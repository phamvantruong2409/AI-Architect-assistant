import { getGeminiImageModel } from "@/lib/gemini";
import { geminiErrorCode, geminiErrorMessage } from "@/lib/gemini-error";

export async function POST(req: Request) {
  const { prompt } = await req.json();

  if (typeof prompt !== "string" || !prompt.trim()) {
    return Response.json({ error: "Thiếu mô tả ảnh cần tạo" }, { status: 400 });
  }

  let result;
  try {
    result = await getGeminiImageModel().generateContent(prompt);
  } catch (error) {
    console.error("Gemini image error:", error);
    return Response.json(
      { error: geminiErrorMessage(error), code: geminiErrorCode(error) },
      { status: 502 }
    );
  }

  const parts = result.response.candidates?.[0]?.content?.parts ?? [];
  const imagePart = parts.find((p) => p.inlineData);

  if (!imagePart?.inlineData) {
    return Response.json(
      { error: "AI không trả về ảnh. Vui lòng thử mô tả khác." },
      { status: 502 }
    );
  }

  const { mimeType, data } = imagePart.inlineData;
  return Response.json({ image: `data:${mimeType};base64,${data}` });
}
