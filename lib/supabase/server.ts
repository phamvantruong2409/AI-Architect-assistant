import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Client phía server (Server Component / Route Handler / proxy) — đọc phiên
// đăng nhập từ cookie. Next 16: cookies() là async.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Gọi từ Server Component — bỏ qua; proxy sẽ làm mới cookie.
          }
        },
      },
    }
  );
}
