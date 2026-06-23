// Luồng khảo sát đã chuyển sang lưu cục bộ: gửi đáp án tới
// POST /api/briefing/projects/[token] (tạo sinh brief bằng Gemini).
// Endpoint này giữ lại để tương thích nhưng không còn dùng.
export async function POST() {
  return Response.json(
    { error: "Endpoint không còn dùng — khảo sát đã chuyển sang /api/briefing/projects/[token]" },
    { status: 410 }
  );
}
