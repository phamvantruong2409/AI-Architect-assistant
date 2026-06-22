// Sinh ảnh render từ ảnh SketchUp thô + prompt.
// Hai backend:
//   - Gemini image (img2img): "gemini-image-pro" (Nano Banana Pro) / "gemini-image" (Flash).
//   - Flux + ControlNet trên Replicate ("flux-controlnet") — giữ khối cứng nhất.
//
// Cấu hình trong .env.local:
//   REPLICATE_API_TOKEN=r8_xxx                          (bắt buộc cho flux-controlnet)
//   REPLICATE_FLUX_MODEL=black-forest-labs/flux-canny-dev (tùy chọn; xác minh schema input theo model thật)

import { getGeminiImageModel } from "@/lib/gemini";
import { geminiErrorCode, geminiErrorMessage } from "@/lib/gemini-error";
import { geminiImageModelId, MAX_RENDER_IMAGES } from "@/lib/render-types";

export const maxDuration = 300; // diffusion cloud có thể chạy lâu

interface GenBody {
  image?: string; // dataURL ảnh SketchUp gốc
  prompt?: string;
  negativePrompt?: string;
  model?: string;
  count?: number;
  resolution?: string; // "1K" | "2K" | "4K" | "8K"
}

/** Tách dataURL "data:<mime>;base64,<data>" → { mimeType, data }. */
function parseDataUrl(dataUrl: string): { mimeType: string; data: string } | null {
  const m = /^data:([^;]+);base64,([\s\S]+)$/.exec(dataUrl);
  if (!m) return null;
  return { mimeType: m[1], data: m[2] };
}

// ---- Gemini img2img ----
async function generateWithGemini(
  geminiModel: string,
  image: { mimeType: string; data: string },
  prompt: string,
  negativePrompt: string,
  count: number,
  resolution: string
): Promise<string[]> {
  // Chọn khổ ảnh: Nano Banana Pro (gemini-3 pro image) hỗ trợ 2K/4K qua
  // imageConfig.imageSize. Flash chỉ 1K → không gửi (để mặc định).
  // Tên field imageConfig/imageSize cần xác minh khi chạy thật với key Pro.
  const supportsSize = geminiModel.includes("pro") && /^(2K|4K)$/i.test(resolution);
  const generationConfig = supportsSize
    ? { imageConfig: { imageSize: resolution.toUpperCase() } }
    : undefined;
  const model = getGeminiImageModel(geminiModel, generationConfig);
  // Gemini image không có tham số negative riêng → gộp vào text prompt.
  const fullPrompt = negativePrompt.trim()
    ? `${prompt}\n\nCần TRÁNH (không được có): ${negativePrompt.trim()}`
    : prompt;
  const runOne = async (): Promise<string | null> => {
    const result = await model.generateContent([
      { text: fullPrompt },
      { inlineData: { mimeType: image.mimeType, data: image.data } },
    ]);
    const parts = result.response.candidates?.[0]?.content?.parts ?? [];
    const imagePart = parts.find((p) => p.inlineData);
    if (!imagePart?.inlineData) return null;
    const { mimeType, data } = imagePart.inlineData;
    return `data:${mimeType};base64,${data}`;
  };
  const results = await Promise.all(Array.from({ length: count }, runOne));
  return results.filter((x): x is string => !!x);
}

// ---- Flux + ControlNet trên Replicate ----
interface ReplicatePrediction {
  id: string;
  status: "starting" | "processing" | "succeeded" | "failed" | "canceled";
  output?: string | string[] | null;
  error?: string | null;
  urls?: { get?: string };
}

function collectUrls(output: ReplicatePrediction["output"]): string[] {
  if (!output) return [];
  if (typeof output === "string") return [output];
  if (Array.isArray(output)) return output.filter((x): x is string => typeof x === "string");
  return [];
}

// Khổ ảnh Flux → số megapixel gần đúng (tên field tuỳ schema model, xác minh khi có token).
const FLUX_MEGAPIXELS: Record<string, number> = { "2K": 4, "4K": 8, "8K": 16 };

