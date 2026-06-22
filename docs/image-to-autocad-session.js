/**
 * TÓM TẮT PHIÊN LÀM VIỆC — Tính năng "Image to AutoCAD"
 * (AI đọc ảnh mặt bằng → xuất bản vẽ DWG chuẩn kỹ thuật trên template người dùng)
 *
 * File này chỉ là GHI CHÚ tổng hợp dạng JS object, không phải code chạy.
 * Ngày: 2026-06-22.
 */

const session = {
  mucTieu:
    "Thêm công cụ 'Image to AutoCAD' trong mục 'Nghiên cứu thiết kế': tải ảnh mặt bằng → " +
    "AI nhận diện tường/cửa/phòng/nội thất/kích thước → xuất file DWG chuẩn.",

  // ── Quyết định kiến trúc (người dùng chọn) ───────────────────────────────
  huongTrienKhai: {
    engine: "Vẽ thật bằng AutoCAD đã cài trên máy (accoreconsole) trên file template của user",
    lyDo: "Cho ra DWG thật + đúng layer/style/khung tên template + chữ tiếng Việt chuẩn",
    nhanDien: "Tường (dày 100/150/200) + cửa + phòng + nội thất + kích thước",
    fallback: "DXF thuần TypeScript khi máy không có AutoCAD (tường 1 nét, không hatch/block)",
  },

  // ── Luồng hoạt động ──────────────────────────────────────────────────────
  luong: [
    "1. Ảnh mặt bằng → Gemini Vision → JSON (CadPlan: walls/openings/rooms/furniture/dimensions)",
    "2. CadPlan → planToLisp() sinh AutoLISP THUẦN ASCII (tiếng Việt mã hoá qua (chr N))",
    "3. cad-runner spawn accoreconsole /i <template> /s <script.scr> → vẽ lên template",
    "4. SAVEAS .dwg → trả buffer về trình duyệt để tải xuống",
  ],

  // ── File tạo/sửa ─────────────────────────────────────────────────────────
  files: {
    taoMoi: [
      "lib/image-to-cad-types.ts      // mô hình CadPlan (tường dày, cửa, phòng, nội thất, dim)",
      "lib/image-to-cad-gemini.ts     // prompt + chuẩn hoá kết quả AI (snap dày 100/150/200)",
      "lib/cad-lisp.ts                // BỘ SINH AutoLISP (cốt lõi): tường+hatch, cửa, nội thất, MTEXT, dim",
      "lib/cad-runner.ts              // dò AutoCAD + chạy accoreconsole → DWG buffer",
      "lib/dxf-writer.ts              // fallback DXF R12 thuần TS",
      "app/api/image-to-cad/analyze/route.ts  // AI đọc ảnh",
      "app/api/image-to-cad/export/route.ts   // sinh DWG qua AutoCAD",
      "app/api/image-to-cad/env/route.ts      // báo UI: có AutoCAD + template chưa",
      "app/(app)/image-to-autocad/page.tsx    // UI: upload, preview SVG, nút Xuất DWG, tiến trình",
    ],
    sua: [
      "lib/dashboard-data.ts          // thêm thẻ 'Image to AutoCAD' vào nhóm 'Nghiên cứu thiết kế'",
      "lib/settings-store.ts          // thêm cấu hình acadAccorePath + cadTemplatePath",
    ],
  },

  // ── Phát hiện kỹ thuật quan trọng (đã kiểm chứng trên AutoCAD 2024) ───────
  phatHienKyThuat: {
    chuTiengViet:
      "DXF R12 (ANSI) bị lỗi font → giải pháp: sinh AutoLISP ASCII, dựng chữ Việt bằng " +
      "(chr <unicode>). Đã verify khớp đúng layer template (vd '1.AAA_TƯỜNG').",
    accoreconsole:
      "C:/Program Files/Autodesk/AutoCAD 2024/accoreconsole.exe — AutoCAD chạy nền, " +
      "điều khiển bằng script .scr (mỗi dòng 1 form LISP).",
    tuong:
      "KHÔNG vẽ rectangle rời từng đoạn (góc hở/chồng). Dùng REGION + UNION để AutoCAD tự " +
      "làm sạch góc; nối dài đầu tường ±nửa-bề-dày để chắc chắn chồng ở góc.",
    hatch:
      "ANSI31 scale 300 qua '-HATCH'. Template có HPLAYER override (ép hatch về '000 TAN A - Hatch') " +
      "→ phải (setvar \"HPLAYER\" <layer hatch>) trước khi hatch.",
    cua:
      "Cửa khoét tường bằng cách trừ đoạn lỗ mở khỏi tường (solidSegments); vẽ cánh + cung quét 90° " +
      "theo bản lề (hinge) và chiều mở (swing in/out).",
    dimension:
      "DIMLINEAR với '_non' override + DIMASSOC 2; ép entity về layer '1.AAA_DIM' sau khi tạo.",
    render:
      "accoreconsole KHÔNG render raster (PNGOUT/PLOT headless không ổn) → kiểm chứng bằng đếm " +
      "entity + mở DWG trong AutoCAD thật.",
  },

  // ── Bảng layer lấy từ template A3 AiArcAssis.dwg ─────────────────────────
  layerTemplate: {
    "1.AAA_TƯỜNG": { color: 7, lt: "Continuous", dung: "Tường" },
    "1.AAA_CỘT": { color: 1, lt: "Continuous", dung: "Cột" },
    "1.AAA_DOOR&WINDOW": { color: 155, lt: "Continuous", dung: "Cửa đi/sổ" },
    "1.AAA_FURNITURE": { color: 37, lt: "Continuous", dung: "Nội thất" },
    "1.AAA_HATCH": { color: 148, lt: "Continuous", dung: "Hatch tường" },
    "1.AAA_CHỮ": { color: 7, lt: "Continuous", dung: "Ghi chú" },
    "1.AAA_DIM": { color: 139, lt: "Continuous", dung: "Kích thước" },
    "1.AAA_SÀN": { color: 250, lt: "Continuous", dung: "Sàn" },
    "1.AAA_TRỤC": { color: 250, lt: "CENTER2", dung: "Trục" },
  },

  // ── Phản hồi vòng 2 của user → trạng thái sửa ────────────────────────────
  phanHoiVong2: [
    { van_de: "Logic tường sai (rectangle rời, góc hở)", trang_thai: "ĐÃ SỬA: REGION+UNION" },
    { van_de: "Hatch dùng ANSI31 scale 300", trang_thai: "ĐÃ SỬA + fix HPLAYER override" },
    { van_de: "Lỗi cửa đi", trang_thai: "ĐÃ SỬA: cung quét 90° đúng hướng" },
    { van_de: "Hiện tiến trình khi xuất", trang_thai: "ĐÃ THÊM: 5 giai đoạn + spinner" },
    {
      van_de: "Dùng block/ký hiệu thật từ bokihieuvablock.dwg",
      trang_thai:
        "ĐANG CHỜ (giai đoạn sau): 161 block, tên lẫn lộn, đơn vị inch→×25.4, " +
        "accoreconsole không đo được bbox (ActiveX hạn chế) → cần map + verify từng block.",
    },
  ],

  // ── Việc còn lại ─────────────────────────────────────────────────────────
  conLai: [
    "Chạy lại kiểm chứng cuối trên AutoCAD (đang vướng bộ phân loại an toàn của môi trường tạm lỗi).",
    "Tích hợp block nội thất/ký hiệu thật từ thư viện (xử lý đơn vị + kích thước + base point từng block).",
    "Cấu hình đường dẫn template/AutoCAD cho máy người dùng khác (Cài đặt).",
  ],

  // ── Cách dùng ────────────────────────────────────────────────────────────
  cachDung:
    "Trang chủ → Nghiên cứu thiết kế → Image to AutoCAD → tải ảnh mặt bằng → 'Số hoá mặt bằng' → " +
    "'⬇ Xuất DWG (AutoCAD)'. Cần AutoCAD + GEMINI_API_KEY (Cài đặt).",
};

module.exports = session;
