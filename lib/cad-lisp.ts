// Bộ tạo sinh AutoLISP từ mô hình mặt bằng (CadPlan). LISP tạo sinh ra là THUẦN ASCII: mọi
// chữ tiếng Việt (tên layer, tên phòng…) được dựng bằng (chr <mã Unicode>) nên không
// dính lỗi codepage. AutoCAD (accoreconsole) nạp & chạy LISP này TRÊN template của
// người dùng → vẽ tường (2 nét + hatch), cửa khoét tường, nội thất, ghi chú, kích
// thước lên ĐÚNG layer template, rồi lưu DWG.

import type {
  CadFeature,
  CadFurniture,
  CadOpening,
  CadPlan,
  CadWall,
} from "@/lib/image-to-cad-types";
import {
  blockFile,
  DINING_CHAIR,
  pickDoorBlock,
  resolveFurnitureBlock,
  type BlockDef,
  type DoorBlockDef,
} from "@/lib/cad-blocks";
import { trayFurniture } from "@/lib/cad-layout";

/** Tên layer CHÍNH XÁC trong template A3 AiArcAssis.dwg (lấy bằng accoreconsole). */
export const LAYER = {
  wall: "1.AAA_TƯỜNG",
  column: "1.AAA_CỘT",
  door: "1.AAA_DOOR&WINDOW",
  furniture: "1.AAA_FURNITURE",
  hatch: "1.AAA_HATCH",
  hatchFur: "1.AAA_HATCH FURNITURE",
  text: "1.AAA_CHỮ",
  dim: "1.AAA_DIM",
  floor: "1.AAA_SÀN",
} as const;

// ───────────────────────── Helpers chuỗi/số LISP ─────────────────────────

/** Số → token LISP an toàn (không ký pháp khoa học). */
function num(v: number): string {
  if (!Number.isFinite(v)) return "0";
  const r = Math.round(v * 1000) / 1000;
  return Object.is(r, -0) ? "0" : String(r);
}

/** (list x y) */
function pt(x: number, y: number): string {
  return `(list ${num(x)} ${num(y)})`;
}

/**
 * Chuỗi tiếng Việt → biểu thức LISP ASCII-safe. Ký tự ASCII gom vào "..."; ký tự
 * ngoài ASCII thành (chr <code>). Nối bằng (strcat ...).
 */
export function vnStr(s: string): string {
  const parts: string[] = [];
  let buf = "";
  const flush = () => {
    if (buf) {
      parts.push(JSON.stringify(buf)); // escape \" và \\ đúng cú pháp LISP
      buf = "";
    }
  };
  for (const ch of s) {
    const code = ch.codePointAt(0)!;
    if (code >= 32 && code < 127) buf += ch;
    else {
      flush();
      parts.push(`(chr ${code})`);
    }
  }
  flush();
  if (parts.length === 0) return '""';
  if (parts.length === 1) return parts[0];
  return `(strcat ${parts.join(" ")})`;
}

// ───────────────────────── Helpers entmake (tạo sinh dòng LISP) ─────────────────────────

class Lisp {
  lines: string[] = [];
  /** Block đã được định nghĩa (chèn lần đầu kèm "=file"); lần sau chỉ dùng tên. */
  private definedBlocks = new Set<string>();

  raw(s: string) {
    this.lines.push(s);
  }

  /** LWPOLYLINE từ danh sách điểm; closed=true thì khép kín. */
  pline(layerExpr: string, points: [number, number][], closed = true) {
    if (points.length < 2) return;
    const verts = points.map(([x, y]) => `(cons 10 ${pt(x, y)})`).join(" ");
    this.lines.push(
      `(entmakex (list (cons 0 "LWPOLYLINE")(cons 100 "AcDbEntity")(cons 8 ${layerExpr})(cons 100 "AcDbPolyline")(cons 90 ${points.length})(cons 70 ${closed ? 1 : 0}) ${verts}))`
    );
  }

  line(layerExpr: string, x1: number, y1: number, x2: number, y2: number) {
    this.lines.push(
      `(entmakex (list (cons 0 "LINE")(cons 100 "AcDbEntity")(cons 8 ${layerExpr})(cons 100 "AcDbLine")(cons 10 ${pt(x1, y1)})(cons 11 ${pt(x2, y2)})))`
    );
  }

  circle(layerExpr: string, cx: number, cy: number, r: number) {
    this.lines.push(
      `(entmakex (list (cons 0 "CIRCLE")(cons 100 "AcDbEntity")(cons 8 ${layerExpr})(cons 100 "AcDbCircle")(cons 10 ${pt(cx, cy)})(cons 40 ${num(r)})))`
    );
  }

  /** ARC: góc theo ĐỘ, ngược kim đồng hồ. */
  arc(layerExpr: string, cx: number, cy: number, r: number, a0: number, a1: number) {
    this.lines.push(
      `(entmakex (list (cons 0 "ARC")(cons 100 "AcDbEntity")(cons 8 ${layerExpr})(cons 100 "AcDbCircle")(cons 10 ${pt(cx, cy)})(cons 40 ${num(r)})(cons 100 "AcDbArc")(cons 50 ${num(a0)})(cons 51 ${num(a1)})))`
    );
  }

