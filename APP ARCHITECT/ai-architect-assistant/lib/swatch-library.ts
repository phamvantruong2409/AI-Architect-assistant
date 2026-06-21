// Thư viện swatch gỗ công nghiệp An Cường (ảnh tí hon trong public/swatches/<type>/).
// Khớp vật liệu trong ảnh render với swatch gần nhất theo MÀU (không gian Lab) — chạy
// hoàn toàn ở client, 0 API. Index do scripts/build-swatches.ps1 sinh ra.

export const SWATCH_TYPES = ["mfc", "laminate", "veneer", "acrylic"] as const;
export type SwatchType = (typeof SWATCH_TYPES)[number];

export interface SwatchItem {
  type: SwatchType;
  /** Tên file ảnh trong public/swatches/<type>/. */
  file: string;
  /** Mã màu An Cường, vd "MFC - MS 031 WN". */
  name: string;
  /** Màu chủ đạo hex, vd "#9C6B3F". */
  color: string;
  /** Lab tính sẵn để so khớp nhanh. */
  lab: [number, number, number];
  /** Đường dẫn ảnh public. */
  url: string;
}

interface RawIndex {
  type?: string;
  items?: { file: string; name: string; color: string }[];
}

/* ---------- chuyển màu ---------- */

export function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim());
  if (!m) return [0, 0, 0];
  return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
}

export function rgbToLab(r: number, g: number, b: number): [number, number, number] {
  // sRGB → linear
  const f = (c: number) => {
    c /= 255;
    return c > 0.04045 ? Math.pow((c + 0.055) / 1.055, 2.4) : c / 12.92;
  };
  const R = f(r), G = f(g), B = f(b);
  // linear RGB → XYZ (D65)
  let x = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
  let y = R * 0.2126 + G * 0.7152 + B * 0.0722;
  let z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
  const g2 = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  x = g2(x); y = g2(y); z = g2(z);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}

export function hexToLab(hex: string): [number, number, number] {
  const [r, g, b] = hexToRgb(hex);
  return rgbToLab(r, g, b);
}

function deltaE(a: [number, number, number], b: [number, number, number]): number {
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);
}

/* ---------- nạp & khớp ---------- */

let cache: SwatchItem[] | null = null;
let loading: Promise<SwatchItem[]> | null = null;

async function fetchType(type: SwatchType): Promise<SwatchItem[]> {
  try {
    const res = await fetch(`/swatches/${type}/index.json`);
    if (!res.ok) return [];
    const txt = (await res.text()).replace(/^﻿/, ""); // bỏ BOM nếu có
    const data = JSON.parse(txt) as RawIndex;
    return (data.items ?? []).map((it) => ({
      type,
      file: it.file,
      name: it.name,
      color: it.color,
      lab: hexToLab(it.color),
      url: `/swatches/${type}/${encodeURIComponent(it.file)}`,
    }));
  } catch {
    return [];
  }
}

/** Nạp toàn bộ thư viện swatch (cache lại). */
export async function loadSwatches(): Promise<SwatchItem[]> {
  if (cache) return cache;
  if (!loading) {
    loading = Promise.all(SWATCH_TYPES.map(fetchType)).then((lists) => {
      cache = lists.flat();
      return cache;
    });
  }
  return loading;
}

/** Tìm N swatch gần nhất theo màu hex. Mảng rỗng nếu thư viện chưa nạp được. */
export function nearestSwatches(items: SwatchItem[], hex: string, n = 5): SwatchItem[] {
  if (items.length === 0) return [];
  const lab = hexToLab(hex);
  return [...items]
    .map((s) => ({ s, d: deltaE(lab, s.lab) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, n)
    .map((x) => x.s);
}
