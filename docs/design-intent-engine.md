# AI Design Intent Engine — Bản thiết kế kỹ thuật

> Trạng thái: **THIẾT KẾ (chưa code)** · Phiên bản 0.1 · 2026-06-24
>
> Mục tiêu: biến **ảnh mặt bằng** + **ảnh SketchUp nội thất thô** → một **DesignIntent**
> có cấu trúc → một **render-ready prompt**, để đưa vào pipeline render đã có
> (`/api/render/generate`). Đây KHÔNG phải AI Render; đây là lớp HIỂU Ý ĐỒ nằm trước nó.
>
> *(v0.1 dùng PDF; đổi sang ẢNH mặt bằng để đồng nhất pipeline ảnh sẵn có và bỏ phụ thuộc
> đọc PDF.)*

---

## 0. Nguyên tắc thiết kế

1. **Tái dùng, không viết lại.** Pipeline sinh ảnh (`/api/render/generate`, Gemini img2img /
   Flux) và hàm ghép prompt (`buildRenderPrompt`) giữ nguyên. Engine này chỉ thêm phần
   *đầu vào* (đọc PDF) và *suy luận ý đồ*.
2. **Tách nội thất khỏi ngoại thất.** Module render hiện tại (`lib/render-gemini.ts`) thiên
   NGOẠI THẤT (số tầng, mặt tiền, bầu trời, bao cảnh). Engine này là flow NỘI THẤT riêng,
   không sửa đè. Hai flow chia sẻ chung tầng dưới (generate) nhưng khác tầng phân tích.
3. **Giữ nguyên kiến trúc & camera, chỉ sáng tạo trang trí.** Mọi prompt phải khoá:
   tường/sàn/trần, vị trí cửa/cửa sổ, và GÓC CAMERA của ảnh SketchUp. Phần được phép sáng
   tạo: nội thất, vật liệu, ánh sáng, trang trí, cây, tranh, rèm, bảng màu.
4. **Một lần gọi vision cho phân tích.** Ảnh mặt bằng + ảnh SketchUp gửi chung trong một
   request Gemini để tiết kiệm lượt và giữ ngữ cảnh thống nhất (cả hai đều là `image/*`,
   không cần OCR riêng).

---

## 1. Luồng dữ liệu tổng thể

```
┌──────────────┐   ┌──────────────────────┐
│ Ảnh mặt bằng │   │ Ảnh SketchUp nội thất │   (1 phòng, 1 góc camera)
└──────┬───────┘   └───────────┬──────────┘
       │                       │
       └───────────┬───────────┘
                   ▼
   ┌──────────────────────────────────────┐   STEP 1+2 — 1 lần gọi Gemini vision
   │  analyzeDesignIntent(planImg, scene)  │   (2 ảnh trong cùng request)
   └──────────────┬───────────────────────┘
                  ▼
        ┌───────────────────┐            STEP 3 — suy luận: gộp mặt bằng vào
        │   DesignIntent     │            không gian 3D, suy ra vật thiếu, hiểu
        │   (JSON có cấu trúc)│            chức năng phòng + hướng nhìn
        └─────────┬─────────┘
                  ▼
   ┌──────────────────────────────────┐   STEP 4 — gợi ý nội thất/vật liệu/ánh
   │  suggestions[] (toggle/sửa được)  │   sáng/trang trí, mỗi nhóm 1 toggle
   └──────────────┬───────────────────┘
                  ▼
   ┌──────────────────────────────────┐   STEP 5 — ghép prompt cuối
   │  buildInteriorPrompt(intent, …)   │   (mở rộng buildRenderPrompt)
   └──────────────┬───────────────────┘
                  ▼
        /api/render/generate  ───────────►  Ảnh render (KHÔNG đụng code có sẵn)
```

---

## 2. Schema `DesignIntent`

File mới: `lib/design-intent-types.ts`. Đây là bản nâng cấp của `RenderAnalysis`, bổ sung dữ
liệu đọc từ mặt bằng. Tất cả nội dung text bằng **tiếng Việt** (người dùng là KTS Việt).