async function generateWithFlux(
  image: string,
  prompt: string,
  negativePrompt: string,
  count: number,
  resolution: string
): Promise<{ images?: string[]; error?: string; code?: string; status?: number }> {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) {
    return {
      error:
        "Chưa cấu hình REPLICATE_API_TOKEN. Thêm token vào .env.local để dùng Flux + ControlNet (cloud).",
      code: "no_token",
      status: 400,
    };
  }
  const model = process.env.REPLICATE_FLUX_MODEL || "black-forest-labs/flux-canny-dev";

  try {
    // Tạo prediction (Prefer: wait — chờ đồng bộ tối đa ~60s, sau đó poll tiếp).
    // Input params có thể cần chỉnh theo schema thật của model đã chọn.
    let res = await fetch(`https://api.replicate.com/v1/models/${model}/predictions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Prefer: "wait",
      },
      body: JSON.stringify({
        input: {
          control_image: image,
          prompt,
          ...(negativePrompt.trim() ? { negative_prompt: negativePrompt.trim() } : {}),
          ...(FLUX_MEGAPIXELS[resolution.toUpperCase()]
            ? { megapixels: String(FLUX_MEGAPIXELS[resolution.toUpperCase()]) }
            : {}),
          num_outputs: count,
        },
      }),
    });
    let pred = (await res.json()) as ReplicatePrediction;
    if (!res.ok) {
      const msg = (pred as unknown as { detail?: string })?.detail || "Replicate từ chối yêu cầu";
      return { error: msg, status: 502 };
    }

    const deadline = Date.now() + 280_000;
    while (
      (pred.status === "starting" || pred.status === "processing") &&
      pred.urls?.get &&
      Date.now() < deadline
    ) {
      await new Promise((r) => setTimeout(r, 2000));
      res = await fetch(pred.urls.get, { headers: { Authorization: `Bearer ${token}` } });
      pred = (await res.json()) as ReplicatePrediction;
    }

    if (pred.status !== "succeeded") {
      return { error: pred.error || `Flux thất bại (trạng thái: ${pred.status})`, status: 502 };
    }
    const urls = collectUrls(pred.output);
    if (urls.length === 0) return { error: "Flux không trả về ảnh", status: 502 };
    return { images: urls };
  } catch (err) {
    console.error("Flux render error:", err);
    return {
      error: "Không kết nối được tới Replicate. Kiểm tra mạng và token.",
      status: 502,
    };
  }
}

export async function POST(req: Request) {
  let body: GenBody;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Body không hợp lệ" }, { status: 400 });
  }

  const { image, prompt } = body;
  if (typeof image !== "string" || !image.startsWith("data:image/")) {
    return Response.json({ error: "Thiếu ảnh đầu vào hợp lệ" }, { status: 400 });
  }
  if (typeof prompt !== "string" || !prompt.trim()) {
    return Response.json({ error: "Thiếu prompt render" }, { status: 400 });
  }
  const negativePrompt = typeof body.negativePrompt === "string" ? body.negativePrompt : "";
  const count = Math.min(MAX_RENDER_IMAGES, Math.max(1, Math.round(body.count ?? 1)));
  const resolution = typeof body.resolution === "string" ? body.resolution : "";
  const modelId = body.model || "gemini-image-pro";

  // --- Flux + ControlNet (cloud) ---
  if (modelId === "flux-controlnet") {
    const out = await generateWithFlux(image, prompt.trim(), negativePrompt, count, resolution);
    if (out.error) {
      return Response.json({ error: out.error, code: out.code }, { status: out.status ?? 502 });
    }
    return Response.json({ images: out.images });
  }

  // --- Gemini img2img (Pro / Flash) ---
  const geminiModel = geminiImageModelId(modelId);
  if (!geminiModel) {
    return Response.json({ error: "Model render không hợp lệ" }, { status: 400 });
  }
  const parsed = parseDataUrl(image);
  if (!parsed) {
    return Response.json({ error: "Ảnh đầu vào không hợp lệ" }, { status: 400 });
  }
  try {
    const images = await generateWithGemini(geminiModel, parsed, prompt.trim(), negativePrompt, count, resolution);
    if (images.length === 0) {
      return Response.json(
        { error: "AI không trả về ảnh. Thử lại, đổi model, hoặc chỉnh prompt." },
        { status: 502 }
      );
    }
    return Response.json({ images });
  } catch (error) {
    console.error("Gemini render error:", error);
    return Response.json(
      { error: geminiErrorMessage(error), code: geminiErrorCode(error) },
      { status: 502 }
    );
  }
}
