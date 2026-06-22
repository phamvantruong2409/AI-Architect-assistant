import { getGeminiModel, generateContentRetry } from "@/lib/gemini";
import type {
  CadDimension,
  CadFurniture,
  CadOpening,
  CadPlan,
  CadRoom,
  CadWall,
  FurnitureKind,
  ImageToCadRequest,
  PlanAnalysis,
} from "@/lib/image-to-cad-types";

/** Bỏ rào ```json ... ``` nếu model lỡ bọc markdown quanh JSON. */
function stripFence(text: string): string {
  return text
    .replace(/^```json\n?/, "")
    .replace(/^```\n?/, "")
    .replace(/\n?```$/, "")
    .trim();
}

function n(v: unknown, dflt = 0): number {
  const x = Number(v);
  return Number.isFinite(x) ? x : dflt;
}

const FURNITURE_KINDS: ReadonlySet<string> = new Set<FurnitureKind>([
  "bed_double",
  "bed_single",
  "sofa",
  "table_dining",
  "table_coffee",
  "desk",
  "wardrobe",
  "kitchen_counter",
  "stove",
  "fridge",
  "sink",
  "toilet",
  "lavabo",
  "shower",
  "bathtub",
  "lounge_chair",
  "car",
]);

/** Nắn bề dày tường về 1 trong 3 mức chuẩn 100/150/200mm (gần nhất). */
function snapThickness(v: number): number {
  const t = n(v, 100);
  const opts = [100, 150, 200];
  return opts.reduce((best, o) => (Math.abs(o - t) < Math.abs(best - t) ? o : best), 100);
}

function normalizeWalls(raw: unknown): CadWall[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((w) => {
      const c = w as Record<string, unknown>;
      return {
        x1: n(c.x1),
        y1: n(c.y1),
        x2: n(c.x2),
        y2: n(c.y2),
        thickness: snapThickness(n(c.thickness, 100)),
      };
    })
    .filter((w) => Math.hypot(w.x2 - w.x1, w.y2 - w.y1) > 1);
}

function normalizeOpenings(raw: unknown, wallCount: number): CadOpening[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((o) => {
      const c = o as Record<string, unknown>;
      const kind = c.kind === "window" ? "window" : "door";
      const hinge = c.hinge === "right" ? "right" : "left";
      const swing = c.swing === "out" ? "out" : "in";
      return {
        kind: kind as CadOpening["kind"],
        x: n(c.x),
        y: n(c.y),
        width: Math.max(300, n(c.width, kind === "window" ? 1200 : 900)),
        wallIndex: Math.round(n(c.wallIndex, -1)),
        hinge: hinge as CadOpening["hinge"],
        swing: swing as CadOpening["swing"],
      };
    })
    .filter((o) => o.wallIndex >= 0 && o.wallIndex < wallCount);
}

function normalizeRooms(raw: unknown): CadRoom[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((r) => {
      const c = r as Record<string, unknown>;
      const pts = Array.isArray(c.points)
        ? c.points
            .map((p) => (Array.isArray(p) ? ([n(p[0]), n(p[1])] as [number, number]) : null))
            .filter((p): p is [number, number] => p !== null)
        : [];
      return {
        name: typeof c.name === "string" && c.name.trim() ? c.name.trim() : "Phòng",
        area: Math.max(0, n(c.area)),
        points: pts,
      };
    })
    .filter((r) => r.points.length >= 3);
}

function normalizeFurniture(raw: unknown): CadFurniture[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((fEntry) => {
      const c = fEntry as Record<string, unknown>;
      const kind = typeof c.kind === "string" ? c.kind : "";
      if (!FURNITURE_KINDS.has(kind)) return null;
      return {
        kind: kind as FurnitureKind,
        x: n(c.x),
        y: n(c.y),
        width: Math.max(100, n(c.width, 600)),
        depth: Math.max(100, n(c.depth, 600)),
        rotation: n(c.rotation),
      };
    })
    .filter((x): x is CadFurniture => x !== null);
}

function normalizeDimensions(raw: unknown): CadDimension[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((d) => {
      const c = d as Record<string, unknown>;
      const text = typeof c.text === "string" && c.text.trim() ? c.text.trim() : undefined;
      return { x1: n(c.x1), y1: n(c.y1), x2: n(c.x2), y2: n(c.y2), text };
    })
    .filter((d) => Math.hypot(d.x2 - d.x1, d.y2 - d.y1) > 1);
}

/**
 * BƯỚC 1 (trung gian) — đọc ẢNH MẶT BẰNG và mô tả "mặt bằng có gì" thành VĂN BẢN
 * tiếng Việt có cấu trúc, để người dùng ĐỌC & SỬA trước khi dựng hình. KHÔNG sinh
 * toạ độ ở bước này — chỉ nhận diện & diễn giải công năng/bố cục/kích thước.
 */
export async function describePlan(req: ImageToCadRequest): Promise<PlanAnalysis> {
  const model = getGeminiModel();

  const prompt = `Bạn là KIẾN TRÚC SƯ. Nhìn kỹ ẢNH MẶT BẰNG đính kèm và MÔ TẢ LẠI mặt bằng có gì, bằng tiếng Việt, để một KTS khác đọc và hiểu chính xác. ĐÂY LÀ BƯỚC PHÂN TÍCH — KHÔNG cần toạ độ, KHÔNG cần JSON hình học.

YÊU CẦU NỘI DUNG "description" (văn bản nhiều dòng, rõ ràng, đúng những gì NHÌN THẤY):
- Dòng đầu: loại công trình (nhà ống/biệt thự/căn hộ…), số tầng thể hiện, kích thước bao tổng ƯỚC LƯỢNG (rộng × dài, mét). Đọc số kích thước ghi trên bản vẽ nếu có; nếu không có thì ước lượng hợp lý theo công năng.
- Liệt kê TỪNG PHÒNG theo thứ tự (đánh số), mỗi phòng 1–2 dòng gồm: TÊN phòng, DIỆN TÍCH ước lượng (m²), VỊ TRÍ tương đối (giáp phòng nào / phía nào), CỬA ĐI & CỬA SỔ (rộng bao nhiêu, thông sang đâu), NỘI THẤT nhìn thấy hoặc nên có theo công năng.
- Nêu rõ chỗ NGHI NGỜ / mờ / không chắc để người dùng sửa.

QUY TẮC:
- Chỉ mô tả thứ NHÌN THẤY trên ảnh; không bịa thêm phòng.
- Dùng đơn vị mm cho cửa (vd cửa đi 900, cửa WC 750, cửa sổ 1200) và m²/m cho phòng.
- Nếu ảnh KHÔNG phải mặt bằng, để "description" rỗng và ghi lý do vào "notes".

Trả về JSON THUẦN TÚY (không markdown), đúng cấu trúc:
{
  "title": "Mặt bằng nhà ống 5x12",
  "description": "MẶT BẰNG: Nhà ống 1 tầng, ~5.0 x 12.0 m.\\n\\nCÁC PHÒNG:\\n1. Sân trước (~10 m²): để xe, cổng rộng ~2700 ra mặt đường.\\n2. Phòng khách (~18 m²): nối sân qua cửa đi 900; kê sofa áp tường trái, bàn trà.\\n...",
  "notes": ""
}
Chỉ trả về JSON.`;

  const result = await generateContentRetry(model, [
    prompt,
    { inlineData: { mimeType: req.mimeType, data: req.imageBase64 } },
  ]);

  const parsed = JSON.parse(stripFence(result.response.text().trim())) as Record<string, unknown>;

  const description = typeof parsed.description === "string" ? parsed.description.trim() : "";
  const notes = typeof parsed.notes === "string" ? parsed.notes.trim() : "";

  if (!description) {
    throw new Error(
      notes
        ? `AI không phân tích được mặt bằng: ${notes}`
        : "AI không nhận diện được mặt bằng trong ảnh. Hãy thử ảnh mặt bằng rõ nét hơn."
    );
  }

  return {
    title:
      typeof parsed.title === "string" && parsed.title.trim()
        ? parsed.title.trim()
        : "Mặt bằng số hoá",
    description,
    notes: notes || undefined,
  };
}

/**
 * BƯỚC 2 — Image to AutoCAD — nhìn ẢNH MẶT BẰNG, đóng vai KTS, dò TƯỜNG (có bề dày) +
 * CỬA + PHÒNG + NỘI THẤT + KÍCH THƯỚC, dựng mô hình toạ độ mm (gốc dưới-trái, Y hướng
 * lên). Nếu có req.analysis (bản phân tích người dùng đã xác nhận) thì DỰNG THEO mô tả
 * đó là ưu tiên cao nhất, ảnh chỉ để tham chiếu vị trí & tỉ lệ.
 */
export async function analyzePlan(req: ImageToCadRequest): Promise<CadPlan> {
  const model = getGeminiModel();

  const brief = req.analysis?.trim()
    ? `\nBẢN PHÂN TÍCH ĐÃ ĐƯỢC KTS XÁC NHẬN (ƯU TIÊN TUYỆT ĐỐI — dựng ĐÚNG theo mô tả này về số phòng, tên, công năng, cửa, nội thất; ảnh chỉ để tham chiếu vị trí & tỉ lệ; nếu ảnh khác mô tả thì THEO MÔ TẢ):\n"""\n${req.analysis.trim()}\n"""\n`
    : "";

  const prompt = `Bạn là KIẾN TRÚC SƯ chuyên SỐ HOÁ MẶT BẰNG (vectorize) sang bản vẽ kỹ thuật AutoCAD. Nhìn ẢNH MẶT BẰNG đính kèm và dựng lại thành dữ liệu hình học.
${brief}

HỆ TOẠ ĐỘ:
- Đơn vị MILIMET (mm). Gốc (0,0) ở GÓC DƯỚI-TRÁI. Trục X sang phải, trục Y HƯỚNG LÊN (quy ước CAD, KHÔNG phải toạ độ ảnh).
- Xác định TỈ LỆ thật: đọc số kích thước ghi trên bản vẽ (nếu có). Nếu không có, ƯỚC LƯỢNG hợp lý theo công năng (phòng ngủ ~3000–4000, hành lang ~1200, cửa đi ~900, cửa sổ ~1200, tường ~100–200mm).

CẦN DỰNG:
1) "walls" — TIM tường, mỗi đoạn { "x1","y1","x2","y2", "thickness" } (mm). Giữ GÓC VUÔNG nơi vuông góc; các đoạn tường gặp nhau DÙNG CHUNG toạ độ điểm góc. Làm tròn toạ độ về bội số 50mm. thickness CHỈ chọn 1 trong 3 giá trị 100/150/200 (tường ngăn nhẹ 100, tường thường 150, tường bao 200).
2) "openings" — CỬA trên tường: { "kind": "door"|"window", "x","y": tâm lỗ mở nằm TRÊN tim đoạn tường, "width", "wallIndex": chỉ số đoạn tường (0-based) chứa cửa, "hinge": "left"|"right", "swing": "in"|"out" }. Bắt buộc x,y nằm đúng trên đoạn tường wallIndex. Cửa đi phòng mặc định rộng 900; cửa đi nhà vệ sinh mặc định rộng 750.
3) "rooms" — mỗi PHÒNG là đa giác KÍN: { "name": tên tiếng Việt, "area": m², "points": [[x,y],...] }. Tên: Phòng khách, Phòng ngủ, Bếp, WC, Hành lang, Ban công...
4) "furniture" — NỘI THẤT bố trí theo công năng phòng, mỗi món { "kind", "x","y": tâm, "width","depth": kích thước (mm), "rotation": góc xoay độ }. CHỈ dùng "kind" trong danh sách: bed_double, bed_single, sofa, table_dining, table_coffee, desk, wardrobe, kitchen_counter, stove, fridge, sink, toilet, lavabo, shower, bathtub, lounge_chair, car. Đặt đúng phòng (giường+tủ quần áo→phòng ngủ; sofa+bàn trà+ghế thư giãn(lounge_chair)→phòng khách; kitchen_counter+stove+sink+fridge+bàn ăn(table_dining)→bếp; toilet+lavabo+shower/bathtub→WC). QUY TẮC BỐ TRÍ: nội thất nằm HẲN TRONG phòng, KHÔNG đè lên tường, KHÔNG chồng lên nhau; món áp tường thì áp SÁT MẶT TRONG tường. "rotation" xoay sao cho LƯNG món đồ (cạnh nên quay vào tường) hướng ra tường gần nhất: giường quay đầu giường vào tường, bồn cầu/lavabo/bếp/tủ lạnh/bồn rửa quay lưng vào tường. Bếp (kitchen_counter) bề SÂU mặc định 600, bề rộng kéo dài theo tường bếp.
5) "dimensions" — kích thước chính: { "x1","y1","x2","y2" } đặt ở mép ngoài tường (để trống "text" cho AutoCAD tự đo).
6) "width","height" — kích thước bao tổng (mm).

