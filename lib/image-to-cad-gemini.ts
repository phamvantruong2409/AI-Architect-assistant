import { getGeminiModel, generateContentRetry } from "@/lib/gemini";
import type {
  CadDimension,
  CadFeature,
  CadFurniture,
  CadOpening,
  CadPlan,
  CadRoom,
  CadWall,
  FeatureKind,
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
      // thickness 0 (hoặc cờ single) = TƯỜNG 1 NÉT THẤY: giữ nguyên, KHÔNG làm dày.
      const rawT = n(c.thickness, 100);
      const single = c.single === true || rawT <= 0;
      return {
        x1: n(c.x1),
        y1: n(c.y1),
        x2: n(c.x2),
        y2: n(c.y2),
        thickness: single ? 0 : snapThickness(rawT),
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

const FEATURE_KINDS: ReadonlySet<string> = new Set<FeatureKind>([
  "stairs",
  "planter",
  "tree",
  "elevator",
  "void",
  "ramp",
  "pond",
  "column",
]);

function normalizeFeatures(raw: unknown): CadFeature[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((fEntry) => {
      const c = fEntry as Record<string, unknown>;
      const kind = typeof c.kind === "string" ? c.kind : "";
      if (!FEATURE_KINDS.has(kind)) return null;
      const steps = Math.round(n(c.steps, 0));
      const label = typeof c.label === "string" && c.label.trim() ? c.label.trim() : undefined;
      return {
        kind: kind as FeatureKind,
        x: n(c.x),
        y: n(c.y),
        width: Math.max(100, n(c.width, 1000)),
        depth: Math.max(100, n(c.depth, 1000)),
        rotation: n(c.rotation),
        ...(steps > 0 ? { steps } : {}),
        ...(label ? { label } : {}),
      };
    })
    .filter((x): x is CadFeature => x !== null);
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
 * tiếng Việt có cấu trúc, để người dùng ĐỌC & SỬA trước khi dựng hình. KHÔNG tạo sinh
 * toạ độ ở bước này — chỉ nhận diện & diễn giải công năng/bố cục/kích thước.
 */
export async function describePlan(req: ImageToCadRequest): Promise<PlanAnalysis> {
  const model = getGeminiModel();

  const prompt = `Bạn là KIẾN TRÚC SƯ. Nhìn kỹ ẢNH MẶT BẰNG đính kèm và MÔ TẢ LẠI mặt bằng có gì, bằng tiếng Việt, để một KTS khác đọc và hiểu chính xác. ĐÂY LÀ BƯỚC PHÂN TÍCH — KHÔNG cần toạ độ, KHÔNG cần JSON hình học.

YÊU CẦU NỘI DUNG "description" (văn bản nhiều dòng, rõ ràng, đúng những gì NHÌN THẤY):
- Dòng đầu: loại công trình (nhà ống/biệt thự/căn hộ…), số tầng thể hiện, kích thước bao tổng ƯỚC LƯỢNG (rộng × dài, mét). Đọc số kích thước ghi trên bản vẽ nếu có; nếu không có thì ước lượng hợp lý theo công năng.
- Liệt kê TỪNG PHÒNG theo thứ tự (đánh số), mỗi phòng 1–2 dòng gồm: TÊN phòng, DIỆN TÍCH ước lượng (m²), VỊ TRÍ tương đối (giáp phòng nào / phía nào), CỬA ĐI & CỬA SỔ (rộng bao nhiêu, thông sang đâu), NỘI THẤT nhìn thấy hoặc nên có theo công năng.
- Nêu CẤU KIỆN/CÔNG NĂNG đặc biệt thấy được: cầu thang (vị trí, hướng lên, số bậc nếu đếm được), thang máy, ô thông tầng/giếng trời, dốc/ram dắt xe, bồn cây/bồn hoa, cây xanh, hồ nước/bể cảnh, cột.
- Nêu rõ chỗ NGHI NGỜ / mờ / không chắc để người dùng sửa.

GHI CHÚ NGƯỜI DÙNG VẼ TAY: Ảnh có thể có nét vẽ/mũi tên/khoanh tròn/chữ do người dùng GHI THÊM (thường màu đỏ/xanh, nét tay) để chỉ rõ ý — vd khoanh vùng phòng, mũi tên chiều mở cửa, ghi tên phòng hay số đo ("tường 200", "WC"). Đây CHỈ là CHỈ DẪN cách đọc/diễn giải bản vẽ in sẵn, có ƯU TIÊN CAO: mô tả theo đúng ý đó, nếu mâu thuẫn với hình in thì THEO ghi chú tay. TUYỆT ĐỐI KHÔNG coi bản thân các nét khoanh/mũi tên/chữ này là tường/cửa/phòng/đồ vật có thật — chúng KHÔNG phải đối tượng trên mặt bằng, chỉ là chú thích.

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
1) "walls" — TIM tường, mỗi đoạn { "x1","y1","x2","y2", "thickness" } (mm). Giữ GÓC VUÔNG nơi vuông góc; các đoạn tường gặp nhau DÙNG CHUNG toạ độ điểm góc. Làm tròn toạ độ về bội số 50mm.
   - Nếu bản vẽ thể hiện tường bằng 2 NÉT (có bề dày) hoặc tô đặc: thickness chọn 1 trong 3 giá trị 100/150/200 (tường ngăn nhẹ 100, tường thường 150, tường bao 200).
   - Nếu bản vẽ CHỈ vẽ tường bằng 1 NÉT MẢNH (sơ đồ nét đơn, không thể hiện bề dày): đặt "thickness": 0 — giữ ĐÚNG 1 nét thấy, KHÔNG tự bịa bề dày. Cả bản vẽ nét đơn thì để 0 cho TẤT CẢ tường.
2) "openings" — CỬA trên tường: { "kind": "door"|"window", "x","y": tâm lỗ mở nằm TRÊN tim đoạn tường, "width", "wallIndex": chỉ số đoạn tường (0-based) chứa cửa, "hinge": "left"|"right", "swing": "in"|"out" }. Bắt buộc x,y nằm đúng trên đoạn tường wallIndex. Cửa đi phòng mặc định rộng 900; cửa đi nhà vệ sinh mặc định rộng 750. Lối mở/cửa chính RỘNG > 1000mm cứ khai "kind":"door" với width thật — ứng dụng sẽ để TRỐNG lỗ (không vẽ cánh).
3) "rooms" — mỗi PHÒNG là đa giác KÍN: { "name": tên tiếng Việt, "area": m², "points": [[x,y],...] }. Tên: Phòng khách, Phòng ngủ, Bếp, WC, Hành lang, Ban công, Logia... BAN CÔNG (thường nhô ra, 1 cạnh giáp tường nhà, 3 cạnh HỞ) và LOGIA (thụt vào, 3 cạnh giáp tường, 1 cạnh HỞ): đặt tên đúng "Ban công"/"Logia"; CHỈ tạo tường ("walls") ở cạnh GIÁP TƯỜNG — KHÔNG tạo tường ở cạnh hở (ứng dụng tự vẽ lan can ở cạnh hở).
4) "furniture" — chỉ LIỆT KÊ những món nội thất NÊN CÓ theo công năng từng phòng (KHÔNG cần đặt đúng vị trí — ứng dụng sẽ xếp chúng thành 1 khay block phía trên mặt bằng để người dùng tự kéo vào). Mỗi món { "kind", "x":0, "y":0, "width","depth": kích thước thật (mm), "rotation":0 }. CHỈ dùng "kind" trong danh sách: bed_double, bed_single, sofa, table_dining, table_coffee, desk, wardrobe, kitchen_counter, stove, fridge, sink, toilet, lavabo, shower, bathtub, lounge_chair, car. Chọn đúng món theo phòng (giường+tủ quần áo→phòng ngủ; sofa+bàn trà+ghế thư giãn(lounge_chair)→phòng khách; kitchen_counter+stove+sink+fridge+bàn ăn(table_dining)→bếp; toilet+lavabo+shower/bathtub→WC). x,y,rotation cứ để 0 — KHÔNG cần tính toạ độ cho nội thất.
5) "features" — CÔNG NĂNG / CẤU KIỆN khác (ĐẶT ĐÚNG VỊ TRÍ thấy trên ảnh, khác nội thất). Mỗi cái { "kind", "x","y": tâm thật trên mặt bằng (mm), "width","depth": kích thước phủ bì (mm), "rotation": góc xoay (với cầu thang/ram: hướng ĐI LÊN = +Y cục bộ sau khi xoay), "steps": số bậc (chỉ cầu thang/ram), "label": nhãn tuỳ chọn }. CHỈ dùng "kind" trong: stairs (cầu thang), planter (bồn cây/bồn hoa), tree (cây), elevator (thang máy), void (ô thông tầng/giếng trời), ramp (dốc/ram dắt xe), pond (hồ nước/bể cảnh), column (cột). Nhận diện ĐÚNG vị trí & kích thước; cầu thang ước số bậc theo chiều dài (~250–300mm/bậc) nếu không đếm được. Cột đặt ở giao tường/đầu trục, phủ bì ~220x220 nếu không rõ.
6) "dimensions" — KHÔNG cần tính kích thước nữa (ứng dụng TỰ dựng 2 đường dim theo vị trí tường: đường trong dim từng nhịp giao tường, đường ngoài dim tổng). Cứ trả [] cho gọn.
7) "width","height" — kích thước bao tổng (mm).

GHI CHÚ NGƯỜI DÙNG VẼ TAY (QUAN TRỌNG): Ảnh có thể có nét vẽ/mũi tên/khoanh tròn/chữ do người dùng GHI THÊM (nét tay, thường màu đỏ/xanh) để chỉ rõ ý — khoanh vùng, mũi tên chiều mở cửa, ghi tên phòng hay số đo ("tường 200", "WC", "cửa 900"). Đây CHỈ là CHỈ DẪN cách đọc bản vẽ (ưu tiên cao): dùng để xác định/sửa thuộc tính của tường/cửa/phòng IN SẴN, nếu mâu thuẫn với hình in thì THEO ghi chú tay (và theo bản phân tích đã xác nhận nếu có). TUYỆT ĐỐI KHÔNG vectorize chính các nét khoanh/mũi tên/chữ tay này thành "walls"/"openings"/"rooms"/"furniture"/"features" — chúng KHÔNG phải đối tượng hình học. Mọi toạ độ hình học CHỈ lấy từ nét IN của mặt bằng; vd mũi tên đỏ chỉ chiều mở cửa thì chỉnh "swing"/"hinge" của cửa đó, KHÔNG tạo thêm tường theo mũi tên.

QUY TẮC:
- CHỈ dựng thứ NHÌN THẤY; ưu tiên TƯỜNG ĐÚNG (vị trí, bề dày, góc vuông, dùng chung điểm góc) & TỈ LỆ NHẤT QUÁN. Đây là phần quan trọng nhất. Nội thất chỉ cần liệt kê đúng món theo công năng (không cần toạ độ). Features thì PHẢI đặt đúng vị trí.
- Mọi toạ độ là SỐ mm. Nếu ảnh không phải mặt bằng, trả mảng rỗng + ghi lý do vào "notes".

Trả về JSON THUẦN TÚY (không markdown), đúng cấu trúc:
{
  "title": "...",
  "width": 10000, "height": 8000,
  "walls": [ { "x1":0,"y1":0,"x2":10000,"y2":0,"thickness":200 } ],
  "openings": [ { "kind":"door","x":3000,"y":0,"width":900,"wallIndex":0,"hinge":"left","swing":"in" } ],
  "rooms": [ { "name":"Phòng khách","area":18.5,"points":[[0,0],[4000,0],[4000,4000],[0,4000]] } ],
  "furniture": [ { "kind":"sofa","x":0,"y":0,"width":1800,"depth":800,"rotation":0 } ],
  "features": [ { "kind":"stairs","x":8000,"y":3000,"width":1100,"depth":2700,"rotation":0,"steps":16 }, { "kind":"tree","x":1000,"y":1000,"width":900,"depth":900,"rotation":0 } ],
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
  const features = normalizeFeatures(parsed.features);
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
    features,
    dimensions,
    notes,
  };
}
