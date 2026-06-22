// Hậu xử lý BỐ TRÍ nội thất: KHÔNG tin toạ độ AI, chỉ tin "món nào ở phòng nào". Mỗi món
// ÁP TƯỜNG được tự tính lại vị trí: tìm cạnh tường gần nhất của phòng, XOAY LƯNG vào tường,
// rồi XẾP LẦN LƯỢT dọc tường (không đè nhau, né ô cửa). Món GIỮA PHÒNG (bàn ăn/bàn trà) đặt
// quanh tâm phòng rồi đẩy tránh các món khác. Mục tiêu: sát tường, trong nhà, không chồng.

import { resolveFurnitureBlock } from "@/lib/cad-blocks";
import type {
  CadFurniture,
  CadOpening,
  CadPlan,
  CadRoom,
  FurnitureKind,
} from "@/lib/image-to-cad-types";

type Pt = [number, number];

/** Món ÁP TƯỜNG (lưng quay vào tường). Còn lại coi là món giữa phòng. */
const WALL_KINDS: ReadonlySet<FurnitureKind> = new Set<FurnitureKind>([
  "bed_double",
  "bed_single",
  "wardrobe",
  "sofa",
  "desk",
  "kitchen_counter",
  "stove",
  "fridge",
  "sink",
  "toilet",
  "lavabo",
  "shower",
  "bathtub",
]);

const WALL_CLEAR = 60; // khe hở mép trong tường (mm)
const GAP = 80; // khe hở giữa 2 món cạnh nhau (mm)

/** Kích thước CHIẾM CHỖ (mm) [bề rộng theo trục cục bộ X, bề sâu theo Y]. */
function footprint(f: CadFurniture): [number, number] {
  const b = resolveFurnitureBlock(f);
  if (!b) return [Math.max(100, f.width), Math.max(100, f.depth)];
  const w = b.scalable === "x" ? Math.max(b.w, f.width) : b.w;
  const h = b.scalable === "y" ? Math.max(b.h, f.depth) : b.h;
  return [w, h];
}

/** Nửa khung bao TRỤC CHÍNH (AABB) sau khi xoay rotation độ. */
function halfExtents(f: CadFurniture): [number, number] {
  const [w, h] = footprint(f);
  const r = (f.rotation * Math.PI) / 180;
  const c = Math.abs(Math.cos(r));
  const s = Math.abs(Math.sin(r));
  return [(w / 2) * c + (h / 2) * s, (w / 2) * s + (h / 2) * c];
}

function polyBBox(pts: Pt[]) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of pts) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return { minX, minY, maxX, maxY };
}

function centroid(pts: Pt[]): Pt {
  return [
    pts.reduce((s, p) => s + p[0], 0) / pts.length,
    pts.reduce((s, p) => s + p[1], 0) / pts.length,
  ];
}

function pointInPoly(x: number, y: number, pts: Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function roomOf(x: number, y: number, rooms: CadRoom[]): number {
  for (let i = 0; i < rooms.length; i++) if (pointInPoly(x, y, rooms[i].points)) return i;
  let best = -1;
  let bestD = Infinity;
  rooms.forEach((r, i) => {
    const c = centroid(r.points);
    const d = (c[0] - x) ** 2 + (c[1] - y) ** 2;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  });
  return best;
}

function clamp(v: number, lo: number, hi: number): number {
  if (lo > hi) return (lo + hi) / 2;
  return Math.min(hi, Math.max(lo, v));
}

interface Edge {
  ax: number;
  ay: number;
  len: number;
  dx: number; // hướng dọc cạnh (đơn vị)
  dy: number;
  nx: number; // pháp tuyến HƯỚNG VÀO TRONG phòng (đơn vị)
  ny: number;
}

/** Các cạnh đa giác phòng kèm pháp tuyến hướng vào trong. */
function roomEdges(pts: Pt[]): Edge[] {
  const c = centroid(pts);
  const edges: Edge[] = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len < 1) continue;
    const dx = (b[0] - a[0]) / len;
    const dy = (b[1] - a[1]) / len;
    let nx = -dy;
    let ny = dx;
    const mx = (a[0] + b[0]) / 2;
    const my = (a[1] + b[1]) / 2;
    if (nx * (c[0] - mx) + ny * (c[1] - my) < 0) {
      nx = -nx;
      ny = -ny;
    }
    edges.push({ ax: a[0], ay: a[1], len, dx, dy, nx, ny });
  }
  return edges;
}

