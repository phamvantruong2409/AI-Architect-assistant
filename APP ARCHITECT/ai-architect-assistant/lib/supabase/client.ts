import { createBrowserClient } from "@supabase/ssr";

// Client phía trình duyệt — dùng khoá publishable (an toàn để lộ ở client).
// Phiên đăng nhập được lưu/đồng bộ qua cookie để server (proxy, route) đọc được.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
