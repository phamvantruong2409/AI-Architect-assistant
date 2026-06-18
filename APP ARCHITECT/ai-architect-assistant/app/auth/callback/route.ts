import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Google trả về đây kèm "code"; đổi code lấy phiên đăng nhập rồi về dashboard.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Lỗi hoặc thiếu code → về trang đăng nhập kèm thông báo.
  return NextResponse.redirect(`${origin}/login?error=auth`);
}