/** Chiếu điểm lên cạnh → tham số dọc cạnh (mm, kẹp trong [0,len]) + khoảng cách vuông góc. */
function projOnEdge(e: Edge, x: number, y: number): { t: number; perp: number } {
  const t = clamp((x - e.ax) * e.dx + (y - e.ay) * e.dy, 0, e.len);
  const px = e.ax + e.dx * t;
  const py = e.ay + e.dy * t;
  return { t, perp: Math.hypot(x - px, y - py) };
}

interface Reserved {
  a: number;
  b: number;
}

/** Đẩy [start,start+w] ra khỏi các đoạn ĐÃ GIỮ (cửa) gần nhất về phía sau. */
function avoidReserved(start: number, w: number, reserved: Reserved[]): number {
  let s = start;
  let changed = true;
  let guard = 0;
  while (changed && guard++ < 20) {
    changed = false;
    for (const r of reserved) {
      if (s < r.b && s + w > r.a) {
        s = r.b + GAP;
        changed = true;
      }
    }
  }
  return s;
}

export function layoutFurniture(plan: CadPlan): CadPlan {
  if (plan.furniture.length === 0) return plan;

  // Gom nội thất theo phòng.
  const byRoom = new Map<number, CadFurniture[]>();
  for (const f of plan.furniture) {
    const ri = roomOf(f.x, f.y, plan.rooms);
    if (ri < 0) continue;
    const list = byRoom.get(ri) ?? [];
    list.push(f);
    byRoom.set(ri, list);
  }

  for (const [ri, items] of byRoom) {
    const room = plan.rooms[ri];
    const edges = roomEdges(room.points);
    if (edges.length === 0) continue;
    const bb = polyBBox(room.points);

    // Ô CỬA giáp phòng (để né khi xếp đồ). Chiếu lên từng cạnh.
    const doorsOnEdge: Reserved[][] = edges.map(() => []);
    for (const op of plan.openings) {
      if (op.kind !== "door") continue;
      edges.forEach((e, ei) => {
        const { t, perp } = projOnEdge(e, op.x, op.y);
        if (perp < 250 && t > 0 && t < e.len) {
          doorsOnEdge[ei].push({ a: t - op.width / 2 - GAP, b: t + op.width / 2 + GAP });
        }
      });
    }

    const wallItems = items.filter((f) => WALL_KINDS.has(f.kind));
    const freeItems = items.filter((f) => !WALL_KINDS.has(f.kind));

    // 1)+2) Gán & xếp: món TO trước, ưu tiên cạnh gần nhất CÒN CHỖ; cạnh đầy thì tràn sang
    // cạnh khác. Mỗi cạnh có "con trỏ" chạy dọc; lưng món quay ra tường; né ô cửa.
    const cursor = edges.map(() => WALL_CLEAR);
    const ordered = wallItems
      .map((f) => {
        const [w, d] = footprint(f);
        return { f, w, d };
      })
      .sort((a, b) => b.w - a.w);

    for (const it of ordered) {
      // Xếp hạng cạnh theo: (vừa chỗ?) rồi khoảng cách vuông góc nhỏ nhất (gần AI nhất).
      const ranked = edges
        .map((e, ei) => {
          const { perp } = projOnEdge(e, it.f.x, it.f.y);
          const remain = e.len - WALL_CLEAR - cursor[ei];
          return { ei, perp, fits: remain >= it.w, remain };
        })
        .sort((a, b) => {
          if (a.fits !== b.fits) return a.fits ? -1 : 1; // ưu tiên cạnh còn chỗ
          if (a.fits) return a.perp - b.perp; // cùng vừa: gần nhất
          return b.remain - a.remain; // đều chật: chọn cạnh rộng nhất
        });
      const pick = ranked[0];
      const e = edges[pick.ei];
      const outAngle = (Math.atan2(-e.ny, -e.nx) * 180) / Math.PI;

      let start = avoidReserved(cursor[pick.ei], it.w, doorsOnEdge[pick.ei]);
      if (start + it.w > e.len - WALL_CLEAR) {
        start = Math.max(WALL_CLEAR, e.len - WALL_CLEAR - it.w);
      }
      const t = start + it.w / 2;
      it.f.x = e.ax + e.dx * t + e.nx * (it.d / 2 + WALL_CLEAR);
      it.f.y = e.ay + e.dy * t + e.ny * (it.d / 2 + WALL_CLEAR);
      it.f.rotation = ((outAngle - 90) % 360 + 360) % 360; // block quy ước LƯNG = +Y cục bộ
      cursor[pick.ei] = start + it.w + GAP;
    }

    // 3) Món giữa phòng: đặt quanh tâm phòng, kẹp trong khung, rồi đẩy tránh mọi món.
    const c = centroid(room.points);
    freeItems.forEach((f, k) => {
      const [hx, hy] = halfExtents(f);
      f.x = clamp(c[0] + (k % 2 ? 1 : -1) * (k > 1 ? 600 : 0), bb.minX + WALL_CLEAR + hx, bb.maxX - WALL_CLEAR - hx);
      f.y = clamp(c[1], bb.minY + WALL_CLEAR + hy, bb.maxY - WALL_CLEAR - hy);
    });

    // 4) Đẩy tách: chỉ XÊ DỊCH món giữa phòng (món áp tường giữ nguyên).
    const all = items;
    const ext = all.map(halfExtents);
    const isFree = all.map((f) => !WALL_KINDS.has(f.kind));
    for (let iter = 0; iter < 12; iter++) {
      let moved = false;
      for (let i = 0; i < all.length; i++) {
        for (let j = i + 1; j < all.length; j++) {
          if (!isFree[i] && !isFree[j]) continue; // 2 món tường: bỏ qua
          const a = all[i];
          const b = all[j];
          const ox = ext[i][0] + ext[j][0] - Math.abs(a.x - b.x);
          const oy = ext[i][1] + ext[j][1] - Math.abs(a.y - b.y);
          if (ox <= 1 || oy <= 1) continue;
          // Đẩy theo trục chồng ít hơn; món tường cố định → dồn hết vào món free.
          if (ox < oy) {
            const dir = a.x <= b.x ? -1 : 1;
            if (isFree[i] && isFree[j]) {
              a.x += (ox / 2) * dir;
              b.x -= (ox / 2) * dir;
            } else if (isFree[i]) a.x += ox * dir;
            else b.x -= ox * dir;
          } else {
            const dir = a.y <= b.y ? -1 : 1;
            if (isFree[i] && isFree[j]) {
              a.y += (oy / 2) * dir;
              b.y -= (oy / 2) * dir;
            } else if (isFree[i]) a.y += oy * dir;
            else b.y -= oy * dir;
          }
          moved = true;
        }
      }
      if (!moved) break;
    }

    // 5) Kẹp lần cuối các món giữa phòng trong khung phòng.
    for (const f of freeItems) {
      const [hx, hy] = halfExtents(f);
      f.x = clamp(f.x, bb.minX + WALL_CLEAR + hx, bb.maxX - WALL_CLEAR - hx);
      f.y = clamp(f.y, bb.minY + WALL_CLEAR + hy, bb.maxY - WALL_CLEAR - hy);
    }
  }

  return plan;
}
