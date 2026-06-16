export function geminiErrorCode(error: unknown): "QUOTA_EXCEEDED" | "AUTH_ERROR" | "UNKNOWN" {
  const status = (error as { status?: number })?.status;
  if (status === 429) return "QUOTA_EXCEEDED";
  if (status === 401 || status === 403) return "AUTH_ERROR";
  return "UNKNOWN";
}

export function geminiErrorMessage(error: unknown): string {
  switch (geminiErrorCode(error)) {
    case "QUOTA_EXCEEDED":
      return "Đã hết hạn mức sử dụng Gemini cho hôm nay (giới hạn gói miễn phí). Vui lòng thử lại sau hoặc đổi sang model khác.";
    case "AUTH_ERROR":
      return "API key Gemini không hợp lệ hoặc không có quyền truy cập model này.";
    default:
      return "Không thể kết nối với Gemini. Vui lòng thử lại.";
  }
}