```ts
/** Một món nội thất đọc/suy ra từ mặt bằng. */
export interface FurnitureItem {
  name: string;        // "sofa 3 chỗ", "bàn trà", "kệ tivi"
  zone?: string;       // "góc cửa sổ", "sát tường trái" — vị trí tương đối
  fromPlan: boolean;   // true = có trong mặt bằng; false = AI suy luận thêm
}

/** Kết quả phân tích ý đồ thiết kế từ PDF + ảnh SketchUp. */
export interface DesignIntent {
  // ---- STEP 1: từ PDF mặt bằng ----
  roomType: string;        // "phòng khách", "phòng ngủ master", "bếp + ăn"
  roomName: string;        // tên ghi trên bản vẽ nếu có
  roomSize: string;        // "3.6m x 4.2m" hoặc "~15m²" — đọc từ kích thước ghi chú
  furnitureLayout: FurnitureItem[];  // bố trí nội thất theo mặt bằng
  doors: string[];         // mô tả vị trí cửa đi
  windows: string[];       // mô tả vị trí cửa sổ
  circulation: string;     // mô tả lối đi / luồng di chuyển

  // ---- STEP 2: từ ảnh SketchUp ----
  architecture: {
    walls: string;         // mô tả tường thấy trong khung
    floor: string;
    ceiling: string;
    openings: string;      // cửa/cửa sổ thấy trong khung 3D
  };
  camera: {
    description: string;   // hướng nhìn suy từ ảnh ("nhìn từ cửa vào, hướng ra cửa sổ")
    keepExact: boolean;    // luôn true ở v1 — giữ y nguyên góc ảnh
  };

  // ---- STEP 3: ý đồ tổng hợp ----
  functionNote: string;    // hiểu chức năng/công năng phòng
  viewingDirection: string;// hướng nhìn chính của render

  // ---- STEP 4: concept sáng tạo (AI nội thất) ----
  suggestions: RenderSuggestion[];  // tái dùng type cũ: {id,label,text} toggle được
  styleHint: string;       // phong cách gợi ý ("hiện đại tối giản ấm")
  colorPalette: string;    // bảng màu chủ đạo

  // ---- meta / output ----
  title: string;           // tiêu đề ngắn 3–6 từ
  negativePrompt: string;  // lỗi cần tránh (đổi layout, lệch camera, méo phối cảnh…)
}
```

`RenderSuggestion` tái dùng nguyên từ `lib/render-types.ts` (`{ id, label, text }`).

### Vì sao tách `furnitureLayout` thành mảng object thay vì 1 đoạn text?
Để UI render được checklist "đồ trong mặt bằng" và phân biệt món **có sẵn** (giữ đúng vị trí)
với món **AI thêm** (người dùng được tắt). Đây là điểm mấu chốt để "giữ layout gốc".

---

## 3. Các nhóm `suggestions` (STEP 4)

Engine sinh 6–8 toggle, mỗi nhóm một khía cạnh (giống cơ chế đang chạy ở render ngoại thất,
nhưng đổi nội dung sang nội thất):

| label | Nội dung `text` mô tả |
|---|---|
| Nội thất chính | Chất liệu/kiểu dáng các món chính theo layout (giữ vị trí) |
| Vật liệu hoàn thiện | Sàn, tường, trần: gỗ/đá/sơn/giấy dán — chất & màu thực |
| Ánh sáng | Đèn hắt, đèn thả, ánh sáng tự nhiên qua cửa sổ; chất sáng ấm/trung tính |
| Trang trí & decor | Vật trang trí tiết chế hợp phong cách |
| Cây xanh trong nhà | Cây/chậu hợp khí hậu VN, tiết chế |
| Rèm cửa | Kiểu rèm hợp cửa sổ thấy trong khung |
| Tranh / artwork | Tranh treo tường hợp bảng màu |
| Hậu kỳ / chất ảnh | Độ nét, màu tự nhiên, khử cảm giác CGI |

Quy ước (kế thừa render hiện tại):
- `text` viết theo lối **khẳng định** (chỉ mô tả cái muốn có). Cái cần tránh dồn vào `negativePrompt`.
- Mỗi `text` ngắn (~15–25 từ); riêng "Vật liệu hoàn thiện" được dài hơn.
- Toggle "Cây xanh", "Trang trí", "Tranh" mặc định BẬT; người dùng tắt được.

