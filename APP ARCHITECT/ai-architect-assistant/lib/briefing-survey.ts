// Bộ câu hỏi khảo sát nhu cầu khách hàng (chi tiết, nhiều lựa chọn).
// Dùng cho trang khảo sát công khai /brief/[token] và để AI tổng hợp brief.

export type QuestionType = "single" | "multi" | "text";

export interface SurveyQuestion {
  id: string;
  label: string;
  type: QuestionType;
  options?: string[];
  placeholder?: string;
  optional?: boolean;
}

export interface SurveySection {
  id: string;
  title: string;
  icon: string;
  questions: SurveyQuestion[];
}

export const SURVEY_SECTIONS: SurveySection[] = [
  {
    id: "cong_trinh",
    title: "Thông tin công trình",
    icon: "🏗️",
    questions: [
      {
        id: "loai_cong_trinh",
        label: "Loại công trình",
        type: "single",
        options: ["Nhà phố", "Biệt thự", "Nhà vườn", "Căn hộ", "Penthouse", "Shophouse", "Văn phòng", "Quán cafe / Nhà hàng", "Khác"],
      },
      {
        id: "dien_tich",
        label: "Diện tích đất / sàn",
        type: "single",
        options: ["Dưới 60 m²", "60 – 100 m²", "100 – 200 m²", "200 – 400 m²", "Trên 400 m²"],
      },
      {
        id: "so_tang",
        label: "Số tầng mong muốn",
        type: "single",
        options: ["1 tầng", "2 tầng", "3 tầng", "4 tầng", "5 tầng trở lên", "Chưa rõ"],
      },
      {
        id: "huong_nha",
        label: "Hướng nhà chính",
        type: "single",
        options: ["Đông", "Tây", "Nam", "Bắc", "Đông Nam", "Tây Nam", "Đông Bắc", "Tây Bắc", "Chưa rõ"],
      },
      {
        id: "hien_trang",
        label: "Hiện trạng khu đất",
        type: "single",
        options: ["Đất trống", "Nhà cũ cần phá dỡ", "Cải tạo nhà hiện có"],
      },
    ],
  },
  {
    id: "gia_dinh",
    title: "Gia đình & lối sống",
    icon: "👨‍👩‍👧",
    questions: [
      {
        id: "so_thanh_vien",
        label: "Số thành viên sinh sống",
        type: "single",
        options: ["1 – 2 người", "3 – 4 người", "5 – 6 người", "Trên 6 người"],
      },
      {
        id: "thanh_phan",
        label: "Thành phần gia đình (chọn nhiều)",
        type: "multi",
        options: ["Vợ chồng trẻ", "Có con nhỏ", "Có con tuổi teen", "Sống cùng ông bà / cha mẹ", "Ở một mình", "Đại gia đình nhiều thế hệ"],
      },
      {
        id: "thoi_quen",
        label: "Thói quen sinh hoạt (chọn nhiều)",
        type: "multi",
        options: ["Nấu ăn nhiều", "Làm việc tại nhà", "Tiếp khách thường xuyên", "Nuôi thú cưng", "Tập thể dục tại nhà", "Trồng cây / làm vườn", "Thờ cúng", "Sưu tầm (sách, rượu, xe...)"],
      },
      {
        id: "luu_y_dac_biet",
        label: "Đối tượng cần lưu ý (chọn nhiều)",
        type: "multi",
        options: ["Người cao tuổi", "Trẻ nhỏ", "Người hạn chế vận động", "Không có"],
      },
    ],
  },
  {
    id: "cong_nang",
    title: "Công năng & phòng",
    icon: "🛋️",
    questions: [
      {
        id: "so_phong_ngu",
        label: "Số phòng ngủ cần có",
        type: "single",
        options: ["1", "2", "3", "4", "5 trở lên"],
      },
      {
        id: "phong_can_them",
        label: "Không gian / phòng cần có thêm (chọn nhiều)",
        type: "multi",
        options: ["Phòng thờ", "Phòng làm việc", "Phòng giải trí / gym", "Phòng người giúp việc", "Gara ô tô", "Sân vườn", "Hồ bơi", "Sân thượng / BBQ", "Thang máy", "Kho chứa đồ", "Giếng trời"],
      },
      {
        id: "uu_tien_khong_gian",
        label: "Không gian bạn coi trọng nhất",
        type: "single",
        options: ["Phòng khách", "Bếp & phòng ăn", "Phòng ngủ master", "Sân vườn", "Không gian sinh hoạt chung"],
      },
      {
        id: "bo_cuc",
        label: "Phong cách bố cục không gian",
        type: "single",
        options: ["Mở — thông thoáng, liên hoàn", "Riêng tư — phân khu rõ ràng", "Cân bằng cả hai"],
      },
    ],
  },
  {
    id: "phong_cach",
    title: "Phong cách & thẩm mỹ",
    icon: "🎨",
    questions: [
      {
        id: "phong_cach_yeu_thich",
        label: "Phong cách yêu thích (chọn nhiều)",
        type: "multi",
        options: ["Hiện đại", "Tối giản (Minimalist)", "Tân cổ điển", "Cổ điển", "Indochine (Đông Dương)", "Bắc Âu (Scandinavian)", "Nhiệt đới", "Wabi-sabi", "Industrial", "Luxury / Sang trọng", "Chưa rõ"],
      },
      {
        id: "tong_mau",
        label: "Tông màu mong muốn (chọn nhiều)",
        type: "multi",
        options: ["Trung tính (trắng / xám / be)", "Trầm ấm (nâu / gỗ)", "Tương phản mạnh", "Pastel nhẹ nhàng", "Tối (dark)", "Nhiều màu / cá tính"],
      },
      {
        id: "cam_giac",
        label: "Cảm giác không gian mong muốn (chọn nhiều)",
        type: "multi",
        options: ["Ấm cúng", "Sang trọng", "Thư giãn / nghỉ dưỡng", "Năng động", "Yên tĩnh / thiền", "Gần gũi thiên nhiên"],
      },
    ],
  },
  {
    id: "vat_lieu",
    title: "Vật liệu & chi tiết",
    icon: "🧱",
    questions: [
      {
        id: "vat_lieu_ua_thich",
        label: "Vật liệu ưa thích (chọn nhiều)",
        type: "multi",
        options: ["Gỗ tự nhiên", "Đá tự nhiên (marble / granite)", "Kính lớn", "Bê tông trần", "Gạch thô / gạch bông", "Kim loại (đồng / inox)", "Mây tre / vật liệu thô mộc"],
      },
      {
        id: "anh_sang",
        label: "Mức độ ánh sáng tự nhiên",
        type: "single",
        options: ["Tối đa ánh sáng tự nhiên", "Vừa phải", "Ấm cúng / ít chói"],
      },
      {
        id: "cay_xanh",
        label: "Mức độ cây xanh",
        type: "single",
        options: ["Rất nhiều (sân vườn, mảng xanh)", "Vừa phải (điểm nhấn)", "Tối thiểu"],
      },
    ],
  },
  {
    id: "ngan_sach",
    title: "Ngân sách & tiến độ",
    icon: "💰",
    questions: [
      {
        id: "ngan_sach",
        label: "Ngân sách xây dựng dự kiến",
        type: "single",
        options: ["Dưới 1 tỷ", "1 – 2 tỷ", "2 – 3.5 tỷ", "3.5 – 5 tỷ", "Trên 5 tỷ", "Chưa xác định"],
      },
      {
        id: "muc_hoan_thien",
        label: "Mức độ hoàn thiện mong muốn",
        type: "single",
        options: ["Cơ bản", "Trung bình khá", "Cao cấp", "Không giới hạn"],
      },
      {
        id: "thoi_gian",
        label: "Thời gian dự kiến khởi công",
        type: "single",
        options: ["Càng sớm càng tốt", "Trong 3 tháng", "3 – 6 tháng", "Sau 6 tháng", "Chưa rõ"],
      },
      {
        id: "uu_tien_hang_dau",
        label: "Ưu tiên hàng đầu của bạn",
        type: "single",
        options: ["Tối ưu chi phí", "Công năng tiện nghi", "Thẩm mỹ / đẳng cấp", "Bền vững / tiết kiệm năng lượng"],
      },
    ],
  },
  {
    id: "mong_muon",
    title: "Mong muốn riêng",
    icon: "✍️",
    questions: [
      {
        id: "phai_co",
        label: "Điều bạn NHẤT ĐỊNH muốn có",
        type: "text",
        placeholder: "VD: phòng thờ riêng, bếp đảo lớn, view ra vườn...",
        optional: true,
      },
      {
        id: "tranh",
        label: "Điều bạn muốn TRÁNH",
        type: "text",
        placeholder: "VD: không cầu thang dốc, tránh màu quá tối...",
        optional: true,
      },
      {
        id: "ghi_chu",
        label: "Ghi chú thêm cho kiến trúc sư",
        type: "text",
        placeholder: "Bất cứ điều gì bạn muốn chia sẻ thêm...",
        optional: true,
      },
    ],
  },
];
