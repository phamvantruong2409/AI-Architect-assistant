/**
 * ============================================================================
 *  BÀN GIAO NGỮ CẢNH — Dự án "AI Architect Assistant"
 *  Tính năng: "Hồ sơ và dự toán" → "Bốc Vật liệu AI" + đổi AI sang DeepSeek
 *  Mục đích: dán vào CHAT MỚI để Claude nắm nhanh trạng thái, khỏi dò lại.
 *  Cập nhật: 2026-06-21
 * ============================================================================
 *
 *  Dùng sao: mở chat mới, đính kèm hoặc dán nội dung file này, nói "đọc file
 *  bàn giao này rồi tiếp tục". Mọi đường dẫn dưới đây là TƯƠNG ĐỐI so với
 *  thư mục app:  "d:\3. VS CODE\APP ARCHITECT\ai-architect-assistant"
 */

const BAN_GIAO = {
  duAn: {
    ten: "AI Architect Assistant",
    loai: "Next.js 16.2.9 (App Router, Turbopack) chạy trong Electron, tiếng Việt",
    thuMucApp: "d:\\3. VS CODE\\APP ARCHITECT\\ai-architect-assistant",
    luuY: [
      "AGENTS.md cảnh báo: bản Next.js này có breaking change — đọc node_modules/next/dist/docs khi cần.",
      "Dev server chạy bằng: npm run dev  → http://localhost:3000",
      "Có sẵn dependency 'sharp' (0.34.5) và PowerShell (Windows) để xử lý ảnh.",
    ],
  },

  // --------------------------------------------------------------------------
  // VIỆC 1 — Đổi model AI cho 2 phần (ĐÃ XONG)
  // --------------------------------------------------------------------------
  viec1_doiModel: {
    yeuCau: "Thư viện tài liệu + Pháp lý: chuyển từ Gemini sang DeepSeek V4 Pro.",
    daLam: {
      thuVienTaiLieu: {
        file: "lib/knowledge-gemini.ts",
        sinhCauTraLoi: "DeepSeek V4 Pro (deepseekGenerateChat)",
        embedding: "VẪN GIỮ Gemini text-embedding-004 (DeepSeek không có embedding) — bắt buộc cho vector search.",
      },
      phapLy: {
        file: "lib/regulatory-gemini.ts + app/api/regulatory/analyze/route.ts",
        phanTich: "DeepSeek V4 Pro (deepseekGenerateText)",
        matMat: "DeepSeek chỉ nhận text → MẤT khả năng đọc ảnh mặt bằng (imageBase64 bị bỏ qua).",
        cotDB: "Cột 'gemini_model' giữ tên cũ nhưng nay lưu 'deepseek-v4-pro'.",
      },
      themHam: "lib/deepseek.ts: thêm deepseekGenerateChat (chat nhiều lượt, non-stream).",
    },
    modelIds: {
      deepseekPro: "deepseek-v4-pro",
      deepseekFlash: "deepseek-v4-flash",
      geminiMacDinh: "gemini-3-flash-preview",
      geminiImage: "gemini-2.5-flash-image",
      embedding: "text-embedding-004",
    },
  },

  // --------------------------------------------------------------------------
  // VIỆC 2 — Thẻ dashboard "Thuyết minh AI" → nhóm "Hồ sơ và dự toán" (ĐÃ XONG)
  // --------------------------------------------------------------------------
  viec2_dashboard: {
    file: "lib/dashboard-data.ts",
    thayDoi: "Thẻ 'Thuyết minh AI' (link /dossier) → thẻ NHÓM 'Hồ sơ và dự toán' (bung tag con + làm mờ nền như 'Nghiên cứu thiết kế').",
    tagCon: [{ label: "Bốc Vật liệu AI", href: "/material-takeoff", icon: "box" }],
    nhomIcon: "calculator",
    giaoDien: "QuickActions.tsx tự xử lý nhóm qua WorkflowOverlay — KHÔNG sửa.",
    dossierCu: "Trang /dossier (Thuyết minh AI cũ) vẫn còn trong code nhưng không còn lối vào — chưa xoá.",
  },

  // --------------------------------------------------------------------------
  // VIỆC 3 — Tính năng "Bốc Vật liệu AI" (ĐÃ XONG)
  // --------------------------------------------------------------------------
  viec3_bocVatLieu: {
    route: "/material-takeoff  (app/(app)/material-takeoff/page.tsx)",
    luong: [
      "1. Tải 1 ảnh render/thiết kế (<=8MB).",
      "2. POST /api/material-takeoff/analyze → Gemini vision (1 lần) trả JSON: materials[] + furniture[], mỗi mục có name, description, isIndustrialWood, searchHint, box (bbox 0-1000).",
      "3. Client crop từng vùng box từ ảnh gốc + lấy MÀU CHỦ ĐẠO.",
      "4. Vật liệu GỖ CÔNG NGHIỆP → khớp swatch An Cường gần nhất (màu Lab) → hiện ảnh swatch + mã + 5 swatch để đổi + link Google 'An Cường <mã>'.",
      "5. Vật liệu KHÁC + ĐỒ NỘI THẤT → dùng luôn ảnh CROP từ render.",
      "6. Xuất Excel (.xls HTML) nhúng ảnh + cột Đơn giá/m²/Số lượng tự điền.",
    ],
    quanTrong: "ĐÃ BỎ hẳn việc gọi Gemini TẠO ẢNH → hết lỗi 429 quota. Chạy gần như 0 đồng (chỉ 1 lần vision).",
    files: {
      "lib/material-takeoff-types.ts": "Types (TakeoffItem có box, BBox) + buildBuyLink(item, matchName?).",
      "lib/material-takeoff-gemini.ts": "analyzeMaterials() vision→JSON (có box). ĐÃ BỎ buildSwatchPrompt.",
      "app/api/material-takeoff/analyze/route.ts": "Route phân tích (mirror massing/analyze).",
      "app/api/material-takeoff/swatch/route.ts": "ĐÃ XOÁ (không tạo ảnh nữa).",
      "lib/swatch-library.ts": "Nạp index.json + đổi hex→Lab + nearestSwatches() (khớp màu).",
      "app/(app)/material-takeoff/page.tsx": "UI: upload, crop, khớp, đổi swatch, xuất Excel.",
    },
  },

  // --------------------------------------------------------------------------
  // VIỆC 4 — Thư viện swatch An Cường (ĐÃ XONG)
  // --------------------------------------------------------------------------
  viec4_thuVienSwatch: {
    nguon: "Color Map An Cường (https://ancuong.com/color-map.html) → 4 file ZIP trên filecloud.ancuong.com (mỗi loại 1 zip, TỔNG ~9.7GB).",
    cachLam: "scripts/build-swatches.ps1: đọc THẲNG từng ảnh trong zip (KHÔNG giải nén ra ổ) → cắt vuông giữa → thu nhỏ 256px JPEG q78 → lưu public/swatches/<loai>/ + index.json (file, name=mã màu, color=hex).",
    ketQua: {
      "public/swatches/mfc/": "428 swatch (3.3MB)",
      "public/swatches/laminate/": "739 swatch (5.9MB)",
      "public/swatches/veneer/": "116 swatch (1.1MB)",
      "public/swatches/acrylic/": "119 swatch (848KB)",
      tong: "1.402 swatch, ~11MB (từ ~9.7GB zip)",
    },
    index_json_format: '{ type, size, count, items: [{ file, name, color }] }  (CÓ BOM, code client đã strip).',
    chayLai: 'powershell -ExecutionPolicy Bypass -File scripts/build-swatches.ps1 -Zip "<duong-dan.zip>" -OutDir "public/swatches/<loai>" -Type <loai>',
    banQuyen: "Ảnh swatch An Cường là tài sản có bản quyền — dùng nội bộ ổn; nếu PHÁT HÀNH .exe công khai thì cân nhắc xin phép / trộn swatch CC0.",
    donDep: "4 file ZIP gốc nằm ở 'D:\\3. VS CODE\\APP ARCHITECT\\library\\' — XOÁ ĐƯỢC (đã tách xong, không cần nữa).",
  },

  // --------------------------------------------------------------------------
  // TRẠNG THÁI & KIỂM THỬ
  // --------------------------------------------------------------------------
  trangThai: {
    build: "tsc --noEmit SẠCH, eslint SẠCH.",
    devTest: "Trang /material-takeoff 200; /swatches/<loai>/index.json 200; ảnh swatch (tên có dấu cách, %20) 200.",
    chuaTestThucTe: "Chưa chạy luồng AI đầu-cuối với ảnh thật (cần GEMINI_API_KEY trong .env.local cho bước vision analyze). Vision Gemini vẫn còn quota; KHÔNG còn dùng image-gen nên không lo 429.",
  },

  // --------------------------------------------------------------------------
  // VIỆC CÒN MỞ / GỢI Ý TIẾP THEO
  // --------------------------------------------------------------------------
  viecConMo: [
    "Khớp swatch hiện CHỈ theo MÀU chủ đạo (Lab) → gỗ cùng tông dễ nhầm. Đã có nút đổi swatch (5 gợi ý). Nâng cấp tuỳ chọn: thêm pHash hoặc CLIP cục bộ để khớp VÂN gỗ (vẫn 0 đồng).",
    "Cân nhắc xoá hẳn trang /dossier (Thuyết minh AI cũ) nếu không dùng.",
    "Phần Pháp lý mất đọc ảnh mặt bằng (do DeepSeek) — nếu cần lại, làm kiểu lai: có ảnh→Gemini, không ảnh→DeepSeek.",
    "Excel nhúng ảnh base64 là best-effort (vài bản Excel không hiện) — ảnh luôn hiện ở web.",
  ],

  // --------------------------------------------------------------------------
  // QUY ƯỚC LÀM VIỆC CỦA USER (KTS Phạm Văn Trường)
  // --------------------------------------------------------------------------
  quyUoc: {
    ngonNgu: "Trả lời TIẾNG VIỆT.",
    phongCach: "Quyết đoán, thích làm nhanh; OK tự quyết theo mặc định hợp lý rồi báo lại.",
    link: "Ưu tiên link KHÔNG chết (404). Gỗ CN → An Cường; loại khác → Google 'mua ...'.",
    release: "#release / 'lên bản mới': bump version → npm run release (tạo draft) → test → bỏ tích draft để publish.",
  },
};

// Cho phép require() nếu cần; còn không thì chỉ đọc như tài liệu.
if (typeof module !== "undefined") module.exports = BAN_GIAO;