---

## 4. Prompt cho engine (STEP 1+2+3+4 gộp 1 lần gọi)

Hàm `buildIntentPrompt()` trong `lib/design-intent.ts`. Khung prompt (rút gọn):

```
Bạn là KTS nội thất + chuyên gia diễn họa. Bạn nhận:
  (A) một ẢNH MẶT BẰNG bố trí nội thất của một phòng (bản vẽ 2D),
  (B) một ẢNH SketchUp THÔ của chính phòng đó (1 góc camera, chưa vật liệu/ánh sáng).

NHIỆM VỤ: đọc cả hai, hiểu Ý ĐỒ thiết kế, trả về JSON DesignIntent để dựng render.

QUY TẮC BẤT BIẾN:
- GIỮ NGUYÊN tường/sàn/trần, vị trí cửa & cửa sổ, và GÓC CAMERA của ảnh SketchUp.
  Không đổi khung hình, không xoay phòng, không dời tường.
- Bố trí nội thất phải BÁM mặt bằng (B là không gian 3D của chính mặt bằng A).
  Món nào mặt bằng có → đặt đúng khu vực, fromPlan=true.
  Món suy luận thêm cho hợp công năng → fromPlan=false.
- TẤT CẢ text tiếng Việt. Khẳng định, súc tích.

ĐỌC ẢNH MẶT BẰNG (A): roomType, roomName, roomSize (từ kích thước ghi chú trên bản vẽ),
  furnitureLayout (tên món + khu vực), doors, windows, circulation.
ĐỌC ẢNH SKETCHUP (B): architecture (walls/floor/ceiling/openings thấy trong khung),
  camera.description.
SUY LUẬN: functionNote, viewingDirection, styleHint, colorPalette.
GỢI Ý: suggestions[] 6–8 toggle (xem mục 3), negativePrompt, title.

Trả về JSON THUẦN (không markdown), đúng schema DesignIntent. Chỉ trả về JSON.
```

Lưu ý kỹ thuật khi gọi Gemini:
- Cả hai gửi dạng `inlineData` `image/*` (cùng cơ chế như `analyzeForRender` đang chạy) —
  không cần OCR hay xử lý PDF.
- Thứ tự gửi nên rõ ràng: gắn nhãn text "ẢNH MẶT BẰNG (A):" trước ảnh A và
  "ẢNH SKETCHUP (B):" trước ảnh B để model không lẫn hai ảnh.
