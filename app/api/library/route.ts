import { getLibraryInfo } from "@/lib/library-store";

export async function GET() {
  return Response.json(getLibraryInfo());
}
