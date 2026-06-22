// Image to AutoCAD — AI đọc 1 ảnh MẶT BẰNG, nhận diện TƯỜNG + CỬA + PHÒNG + NỘI THẤT
// + KÍCH THƯỚC, dựng mô hình hình học vector (đơn vị mm, gốc dưới-trái, trục Y hướng
// lên theo quy ước CAD). Mô hình này được chuyển thành AutoLISP rồi để AutoCAD (chạy
// nền qua accoreconsole) vẽ lên TEMPLATE của người dùng và xuất ra DWG thật.
// Vision BẮT BUỘC dùng Gemini.

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8MB, đồng bộ các công cụ ảnh khác

/** Một đoạn TƯỜNG: TIM tường từ (x1,y1) đến (x2,y2), đơn vị mm, kèm bề dày. */
export interface CadWall {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** Bề dày tường (mm). Mặc định 100 nếu AI không suy ra được. */
  thickness: number;
}

/** Loại lỗ mở trên tường. */
export type OpeningKind = "door" | "window";

/**
 * Một CỬA (đi/sổ) nằm TRÊN một đoạn tường. Vị trí cho bằng tâm lỗ mở (x,y) trên tim
 * tường + bề rộng; generator tự khoét tường và vẽ cánh/khung theo bản vẽ kỹ thuật.
 */
export interface CadOpening {
  kind: OpeningKind;
  /** Tâm lỗ mở trên tim tường (mm). */
  x: number;
  y: number;
  /** Bề rộng lỗ mở (mm), vd cửa đi 900, cửa sổ 1200. */
  width: number;
  /** Chỉ số đoạn tường (index trong mảng walls) mà lỗ mở nằm trên. */
  wallIndex: number;
  /** Cửa đi: bản lề bên trái hay phải đoạn (theo chiều x1→x2). */
  hinge?: "left" | "right";
  /** Cửa đi: cánh mở về phía nào so với tim tường (pháp tuyến + hay -). */
  swing?: "in" | "out";
}

/** Một PHÒNG: đa giác kín (danh sách đỉnh mm) + tên + diện tích m². */
export interface CadRoom {
  /** Tên phòng tiếng Việt, vd "Phòng khách", "WC", "Bếp". */
  name: string;
  /** Diện tích sàn ước lượng (m²); 0 nếu không suy ra được. */
  area: number;
  /** Đỉnh đa giác theo thứ tự, mm: [[x,y], ...] (≥ 3 đỉnh). */
  points: [number, number][];
}

/** Loại block nội thất generator biết vẽ (bộ cơ bản theo công năng). */
export type FurnitureKind =
  | "bed_double" // giường đôi
  | "bed_single" // giường đơn
  | "sofa" // sofa
  | "table_dining" // bàn ăn
  | "table_coffee" // bàn trà
  | "desk" // bàn làm việc
  | "wardrobe" // tủ quần áo
  | "kitchen_counter" // bếp (quầy + bồn)
  | "stove" // bếp nấu
  | "fridge" // tủ lạnh
  | "sink" // chậu rửa
  | "toilet" // bồn cầu
  | "lavabo" // lavabo
  | "shower" // vòi sen
  | "bathtub" // bồn tắm
  | "lounge_chair" // ghế thư giãn / ghế lười
  | "car"; // xe (gara)

/** Một món NỘI THẤT đặt vào mặt bằng dưới dạng block tham số. */
export interface CadFurniture {
  kind: FurnitureKind;
  /** Tâm món đồ (mm). */
  x: number;
  y: number;
  /** Bề rộng (mm) theo trục cục bộ X trước khi xoay. */
  width: number;
  /** Bề sâu (mm) theo trục cục bộ Y trước khi xoay. */
  depth: number;
  /** Góc xoay quanh tâm (độ, ngược kim đồng hồ). */
  rotation: number;
}

/** Một đường KÍCH THƯỚC tuyến tính giữa 2 điểm. */
export interface CadDimension {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** Bỏ trống để AutoCAD tự đo; hoặc đặt chữ ghi đè. */
  text?: string;
}

/** Mô hình mặt bằng AI trả về sau khi đọc ảnh. */
export interface CadPlan {
  /** Tiêu đề ngắn tiếng Việt 3–6 từ. */
  title: string;
  /** Bề rộng tổng (mm) theo trục X — dùng để canh khung & cỡ chữ. */
  width: number;
  /** Chiều cao tổng (mm) theo trục Y. */
  height: number;
  walls: CadWall[];
  openings: CadOpening[];
  rooms: CadRoom[];
  furniture: CadFurniture[];
  dimensions: CadDimension[];
  /** Ghi chú/cảnh báo của AI về độ tin cậy hoặc phần không đọc được. */
  notes?: string;
}

/**
 * Bản PHÂN TÍCH mặt bằng dạng VĂN BẢN tiếng Việt (bước trung gian). AI đọc ảnh rồi
 * mô tả "mặt bằng có gì" theo mục (tổng quan, từng phòng, cửa, nội thất); người dùng
 * ĐỌC & SỬA tự do, rồi bản mô tả này thành "đề bài" cho bước dựng hình học (analyzePlan).
 */
export interface PlanAnalysis {
  /** Tiêu đề ngắn tiếng Việt 3–6 từ. */
  title: string;
  /** Mô tả mặt bằng có cấu trúc (xuống dòng theo mục/phòng) — người dùng sửa được. */
  description: string;
  /** Ghi chú/cảnh báo của AI về độ tin cậy hoặc phần không đọc được. */
  notes?: string;
}

export interface ImageToCadRequest {
  imageBase64: string;
  mimeType: string;
  /**
   * Bản phân tích đã được người dùng XÁC NHẬN/SỬA (nếu có). Khi có, bước dựng hình
   * ưu tiên tuyệt đối theo mô tả này, ảnh chỉ để tham chiếu vị trí & tỉ lệ.
   */
  analysis?: string;
}
