import { getGeminiModel } from './gemini'
import type { QuizSession, DesignBrief } from './briefing-types'

export async function analyzeClientBrief(
  session: QuizSession,
  projectName: string
): Promise<Omit<DesignBrief, 'id' | 'project_id' | 'generated_at' | 'gemini_model'>> {
  const model = getGeminiModel()

  const styleLabels: Record<string, string> = {
    bac_au: 'Bắc Âu (Scandinavian)',
    dong_duong: 'Đông Dương (Indochine)',
    hien_dai: 'Hiện Đại (Modern)',
    co_dien: 'Cổ Điển (Classic)',
    nha_vuon: 'Nhà Vườn (Tropical)',
    toi_gian: 'Tối Giản (Minimalist)',
  }

  const budgetLabels: Record<string, string> = {
    under_500m: 'Dưới 500 triệu',
    '500m_1b': '500 triệu – 1 tỷ',
    '1b_2b': '1 tỷ – 2 tỷ',
    over_2b: 'Trên 2 tỷ',
  }

  const styleScoreText = Object.entries(session.style_scores)
    .map(([k, v]) => `${styleLabels[k] || k}: ${Math.round(v * 100)}%`)
    .join(', ')

  const habitsText = Object.entries(session.lifestyle_habits)
    .filter(([, v]) => v)
    .map(([k]) => {
      const map: Record<string, string> = {
        cooking: 'thích nấu ăn',
        wfh: 'làm việc tại nhà',
        pets: 'nuôi thú cưng',
        exercise: 'tập thể dục tại nhà',
        guests_frequent: 'thường xuyên có khách',
        gardening: 'trồng cây/làm vườn',
      }
      return map[k] || k
    })
    .join(', ')

  const familyDesc = session.family_members
    .map((m) => {
      const roleMap: Record<string, string> = { adult: 'người lớn', child: 'trẻ em', elder: 'người cao tuổi' }
      return `${roleMap[m.role]} (${m.age_range})`
    })
    .join(', ')

  const prompt = `
Bạn là chuyên gia phân tích tâm lý không gian sống cho kiến trúc sư.
Hãy phân tích dữ liệu khảo sát sau và trả về JSON THUẦN TÚY (không có markdown, không có \`\`\`json).

=== DỮ LIỆU KHẢO SÁT ===
Dự án: ${projectName}
Thành phần gia đình: ${session.family_size} người gồm ${familyDesc}
Thói quen sinh hoạt: ${habitsText || 'không có đặc biệt'}
Ngân sách: ${budgetLabels[session.budget_range] || session.budget_range}
Ghi chú của khách: "${session.free_text_notes || 'không có'}"

Kết quả chọn hình ảnh phong cách:
${styleScoreText}

Hình ảnh khách đã chọn (tags):
${session.selected_images.map((img) => `- ${img.style}: [${img.tags.join(', ')}]`).join('\n')}

=== YÊU CẦU PHÂN TÍCH ===
Trả về JSON với cấu trúc CHÍNH XÁC sau:

{
  "dominant_style": "tên phong cách chủ đạo bằng tiếng Việt",
  "style_breakdown": {"tên_phong_cách": phần_trăm_số_nguyên, ...},
  "color_palette": ["#hex1", "#hex2", "#hex3", "#hex4", "#hex5"],
  "material_preferences": ["vật liệu 1", "vật liệu 2", "vật liệu 3"],
  "lighting_preference": "mô tả sở thích ánh sáng",
  "design_constraints": [
    {
      "type": "accessibility|safety|functional|spatial|budget",
      "note": "ràng buộc thiết kế cụ thể",
      "triggered_by": "lý do từ dữ liệu"
    }
  ],
  "space_requirements": [
    {
      "room": "tên phòng",
      "note": "yêu cầu đặc biệt",
      "priority": "must_have|nice_to_have"
    }
  ],
  "ai_summary": "Đoạn tóm tắt 3-4 câu cho kiến trúc sư, viết chuyên nghiệp, nêu rõ phong cách chủ đạo, tính cách khách hàng, và những lưu ý quan trọng nhất."
}

Quy tắc suy luận ràng buộc ẩn:
- Có người lớn tuổi → thêm constraint accessibility: không bậc thềm dốc, phòng ngủ tầng trệt, tay vịn cầu thang
- Có trẻ em → safety: góc tường bo tròn, vật liệu sàn chống trơn, không nội thất sắc nhọn
- Nuôi thú cưng → functional: sàn dễ lau chùi, không thảm len, khu vực riêng cho thú cưng
- Làm việc tại nhà → spatial: cần góc làm việc yên tĩnh, ánh sáng đủ, cách âm
- Thường xuyên có khách → spatial: phòng khách rộng, có khu ăn uống linh hoạt
- Ngân sách hạn chế → budget: ưu tiên vật liệu trong nước, thiết kế tối giản

Chỉ trả về JSON thuần túy.`

  const result = await model.generateContent(prompt)
  const text = result.response.text().trim()
  const cleaned = text.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim()

  return JSON.parse(cleaned)
}