QUY TẮC:
- CHỈ dựng thứ NHÌN THẤY; ưu tiên ĐÚNG hình học & TỈ LỆ NHẤT QUÁN. Nội thất đặt hợp công năng, không chồng tường.
- Mọi toạ độ là SỐ mm. Nếu ảnh không phải mặt bằng, trả mảng rỗng + ghi lý do vào "notes".

Trả về JSON THUẦN TÚY (không markdown), đúng cấu trúc:
{
  "title": "...",
  "width": 10000, "height": 8000,
  "walls": [ { "x1":0,"y1":0,"x2":10000,"y2":0,"thickness":200 } ],
  "openings": [ { "kind":"door","x":3000,"y":0,"width":900,"wallIndex":0,"hinge":"left","swing":"in" } ],
  "rooms": [ { "name":"Phòng khách","area":18.5,"points":[[0,0],[4000,0],[4000,4000],[0,4000]] } ],
  "furniture": [ { "kind":"sofa","x":2000,"y":600,"width":1800,"depth":800,"rotation":0 } ],
  "dimensions": [ { "x1":0,"y1":-600,"x2":10000,"y2":-600 } ],
  "notes": ""
}
Chỉ trả về JSON.`;

  const result = await generateContentRetry(model, [
    prompt,
    { inlineData: { mimeType: req.mimeType, data: req.imageBase64 } },
  ]);

  const parsed = JSON.parse(stripFence(result.response.text().trim())) as Record<string, unknown>;

  const walls = normalizeWalls(parsed.walls);
  const openings = normalizeOpenings(parsed.openings, walls.length);
  const rooms = normalizeRooms(parsed.rooms);
  const furniture = normalizeFurniture(parsed.furniture);
  const dimensions = normalizeDimensions(parsed.dimensions);
  const notes = typeof parsed.notes === "string" ? parsed.notes : undefined;

  if (walls.length === 0 && rooms.length === 0) {
    throw new Error(
      notes?.trim()
        ? `AI không dựng được mặt bằng: ${notes.trim()}`
        : "AI không nhận diện được tường/phòng nào trong ảnh. Hãy thử ảnh mặt bằng rõ nét hơn."
    );
  }

  let width = n(parsed.width);
  let height = n(parsed.height);
  if (width <= 0 || height <= 0) {
    let maxX = 0;
    let maxY = 0;
    for (const w of walls) {
      maxX = Math.max(maxX, w.x1, w.x2);
      maxY = Math.max(maxY, w.y1, w.y2);
    }
    for (const r of rooms) {
      for (const [x, y] of r.points) {
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
    width = width > 0 ? width : maxX;
    height = height > 0 ? height : maxY;
  }

  return {
    title:
      typeof parsed.title === "string" && parsed.title.trim()
        ? parsed.title.trim()
        : "Mặt bằng số hoá",
    width,
    height,
    walls,
    openings,
    rooms,
    furniture,
    dimensions,
    notes,
  };
}
