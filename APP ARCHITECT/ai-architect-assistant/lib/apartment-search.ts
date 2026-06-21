// Tra cứu thư viện căn hộ / nhà trọ: phân tích câu hỏi tiếng Việt → lọc & xếp
// hạng theo diện tích + số phòng ngủ + tiện ích, kèm lời tư vấn. Local, 0 API.

import { APT_PLANS, aptFeatureLabels, type AptPlanFull } from "./apartment-library";

export interface PlanMatch {
  id: string;
  url: string;
  title: string;
  caption: string;
}

export interface PlanSearchResponse {
  advice: string;
  results: PlanMatch[];
  topScore: number;
}

function strip(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .toLowerCase();
}

function has(t: string, ...keys: string[]): boolean {
  return keys.some((k) => t.includes(k));
}

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

interface AptIntent {
  area: number | null; // m²
  bedrooms: number | null; // 0 = studio
  needBathtub: boolean;
  needBalcony: boolean;
  preferSeparate: boolean;
  preferSmall: boolean;
  preferLarge: boolean;
  any: boolean;
}

function parseIntent(query: string): AptIntent {
  const t = strip(query);
  const nums = (t.match(/\d+(?:[.,]\d+)?/g) ?? []).map((n) => parseFloat(n.replace(",", ".")));

  // Diện tích: số đi kèm m2, hoặc số 12–200 coi là m² căn hộ.
  let area: number | null = null;
  for (const n of nums) {
    if (n >= 12 && n <= 200) {
      area = n;
      break;
    }
  }

  let bedrooms: number | null = null;
  if (has(t, "studio", "1 phong", "mot phong", "o ghep", "gac")) bedrooms = 0;
  const pn = t.match(/(\d)\s*(?:pn|phong ngu|ngu)/);
  if (pn) bedrooms = parseInt(pn[1], 10);

  const intent: AptIntent = {
    area,
    bedrooms,
    needBathtub: has(t, "bon tam", "bontam", "tam nam", "bathtub"),
    needBalcony: has(t, "ban cong", "bancong", "logia", "san"),
    preferSeparate: has(t, "ngu rieng", "phong rieng", "tach phong", "co phong"),
    preferSmall: has(t, "nho", "mini", "hep", "gon", "tiet kiem", "gia re"),
    preferLarge: has(t, "rong", "lon", "cao cap", "sang", "thoang", "master", "rong rai"),
    any: false,
  };
  intent.any =
    area != null ||
    bedrooms != null ||
    intent.needBathtub ||
    intent.needBalcony ||
    intent.preferSeparate ||
    intent.preferSmall ||
    intent.preferLarge;
  return intent;
}

function score(p: AptPlanFull, it: AptIntent): number {
  let s = 0;
  if (it.area != null) s += clamp01(1 - Math.abs(p.area - it.area) / Math.max(8, it.area)) * 3;
  if (it.bedrooms != null) s += p.bedrooms === it.bedrooms ? 2 : -1;
  if (it.needBathtub && p.bathtub) s += 1.5;
  if (it.needBalcony && p.balcony) s += 1.5;
  if (it.preferSeparate && p.separateRoom) s += 1;
  if (it.preferSmall) s += clamp01(1 - p.area / 45);
  if (it.preferLarge) s += clamp01(p.area / 55);
  return s;
}

function toMatch(p: AptPlanFull): PlanMatch {
  const dt = p.estimated ? "~" : "";
  return {
    id: p.id,
    url: p.url,
    title: `${p.type} · ${dt}${p.area} m²${p.estimated ? " (ước lượng)" : ""}`,
    caption: aptFeatureLabels(p).join(", "),
  };
}

function buildAdvice(it: AptIntent, picks: AptPlanFull[], query: string): string {
  if (picks.length === 0) {
    return `Chưa tìm thấy căn hộ khớp “${query.trim()}”. Bạn thử ghi diện tích (vd 30 m²), số phòng ngủ (studio/1PN) hoặc tiện ích (bồn tắm, ban công).`;
  }
  const reqs: string[] = [];
  if (it.area != null) reqs.push(`~${it.area} m²`);
  if (it.bedrooms != null) reqs.push(it.bedrooms === 0 ? "dạng studio" : `${it.bedrooms} phòng ngủ`);
  if (it.needBathtub) reqs.push("có bồn tắm");
  if (it.needBalcony) reqs.push("có ban công");
  if (it.preferSeparate) reqs.push("ngủ ngăn riêng");
  if (it.preferSmall) reqs.push("ưu tiên nhỏ gọn");
  if (it.preferLarge) reqs.push("ưu tiên rộng");

  const best = picks[0];
  const areas = picks.map((p) => p.area);
  let s = it.any
    ? `Theo nhu cầu của bạn (${reqs.join(", ")}), mình gợi ý ${picks.length} mặt bằng phù hợp. `
    : `Mình đưa ${picks.length} mặt bằng căn hộ/nhà trọ tiêu biểu để bạn tham khảo. `;
  s += `Sát nhất là **${best.type} ${best.estimated ? "~" : ""}${best.area} m²** — ${aptFeatureLabels(best).join(", ")}. `;
  if (Math.min(...areas) !== Math.max(...areas)) s += `Dải diện tích từ ${Math.min(...areas)}–${Math.max(...areas)} m². `;

  if (picks.some((p) => p.estimated)) {
    s += "Lưu ý: diện tích có dấu “~” là mình ước lượng theo tỉ lệ nội thất (ảnh gốc không ghi số), nên xem là tương đối. ";
  }
  const tips: string[] = [];
  if (it.preferSmall || Math.min(...areas) < 30) tips.push("studio nhỏ nên dùng giường gấp/đa năng để mở rộng khu sinh hoạt ban ngày");
  if (it.needBathtub) tips.push("căn có bồn tắm thường cần ≥30 m² để bố trí thoải mái");
  if (tips.length) s += `Gợi ý: ${tips.slice(0, 2).join("; ")}.`;
  return s.trim();
}

export function searchApartments(query: string, limit = 6): PlanSearchResponse {
  const it = parseIntent(query);
  let pool = APT_PLANS.slice();
  if (it.needBathtub) pool = pool.filter((p) => p.bathtub);
  if (it.needBalcony) pool = pool.filter((p) => p.balcony);

  let picks: AptPlanFull[];
  let topScore = 0;
  if (it.any) {
    const ranked = pool
      .map((p) => ({ p, s: score(p, it) }))
      .sort((a, b) => b.s - a.s)
      .slice(0, limit);
    topScore = ranked[0]?.s ?? 0;
    picks = ranked.map((x) => x.p);
  } else {
    picks = pool.slice().sort((a, b) => a.area - b.area).slice(0, limit);
  }

  return { advice: buildAdvice(it, picks, query), results: picks.map(toMatch), topScore };
}
