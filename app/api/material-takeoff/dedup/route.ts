import { dedupTakeoff, type DedupRequest } from "@/lib/material-takeoff-dedup";
import { geminiErrorCode, geminiErrorMessage } from "@/lib/gemini-error";

export const maxDuration = 60;

export async function POST(req: Request) {
  let body: DedupRequest;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Dữ liệu không hợp lệ" }, { status: 400 });
  }

  const materials = Array.isArray(body.materials) ? body.materials : [];
  const furniture = Array.isArray(body.furniture) ? body.furniture : [];

  try {
    const result = await dedupTakeoff({ materials, furniture });
    return Response.json(result);
  } catch (error) {
    console.error("Material takeoff dedup error:", error);
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
