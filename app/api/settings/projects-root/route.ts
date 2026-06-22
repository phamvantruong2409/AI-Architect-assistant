import { getProjectsRoot } from "@/lib/settings-store";

export async function GET() {
  return Response.json({ projectsRoot: getProjectsRoot() });
}
