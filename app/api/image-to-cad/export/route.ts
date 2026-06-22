import { exportPlanToDwg } from "@/lib/cad-runner";
import type { CadPlan } from "@/lib/image-to-cad-types";

export const maxDuration = 300;

export async function POST(req: Request) {
  let plan: CadPlan;
  try {
    plan = (await req.json()) as CadPlan;
  } catch {
    return Response.json({ error: "Dữ liệu mặt bằng không hợp lệ" }, { status: 400 });
  }

  if (!Array.isArray(plan?.walls) || (plan.walls.length === 0 && plan.rooms?.length === 0)) {
    return Response.json({ error: "Mặt bằng rỗng, không có gì để xuất" }, { status: 400 });
  }

  try {
    const { dwg } = await exportPlanToDwg(plan);
    const fileName = `${slugify(plan.title || "mat-bang")}.dwg`;
    return new Response(new Uint8Array(dwg), {
      status: 200,
      headers: {
        "Content-Type": "application/acad",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Content-Length": String(dwg.length),
      },
    });
  } catch (error) {
    console.error("Image to CAD export error:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Xuất DWG thất bại" },
      { status: 502 }
    );
  }
}

function slugify(name: string): string {
  return (
    name
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/đ/g, "d")
      .replace(/Đ/g, "D")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase() || "mat-bang"
  );
}
