// Bộ sinh AutoLISP từ mô hình mặt bằng (CadPlan). LISP sinh ra là THUẦN ASCII: mọi
// chữ tiếng Việt (tên layer, tên phòng…) được dựng bằng (chr <mã Unicode>) nên không
// dính lỗi codepage. AutoCAD (accoreconsole) nạp & chạy LISP này TRÊN template của
// người dùng → vẽ tường (2 nét + hatch), cửa khoét tường, nội thất, ghi chú, kích
// thước lên ĐÚNG layer template, rồi lưu DWG.

import type {
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
import { layoutFurniture } from "@/lib/cad-layout";

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

// ───────────────────────── Helpers entmake (sinh dòng LISP) ─────────────────────────

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
 * Sinh toàn bộ LISP vẽ mặt bằng (KHÔNG gồm lệnh lưu/thoát — runner sẽ bọc).
 * Trả về chuỗi nhiều dòng, mỗi dòng là 1 form LISP hoàn chỉnh.
 */
export function planToLisp(plan: CadPlan, blocksDir?: string | null): string {
  const L = new Lisp();
  const useBlocks = Boolean(blocksDir);

  // Bố trí lại nội thất (kẹp trong phòng, không đè tường/không chồng nhau).
  layoutFurniture(plan);

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

  // 2) Cửa. Cửa đi dùng BLOCK thật (cua900/cua750) khi có thư viện; cửa sổ & cửa lệch
  // chuẩn vẫn vẽ tham số. (Lỗ mở trên tường đã được trừ ở bước drawWall.)
  if (useBlocks) L.raw('(setvar "CLAYER" LD)');
  for (const op of plan.openings) {
    const wall = plan.walls[op.wallIndex];
    if (!wall) continue;
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

  // 4) Nhãn phòng (MTEXT 2 dòng: tên + diện tích).
  const extent = Math.max(plan.width, plan.height, 1000);
  const th = Math.min(400, Math.max(150, extent / 60));
  for (const r of plan.rooms) {
    const cx = r.points.reduce((s, p) => s + p[0], 0) / r.points.length;
    const cy = r.points.reduce((s, p) => s + p[1], 0) / r.points.length;
    const label =
      r.area > 0 ? vnStr(`${r.name}\\P${r.area.toFixed(1)} m2`) : vnStr(r.name);
    L.mtext("LT", cx, cy, th, label);
  }

  // 5) Kích thước (DIMLINEAR, dùng dimstyle template; ép entity về layer DIM).
  if (plan.dimensions.length > 0) {
    L.raw('(setvar "DIMASSOC" 2)');
    L.raw('(setvar "CLAYER" LM)');
    const ccx = plan.width / 2;
    const ccy = plan.height / 2;
    for (const dmn of plan.dimensions) {
      const mx = (dmn.x1 + dmn.x2) / 2;
      const my = (dmn.y1 + dmn.y2) / 2;
      const len = Math.hypot(dmn.x2 - dmn.x1, dmn.y2 - dmn.y1) || 1;
      let nx = -(dmn.y2 - dmn.y1) / len;
      let ny = (dmn.x2 - dmn.x1) / len;
      // Đẩy đường kích thước ra XA tâm bản vẽ.
      if ((mx - ccx) * nx + (my - ccy) * ny < 0) {
        nx = -nx;
        ny = -ny;
      }
      const off = 700;
      const p3x = mx + nx * off;
      const p3y = my + ny * off;
      L.raw(
        `(command "_.DIMLINEAR" "_non" ${pt(dmn.x1, dmn.y1)} "_non" ${pt(dmn.x2, dmn.y2)} "_non" ${pt(p3x, p3y)})`
      );
      // Ép kích thước vừa tạo về đúng layer DIM của template.
      L.raw('(if (setq e1 (entlast)) (entmod (subst (cons 8 LM) (assoc 8 (entget e1)) (entget e1))))');
    }
  }

  L.raw('(princ "\\nPLAN_DRAWN")');
  return L.lines.join("\n");
}
