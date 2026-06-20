// Upscale qua Replicate cho các engine cloud: SUPIR và SeedVR2.
// Real-ESRGAN chạy local trong Electron (xem electron/main.js) nên KHÔNG đi qua route này.
//
// Cấu hình trong .env.local:
//   REPLICATE_API_TOKEN=r8_xxx               (bắt buộc cho cả 2 engine cloud)
//   REPLICATE_SUPIR_MODEL=cjwbw/supir        (tùy chọn)
//   REPLICATE_SEEDVR2_MODEL=zsxkib/seedvr2   (tùy chọn)

export const maxDuration = 300; // diffusion cloud có thể chạy lâu

type CloudEngine = "supir" | "seedvr2";

// Mỗi engine → model Replicate + cách dựng input. Input params có thể cần
// chỉnh theo schema thật của model (verify khi đã có token).
const ENGINES: Record<CloudEngine, { envKey: string; model: string; input: (image: string, scale: number) => Record<string, unknown> }> = {
  supir: {
    envKey: "REPLICATE_SUPIR_MODEL",
    model: "cjwbw/supir",
    input: (image, scale) => ({ image, upscale: scale }),
  },
  seedvr2: {
    envKey: "REPLICATE_SEEDVR2_MODEL",
    model: "zsxkib/seedvr2",
    input: (image) => ({ image }),
  },
};

interface ReplicatePrediction {
  id: string;
  status: "starting" | "processing" | "succeeded" | "failed" | "canceled";
  output?: string | string[] | null;
  error?: string | null;
  urls?: { get?: string };
}

function firstUrl(output: ReplicatePrediction["output"]): string | null {
  if (!output) return null;
  if (typeof output === "string") return output;
  if (Array.isArray(output)) return output.find((x) => typeof x === "string") ?? null;
  return null;
}

export async function POST(req: Request) {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) {
    return Response.json(
      {
        error:
          "Chưa cấu hình REPLICATE_API_TOKEN. Thêm token vào .env.local để dùng engine cloud (SUPIR / SeedVR2).",
        code: "no_token",
      },
      { status: 400 }
    );
  }

  let body: { image?: string; scale?: number; engine?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Body không hợp lệ" }, { status: 400 });
  }

  const { image, scale = 2 } = body;
  const engine: CloudEngine = body.engine === "seedvr2" ? "seedvr2" : "supir";
  if (typeof image !== "string" || !image.startsWith("data:image/")) {
    return Response.json({ error: "Thiếu ảnh đầu vào hợp lệ" }, { status: 400 });
  }

  const cfg = ENGINES[engine];
  const model = process.env[cfg.envKey] || cfg.model;
  const engineName = engine.toUpperCase();

  try {
    // Tạo prediction. Prefer: wait = chờ đồng bộ tối đa 60s; nếu chưa xong thì poll tiếp.
    let res = await fetch(`https://api.replicate.com/v1/models/${model}/predictions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Prefer: "wait",
      },
      body: JSON.stringify({ input: cfg.input(image, scale) }),
    });

    let pred = (await res.json()) as ReplicatePrediction;
    if (!res.ok) {
      const msg = (pred as unknown as { detail?: string })?.detail || "Replicate từ chối yêu cầu";
      return Response.json({ error: msg }, { status: 502 });
    }

    // Poll đến khi xong (Prefer: wait có thể trả về khi vẫn đang chạy).
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
      return Response.json(
        { error: pred.error || `${engineName} thất bại (trạng thái: ${pred.status})` },
        { status: 502 }
      );
    }

    const url = firstUrl(pred.output);
    if (!url) {
      return Response.json({ error: `${engineName} không trả về ảnh` }, { status: 502 });
    }

    return Response.json({ image: url });
  } catch (err) {
    console.error(`${engineName} upscale error:`, err);
    return Response.json(
      { error: `Không kết nối được tới dịch vụ ${engineName}. Kiểm tra mạng và token.` },
      { status: 502 }
    );
  }
}