  /** MTEXT canh giữa (attachment 5), nhiều dòng dùng \\P trong textExpr. */
  mtext(layerExpr: string, x: number, y: number, height: number, textExpr: string) {
    this.lines.push(
      `(entmakex (list (cons 0 "MTEXT")(cons 100 "AcDbEntity")(cons 8 ${layerExpr})(cons 100 "AcDbMText")(cons 10 ${pt(x, y)})(cons 40 ${num(height)})(cons 71 5)(cons 1 ${textExpr})))`
    );
  }

  /**
   * Chèn BLOCK từ file ngoài (đã chuẩn hoá mm, tâm tại gốc). name=def, file forward-slash.
   * sx/sy âm để LẬT (mirror). Block nằm trên CLAYER hiện hành (đặt trước khi gọi).
   */
  insert(name: string, file: string, x: number, y: number, sx: number, sy: number, rotDeg: number) {
    // Lần đầu: "name=file" để nạp định nghĩa; lần sau chỉ "name" (tránh prompt "Redefine?").
    const ref = this.definedBlocks.has(name) ? name : `${name}=${file}`;
    this.definedBlocks.add(name);
    this.lines.push(
      `(command "_.-INSERT" "${ref}" "_non" ${pt(x, y)} ${num(sx)} ${num(sy)} ${num(rotDeg)})`
    );
  }
}

// ───────────────────────── Hình học ─────────────────────────

type Pt = [number, number];

