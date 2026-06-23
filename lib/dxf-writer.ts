// Bộ ghi DXF thuần TypeScript — KHÔNG phụ thuộc native, chạy được cả server lẫn
// trình duyệt. Tạo sinh DXF R12 (AC1009): định dạng đơn giản, hợp lệ, mở trực tiếp
// trong AutoCAD và hầu hết phần mềm CAD. Toạ độ tính bằng mm, gốc dưới-trái.
//
// Vì sao R12: không cần handle cho từng đối tượng, cấu trúc tối thiểu mà vẫn đủ
// LINE / POLYLINE / TEXT — đúng nhu cầu mặt bằng tường + phòng + kích thước.

import type { CadPlan } from "@/lib/image-to-cad-types";

/** Layer dùng trong bản vẽ + màu ACI (AutoCAD Color Index). */
const LAYERS = [
  { name: "TUONG", color: 7 }, // trắng/đen — tường
  { name: "PHONG", color: 5 }, // xanh dương — ranh phòng
  { name: "KICHTHUOC", color: 1 }, // đỏ — kích thước
  { name: "VANBAN", color: 3 }, // xanh lá — nhãn/chữ
] as const;

/** Format số: bỏ ký pháp khoa học, tối đa 4 chữ số thập phân, bỏ số 0 thừa. */
function num(v: number): string {
  if (!Number.isFinite(v)) return "0";
  const s = v.toFixed(4);
  return s.replace(/\.?0+$/, "") || "0";
}

/** Bộ tích luỹ các dòng group code/value của DXF. */
class DxfBuilder {
  private parts: string[] = [];

  /** Ghi một cặp (mã nhóm, giá trị). */
  add(code: number, value: string | number): this {
    this.parts.push(String(code), String(value));
    return this;
  }

  line(layer: string, x1: number, y1: number, x2: number, y2: number): this {
    this.add(0, "LINE").add(8, layer);
    this.add(10, num(x1)).add(20, num(y1)).add(30, 0);
    this.add(11, num(x2)).add(21, num(y2)).add(31, 0);
    return this;
  }

  /** TEXT: height = cỡ chữ, rotation = độ. center → canh giữa-giữa. */
  text(
    layer: string,
    x: number,
    y: number,
    height: number,
    value: string,
    rotation = 0,
    center = false
  ): this {
    this.add(0, "TEXT").add(8, layer);
    this.add(10, num(x)).add(20, num(y)).add(30, 0);
    this.add(40, num(height));
    this.add(1, value);
    if (rotation) this.add(50, num(rotation));
    if (center) {
      // 72=1 (canh giữa ngang), 73=2 (canh giữa dọc); điểm canh ở 11/21.
      this.add(72, 1).add(73, 2);
      this.add(11, num(x)).add(21, num(y)).add(31, 0);
    }
    return this;
  }

  /** POLYLINE kín kiểu R12 (POLYLINE + VERTEX + SEQEND). */
  polyline(layer: string, points: [number, number][], closed = true): this {
    if (points.length < 2) return this;
    this.add(0, "POLYLINE").add(8, layer);
    this.add(66, 1); // có VERTEX theo sau
    // Điểm "giả" bắt buộc của POLYLINE kiểu cũ (R12) — luôn 0,0,0.
    this.add(10, 0).add(20, 0).add(30, 0);
    this.add(70, closed ? 1 : 0); // bit 1 = kín
    for (const [x, y] of points) {
      this.add(0, "VERTEX").add(8, layer);
      this.add(10, num(x)).add(20, num(y)).add(30, 0);
    }
    this.add(0, "SEQEND").add(8, layer);
    return this;
  }

  toString(): string {
    return this.parts.join("\n") + "\n";
  }
}

/** Khối HEADER tối thiểu: phiên bản R12 + đơn vị mm. */
function header(): string {
  const b = new DxfBuilder();
  b.add(0, "SECTION").add(2, "HEADER");
  b.add(9, "$ACADVER").add(1, "AC1009");
  b.add(9, "$INSUNITS").add(70, 4); // 4 = millimet
  b.add(0, "ENDSEC");
  return b.toString();
}

