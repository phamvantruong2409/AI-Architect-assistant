import { searchWcPlans } from "@/lib/wc-search";
import { searchApartments } from "@/lib/apartment-search";

interface SearchRequest {
  category?: string;
  query?: string;
}

function strip(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .toLowerCase();
}

const hasAny = (t: string, keys: string[]) => keys.some((k) => t.includes(k));

const WC_KEYS = ["wc", "ve sinh", "toilet", "nha tam", "phong tam", "lavabo", "bon cau", "tieu nam", "buong tam"];
const APT_KEYS = ["can ho", "studio", "chung cu", "nha tro", "phong tro", "phong ngu", "pn", "ban cong", "bep", "o ghep", "gac", "can phong", "1 phong", "logia", "giuong"];

/**
 * Tab "MB Công năng" phục vụ cả WC lẫn căn hộ — nhưng KHÔNG bao giờ trộn lẫn:
 * tìm phòng ngủ/căn hộ chỉ ra căn hộ, tìm WC chỉ ra WC.
 */
function searchCongNang(query: string) {
  const t = strip(query);
  const wcSig = hasAny(t, WC_KEYS);
  const aptSig = hasAny(t, APT_KEYS);

  // Có tín hiệu rõ một phía → chốt đúng thư viện đó.
  if (wcSig && !aptSig) return searchWcPlans(query);
  if (aptSig && !wcSig) return searchApartments(query);

  // Còn lại (cả hai hoặc không có từ khoá) → chọn DUY NHẤT thư viện khớp điểm
  // cao hơn, vẫn không trộn. Hoà điểm thì theo từ khoá xuất hiện.
  const wc = searchWcPlans(query);
  const apt = searchApartments(query);
  if (apt.topScore !== wc.topScore) return apt.topScore > wc.topScore ? apt : wc;
  return aptSig ? apt : wc;
}

export async function POST(req: Request) {
  let body: SearchRequest;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Dữ liệu không hợp lệ" }, { status: 400 });
  }

  const query = body.query?.trim() ?? "";
  if (!query) return Response.json({ advice: "", results: [] });

  if (body.category === "cong-nang") {
    const { advice, results } = searchCongNang(query);
    return Response.json({ advice, results });
  }

  // Các nhóm khác chưa có thư viện → rỗng (UI báo đang cập nhật).
  return Response.json({ advice: "", results: [] });
}
