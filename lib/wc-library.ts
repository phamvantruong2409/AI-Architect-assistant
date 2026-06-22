// Catalog tri thức thư viện WC — "học" từ các trang mặt bằng trong thuvienwc/.
// Mỗi mục là một mặt bằng đã cắt thành ảnh riêng (public/library/wc/<id>.jpg).
// Dùng cho tra cứu công năng: lọc theo kích thước + thiết bị, rồi tư vấn.

export interface WcPlan {
  id: string; // = mã file ảnh, vd "wc-01-1"
  w: number; // chiều rộng thông thuỷ (mm)
  d: number; // chiều sâu thông thuỷ (mm)
  sinks: number; // số lavabo (2 = lavabo đôi)
  shower: boolean; // có khu tắm đứng (vòi sen)
  bathtub: boolean; // có bồn tắm nằm
  urinal: boolean; // có bồn tiểu nam
  washer: boolean; // có chỗ máy giặt
  storage: boolean; // có tủ/kệ lưu trữ lớn
  dual: boolean; // bố trí đôi/đối xứng (2 khu dùng song song)
  separated: boolean; // tách khô–ướt hoặc ngăn buồng cầu riêng
}

/** Mọi mặt bằng đều có bồn cầu (đây là WC). */
export interface WcPlanFull extends WcPlan {
  area: number; // m² (làm tròn 2 số)
  url: string; // đường dẫn ảnh public
}

// Cờ: H=tắm đứng, B=bồn tắm, U=tiểu, M=máy giặt, K=tủ/kệ, D=đôi/đối xứng, P=ngăn riêng.
type Row = [id: string, w: number, d: number, sinks: number, flags: string];

const RAW: Row[] = [
  // wc-01 — nhóm nhỏ gọn (1500–2600)
  ["wc-01-1", 1500, 1200, 1, ""],
  ["wc-01-2", 1600, 1200, 1, ""],
  ["wc-01-3", 2200, 1200, 1, ""],
  ["wc-01-4", 2200, 1300, 1, "U"],
  ["wc-01-5", 2500, 1400, 1, "HP"],
  ["wc-01-6", 2600, 1500, 1, "H"],
  ["wc-01-7", 2600, 1500, 1, "H"],
  ["wc-01-8", 2600, 1500, 1, "H"],
  // wc-02 — sâu 1400–1700, nhiều ô vuông nhỏ 1700×1700
  ["wc-02-1", 3100, 1400, 1, "HP"],
  ["wc-02-2", 3240, 1500, 1, "HP"],
  ["wc-02-3", 4170, 1500, 2, "HP"],
  ["wc-02-4", 1700, 1700, 1, "H"],
  ["wc-02-5", 1700, 1700, 1, "H"],
  ["wc-02-6", 3620, 1600, 1, "HMP"],
  ["wc-02-7", 1700, 1700, 1, "H"],
  ["wc-02-8", 1800, 1700, 1, "H"],
  // wc-03 — sâu 1700–1800, bắt đầu có bồn tắm & bố trí đôi
  ["wc-03-1", 2300, 1700, 1, "H"],
  ["wc-03-2", 3320, 1700, 2, "HP"],
  ["wc-03-3", 3320, 1700, 2, "HP"],
  ["wc-03-4", 2900, 1800, 1, "HB"],
  ["wc-03-5", 5000, 1700, 2, "HDP"],
  ["wc-03-6", 2200, 1800, 2, "H"],
  ["wc-03-7", 3600, 1800, 2, "HB"],
  ["wc-03-8", 3700, 1800, 1, "HB"],
  // wc-04 — sâu 1800–2100
  ["wc-04-1", 3800, 1800, 1, "HB"],
  ["wc-04-2", 4220, 1800, 2, "HB"],
  ["wc-04-3", 2300, 1900, 1, "HP"],
  ["wc-04-4", 3120, 1900, 2, "HP"],
  ["wc-04-5", 2300, 2000, 1, "HP"],
  ["wc-04-6", 2300, 2000, 2, "H"],
  ["wc-04-7", 2700, 2000, 2, "HP"],
  ["wc-04-8", 2120, 2100, 1, "H"],
  // wc-05 — sâu 2100–2300
  ["wc-05-1", 2620, 2100, 1, "HP"],
  ["wc-05-2", 3820, 2100, 2, "HBP"],
  ["wc-05-3", 2200, 2200, 2, "HP"],
  ["wc-05-4", 2200, 2200, 1, "HP"],
  ["wc-05-5", 2600, 2200, 1, "HP"],
  ["wc-05-6", 2700, 2200, 2, "HD"],
  ["wc-05-7", 2500, 2300, 2, "HP"],
  ["wc-05-8", 2800, 2300, 2, "B"],
  // wc-06 — sâu 2300, hầu hết có bồn tắm (master)
  ["wc-06-1", 2800, 2300, 1, "HB"],
  ["wc-06-2", 2800, 2300, 2, "HB"],
  ["wc-06-3", 2800, 2300, 2, "HBP"],
  ["wc-06-4", 2900, 2300, 2, "HB"],
  ["wc-06-5", 3000, 2300, 1, "HB"],
  ["wc-06-6", 3220, 2300, 1, "HMP"],
  ["wc-06-7", 3200, 2300, 2, "HBP"],
  ["wc-06-8", 3420, 2300, 1, "HB"],
  // wc-07 — khổ lớn (8/8)
  ["wc-07-1", 3450, 2300, 1, "HKP"],
  ["wc-07-2", 3500, 2300, 2, "HB"],
];

function toPlan([id, w, d, sinks, flags]: Row): WcPlanFull {
  return {
    id,
    w,
    d,
    sinks,
    shower: flags.includes("H"),
    bathtub: flags.includes("B"),
    urinal: flags.includes("U"),
    washer: flags.includes("M"),
    storage: flags.includes("K"),
    dual: flags.includes("D"),
    separated: flags.includes("P"),
    area: Math.round((w * d) / 1e4) / 100,
    url: `/library/wc/${id}.jpg`,
  };
}

export const WC_PLANS: WcPlanFull[] = RAW.map(toPlan);

/** Nhãn thiết bị tiếng Việt để hiển thị caption. */
export function fixtureLabels(p: WcPlanFull): string[] {
  const out: string[] = ["bồn cầu"];
  if (p.sinks >= 2) out.push(`${p.sinks} lavabo`);
  else out.push("lavabo");
  if (p.shower) out.push("tắm đứng");
  if (p.bathtub) out.push("bồn tắm");
  if (p.urinal) out.push("tiểu nam");
  if (p.washer) out.push("máy giặt");
  if (p.storage) out.push("tủ đồ");
  if (p.separated) out.push("ngăn khô–ướt");
  if (p.dual) out.push("bố trí đôi");
  return out;
}