/** Bảng LAYER để tường/phòng/kích thước/chữ có màu riêng. */
function tables(): string {
  const b = new DxfBuilder();
  b.add(0, "SECTION").add(2, "TABLES");
  b.add(0, "TABLE").add(2, "LAYER").add(70, LAYERS.length + 1);
  // Layer 0 mặc định luôn cần có.
  b.add(0, "LAYER").add(2, "0").add(70, 0).add(62, 7).add(6, "CONTINUOUS");
  for (const l of LAYERS) {
    b.add(0, "LAYER").add(2, l.name).add(70, 0).add(62, l.color).add(6, "CONTINUOUS");
  }
  b.add(0, "ENDTAB");
  b.add(0, "ENDSEC");
  return b.toString();
}

/** Vẽ một đường kích thước "thủ công": đường đo + 2 vạch chéo + chữ số. */
function drawDimension(
  b: DxfBuilder,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  textValue: string,
  textHeight: number
) {
  const layer = "KICHTHUOC";
  b.line(layer, x1, y1, x2, y2);

  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  // Vector đơn vị dọc đường + pháp tuyến.
  const ux = dx / len;
  const uy = dy / len;
  const nx = -uy;
  const ny = ux;
  const tick = textHeight * 0.8;

  // Vạch chéo 45° kiểu kiến trúc tại 2 đầu.
  for (const [px, py] of [
    [x1, y1],
    [x2, y2],
  ] as const) {
    const ax = (ux + nx) * tick * 0.5;
    const ay = (uy + ny) * tick * 0.5;
    b.line(layer, px - ax, py - ay, px + ax, py + ay);
  }

  // Chữ số đo: đặt giữa đường, đẩy ra ngoài theo pháp tuyến, xoay theo góc đường.
  const mx = (x1 + x2) / 2 + nx * textHeight * 0.7;
  const my = (y1 + y2) / 2 + ny * textHeight * 0.7;
  let angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  // Giữ chữ không bị lộn ngược.
  if (angle > 90 || angle < -90) angle += 180;
  b.text("VANBAN", mx, my, textHeight, textValue, angle, true);
}

/**
 * Dựng nội dung file DXF hoàn chỉnh từ mô hình mặt bằng.
 * Cỡ chữ tự co theo kích thước bản vẽ để luôn đọc được.
 */
export function planToDxf(plan: CadPlan): string {
  const extent = Math.max(plan.width || 0, plan.height || 0, 1000);
  const textHeight = Math.min(1000, Math.max(120, extent / 50));

  const b = new DxfBuilder();
  b.add(0, "SECTION").add(2, "ENTITIES");

  // Tường — đoạn thẳng trên layer TUONG.
  for (const w of plan.walls) {
    b.line("TUONG", w.x1, w.y1, w.x2, w.y2);
  }

  // Phòng — đa giác kín + nhãn tên & diện tích ở trọng tâm.
  for (const r of plan.rooms) {
    if (r.points.length >= 3) {
      b.polyline("PHONG", r.points, true);
    }
    if (r.points.length > 0) {
      let cx = 0;
      let cy = 0;
      for (const [x, y] of r.points) {
        cx += x;
        cy += y;
      }
      cx /= r.points.length;
      cy /= r.points.length;
      // DXF TEXT không xuống dòng; tách tên và diện tích thành 2 dòng chữ.
      b.text("VANBAN", cx, cy + textHeight * 0.7, textHeight, r.name, 0, true);
      if (r.area > 0) {
        b.text("VANBAN", cx, cy - textHeight * 0.7, textHeight * 0.8, `${r.area.toFixed(1)} m2`, 0, true);
      }
    }
  }

  // Kích thước (text trống → tự đo theo khoảng cách).
  for (const d of plan.dimensions) {
    const dimText = d.text ?? String(Math.round(Math.hypot(d.x2 - d.x1, d.y2 - d.y1)));
    drawDimension(b, d.x1, d.y1, d.x2, d.y2, dimText, textHeight);
  }

  b.add(0, "ENDSEC");

  return header() + tables() + b.toString() + "0\nEOF\n";
}
