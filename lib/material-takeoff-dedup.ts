import { getGeminiModel, generateContentRetry } from "@/lib/gemini";

/** Một mục gửi đi gom cụm — chỉ cần id + chữ để AI so nghĩa. */
export interface DedupItem {
  id: string;
  name: string;
  description: string;
}

export interface DedupRequest {
  materials: DedupItem[];
  furniture: DedupItem[];
}

export interface DedupResult {
  /** Mỗi cụm = danh sách id chỉ CÙNG một vật liệu/nội thất (kể cả cụm 1 phần tử). */
  materialClusters: string[][];
  furnitureClusters: string[][];
}

function stripFence(text: string): string {
  return text
    .replace(/^```json\n?/, "")
    .replace(/^```\n?/, "")
    .replace(/\n?```$/, "")
    .trim();
}

/**
 * Đảm bảo MỌI id xuất hiện đúng một lần: bỏ id lạ/trùng do model trả về, rồi
 * thêm những id bị model bỏ sót thành cụm 1 phần tử. Không tin tuyệt đối vào AI.
 */
function reconcile(ids: string[], rawClusters: unknown): string[][] {
  const valid = new Set(ids);
  const seen = new Set<string>();
  const clusters: string[][] = [];
  if (Array.isArray(rawClusters)) {
    for (const c of rawClusters) {
      if (!Array.isArray(c)) continue;
      const cluster = c
        .map((x) => String(x))
        .filter((id) => valid.has(id) && !seen.has(id));
      cluster.forEach((id) => seen.add(id));
      if (cluster.length > 0) clusters.push(cluster);
    }
  }
  for (const id of ids) {
    if (!seen.has(id)) clusters.push([id]);
  }
  return clusters;
}

function listForPrompt(items: DedupItem[]): string {
  return items.map((it) => `- ${it.id}: ${it.name} — ${it.description}`).join("\n");
}

/**
 * Gom cụm các mục TRÙNG NHAU giữa nhiều ảnh của CÙNG một không gian (chụp ở các góc
 * khác nhau). Hai mục là "trùng" nếu chỉ cùng MỘT vật thật, dù tên/chữ viết khác.
 * Chỉ gom trong cùng nhóm (vật liệu riêng, nội thất riêng). Một lượt gọi text.
 */
export async function dedupTakeoff(req: DedupRequest): Promise<DedupResult> {
  const matIds = req.materials.map((m) => m.id);
  const furIds = req.furniture.map((f) => f.id);
  if (matIds.length === 0 && furIds.length === 0) {
    return { materialClusters: [], furnitureClusters: [] };
  }

  const model = getGeminiModel();
  const prompt = `Bạn là KIẾN TRÚC SƯ rà soát dự toán. Dưới đây là các VẬT LIỆU và ĐỒ NỘI THẤT được bóc tách từ NHIỀU ẢNH chụp CÙNG một không gian ở các góc khác nhau. Vì cùng một không gian nên nhiều mục bị lặp lại giữa các ảnh.

Nhiệm vụ: GOM CỤM những mục cùng chỉ MỘT vật thật ngoài đời, DÙ tên hay mô tả viết khác nhau (vd "Sofa vải xám" và "Ghế sofa màu xám" là một; "Đèn LED âm trần" và "Đèn downlight" là một). Mỗi cụm gồm các id của những mục trùng nhau. Mục không trùng với ai thì thành cụm chỉ có 1 id. CHỈ gom trong cùng nhóm — không trộn vật liệu với nội thất.

QUY TẮC:
- Mỗi id phải xuất hiện ĐÚNG MỘT LẦN, không bỏ sót, không lặp.
- Chỉ gom khi thật sự CÙNG một vật; nếu nghi ngờ thì tách riêng.

VẬT LIỆU:
${listForPrompt(req.materials) || "(không có)"}

ĐỒ NỘI THẤT:
${listForPrompt(req.furniture) || "(không có)"}

Trả về JSON THUẦN TÚY (không markdown, không \`\`\`), đúng cấu trúc:
{
  "materialClusters": [["id1","id2"], ["id3"]],
  "furnitureClusters": [["id4"], ["id5","id6"]]
}
Chỉ trả về JSON.`;

  const result = await generateContentRetry(model, prompt);
  const parsed = JSON.parse(stripFence(result.response.text().trim())) as {
    materialClusters?: unknown;
    furnitureClusters?: unknown;
  };

  return {
    materialClusters: reconcile(matIds, parsed.materialClusters),
    furnitureClusters: reconcile(furIds, parsed.furnitureClusters),
  };
}