- Parse JSON đi qua `stripFence` (đã có sẵn) để bỏ rào ```json.

---

## 5. STEP 5 — ghép prompt cuối

Hàm `buildInteriorPrompt()` (mở rộng `buildRenderPrompt` có sẵn):

```ts
function buildInteriorPrompt(intent: DesignIntent, enabled: RenderSuggestion[]): string {
  const parts = [
    // neo không gian + công năng, KHÔNG tả lại camera (đã keep)
    `Nội thất ${intent.roomType} (${intent.roomSize}), ${intent.styleHint}.`,
    `Giữ nguyên bố cục phòng, vị trí cửa/cửa sổ và góc nhìn như ảnh gốc.`,
    `Bố trí: ${intent.furnitureLayout.filter(f => f.fromPlan).map(f => f.name).join(", ")}.`,
    `Bảng màu: ${intent.colorPalette}.`,
  ];
  for (const s of enabled) if (s.text.trim()) parts.push(s.text.trim());
  parts.push("Ảnh render nội thất chân thực, ánh sáng tự nhiên, màu chính xác, chi tiết cao.");
  return parts.filter(Boolean).join(" ");
}
```

Prompt này + ảnh SketchUp gốc đưa vào `/api/render/generate` với `model: "gemini-image-pro"`
(giữ khối tốt nhất). Camera được khoá bằng câu "giữ nguyên góc nhìn" + negativePrompt.

---

## 6. API mới

`app/api/design-intent/route.ts` — POST, `maxDuration = 120`.

Request:
```ts
interface DesignIntentRequest {
  planImageBase64: string; // ảnh mặt bằng (bản vẽ 2D)
  planMime: string;        // "image/jpeg" | "image/png"
  sceneImageBase64: string;// ảnh SketchUp
  sceneMime: string;       // "image/jpeg" | "image/png"
  model?: GeminiModelId;   // mặc định "gemini-3-flash-preview" cho phân tích
}
```
Response: `DesignIntent` (mục 2). Lỗi đi qua `geminiErrorMessage/geminiErrorCode` như các route khác.

Pipeline sinh ảnh KHÔNG đổi: client gọi tiếp `/api/render/generate` với prompt từ STEP 5.

---

## 7. UI (cắm vào đâu)

Phương án đề xuất: thêm trang `app/(app)/render/interior/page.tsx` (hoặc một tab trong
trang render hiện có) với 3 vùng:

1. **Tải lên**: 1 ô ảnh mặt bằng + 1 ô ảnh SketchUp.
2. **Bảng ý đồ** (sau khi phân tích): hiển thị `roomType/roomSize`, checklist
   `furnitureLayout` (đánh dấu món AI thêm), bảng màu, và các `suggestions` dạng toggle —
   tái dùng đúng component toggle của trang render hiện tại.
3. **Render**: nút dựng prompt (STEP 5) → gọi generate → lưới ảnh kết quả (đã có sẵn).

Tái dùng được gần như toàn bộ UI render hiện tại; chỉ thêm ô upload PDF và bảng layout.

---

## 8. Phạm vi v1 vs về sau

**v1 (làm trước):**
- 1 phòng, 1 ảnh SketchUp, 1 ảnh mặt bằng.
- Camera: đoán từ ảnh + khoá bằng prompt ("keep"). Không đọc thông số camera thật.
- Backend phân tích: Gemini 3 Flash; render: Gemini 3 Pro Image (đã wired).

**Về sau (v2+):**
- Xuất camera/hình học CHÍNH XÁC từ SketchUp qua Ruby API → JSON (thay vì đoán từ ảnh).
- Nhiều phòng / nhiều góc trong một dự án, đồng bộ phong cách (`maintainStyleConsistency`).
- ControlNet (Flux) khoá hình học cứng hơn cho nội thất.
- Nối với module Concept/Briefing để lấy phong cách dự án thay vì đoán.

---

## 9. Danh sách file sẽ tạo/sửa (khi code)

| File | Hành động | Ghi chú |
|---|---|---|
| `lib/design-intent-types.ts` | tạo | schema `DesignIntent`, `FurnitureItem` |
| `lib/design-intent.ts` | tạo | `analyzeDesignIntent()`, `buildIntentPrompt()`, `buildInteriorPrompt()` |
| `app/api/design-intent/route.ts` | tạo | endpoint phân tích |
| `app/(app)/render/interior/page.tsx` | tạo | UI (hoặc thêm tab vào render) |
| `lib/render-types.ts` | (không sửa) | tái dùng `RenderSuggestion`, `buildRenderPrompt` |
| `app/api/render/generate/route.ts` | (không sửa) | tái dùng nguyên |

---

## 10. Rủi ro & điểm cần xác minh khi code

- **Đọc layout nội thất từ ảnh mặt bằng**: chất lượng phụ thuộc độ rõ của bản vẽ. Bản vẽ ký
  hiệu mờ/thiếu chú thích, hoặc ảnh chụp/scan lệch → `furnitureLayout` có thể sai. Cần test
  với ảnh mặt bằng thật của bạn sớm. Khuyến nghị: ảnh mặt bằng nét, thẳng, đủ ánh sáng.
- **Khớp mặt bằng (2D) với ảnh SketchUp (3D)**: model phải tự hiểu B là 3D của A. Nếu lệch,
  thêm bước cho người dùng xác nhận/sửa `roomType` + layout trước khi render.
- **Giữ camera**: Gemini img2img đôi khi vẫn dịch khung. Negative prompt + câu "giữ góc nhìn"
  giảm thiểu; nếu cần cứng hơn thì chuyển sang Flux ControlNet (v2).
- **Lẫn hai ảnh**: gửi 2 ảnh cùng request, model có thể nhầm ảnh nào là mặt bằng. Giảm thiểu
  bằng nhãn text "(A) ẢNH MẶT BẰNG" / "(B) ẢNH SKETCHUP" đặt ngay trước từng ảnh.
```
