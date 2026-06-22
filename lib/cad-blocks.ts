// Thư viện BLOCK THẬT trích từ bokihieuvablock.dwg. Mỗi block đã được CHUẨN HOÁ một
// lần (xem cad-assets/blocks): quy về đơn vị mm và DỜI TÂM hình về gốc (0,0) — nên khi
// chèn chỉ cần đặt tâm vào toạ độ mong muốn, tỉ lệ 1, không phải bù đơn vị/độ lệch.
// accoreconsole chèn các file này vào template qua "_.-INSERT name=path".

import fs from "node:fs";
import path from "node:path";
import type { CadFurniture, FurnitureKind } from "@/lib/image-to-cad-types";

export interface BlockDef {
  /** Tên file (không .dwg) trong cad-assets/blocks và tên block khi chèn. */
  key: string;
  /** Bề rộng thật (mm) theo trục X cục bộ sau chuẩn hoá. */
  w: number;
  /** Bề sâu thật (mm) theo trục Y cục bộ sau chuẩn hoá. */
  h: number;
  /**
   * Cho phép kéo dài theo trục nào để vừa phòng ("x" = theo bề rộng). Trục còn lại giữ
   * nguyên kích thước thật (vd tủ quần áo: sâu 600 cố định, dài thay đổi).
   */
  scalable?: "x" | "y";
}

/**
 * Map loại nội thất → block thật. Loại không có ở đây vẫn vẽ tham số (fallback).
 * Kích thước (mm) đo từ block đã chuẩn hoá. Block từ blocknew.dwg ("mb"=mặt bằng) cho:
 * shower, stove, sink, fridge, lavabo, bed (sofa xử lý riêng bên dưới). Còn toilet, bathtub,
 * lounge_chair giữ block cũ. KHÔNG còn block tủ quần áo (wardrobe) — vẽ rectang tham số.
 */
export const FURNITURE_BLOCKS: Partial<Record<FurnitureKind, BlockDef>> = {
  toilet: { key: "toilet", w: 483, h: 780 },
  lavabo: { key: "lavabo", w: 551, h: 531 },
  shower: { key: "shower", w: 546, h: 285 },
  bathtub: { key: "bathtub", w: 1679, h: 774 },
  bed_double: { key: "bed", w: 1800, h: 2100 },
  bed_single: { key: "bed", w: 1800, h: 2100 },
  stove: { key: "stove", w: 731, h: 421 },
  sink: { key: "sink", w: 800, h: 500 },
  fridge: { key: "fridge", w: 800, h: 640 },
  lounge_chair: { key: "lounge", w: 876, h: 737 },
};

/** Sofa có 2 cỡ block — chọn theo bề rộng AI đọc được (sofato ~3 chỗ, sofanho ~2 chỗ). */
export const SOFA_BLOCKS = {
  big: { key: "sofato", w: 2351, h: 800 } as BlockDef,
  small: { key: "sofanho", w: 1651, h: 800 } as BlockDef,
};

/** Chọn block sofa to/nhỏ theo bề rộng (mm). */
export function pickSofaBlock(width: number): BlockDef {
  return width >= 2000 ? SOFA_BLOCKS.big : SOFA_BLOCKS.small;
}

/** Block thật cho 1 món nội thất (sofa chọn theo cỡ; còn lại tra FURNITURE_BLOCKS). */
export function resolveFurnitureBlock(f: CadFurniture): BlockDef | undefined {
  if (f.kind === "sofa") return pickSofaBlock(f.width);
  return FURNITURE_BLOCKS[f.kind];
}

/** Block ghế bàn ăn (xếp quanh bàn ăn tham số). */
export const DINING_CHAIR: BlockDef = { key: "dchair", w: 452, h: 486 };

/**
 * Block cửa theo bề rộng tiêu chuẩn. Block (từ blocknew.dwg) có ĐIỂM CHÈN = BẢN LỀ tại gốc
 * (0,0): cánh khi đóng nằm dọc -X (tới (-width,0)), cung quét về -Y. Nhờ vậy chèn thẳng tại
 * đầu lỗ mở (không cần bù lệch tâm như trước).
 */
export interface DoorBlockDef {
  key: string;
  /** Bề rộng cánh danh nghĩa (mm) — dùng để chọn block & scale cho khớp lỗ mở. */
  width: number;
}

export const DOOR_BLOCKS: DoorBlockDef[] = [
  { key: "door900", width: 900 },
  { key: "door750", width: 750 },
];

/** Chọn block cửa gần bề rộng nhất (chỉ cửa đi); null nếu không hợp (vd cửa quá to). */
export function pickDoorBlock(width: number): DoorBlockDef | null {
  let best: DoorBlockDef | null = null;
  let bestErr = Infinity;
  for (const d of DOOR_BLOCKS) {
    const err = Math.abs(d.width - width);
    if (err < bestErr) {
      bestErr = err;
      best = d;
    }
  }
  // Nếu lệch quá xa (>350mm) thì không dùng block, để vẽ cửa tham số.
  return bestErr <= 350 ? best : null;
}

/**
 * Dò thư mục chứa block đã chuẩn hoá (public/cad-blocks). Ở dev cwd = gốc app; ở bản
 * Electron standalone cwd = thư mục standalone (đã copy 'public' vào). Có thêm dự phòng
 * cạnh module & resourcesPath. Trả null nếu không có → generator dùng vẽ tham số.
 */
export function resolveBlocksDir(): string | null {
  const candidates = [
    path.join(process.cwd(), "public", "cad-blocks"),
    path.join(process.cwd(), "cad-blocks"),
    path.join(__dirname, "..", "public", "cad-blocks"),
    path.join(__dirname, "..", "..", "public", "cad-blocks"),
  ];
  const res = process.env["RESOURCES_PATH"] || (process as { resourcesPath?: string }).resourcesPath;
  if (res) candidates.push(path.join(res, "standalone", "public", "cad-blocks"));
  for (const c of candidates) {
    try {
      if (fs.existsSync(path.join(c, "toilet.dwg"))) return c;
    } catch {
      /* bỏ qua */
    }
  }
  return null;
}

/** Đường dẫn forward-slash tới file block (cho LISP). */
export function blockFile(blocksDir: string, key: string): string {
  return path.join(blocksDir, `${key}.dwg`).replace(/\\/g, "/");
}
