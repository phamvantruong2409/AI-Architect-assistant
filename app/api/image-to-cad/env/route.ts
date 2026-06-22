import { checkExportEnv } from "@/lib/cad-runner";

// Cho UI biết máy có sẵn AutoCAD + template để bật/tắt nút "Xuất DWG".
export async function GET() {
  try {
    const env = checkExportEnv();
    return Response.json({
      ready: env.ready,
      hasAutocad: Boolean(env.accore),
      hasTemplate: Boolean(env.template),
    });
  } catch {
    return Response.json({ ready: false, hasAutocad: false, hasTemplate: false });
  }
}
