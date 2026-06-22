import { analyzeMaterials } from "@/lib/material-takeoff-gemini";
import { geminiErrorCode, geminiErrorMessage } from "@/lib/gemini-error";
import { MAX_IMAGE_BYTES, type TakeoffAnalyzeRequest } from "@/lib/material-takeoff-types";

export const maxDuration = 120;

export async function POST(req: Request) {
  let body: TakeoffAnalyzeRequest;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Dữ liệu không hợp lệ" }, { status: 400 });
  }

  if (!body.imageBase64?.trim() || !body.mimeType?.trim()) {
    return Response.json({ error: "Vui lòng tải lên ảnh cần bóc tách vật liệu" }, { status: 400 });
  }
  // base64 → ~3/4 kích thước thật
  if (body.imageBase64.length * 0.75 > MAX_IMAGE_BYTES) {
    return Response.json({ error: "Ảnh quá lớn (tối đa 8MB). Vui lòng nén lại." }, { status: 413 });
  }

  try {
    const result = await analyzeMaterials(body);
    return Response.json(result);
  } catch (error) {
    console.error("Material takeoff analyze error:", error);
    if (error instanceof SyntaxError) {
      return Response.json(
        { error: "AI trả về dữ liệu không đọc được. Vui lòng thử lại." },
        { status: 502 }
      );
    }
    return Response.json(
      { error: geminiErrorMessage(error), code: geminiErrorCode(error) },
      { status: 502 }
    );
  }
}
