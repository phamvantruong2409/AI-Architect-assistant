// Catalog căn hộ / nhà trọ — "học" từ ảnh trong thuviennhatro-canho/.
// Ảnh đã cắt sát mặt bằng + đen trắng (public/library/canho/<id>.jpg).
// Diện tích: ưu tiên số ghi sẵn trên bản vẽ; ảnh không ghi thì ƯỚC LƯỢNG theo
// tỉ lệ nội thất (giường đôi ~1.6×2.0m, ghế ăn ~0.45m, bồn cầu ~0.7m).

export interface AptPlan {
  id: string;
  area: number; // m²
  estimated: boolean; // true = ước lượng theo tỉ lệ (ảnh không ghi kích thước)
  bedrooms: number; // 0 = studio
  bathtub: boolean; // có bồn tắm nằm
  balcony: boolean; // có ban công / logia
  separateRoom: boolean; // có phòng/góc ngủ ngăn riêng
  note?: string;
}

export interface AptPlanFull extends AptPlan {
  url: string;
  type: string; // "Studio" | "1 phòng ngủ"…
}

const RAW: AptPlan[] = [
  { id: "ch-01", area: 40, estimated: true, bedrooms: 1, bathtub: true, balcony: false, separateRoom: true },
  { id: "ch-02", area: 25, estimated: true, bedrooms: 0, bathtub: false, balcony: true, separateRoom: false },
  { id: "ch-03", area: 37, estimated: false, bedrooms: 0, bathtub: false, balcony: false, separateRoom: false, note: "Có giường gấp (hideaway bed); diện tích ghi sẵn 37,3 m²." },
  { id: "ch-04", area: 32.5, estimated: false, bedrooms: 0, bathtub: false, balcony: false, separateRoom: true, note: "Góc ngủ ngăn riêng 5,1 m²; diện tích ghi sẵn 32,5 m²." },
  { id: "ch-05", area: 30, estimated: true, bedrooms: 0, bathtub: true, balcony: true, separateRoom: false },
  { id: "ch-06", area: 28, estimated: true, bedrooms: 0, bathtub: false, balcony: true, separateRoom: false },
  { id: "ch-07", area: 42, estimated: true, bedrooms: 1, bathtub: true, balcony: false, separateRoom: true },
  { id: "ch-08", area: 45, estimated: true, bedrooms: 1, bathtub: false, balcony: true, separateRoom: true },
  { id: "ch-09", area: 50, estimated: true, bedrooms: 1, bathtub: true, balcony: true, separateRoom: true },
];

function toFull(p: AptPlan): AptPlanFull {
  return {
    ...p,
    url: `/library/canho/${p.id}.jpg`,
    type: p.bedrooms >= 1 ? `${p.bedrooms} phòng ngủ` : "Studio",
  };
}

export const APT_PLANS: AptPlanFull[] = RAW.map(toFull);

export function aptFeatureLabels(p: AptPlanFull): string[] {
  const out: string[] = [p.type];
  if (p.separateRoom && p.bedrooms === 0) out.push("góc ngủ riêng");
  out.push("bếp", "khu ăn");
  if (p.bathtub) out.push("bồn tắm");
  if (p.balcony) out.push("ban công");
  return out;
}
