/** Gợi ý mặc định (fallback) cho thanh nhập ý tưởng — dùng khi chưa tải được
 *  gợi ý theo ngày hoặc khi gọi AI lỗi/offline. An toàn để import ở client. */
export const DEFAULT_SUGGESTIONS = [
  "Thiết kế villa 2 tầng 10x20m",
  "Nhà chống nóng miền Tây",
  "Resort sinh thái Phú Quốc",
  "Văn phòng hiện đại 500m²",
];

/** Số gợi ý hiển thị. */
export const SUGGESTION_COUNT = 4;

/** Gợi ý mặc định (fallback) cho ô trống của AI Chat — là câu HỎI kiến thức
 *  (thuật ngữ, quy chuẩn, vật liệu, phong cách), khác với brief thiết kế ở trên. */
export const DEFAULT_CHAT_QUESTIONS = [
  "Gợi ý vật liệu chống nóng cho mặt tiền hướng Tây",
  "Quy định khoảng lùi xây dựng nhà phố theo QCVN 01:2021",
  "So sánh phong cách Indochine và Nhiệt đới hiện đại",
  "Thông thủy cầu thang tối thiểu là bao nhiêu?",
];

/** Số câu hỏi gợi ý hiển thị trong AI Chat. */
export const CHAT_QUESTION_COUNT = 4;
