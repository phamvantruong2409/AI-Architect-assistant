// Bốc Vật liệu AI — đọc 1 ảnh render/thiết kế, AI nhận diện vật liệu & đồ nội thất
// để lập dự toán. Vision BẮT BUỘC dùng Gemini (DeepSeek không đọc ảnh).

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8MB, đồng bộ với massing/review

/** Khung vùng vật thể trong ảnh (chuẩn hoá 0–1000 theo quy ước Gemini). */
export type BBox = [ymin: number, xmin: number, ymax: number, xmax: number];

/** Một mục bóc tách — dùng chung cho cả vật liệu lẫn đồ nội thất. */
export interface TakeoffItem {
  /** Tên ngắn tiếng Việt, vd "Đá granite đen", "Sofa vải xám". */
  name: string;
  /** 1 câu mô tả chất/màu/độ hoàn thiện để KTS nhận ra. */
  description: string;
  /** true nếu là bề mặt gỗ công nghiệp (MFC/MDF/HDF/laminate/melamine/acrylic/veneer) → khớp thư viện An Cường. */
  isIndustrialWood?: boolean;
  /** Từ khoá tìm mua (tên + đặc điểm), dùng dựng link. */
  searchHint: string;
  /** Khung vùng vật thể trong ảnh để crop lấy ảnh minh hoạ + màu chủ đạo. */
  box?: BBox;
}

export interface TakeoffResult {
  title: string;
  /** Dự toán vật liệu (gỗ CN, đá, gạch, sơn, kim loại, kính…). */
  materials: TakeoffItem[];
  /** Dự toán đồ nội thất (bàn ghế, giường, tranh, decor…). */
  furniture: TakeoffItem[];
}

export interface TakeoffAnalyzeRequest {
  imageBase64: string;
  mimeType: string;
}

/**
 * Trang "bản đồ màu" (Color Map) CHÍNH THỨC của An Cường — dự phòng khi gỗ CN không
 * khớp được mã cụ thể. Một URL ổn định, không 404.
 */
const ANCUONG_COLOR_MAP = "https://ancuong.com/color-map.html";

/**
 * Dựng link MUA:
 *  - Gỗ CN ĐÃ khớp mã An Cường → Google "An Cường <mã>" (ra đúng sản phẩm).
 *  - Gỗ CN chưa khớp → Color Map An Cường.
 *  - Loại khác → Google "mua …".
 * `matchName` là mã swatch An Cường khớp được (vd "MFC - MS 031 WN"), nếu có.
 */
export function buildBuyLink(item: TakeoffItem, matchName?: string): string {
  if (item.isIndustrialWood) {
    if (matchName) {
      return `https://www.google.com/search?q=${encodeURIComponent(`An Cường ${matchName}`)}`;
    }
    return ANCUONG_COLOR_MAP;
  }
  const kw = (item.searchHint || item.name).trim();
  return `https://www.google.com/search?q=${encodeURIComponent(`mua ${kw}`)}`;
}
