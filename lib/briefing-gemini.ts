import { generateTextLLM } from "./ai";

function buildPrompt(projectName: string, clientName: string, detail: string): string {
  return `Bạn là kiến trúc sư trưởng giàu kinh nghiệm tại Việt Nam. Dưới đây là THÔNG TIN CHI TIẾT do kiến trúc sư ghi lại cho dự án "${projectName}" của khách hàng "${clientName}". Hãy tổng hợp và suy luận thành một bản NHIỆM VỤ THIẾT KẾ chuyên nghiệp, súc tích, đủ để bắt tay vào concept.

=== THÔNG TIN CHI TIẾT ===
${detail.trim() || "(chưa có nhiều thông tin)"}

=== YÊU CẦU ===
Viết bằng tiếng Việt, định dạng Markdown với các mục (dùng tiêu đề "## "):
## Tổng quan & chân dung khách hàng
(2-3 câu nắm bắt khách hàng và mục tiêu dự án)
## Phong cách & định hướng thẩm mỹ
(phong cách chủ đạo, tông màu, cảm giác không gian, vật liệu chủ đạo)
## Yêu cầu công năng
(liệt kê phòng/không gian cần có + lưu ý bố trí, ưu tiên)
## Ràng buộc & lưu ý đặc biệt
(suy luận từ thông tin: người già → tiếp cận an toàn; trẻ nhỏ → an toàn; hướng nắng; ngân sách; kỹ thuật...)
## Bảng màu & vật liệu gợi ý
(gợi ý cụ thể, phù hợp ngân sách)
## Khuyến nghị của kiến trúc sư
(3-5 gạch đầu dòng định hướng concept tiếp theo)

Chỉ trả về nội dung Markdown của bản nhiệm vụ thiết kế, không thêm lời mở đầu hay kết luận thừa.`;
}

export async function generateDesignTaskFromDetail(
  projectName: string,
  clientName: string,
  detail: string,
  modelId?: string
): Promise<string> {
  const prompt = buildPrompt(projectName, clientName, detail);
  const text = await generateTextLLM({ model: modelId, prompt });
  return text.trim();
}
