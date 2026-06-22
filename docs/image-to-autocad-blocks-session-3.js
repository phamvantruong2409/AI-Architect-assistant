/**
 * TÓM TẮT PHIÊN LÀM VIỆC #3 — "Image to AutoCAD": THAY THƯ VIỆN BLOCK BẰNG blocknew.dwg
 * (tiếp nối image-to-autocad-blocks-session.js)
 *
 * File này chỉ là GHI CHÚ tổng hợp dạng JS object, không phải code chạy.
 * Ngày: 2026-06-22.
 */

const session = {
  mucTieu:
    "Thay bộ block cũ bằng block mới trong D:/3. KIEN TRUC AI/CAD/blocknew.dwg (toạ độ góc " +
    "ổn → đỡ phải phân tích toạ độ phức tạp). Bỏ block tủ quần áo, vẽ rectang thay thế. " +
    "Giữ nguyên logic bố trí như phiên #2.",

  // ── Thư viện nguồn mới ───────────────────────────────────────────────────────
  thuVienMoi:
    "blocknew.dwg (1.1MB, sạch hơn lib cũ 21MB). Có bộ block 'mb' (mặt bằng) do người dùng " +
    "chuẩn bị sẵn: voitammb, bepmb, chauruamb, tulanhmb, lavabomb, giuong1800, sofato, sofanho, " +
    "cua900, cua750. THIẾU: toilet, bathtub, ghế ăn (dchair), lounge, wardrobe.",

  // ── Quyết định mapping (đã hỏi & người dùng chốt) ────────────────────────────
  quyetDinh: {
    giuLaiBlockCu: "toilet, bathtub, dchair, lounge (blocknew không có) → giữ file cũ.",
    giuong: "bed_double & bed_single ĐỀU dùng giuong1800 (1800×2100).",
    sofa: "Tự chọn theo bề rộng AI: ≥2000 → sofato (2351×800), <2000 → sofanho (1651×800).",
    shower: "Dùng voitammb (546×285).",
    wardrobe: "BỎ block → vẽ rectang tham số (plain box, bỏ gạch chéo).",
  },

  // ── Phát hiện kỹ thuật accoreconsole (bổ sung phiên #2) ───────────────────────
  accoreconsole: {
    insertTuScale:
      "(command \"_.-INSERT\" tenBlockNoiBo ...) với block NỘI BỘ bị TỰ SCALE đổi đơn vị " +
      "(mm→inch, ÷25.4 → SAI kích thước!). Phải đo/chuẩn hoá bằng entmakex INSERT (không scale). " +
      "INSERT file NGOÀI có INSUNITS khớp thì OK.",
    chuanHoaTam:
      "Recenter: erase all → entmake INSERT 0,0 → ZOOM E → đọc EXTMIN/MAX → MOVE về gốc → " +
      "setvar INSUNITS 4 → -WBLOCK file *.",
    giuBasePoint:
      "Giữ base point gốc của block (cho CỬA = bản lề): -WBLOCK file <tenBlock> (không recenter).",
    powershell:
      "TRÁNH 2>&1 trên accoreconsole.exe trong PowerShell (NativeCommandError → treo). Redirect " +
      "stdout bằng | Out-File. stdout in ra ký tự cách-nhau (wide).",
  },

  // ── Block đã dựng vào public/cad-blocks/ ─────────────────────────────────────
  blockMoi: {
    chuanHoaTamGoc:
      "shower←voitammb 546×285, stove←bepmb 731×421, sink←chauruamb 800×500, " +
      "fridge←tulanhmb 800×640, lavabo←lavabomb 551×531, bed←giuong1800 1800×2100, " +
      "sofato 2351×800, sofanho 1651×800. (recenter về gốc, mm)",
    cuaHingeGoc:
      "door900←cua900, door750←cua750: -WBLOCK theo tên (GIỮ base = BẢN LỀ tại 0,0). Hình cục " +
      "bộ: cánh đóng dọc -X tới (-width,0), cung quét về -Y.",
    giuNguyen: "toilet, bathtub, dchair, lounge (file cũ). XOÁ wardrobe.dwg.",
  },

  // ── File code đã sửa ─────────────────────────────────────────────────────────
  files: {
    "lib/cad-blocks.ts":
      "Cập nhật size; bỏ wardrobe; thêm SOFA_BLOCKS + pickSofaBlock(width) + " +
      "resolveFurnitureBlock(f) (sofa chọn theo cỡ); DoorBlockDef bỏ hingeX/hingeY.",
    "lib/cad-layout.ts": "footprint() dùng resolveFurnitureBlock (sofa-aware).",
    "lib/cad-lisp.ts":
      "Furniture loop dùng resolveFurnitureBlock; wardrobe vẽ box trơn (rectang); VIẾT LẠI " +
      "insertDoorBlock theo hinge-at-origin: đặt bản lề vào đầu lỗ mở (op.hinge), xoay " +
      "r=atan2(-uy,-ux) để -X→hướng lỗ mở, lật yscale theo swing in/out, scale=op.width/def.width.",
  },

  // ── Đã kiểm chứng ────────────────────────────────────────────────────────────
  kiemChung: [
    "tsc --noEmit: PASS.",
    "Đo lại 10 file output: furniture đúng mm & tâm tại gốc; cửa hinge tại (0,0).",
    "Chạy pipeline THẬT (harness flat-copy 4 lib → planToLisp → accoreconsole trên template): " +
    "PLAN_DRAWN, không lỗi, ra _pipeout.dwg.",
    "Soi inserts trong output: sofa tự chọn đúng (2300→sofato, 1600→sofanho); 4 cửa đặt đúng " +
    "bản lề/xoay/lật/scale; wardrobe là rectang (không block).",
  ],

  // ── Đánh giá bản xuất THỰC của người dùng (ảnh nhà ống) — CẦN SỬA ─────────────
  canSua: {
    nang: [
      "Cung quét CỬA KHỔNG LỒ ở Sân trước: cổng rộng (~2.7-3m) lệch xa 900/750 → drawOpening " +
      "vẽ cung 90° bán kính = cả bề rộng → tràn nửa sân. Fix: width > ~1200 vẽ cửa lùa/2 cánh, " +
      "bỏ cung lớn.",
      "Xe (car) ở Sân trước = hình chữ nhật trơn (furnitureShape car chỉ là box). Fix: vẽ ký " +
      "hiệu xe hoặc làm block xe.",
    ],
    vua: [
      "Vách Sân trước↔Phòng khách nghi 2 lỗ cửa sát nhau — kiểm tra lỗ mở thừa.",
      "WC 2.4m²: lavabo & bồn cầu sát nhau — kiểm tra khe hở/chồng.",
      "Bếp hiện 2 mắt — xác nhận đúng ý (bếp đôi) hay muốn 4 mắt.",
    ],
    nhe: [
      "Quy ước: phòng tên chứa 'sân' có nên đặt nội thất? (xe ở sân trước thì hợp lý).",
      "Cửa sổ mép tường dưới Sân trước hơi lệch ra ngoài tường — kiểm tra vị trí.",
    ],
  },

  // ── Ổn (không cần sửa) ───────────────────────────────────────────────────────
  on: "Block mới render ĐỦ CHI TIẾT và ĐÚNG HƯỚNG: sofa lưng vào tường, chậu rửa/bếp áp tường, " +
    "lavabo+bồn cầu trong WC, ghế ăn vây bàn — quy ước back=+Y coi như đạt.",
};

module.exports = session;
