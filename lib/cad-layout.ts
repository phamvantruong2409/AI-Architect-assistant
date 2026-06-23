// Hậu xử lý nội thất: KHÔNG còn xếp đồ vào trong phòng. AI chỉ NHẬN DIỆN những món nội
// thất nên có; ta xếp chúng thành (các) HÀNG NẰM PHÍA TRÊN mặt bằng — như 1 khay block để
// người dùng TỰ KÉO vào vị trí trong AutoCAD. Mỗi món xoay về 0°, dùng kích thước thật của
// block (nếu có), không đè nhau, cùng loại đứng cạnh nhau cho dễ nhặt.

import { resolveFurnitureBlock } from "@/lib/cad-blocks";
import type { CadFurniture, CadPlan } from "@/lib/image-to-cad-types";

const TRAY_GAP = 600; // khe hở giữa 2 món trong khay (mm)
const TRAY_MARGIN = 1500; // khoảng cách từ mép trên mặt bằng tới hàng đầu tiên (mm)
const TRAY_ROW_GAP = 800; // khe hở giữa 2 hàng (mm)

/** Kích thước CHIẾM CHỖ (mm) [bề rộng, bề sâu]: theo block thật nếu có, không thì theo AI. */
function footprint(f: CadFurniture): [number, number] {
  const b = resolveFurnitureBlock(f);
  if (!b) return [Math.max(100, f.width), Math.max(100, f.depth)];
  const w = b.scalable === "x" ? Math.max(b.w, f.width) : b.w;
  const h = b.scalable === "y" ? Math.max(b.h, f.depth) : b.h;
  return [w, h];
}

/**
 * Xếp toàn bộ nội thất thành KHAY BLOCK phía TRÊN mặt bằng (y > height). Trả về cùng plan đã
 * cập nhật x/y/rotation của từng món. Người dùng sẽ tự kéo từng món vào vị trí mong muốn.
 */
export function trayFurniture(plan: CadPlan): CadPlan {
  if (plan.furniture.length === 0) return plan;

  // Cùng loại đứng cạnh nhau cho gọn.
  const items = plan.furniture
    .map((f) => ({ f, fp: footprint(f) }))
    .sort((a, b) => a.f.kind.localeCompare(b.f.kind));

  // Bề rộng tối đa 1 hàng: ưu tiên bằng bề ngang mặt bằng, nhưng đủ chứa món rộng nhất.
  const widest = items.reduce((m, it) => Math.max(m, it.fp[0]), 0);
  const maxRowW = Math.max(plan.width, widest, 4000);

  let x = 0;
  let rowBottom = plan.height + TRAY_MARGIN; // mép dưới hàng hiện tại (y nhỏ)
  let rowH = 0;

  for (const { f, fp } of items) {
    const [w, d] = fp;
    if (x > 0 && x + w > maxRowW) {
      // Xuống dòng — hàng mới nằm CAO HƠN (về phía trên).
      x = 0;
      rowBottom += rowH + TRAY_ROW_GAP;
      rowH = 0;
    }
    f.rotation = 0;
    f.x = x + w / 2;
    f.y = rowBottom + d / 2;
    x += w + TRAY_GAP;
    rowH = Math.max(rowH, d);
  }

  return plan;
}
