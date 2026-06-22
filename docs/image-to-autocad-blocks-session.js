/**
 * TÓM TẮT PHIÊN LÀM VIỆC #2 — "Image to AutoCAD": CHÈN BLOCK THẬT + BỐ TRÍ TỰ ĐỘNG
 * (tiếp nối image-to-autocad-session.js)
 *
 * File này chỉ là GHI CHÚ tổng hợp dạng JS object, không phải code chạy.
 * Ngày: 2026-06-22.
 */

const session = {
  mucTieu:
    "Khi xuất bản vẽ, nếu ảnh có nội thất thì TỰ chọn block có sẵn (thư viện) bố trí vào " +
    "bản vẽ: không chèn nhau, không đè tường, nằm trong nhà / sát tường. Cửa đi dùng block " +
    "cua900 (mặc định 900) và cua750 (WC mặc định 750).",

  // ── Thư viện block nguồn ───────────────────────────────────────────────────
  thuVienNguon: "D:/3. KIEN TRUC AI/CAD/bokihieuvablock.dwg (161 block, lộn xộn, trộn đơn vị)",

  // ── Phát hiện kỹ thuật về accoreconsole (AutoCAD 2024) ─────────────────────
  accoreconsole: {
    chay:
      "Phải chạy qua Start-Process -Wait + tắt sandbox; đường dẫn có dấu cách thì copy sang " +
      "thư mục không dấu cách (vd C:\\acadtmp). App thật dùng Node execFile nên dấu cách OK.",
    khongCoCOM:
      "KHÔNG có ActiveX/COM: vlax-get-acad-object=nil, vlax-ename->vla-object lỗi, " +
      "Express acet-ent-geomextents không nạp → vla-getboundingbox VÔ DỤNG.",
    doBbox:
      "Đo khung bao bằng: erase model, -INSERT key=cleanfile.dwg tại 0,0, ZOOM _E, đọc " +
      "(getvar EXTMIN/EXTMAX). (ERASE ALL trên thư viện đầy đủ còn sót 583 entity ở layout/ " +
      "layer khoá → phải đo trên file WBLOCK sạch của TỪNG block.)",
    tenBlock:
      "Tên trong symbol table lưu ký tự ngoài ANSI thành chuỗi ASCII '\\U+XXXX'. Match block " +
      "bằng CHUỖI CON ASCII duy nhất (vl-string-search), không dùng tên đầy đủ.",
  },

  // ── 13 block đã trích (chuỗi con ASCII → WBLOCK → chuẩn hoá) ────────────────
  block13: {
    danhSach:
      "toilet=WC05_P, lavabo='lavbo 10', shower=ID123123(VÒI TẮM), bathtub='BON TAM 2', " +
      "bed=M.GIUONG, wardrobe=M.TUQUANAO, stove=BEPTU2A, sink='bon rua', fridge=ID654g1d6g, " +
      "dchair=ID101(GHẾ), lounge=ID8(GHẾ LƯỜI), door900=cua900, door750=cua750",
    donViTRON:
      "inch(×25.4): toilet, shower, sink, fridge, dchair, door900, door750. mm(×1): lavabo, " +
      "bathtub, bed, wardrobe, stove, lounge.",
    kichThuocThatMM:
      "toilet 483×780, lavabo 547×554, shower 242×1316, bathtub 1679×774, bed 2812×2041, " +
      "wardrobe 611×604, stove 730×54, sink 800×500, fridge 880×740, dchair 452×486, " +
      "lounge 876×737, door900 943×948, door750 795×801.",
    chuanHoa:
      "Mỗi block được CHUẨN HOÁ 1 lần: scale về mm + DỜI TÂM hình về gốc (0,0), INSUNITS=mm. " +
      "→ xuất chỉ cần chèn tại tâm, scale 1. Lưu ở public/cad-blocks/<key>.dwg (prepare-electron " +
      "tự copy 'public' vào bản standalone).",
  },

  // ── File tạo/sửa ────────────────────────────────────────────────────────────
  files: {
    taoMoi: [
      "public/cad-blocks/*.dwg          // 13 block đã chuẩn hoá (mm, tâm gốc)",
      "lib/cad-blocks.ts                // registry: kind→block + size + door + resolveBlocksDir",
      "lib/cad-layout.ts                // engine BỐ TRÍ: áp tường, né cửa, không chồng",
    ],
    sua: [
      "lib/cad-lisp.ts                  // planToLisp(plan, blocksDir): chèn block, fallback vẽ tham số",
      "lib/cad-runner.ts                // truyền resolveBlocksDir() vào planToLisp",
      "lib/image-to-cad-types.ts        // thêm kind 'lounge_chair'",
      "lib/image-to-cad-gemini.ts       // prompt: thêm lounge_chair, quy tắc bố trí, cửa 900/750",
    ],
  },

  // ── Chèn block trong LISP (điểm mấu chốt) ─────────────────────────────────────
  chenBlock: {
    lenh: '(command "_.-INSERT" "name=file.dwg" "_non" (list x y) sx sy rotDeg)',
    redefine:
      "Chèn 'name=file' lần 2 sẽ bật prompt 'Redefine block?' làm TREO chuỗi lệnh → lần đầu " +
      "kèm '=file', lần sau CHỈ dùng tên (Lisp.definedBlocks theo dõi).",
    layer: "Đặt CLAYER=LF trước khi chèn nội thất, CLAYER=LD trước khi chèn cửa.",
    insunits: 'setvar INSUNITS 4 (mm) khớp block đã chuẩn hoá → không bị AutoCAD tự rescale.',
    cua:
      "Chèn cua900/cua750 tại TÂM lỗ mở, xoay theo phương tường, LẬT theo bản lề (sx) + chiều " +
      "mở (sy). Lỗ mở trên tường đã được trừ sẵn ở bước drawWall (solidSegments).",
  },

  // ── Engine bố trí (cad-layout.ts) ────────────────────────────────────────────
  boTri: {
    triet_ly: "KHÔNG tin toạ độ AI; chỉ tin 'món nào ở phòng nào'.",
    monApTuong:
      "bed/wardrobe/sofa/desk/kitchen_counter/stove/fridge/sink/toilet/lavabo/shower/bathtub: " +
      "xếp TO TRƯỚC → cạnh tường gần nhất CÒN CHỖ (đầy thì tràn sang cạnh khác) → xoay LƯNG " +
      "(+Y cục bộ block) vào tường → xếp dọc tường, né ô cửa, không đè nhau.",
    monGiuaPhong: "table_dining/table_coffee/lounge/car: quanh tâm phòng rồi đẩy tránh món khác.",
    banAn: "Mặt bàn vẽ tham số + ghế ăn (block dchair) ghép quanh, quay mặt vào bàn.",
    fallback: "Thiếu thư viện block → tự quay về vẽ tham số như phiên #1.",
  },

  // ── Đã kiểm chứng ─────────────────────────────────────────────────────────────
  kiemChung: [
    "tsc --noEmit: PASS.",
    "Chèn từ đường dẫn có dấu cách vào template thật: 5 nội thất + 2 cửa đúng vị trí/scale/layer.",
    "Studio mẫu sau bố trí: OVERLAPS=0, mọi món sát tường & trong phòng, LISP chạy sạch ra DWG.",
  ],

  // ── CÒN CẦN MẮT NGƯỜI XÁC NHẬN (không render được ảnh) ───────────────────────
  canXacNhanTrucQuan: [
    "Hướng LƯNG món đồ: quy ước back = +Y của block; nếu món quay ngược → đổi rotation/back-axis.",
    "Chiều mở cửa (bản lề trái/phải, mở trong/ngoài): nếu sai → đổi dấu sx/sy trong insertDoorBlock.",
    "Block vòi sen (shower) đo ra 239×1316 (như ký hiệu vòi đứng) — kiểm tra có đúng ý không.",
  ],

  // ── Vấn đề vòng trước đã sửa ─────────────────────────────────────────────────
  daSua:
    "Phản hồi 'bố trí lung tung, chồng nhau, không sát tường' (xuất bằng layout cũ chỉ kẹp khung " +
    "phòng) → viết lại engine áp-tường + xếp dọc tường + tránh chồng.",
};

module.exports = session;