function rot(cx: number, cy: number, deg: number, lx: number, ly: number): Pt {
  const r = (deg * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return [cx + lx * c - ly * s, cy + lx * s + ly * c];
}

interface WallSeg {
  /** Khoảng [t0,t1] đặc (mm dọc theo tường) sau khi trừ lỗ mở. */
  t0: number;
  t1: number;
}

/** Trả về các đoạn ĐẶC của 1 tường sau khi trừ các lỗ mở (cửa) trên nó. */
function solidSegments(wall: CadWall, openings: CadOpening[], len: number): WallSeg[] {
  const A: Pt = [wall.x1, wall.y1];
  const dx = (wall.x2 - wall.x1) / len;
  const dy = (wall.y2 - wall.y1) / len;
  const holes = openings
    .map((o) => {
      const t = (o.x - A[0]) * dx + (o.y - A[1]) * dy; // chiếu tâm lỗ lên tim tường
      return { a: t - o.width / 2, b: t + o.width / 2 };
    })
    .filter((h) => h.b > 0 && h.a < len)
    .sort((p, q) => p.a - q.a);

  const segs: WallSeg[] = [];
  let s = 0;
  for (const h of holes) {
    const a = Math.max(0, h.a);
    if (a > s) segs.push({ t0: s, t1: a });
    s = Math.max(s, Math.min(len, h.b));
  }
  if (s < len) segs.push({ t0: s, t1: len });
  return segs;
}

/**
 * Vẽ các KHỐI ĐẶC của 1 tường (polyline kín cho mỗi đoạn sau khi trừ cửa). KHÔNG
 * hatch ở đây — sau khi vẽ hết tường, ta REGION+UNION toàn bộ để làm sạch góc rồi
 * mới hatch ANSI31 một lần (xem planToLisp).
 */
function drawWall(L: Lisp, wallLayer: string, wall: CadWall, wallOpenings: CadOpening[]) {
  const len = Math.hypot(wall.x2 - wall.x1, wall.y2 - wall.y1);
  if (len < 1) return;
  const dx = (wall.x2 - wall.x1) / len;
  const dy = (wall.y2 - wall.y1) / len;
  const nx = -dy; // pháp tuyến đơn vị
  const ny = dx;
  const h = wall.thickness / 2;
  const A: Pt = [wall.x1, wall.y1];

  // TƯỜNG 1 NÉT THẤY (thickness 0): vẽ đúng tim tường thành các đoạn LINE, không
  // thicken/không hatch (LINE không bị bước REGION/UNION/hatch chọn).
  if (wall.thickness <= 0) {
    for (const seg of solidSegments(wall, wallOpenings, len)) {
      L.line(
        wallLayer,
        A[0] + dx * seg.t0,
        A[1] + dy * seg.t0,
        A[0] + dx * seg.t1,
        A[1] + dy * seg.t1
      );
    }
    return;
  }

  for (const seg of solidSegments(wall, wallOpenings, len)) {
    // Nối dài 2 đầu KHÔNG giáp cửa thêm 1 nửa bề dày để các tường chắc chắn
    // chồng nhau ở góc → UNION làm sạch góc đẹp. Đầu giáp cửa giữ nguyên.
    const e0 = seg.t0 <= 0.5 ? -h : 0;
    const e1 = seg.t1 >= len - 0.5 ? h : 0;
    const p0x = A[0] + dx * (seg.t0 + e0);
    const p0y = A[1] + dy * (seg.t0 + e0);
    const p1x = A[0] + dx * (seg.t1 + e1);
    const p1y = A[1] + dy * (seg.t1 + e1);
    const rect: [number, number][] = [
      [p0x + nx * h, p0y + ny * h],
      [p1x + nx * h, p1y + ny * h],
      [p1x - nx * h, p1y - ny * h],
      [p0x - nx * h, p0y - ny * h],
    ];
    L.pline(wallLayer, rect, true);
  }
}

/** Vẽ cửa đi (cánh + cung quét) hoặc cửa sổ trong lỗ mở. */
function drawOpening(L: Lisp, doorLayer: string, wall: CadWall, op: CadOpening) {
  const len = Math.hypot(wall.x2 - wall.x1, wall.y2 - wall.y1);
  if (len < 1) return;
  const dx = (wall.x2 - wall.x1) / len;
  const dy = (wall.y2 - wall.y1) / len;
  const nx = -dy;
  const ny = dx;
  const h = wall.thickness / 2;
  const A: Pt = [wall.x1, wall.y1];
  const t = (op.x - A[0]) * dx + (op.y - A[1]) * dy; // tâm lỗ dọc tường
  const a = t - op.width / 2;
  const b = t + op.width / 2;
  const Ax = A[0] + dx * a;
  const Ay = A[1] + dy * a;
  const Bx = A[0] + dx * b;
  const By = A[1] + dy * b;

  if (op.kind === "window") {
    // Tường 1 nét (h≈0): cửa sổ chỉ là 1 nét trên tim, tránh vẽ 3 nét trùng nhau.
    if (h < 1) {
      L.line(doorLayer, Ax, Ay, Bx, By);
      return;
    }
    // 3 nét song song trong lỗ: 2 mép tường + tim cửa sổ.
    L.line(doorLayer, Ax + nx * h, Ay + ny * h, Bx + nx * h, By + ny * h);
    L.line(doorLayer, Ax - nx * h, Ay - ny * h, Bx - nx * h, By - ny * h);
    L.line(doorLayer, Ax, Ay, Bx, By);
    // 2 đố 2 đầu
    L.line(doorLayer, Ax + nx * h, Ay + ny * h, Ax - nx * h, Ay - ny * h);
    L.line(doorLayer, Bx + nx * h, By + ny * h, Bx - nx * h, By - ny * h);
    return;
  }

  // CỬA ĐI: bản lề ở 1 đầu lỗ mở; cánh dài = width; mở quét 90°.
  const hingeAtA = op.hinge !== "right";
  const hx = hingeAtA ? Ax : Bx; // điểm bản lề (trên tim tường)
  const hy = hingeAtA ? Ay : By;
  const ox = hingeAtA ? Bx : Ax; // đầu kia của lỗ mở
  const oy = hingeAtA ? By : Ay;
  const sideSign = op.swing === "out" ? -1 : 1; // mở theo +n (in) hay -n (out)

  // Cánh khi ĐÓNG: nằm dọc tường, từ bản lề tới đầu kia lỗ mở.
  const angClose = (Math.atan2(oy - hy, ox - hx) * 180) / Math.PI;
  // Cánh khi MỞ 90°: vuông góc tường về phía sideSign.
  const openTipX = hx + nx * sideSign * op.width;
  const openTipY = hy + ny * sideSign * op.width;
  const angOpen = (Math.atan2(openTipY - hy, openTipX - hx) * 180) / Math.PI;

  // Vẽ cánh ở vị trí MỞ.
  L.line(doorLayer, hx, hy, openTipX, openTipY);
  // Cung quét 90° từ đóng→mở. ARC vẽ CCW từ a0→a1; chọn để đúng 90°.
  const da = ((angOpen - angClose) % 360 + 360) % 360;
  if (Math.abs(da - 90) < 1) L.arc(doorLayer, hx, hy, op.width, angClose, angOpen);
  else L.arc(doorLayer, hx, hy, op.width, angOpen, angClose);
}

// ───────────────────────── Nội thất ─────────────────────────

interface Shape {
  plines?: Pt[][];
  circles?: { x: number; y: number; r: number }[];
  arcs?: { x: number; y: number; r: number; a0: number; a1: number }[];
}

/** Định nghĩa hình NỘI THẤT trong toạ độ cục bộ (tâm 0,0), kích thước w×d. */
function furnitureShape(kind: CadFurniture["kind"], w: number, d: number): Shape {
  const hw = w / 2;
  const hd = d / 2;
  const box: Pt[] = [
    [-hw, -hd],
    [hw, -hd],
    [hw, hd],
    [-hw, hd],
  ];
  switch (kind) {
    case "bed_double":
    case "bed_single": {
      const pillowD = Math.min(hd * 0.5, 350);
      const pillows: Pt[] = [
        [-hw * 0.9, hd - pillowD],
        [hw * 0.9, hd - pillowD],
        [hw * 0.9, hd - 60],
        [-hw * 0.9, hd - 60],
      ];
      return { plines: [box, pillows] };
    }
    case "sofa": {
      const back: Pt[] = [
        [-hw, hd - Math.min(200, d * 0.25)],
        [hw, hd - Math.min(200, d * 0.25)],
      ];
      return { plines: [box, back] };
    }
    case "table_dining": {
      // bàn + 6 ghế nhỏ quanh
      const chairs: Pt[][] = [];
      const cs = 380;
      const along = w >= d ? "x" : "y";
      const count = 3;
      for (let i = 0; i < count; i++) {
        const f = (i + 1) / (count + 1) - 0.5;
        if (along === "x") {
          chairs.push(squareAt(f * w, hd + 250, cs));
          chairs.push(squareAt(f * w, -hd - 250, cs));
        } else {
          chairs.push(squareAt(hw + 250, f * d, cs));
          chairs.push(squareAt(-hw - 250, f * d, cs));
        }
      }
      return { plines: [box, ...chairs] };
    }
    case "table_coffee":
    case "desk":
    case "fridge":
    case "wardrobe": {
      // Tủ quần áo: KHÔNG còn block — chỉ vẽ rectang tham số (theo kích thước AI).
      return { plines: [box] };
    }
    case "kitchen_counter": {
      const sinkR = Math.min(hd * 0.5, 180);
      return {
        plines: [box],
        circles: [{ x: -hw * 0.4, y: 0, r: sinkR }],
      };
    }
    case "stove": {
      const r = Math.min(hw, hd) * 0.28;
      return {
        plines: [box],
        circles: [
          { x: -hw * 0.45, y: hd * 0.45, r },
          { x: hw * 0.45, y: hd * 0.45, r },
          { x: -hw * 0.45, y: -hd * 0.45, r },
          { x: hw * 0.45, y: -hd * 0.45, r },
        ],
      };
    }
    case "sink":
    case "lavabo": {
      return {
        plines: [box],
        circles: [{ x: 0, y: 0, r: Math.min(hw, hd) * 0.6 }],
      };
    }
    case "toilet": {
      // két nước (rect nhỏ phía sau) + bệ (ellipse ~ vòng tròn dẹt → dùng circle)
      const tank: Pt[] = [
        [-hw, hd - Math.min(200, d * 0.25)],
        [hw, hd - Math.min(200, d * 0.25)],
        [hw, hd],
        [-hw, hd],
      ];
      return { plines: [tank], circles: [{ x: 0, y: -hd * 0.2, r: Math.min(hw, hd * 0.6) }] };
    }
    case "shower": {
      return { plines: [box, [[-hw, -hd], [hw, hd]], [[-hw, hd], [hw, -hd]]], circles: [{ x: 0, y: 0, r: 60 }] };
    }
    case "bathtub": {
      return { plines: [box], circles: [{ x: hw * 0.6, y: 0, r: 70 }], arcs: [] };
    }
    case "car": {
      return { plines: [box] };
    }
    default:
      return { plines: [box] };
  }
}

function squareAt(x: number, y: number, s: number): Pt[] {
  const h = s / 2;
  return [
    [x - h, y - h],
    [x + h, y - h],
    [x + h, y + h],
    [x - h, y + h],
  ];
}

function drawFurniture(L: Lisp, furLayer: string, f: CadFurniture) {
  const shape = furnitureShape(f.kind, f.width, f.depth);
  const tf = (p: Pt): Pt => rot(f.x, f.y, f.rotation, p[0], p[1]);
  for (const pl of shape.plines ?? []) {
    L.pline(furLayer, pl.map(tf), pl.length > 2);
  }
  for (const c of shape.circles ?? []) {
    const [cx, cy] = tf([c.x, c.y]);
    L.circle(furLayer, cx, cy, c.r);
  }
  for (const a of shape.arcs ?? []) {
    const [cx, cy] = tf([a.x, a.y]);
    L.arc(furLayer, cx, cy, a.r, a.a0 + f.rotation, a.a1 + f.rotation);
  }
}

// ───────────────────────── Ban công / Logia (lan can) ─────────────────────────

/** Bỏ dấu + thường hoá để so khớp tên phòng. */
function normName(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

const BALCONY_RE = /(ban\s*cong|logia|loi?gia)/;
const WC_RE = /(wc|ve\s*sinh|toilet|nha\s*ve\s*sinh)/;

/**
 * Ký hiệu CỐT cao độ: tam giác chỉ xuống (đỉnh tại x,y) + số cao độ phía trên, trên
 * layer chữ. Dùng đánh dấu sàn thấp hơn (vd WC -0.050).
 */
function drawCote(L: Lisp, x: number, y: number, size: number, text: string) {
  const s = size;
  L.pline(
    "LT",
    [
      [x - s / 2, y + s],
      [x + s / 2, y + s],
      [x, y],
    ],
    true
  );
  L.mtext("LT", x, y + s * 1.7, size, vnStr(text));
}

/** Điểm (x,y) có nằm SÁT một đoạn tường (trong dung sai) không. */
function nearWall(x: number, y: number, wall: CadWall, tol: number): boolean {
  const len = Math.hypot(wall.x2 - wall.x1, wall.y2 - wall.y1);
  if (len < 1) return false;
  const dx = (wall.x2 - wall.x1) / len;
  const dy = (wall.y2 - wall.y1) / len;
  const t = (x - wall.x1) * dx + (y - wall.y1) * dy;
  if (t < -tol || t > len + tol) return false;
  const px = wall.x1 + dx * t;
  const py = wall.y1 + dy * t;
  return Math.hypot(x - px, y - py) <= tol;
}

/** Cạnh phòng (a→b) có GIÁP TƯỜNG không (3 điểm mẫu đều sát tường nào đó). */
function edgeOnWall(a: Pt, b: Pt, walls: CadWall[]): boolean {
  const samples: Pt[] = [
    [a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25],
    [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2],
    [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75],
  ];
  return samples.every((p) =>
    walls.some((w) => nearWall(p[0], p[1], w, Math.max(120, w.thickness / 2 + 120)))
  );
}

/**
 * Vẽ LAN CAN cho ban công/logia: cạnh GIÁP TƯỜNG bỏ qua (tường đã vẽ); cạnh HỞ vẽ
 * NÉT THẤY (mép sàn) + 1 nét lan can lùi vào trong. Ban công thường 1 cạnh giáp tường +
 * 3 cạnh hở; logia 3 cạnh giáp tường + 1 cạnh hở — tự suy theo hình học, không cần đếm.
 */
function drawBalconyRailings(L: Lisp, plan: CadPlan) {
  for (const room of plan.rooms) {
    if (!BALCONY_RE.test(normName(room.name))) continue;
    const pts = room.points;
    if (pts.length < 3) continue;
    const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
    const cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      if (edgeOnWall(a, b, plan.walls)) continue; // cạnh giáp tường: giữ nguyên tường cũ
      // Cạnh HỞ → nét thấy (mép sàn) + lan can lùi vào trong.
      L.line("LW", a[0], a[1], b[0], b[1]);
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      let nx = -(b[1] - a[1]) / len;
      let ny = (b[0] - a[0]) / len;
      const mx = (a[0] + b[0]) / 2;
      const my = (a[1] + b[1]) / 2;
      if (nx * (cx - mx) + ny * (cy - my) < 0) {
        nx = -nx;
        ny = -ny;
      }
      const off = 100; // lan can lùi vào 100mm
      L.line("LW", a[0] + nx * off, a[1] + ny * off, b[0] + nx * off, b[1] + ny * off);
    }
  }
}

// ───────────────────────── Cấu kiện / công năng ─────────────────────────

/**
 * Vẽ 1 CẤU KIỆN (cầu thang, bồn cây, cây, thang máy, ô thông tầng, dốc, hồ): hình học
 * trên layer nội thất (LF), nhãn trên layer chữ (LT). Cột vẽ riêng (drawColumn).
 */
function drawFeature(L: Lisp, f: CadFeature) {
  const hw = f.width / 2;
  const hd = f.depth / 2;
  const tf = (x: number, y: number): Pt => rot(f.x, f.y, f.rotation, x, y);
  const ln = (a: Pt, b: Pt) => L.line("LF", a[0], a[1], b[0], b[1]);
  const box: Pt[] = [tf(-hw, -hd), tf(hw, -hd), tf(hw, hd), tf(-hw, hd)];

  // Mũi tên ĐI LÊN dọc +Y cục bộ (cầu thang/ram), chấm tròn ở chân.
  const upArrow = (clear: number) => {
    const y0 = -hd + clear;
    const y1 = hd - clear;
    ln(tf(0, y0), tf(0, y1));
    const hLen = Math.min(300, (f.depth - 2 * clear) * 0.35);
    const hWid = Math.min(hw * 0.4, 180);
    ln(tf(0, y1), tf(-hWid, y1 - hLen));
    ln(tf(0, y1), tf(hWid, y1 - hLen));
    const [sx, sy] = tf(0, y0);
    L.circle("LF", sx, sy, Math.min(80, hw * 0.15));
  };

  const labelAt = (text: string) => {
    const [cx, cy] = tf(0, 0);
    const th = Math.min(300, Math.max(120, Math.min(f.width, f.depth) / 4));
    L.mtext("LT", cx, cy, th, vnStr(text));
  };

  switch (f.kind) {
    case "stairs": {
      L.pline("LF", box, true);
      const steps = f.steps && f.steps > 1 ? f.steps : Math.max(2, Math.round(f.depth / 270));
      for (let i = 1; i < steps; i++) {
        const y = -hd + (f.depth * i) / steps;
        ln(tf(-hw, y), tf(hw, y));
      }
      upArrow(Math.min(250, hd * 0.15));
      break;
    }
    case "ramp": {
      L.pline("LF", box, true);
      const steps = f.steps && f.steps > 1 ? f.steps : 6;
      for (let i = 1; i < steps; i++) {
        const y = -hd + (f.depth * i) / steps;
        ln(tf(-hw, y), tf(hw, y));
      }
      upArrow(Math.min(250, hd * 0.15));
      labelAt(f.label ?? "DOC");
      break;
    }
    case "elevator":
    case "void": {
      L.pline("LF", box, true);
      ln(tf(-hw, -hd), tf(hw, hd));
      ln(tf(-hw, hd), tf(hw, -hd));
      labelAt(f.label ?? (f.kind === "elevator" ? "THANG MAY" : "THONG TANG"));
      break;
    }
    case "planter": {
      L.pline("LF", box, true);
      const inset = Math.min(120, hw * 0.3, hd * 0.3);
      L.pline(
        "LF",
        [
          tf(-hw + inset, -hd + inset),
          tf(hw - inset, -hd + inset),
          tf(hw - inset, hd - inset),
          tf(-hw + inset, hd - inset),
        ],
        true
      );
      const [cx, cy] = tf(0, 0);
      const r = Math.min(hw, hd) * 0.45;
      L.circle("LF", cx, cy, r);
      L.circle("LF", cx, cy, r * 0.55);
      break;
    }
    case "tree": {
      const [cx, cy] = tf(0, 0);
      const r = Math.min(hw, hd);
      L.circle("LF", cx, cy, r);
      L.circle("LF", cx, cy, r * 0.62);
      L.circle("LF", cx, cy, Math.min(60, r * 0.12));
      break;
    }
    case "pond": {
      L.pline("LF", box, true);
      for (const k of [-0.4, 0, 0.4]) {
        ln(tf(-hw * 0.8, hd * k), tf(hw * 0.8, hd * k));
      }
      if (f.label) labelAt(f.label);
      break;
    }
    default:
      L.pline("LF", box, true);
  }
}

/** CỘT: ô ĐẶC (hatch SOLID) trên layer cột — đặt CLAYER/HPLAYER = LC trước khi gọi. */
function drawColumn(L: Lisp, f: CadFeature) {
  const hw = f.width / 2;
  const hd = f.depth / 2;
  const tf = (x: number, y: number): Pt => rot(f.x, f.y, f.rotation, x, y);
  L.pline("LC", [tf(-hw, -hd), tf(hw, -hd), tf(hw, hd), tf(-hw, hd)], true);
  L.raw('(command "_.-HATCH" "_P" "SOLID" "_S" (entlast) "" "")');
}

// ───────────────────────── Chèn BLOCK THẬT ─────────────────────────

/** Chèn 1 món nội thất bằng block thật (đã chuẩn hoá mm, tâm tại gốc). */
function insertFurnitureBlock(L: Lisp, dir: string, f: CadFurniture, blk: BlockDef) {
  const file = blockFile(dir, blk.key);
  // Chỉ block "scalable" mới kéo theo 1 trục cho vừa phòng; còn lại giữ kích thước thật.
  const sx = blk.scalable === "x" ? Math.max(0.3, f.width / blk.w) : 1;
  const sy = blk.scalable === "y" ? Math.max(0.3, f.depth / blk.h) : 1;
  L.insert(`F_${blk.key}`, file, f.x, f.y, sx, sy, f.rotation);
}

/** Bàn ăn: mặt bàn vẽ tham số + ghế ăn (block thật) bám 2 cạnh dài, quay mặt vào bàn. */
function insertDiningSet(L: Lisp, dir: string, f: CadFurniture) {
  const hw = f.width / 2;
  const hd = f.depth / 2;
  const tf = (p: Pt): Pt => rot(f.x, f.y, f.rotation, p[0], p[1]);
  const top: Pt[] = [
    [-hw, -hd],
    [hw, -hd],
    [hw, hd],
    [-hw, hd],
  ];
  L.pline("LF", top.map(tf), true);

  const file = blockFile(dir, DINING_CHAIR.key);
  const cd = DINING_CHAIR.h; // bề sâu ghế (mm)
  const gap = 40;
  const alongX = f.width >= f.depth;
  const edge = alongX ? f.width : f.depth;
  const count = Math.max(1, Math.min(4, Math.floor(edge / 650)));
  for (let i = 0; i < count; i++) {
    const t = (i + 1) / (count + 1) - 0.5;
    // 2 cạnh dài; ghế quay LƯNG (+Y cục bộ block) ra NGOÀI bàn.
    const pairs: { lx: number; ly: number; ang: number }[] = alongX
      ? [
          { lx: t * f.width, ly: hd + gap + cd / 2, ang: 0 },
          { lx: t * f.width, ly: -(hd + gap + cd / 2), ang: 180 },
        ]
      : [
          { lx: hw + gap + cd / 2, ly: t * f.depth, ang: -90 },
          { lx: -(hw + gap + cd / 2), ly: t * f.depth, ang: 90 },
        ];
    for (const c of pairs) {
      const [wx, wy] = tf([c.lx, c.ly]);
      L.insert(`F_${DINING_CHAIR.key}`, file, wx, wy, 1, 1, f.rotation + c.ang);
    }
  }
}

/**
 * Chèn block CỬA ĐI thật vào lỗ mở. Block có ĐIỂM CHÈN = BẢN LỀ tại gốc (0,0): cánh đóng
 * dọc -X tới (-width,0), cung quét về -Y. Ta đặt bản lề vào ĐÚNG đầu lỗ mở (trái/phải theo
 * op.hinge), xoay để cánh chạy dọc lỗ mở, và lật trục Y để cung quét đúng chiều mở (in/out).
 * Scale theo width lỗ mở / width block để cánh khít lỗ.
 */
function insertDoorBlock(L: Lisp, dir: string, wall: CadWall, op: CadOpening, def: DoorBlockDef) {
  const len = Math.hypot(wall.x2 - wall.x1, wall.y2 - wall.y1);
  if (len < 1) return;
  const dx = (wall.x2 - wall.x1) / len;
  const dy = (wall.y2 - wall.y1) / len;
  const nx = -dy; // pháp tuyến tường
  const ny = dx;
  const w = op.width;

  // Bản lề ở 1 đầu lỗ mở; cánh mở dọc lỗ về phía đầu kia (u là hướng đó).
  const hingeLeft = op.hinge !== "right"; // mặc định bản lề bên x1
  const sgn = hingeLeft ? 1 : -1;
  const hx = op.x - dx * (w / 2) * sgn; // điểm bản lề
  const hy = op.y - dy * (w / 2) * sgn;
  const ux = dx * sgn; // hướng bản lề → đầu kia lỗ mở
  const uy = dy * sgn;

  // Chiều mở: in = về +pháp tuyến, out = về -pháp tuyến (khớp drawOpening).
  const sIn = op.swing !== "out";
  const swx = sIn ? nx : -nx;
  const swy = sIn ? ny : -ny;

  // Xoay r để (-X cục bộ) → u : r = atan2(-uy,-ux).
  const r = Math.atan2(-uy, -ux);
  const baseSwX = Math.sin(r); // = R(r)·(0,-1) : phương cung quét khi yscale=+1
  const baseSwY = -Math.cos(r);
  const my = baseSwX * swx + baseSwY * swy >= 0 ? 1 : -1; // lật Y nếu quét ngược chiều mở
  const scale = w / def.width;

  L.insert(`D_${def.key}`, blockFile(dir, def.key), hx, hy, scale, scale * my, (r * 180) / Math.PI);
}

// ───────────────────────── Tổng hợp ─────────────────────────

/**
 * Tạo sinh toàn bộ LISP vẽ mặt bằng (KHÔNG gồm lệnh lưu/thoát — runner sẽ bọc).
 * Trả về chuỗi nhiều dòng, mỗi dòng là 1 form LISP hoàn chỉnh.
 */
export function planToLisp(plan: CadPlan, blocksDir?: string | null): string {
  const L = new Lisp();
  const useBlocks = Boolean(blocksDir);

  // Dữ liệu cũ có thể thiếu mảng features — chuẩn hoá để không vỡ.
  if (!Array.isArray(plan.features)) plan.features = [];

  // Xếp nội thất thành khay block PHÍA TRÊN mặt bằng để người dùng tự kéo vào vị trí.
  trayFurniture(plan);

  // Biến layer (dựng ASCII-safe). Dùng trong (cons 8 <var>).
  L.raw('(setvar "CMDECHO" 0)');
  L.raw('(setvar "FILEDIA" 0)');
  L.raw('(setvar "OSMODE" 0)');
  L.raw('(setvar "ATTREQ" 0)'); // không hỏi thuộc tính khi chèn block
  L.raw('(setvar "ATTDIA" 0)');
  L.raw('(setvar "INSUNITS" 4)'); // mm — khớp block đã chuẩn hoá, không tự rescale
  L.raw(`(setq LW ${vnStr(LAYER.wall)})`);
  L.raw(`(setq LH ${vnStr(LAYER.hatch)})`);
  L.raw(`(setq LD ${vnStr(LAYER.door)})`);
  L.raw(`(setq LF ${vnStr(LAYER.furniture)})`);
  L.raw(`(setq LC ${vnStr(LAYER.column)})`);
  L.raw(`(setq LT ${vnStr(LAYER.text)})`);
  L.raw(`(setq LM ${vnStr(LAYER.dim)})`);

  // Gom lỗ mở theo từng tường.
  const byWall = new Map<number, CadOpening[]>();
  for (const op of plan.openings) {
    const list = byWall.get(op.wallIndex) ?? [];
    list.push(op);
    byWall.set(op.wallIndex, list);
  }

  // 1) Tường: vẽ khối đặc từng đoạn, rồi REGION+UNION làm sạch góc, hatch ANSI31.
  plan.walls.forEach((wall, i) => {
    drawWall(L, "LW", wall, byWall.get(i) ?? []);
  });
  if (plan.walls.length > 0) {
    L.raw('(setvar "CLAYER" LW)');
    // Gom mọi polyline tường → region → hợp nhất (góc tự làm sạch).
    L.raw('(setq _ws (ssget "_X" (list (cons 0 "LWPOLYLINE") (cons 8 LW))))');
    L.raw('(if _ws (progn (command "_.REGION" _ws "")');
    L.raw('  (setq _rs (ssget "_X" (list (cons 0 "REGION") (cons 8 LW))))');
    L.raw('  (if (and _rs (> (sslength _rs) 1)) (command "_.UNION" _rs ""))');
    // Hatch ANSI31 scale 300 lên TỪNG region tường (theo ename — tin cậy hơn
    // truyền cả selection set), đặt trên layer HATCH.
    L.raw('  (setq _rs2 (ssget "_X" (list (cons 0 "REGION") (cons 8 LW))))');
    // Template ép hatch về layer riêng qua HPLAYER → ghi đè để hatch nằm đúng
    // layer "1.AAA_HATCH" của ta.
    L.raw('  (setvar "HPLAYER" LH)');
    L.raw('  (setvar "CLAYER" LH)');
    L.raw('  (if _rs2 (progn (setq _i 0) (while (< _i (sslength _rs2))');
    L.raw('    (command "_.-HATCH" "_P" "ANSI31" "300" "0" "_S" (ssname _rs2 _i) "" "")');
    L.raw('    (setq _i (1+ _i)))))');
    L.raw('))');
  }

  // 1b) Ban công/Logia: vẽ lan can ở cạnh HỞ (cạnh giáp tường giữ nguyên tường).
  drawBalconyRailings(L, plan);

  // 2) Cửa. Cửa đi dùng BLOCK thật (cua900/cua750) khi có thư viện; cửa sổ & cửa lệch
  // chuẩn vẫn vẽ tham số. (Lỗ mở trên tường đã được trừ ở bước drawWall.)
  if (useBlocks) L.raw('(setvar "CLAYER" LD)');
  for (const op of plan.openings) {
    const wall = plan.walls[op.wallIndex];
    if (!wall) continue;
    // Cửa đi / lỗ mở RỘNG > 1m (cửa chính lớn, lối thông): CHỈ đục lỗ, để TRỐNG —
    // không cánh, không block (lỗ trên tường đã được trừ ở drawWall).
    if (op.kind === "door" && op.width > 1000) continue;
    const doorDef = op.kind === "door" && useBlocks ? pickDoorBlock(op.width) : null;
    if (doorDef) insertDoorBlock(L, blocksDir!, wall, op, doorDef);
    else drawOpening(L, "LD", wall, op);
  }

  // 3) Nội thất — ưu tiên BLOCK thật từ thư viện, fallback vẽ tham số.
  if (useBlocks) L.raw('(setvar "CLAYER" LF)');
  for (const f of plan.furniture) {
    const blk = useBlocks ? resolveFurnitureBlock(f) : undefined;
    if (blk) insertFurnitureBlock(L, blocksDir!, f, blk);
    else if (useBlocks && f.kind === "table_dining") insertDiningSet(L, blocksDir!, f);
    else drawFurniture(L, "LF", f);
  }

  // 3b) Cấu kiện/công năng: cầu thang, bồn cây, cây, thang máy, ô thông tầng, dốc, hồ.
  const featGeom = plan.features.filter((f) => f.kind !== "column");
  const featCols = plan.features.filter((f) => f.kind === "column");
  for (const f of featGeom) drawFeature(L, f);
  if (featCols.length > 0) {
    L.raw('(setvar "CLAYER" LC)');
    L.raw('(setvar "HPLAYER" LC)');
    for (const f of featCols) drawColumn(L, f);
  }

  // 4) Nhãn phòng (MTEXT 2 dòng: tên + diện tích).
  const extent = Math.max(plan.width, plan.height, 1000);
  const th = Math.min(400, Math.max(150, extent / 60));
  for (const r of plan.rooms) {
    const cx = r.points.reduce((s, p) => s + p[0], 0) / r.points.length;
    const cy = r.points.reduce((s, p) => s + p[1], 0) / r.points.length;
    // Tên phòng IN HOA toàn bộ; dòng diện tích "50.0 m2" giữ nguyên (không in hoa "m2").
    const nameUpper = r.name.toUpperCase();
    const label =
      r.area > 0 ? vnStr(`${nameUpper}\\P${r.area.toFixed(1)} m2`) : vnStr(nameUpper);
    L.mtext("LT", cx, cy, th, label);
    // Nhà vệ sinh: cốt sàn mặc định THẤP HƠN 0.050 so với sàn ở/bếp/khách → ghi cote -0.050.
    if (WC_RE.test(normName(r.name))) {
      drawCote(L, cx, cy - th * 2, th * 0.9, "-0.050");
    }
  }

  // 5) Kích thước: 2 ĐƯỜNG DIM mỗi phương — đường TRONG (gần nhà) dim từng NHỊP giữa các
  //    giao tường; đường NGOÀI (xa hơn) dim TỔNG. Tự dựng từ vị trí tường, không dùng
  //    dimension AI cho. Phương ngang đặt phía dưới, phương đứng đặt bên trái.
  if (plan.walls.length > 0) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const w of plan.walls) {
      minX = Math.min(minX, w.x1, w.x2);
      maxX = Math.max(maxX, w.x1, w.x2);
      minY = Math.min(minY, w.y1, w.y2);
      maxY = Math.max(maxY, w.y1, w.y2);
    }

    // Gom các trạm gần nhau (< 80mm) thành 1.
    const cluster = (vals: number[]): number[] => {
      const s = [...vals].sort((a, b) => a - b);
      const out: number[] = [];
      for (const v of s) if (out.length === 0 || Math.abs(v - out[out.length - 1]) > 80) out.push(v);
      return out;
    };

    // Trạm X = tường ĐỨNG; trạm Y = tường NGANG; luôn kèm 2 mép bao.
    const xs = [minX, maxX];
    const ys = [minY, maxY];
    for (const w of plan.walls) {
      const dxw = Math.abs(w.x2 - w.x1);
      const dyw = Math.abs(w.y2 - w.y1);
      if (dxw <= dyw && dxw < 200) xs.push((w.x1 + w.x2) / 2);
      if (dyw <= dxw && dyw < 200) ys.push((w.y1 + w.y2) / 2);
    }
    const X = cluster(xs);
    const Y = cluster(ys);

    const ext = Math.max(maxX - minX, maxY - minY, 1000);
    const o1 = Math.max(700, ext * 0.035); // đường trong (nhịp)
    const o2 = o1 + Math.max(700, ext * 0.045); // đường ngoài (tổng)

    L.raw('(setvar "DIMASSOC" 2)');
    L.raw('(setvar "CLAYER" LM)');
    const forceLayer = '(if (setq e1 (entlast)) (entmod (subst (cons 8 LM) (assoc 8 (entget e1)) (entget e1))))';
    const dimH = (x1: number, x2: number, yb: number, yLine: number) => {
      L.raw(
        `(command "_.DIMLINEAR" "_non" ${pt(x1, yb)} "_non" ${pt(x2, yb)} "_H" "_non" ${pt((x1 + x2) / 2, yLine)})`
      );
      L.raw(forceLayer);
    };
    const dimV = (y1: number, y2: number, xb: number, xLine: number) => {
      L.raw(
        `(command "_.DIMLINEAR" "_non" ${pt(xb, y1)} "_non" ${pt(xb, y2)} "_V" "_non" ${pt(xLine, (y1 + y2) / 2)})`
      );
      L.raw(forceLayer);
    };

    // Ngang (dưới): trong = từng nhịp X; ngoài = tổng.
    for (let i = 0; i < X.length - 1; i++) dimH(X[i], X[i + 1], minY, minY - o1);
    if (X.length > 2) dimH(X[0], X[X.length - 1], minY, minY - o2);
    // Đứng (trái): trong = từng nhịp Y; ngoài = tổng.
    for (let i = 0; i < Y.length - 1; i++) dimV(Y[i], Y[i + 1], minX, minX - o1);
    if (Y.length > 2) dimV(Y[0], Y[Y.length - 1], minX, minX - o2);
  }

  // 6) (KHÔNG dùng OVERKILL) — accoreconsole KHÔNG nạp lệnh OVERKILL (báo "Unknown
  //    command", làm hỏng cả script → không lưu được DWG). Nét trùng ở tường đã được
  //    REGION+UNION làm sạch ở bước 1; phần còn lại chấp nhận giữ nguyên.
  L.raw('(setvar "CMDECHO" 0)');

  L.raw('(princ "\\nPLAN_DRAWN")');
  return L.lines.join("\n");
}
