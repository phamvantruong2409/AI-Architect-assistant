// Tra cứu thư viện WC: phân tích câu hỏi tiếng Việt của người dùng → lọc & xếp
// hạng mặt bằng phù hợp trong WC_PLANS, kèm lời tư vấn. Chạy thuần local, 0 API.

import { WC_PLANS, fixtureLabels, type WcPlanFull } from "./wc-library";

export interface WcMatch {
  id: string;
  url: string;
  title: string;
  caption: string;
}

export interface WcSearchResponse {
  advice: string;
  results: WcMatch[];
  topScore: number;
}

/** Bỏ dấu tiếng Việt + thường hoá để so khớp từ khoá không phụ thuộc dấu. */
function strip(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .toLowerCase();
}

interface Intent {
  dims: number[]; // mm
  area: number | null; // m²
  needBathtub: boolean;
  needShower: boolean;
  needDoubleSink: boolean;
  needWasher: boolean;
  needUrinal: boolean;
  preferSeparated: boolean;
  preferDual: boolean;
  preferSmall: boolean;
  preferLarge: boolean;
  any: boolean; // có tín hiệu nào không
}

function has(t: string, ...keys: string[]): boolean {
  return keys.some((k) => t.includes(k));
}

function parseIntent(query: string): Intent {
  const t = strip(query);
  const isArea = has(t, "m2", "m²", "met vuong", "mvuong", "metvuong");

  const nums = (t.match(/\d+(?:[.,]\d+)?/g) ?? []).map((n) =>
    parseFloat(n.replace(",", ".")),
  );

  let area: number | null = null;
  const dims: number[] = [];
  if (isArea && nums.length) {
    area = nums[0];
  } else {
    for (const n of nums) {
      // < 100 coi là mét (2.6 → 2600); >= 100 coi là mm.
      dims.push(n < 100 ? Math.round(n * 1000) : Math.round(n));
    }
  }

  const intent: Intent = {
    dims: dims.slice(0, 2),
    area,
    needBathtub: has(t, "bon tam", "bontam", "tam nam", "bathtub", "tub"),
    needShower: has(t, "tam dung", "voi sen", "sen", "shower", "buong tam"),
    needDoubleSink: has(t, "lavabo doi", "doi lavabo", "2 lavabo", "hai lavabo", "double", "doi chau", "2 chau"),
    needWasher: has(t, "may giat", "giat", "washer", "lau giat"),
    needUrinal: has(t, "tieu", "urinal"),
    preferSeparated: has(t, "kho uot", "khouot", "ngan", "tach", "rieng", "buong cau"),
    preferDual: has(t, "doi xung", "cong cong", "chung", "2 nguoi", "song song", "doi ben"),
    preferSmall: has(t, "nho", "mini", "hep", "gon", "nhỏ"),
    preferLarge: has(t, "lon", "rong", "master", "biet thu", "sang", "cao cap"),
    any: false,
  };
  intent.any =
    intent.dims.length > 0 ||
    intent.area != null ||
    intent.needBathtub ||
    intent.needShower ||
    intent.needDoubleSink ||
    intent.needWasher ||
    intent.needUrinal ||
    intent.preferSeparated ||
    intent.preferDual ||
    intent.preferSmall ||
    intent.preferLarge;
  return intent;
}

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

/** Điểm khớp kích thước (cao = sát). Không phụ thuộc chiều xoay. */
function dimScore(p: WcPlanFull, dims: number[]): number {
  if (dims.length === 0) return 0;
  const lo = Math.min(p.w, p.d);
  const hi = Math.max(p.w, p.d);
  if (dims.length >= 2) {
    const t = [...dims].sort((a, b) => a - b);
    const dist = Math.abs(lo - t[0]) + Math.abs(hi - t[1]);
    return clamp01(1 - dist / 1200) * 3;
  }
  const dist = Math.min(Math.abs(p.w - dims[0]), Math.abs(p.d - dims[0]));
  return clamp01(1 - dist / 700) * 2;
}

function score(p: WcPlanFull, it: Intent): number {
  let s = 0;
  s += dimScore(p, it.dims);
  if (it.area != null) s += clamp01(1 - Math.abs(p.area - it.area) / Math.max(1, it.area)) * 3;
  if (it.needShower && p.shower) s += 1;
  if (it.needDoubleSink && p.sinks >= 2) s += 1.5;
  if (it.needBathtub && p.bathtub) s += 1.5;
  if (it.preferSeparated && p.separated) s += 1;
  if (it.preferDual && p.dual) s += 1.5;
  if (it.needWasher && p.washer) s += 1.5;
  if (it.needUrinal && p.urinal) s += 1.5;
  if (it.preferSmall) s += clamp01(1 - p.area / 6);
  if (it.preferLarge) s += clamp01(p.area / 12);
  return s;
}

