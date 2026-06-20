import type { GeminiModelId } from "@/lib/gemini-models";

export interface MassingRequest {
  imageBase64: string;
  mimeType: string;
  /** Bối cảnh / mong muốn của người dùng (tuỳ chọn). */
  context: string;
  model: GeminiModelId;
}

export interface MassingCriterion {
  /** Tên tiêu chí, ví dụ: "Tỉ lệ & cân đối". */
  name: string;
  /** Điểm 0-10. */
  score: number;
  /** Nhận xét tổng quát cho tiêu chí. */
  comment: string;
  /** Điểm đẹp / điểm mạnh của tiêu chí. */
  pros: string[];
  /** Điểm chưa đạt / điểm yếu của tiêu chí. */
  cons: string[];
  /** Cần cải thiện — cách sửa cụ thể cho tiêu chí này. */
  improvements: string[];
}

export interface MassingResult {
  /** Tiêu đề ngắn tiếng Việt. */
  title: string;
  /** Điểm tổng 0-100. */
  overallScore: number;
  /** Tóm tắt 2-3 câu nhận xét chung. */
  summary: string;
  /** Phân tích chi tiết theo từng mục. */
  criteria: MassingCriterion[];
  /** Đề xuất sửa đổi ưu tiên (tổng hợp), để người dùng biết nên chỉnh gì trước. */
  suggestions: string[];
}

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8MB

/** Số phương án hình khối AI sinh ra để người dùng tham khảo. */
export const MASSING_VARIANT_COUNT = 2;

/** Hướng xử lý khối cho từng phương án — cùng áp dụng đề xuất cải thiện, khác cách triển khai. */
export const MASSING_VARIANT_DIRECTIONS = [
  {
    label: "Phương án A — tinh chỉnh",
    hint: "Áp dụng các đề xuất cải thiện một cách TIẾT CHẾ, giữ đúng tinh thần và bố cục khối gốc, chỉ nắn lại tỉ lệ và quan hệ đặc–rỗng cho hợp lý hơn.",
  },
  {
    label: "Phương án B — mạnh dạn",
    hint: "Đẩy các đề xuất đi xa hơn: tái cấu trúc khối táo bạo hơn (giật cấp, lệch tầng, thêm khoảng rỗng/điểm nhấn) nhưng GIỮ NGUYÊN công năng, số tầng và phong cách của công trình gốc.",
  },
] as const;

export interface MassingVariantsRequest {
  /** dataURL ảnh hình khối gốc người dùng tải lên. */
  image: string;
  /** Các đề xuất sửa đổi (lấy từ kết quả phân tích) để áp dụng vào hai phương án. */
  suggestions: string[];
  /** Bối cảnh / mong muốn (tuỳ chọn). */
  context?: string;
}

export interface MassingVariant {
  label: string;
  /** dataURL ảnh phương án (1K). */
  image: string;
}