function fmtMm(n: number): string {
  return n.toLocaleString("vi-VN");
}

function toMatch(p: WcPlanFull): WcMatch {
  return {
    id: p.id,
    url: p.url,
    title: `WC ${fmtMm(p.w)} × ${fmtMm(p.d)} mm · ${p.area} m²`,
    caption: fixtureLabels(p).join(", "),
  };
}

function buildAdvice(it: Intent, picks: WcPlanFull[], query: string): string {
  if (picks.length === 0) {
    return `Chưa tìm thấy mặt bằng khớp “${query.trim()}”. Bạn thử mô tả kích thước (vd 2.6 × 1.5m) hoặc thiết bị mong muốn (bồn tắm, tắm đứng, lavabo đôi…).`;
  }

  const reqs: string[] = [];
  if (it.dims.length >= 2) reqs.push(`kích thước quanh ${fmtMm(it.dims[0])}×${fmtMm(it.dims[1])}mm`);
  else if (it.dims.length === 1) reqs.push(`cạnh khoảng ${fmtMm(it.dims[0])}mm`);
  if (it.area != null) reqs.push(`diện tích ~${it.area}m²`);
  if (it.needBathtub) reqs.push("có bồn tắm");
  if (it.needShower) reqs.push("có tắm đứng");
  if (it.needDoubleSink) reqs.push("lavabo đôi");
  if (it.needWasher) reqs.push("chỗ máy giặt");
  if (it.needUrinal) reqs.push("bồn tiểu");
  if (it.preferSeparated) reqs.push("ngăn khô–ướt");
  if (it.preferDual) reqs.push("bố trí đôi");
  if (it.preferSmall) reqs.push("ưu tiên nhỏ gọn");
  if (it.preferLarge) reqs.push("ưu tiên rộng rãi");

  const areas = picks.map((p) => p.area);
  const minA = Math.min(...areas);
  const maxA = Math.max(...areas);
  const best = picks[0];

  let s = it.any
    ? `Theo nhu cầu của bạn (${reqs.join(", ")}), mình chọn ${picks.length} mặt bằng phù hợp nhất. `
    : `Mình đưa ${picks.length} mặt bằng tiêu biểu trong thư viện để bạn tham khảo. `;

  s += `Gần nhất là **WC ${fmtMm(best.w)} × ${fmtMm(best.d)}mm (${best.area}m²)** — ${fixtureLabels(best).join(", ")}. `;

  if (minA !== maxA) s += `Các phương án trải từ ${minA}m² đến ${maxA}m². `;

  // Mẹo bố trí theo đặc điểm chung của nhóm chọn.
  const tips: string[] = [];
  if (picks.some((p) => p.separated)) tips.push("ưu tiên tách khô–ướt để sàn khô luôn sạch");
  if (it.needBathtub) tips.push("bồn tắm nên đặt sát tường dài nhất, xa cửa để giữ ấm");
  if (it.preferSmall || minA < 2.5) tips.push("WC nhỏ nên dùng cửa lùa/mở ra ngoài để khỏi vướng thiết bị");
  if (picks.some((p) => p.sinks >= 2)) tips.push("lavabo đôi cần mặt bàn tối thiểu ~1.4m");
  if (tips.length) s += `Gợi ý: ${tips.slice(0, 2).join("; ")}.`;

  return s.trim();
}

export function searchWcPlans(query: string, limit = 6): WcSearchResponse {
  const it = parseIntent(query);

  let pool = WC_PLANS.slice();
  // Lọc cứng theo yêu cầu bắt buộc.
  if (it.needBathtub) pool = pool.filter((p) => p.bathtub);
  if (it.needDoubleSink) pool = pool.filter((p) => p.sinks >= 2);
  if (it.needWasher) pool = pool.filter((p) => p.washer);
  if (it.needUrinal) pool = pool.filter((p) => p.urinal);

  let picks: WcPlanFull[];
  let topScore = 0;
  if (it.any) {
    const ranked = pool
      .map((p) => ({ p, s: score(p, it) }))
      .sort((a, b) => b.s - a.s)
      .slice(0, limit);
    topScore = ranked[0]?.s ?? 0;
    picks = ranked.map((x) => x.p);
  } else {
    // Không có tín hiệu → trải đều theo diện tích để giới thiệu thư viện.
    picks = pool.slice().sort((a, b) => a.area - b.area);
    const step = Math.max(1, Math.floor(picks.length / limit));
    picks = picks.filter((_, i) => i % step === 0).slice(0, limit);
  }

  return {
    advice: buildAdvice(it, picks, query),
    results: picks.map(toMatch),
    topScore,
  };
}
