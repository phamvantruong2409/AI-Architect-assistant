import { GoogleGenerativeAI } from '@google/generative-ai'
import type { RegCheck, RegReport } from './regulatory-types'
import {
  getSetbackRule,
  MAX_DENSITY,
  MAX_FAR,
  getMaxHeightForFloors,
  PCCC_RULES,
  LIGHTING_RULES,
  BUILDING_TYPE_LABELS,
  ZONING_TYPE_LABELS,
} from './regulatory-regulations'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

export async function analyzeRegulatory(
  check: RegCheck,
  imageBase64?: string
): Promise<Omit<RegReport, 'id' | 'check_id' | 'generated_at' | 'gemini_model'>> {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

  const setbackRule = getSetbackRule(check.floors)
  const maxDensity = MAX_DENSITY[check.building_type]
  const maxFAR = MAX_FAR[check.building_type]
  const maxHeight = getMaxHeightForFloors(check.floors)
  const actualDensity = Math.round((check.building_area / check.land_area) * 100)
  const actualFAR = parseFloat((check.total_floor_area / check.land_area).toFixed(2))

  const prompt = `Bạn là chuyên gia pháp lý xây dựng tại Việt Nam.
Hãy kiểm tra thông số công trình sau dựa trên Tiêu chuẩn và Quy chuẩn Xây dựng Việt Nam hiện hành.
Trả về JSON THUẦN TÚY (không markdown, không \`\`\`json).

=== THÔNG TIN DỰ ÁN ===
Tên dự án: ${check.project_name}
Địa chỉ: ${check.project_address}
Loại công trình: ${BUILDING_TYPE_LABELS[check.building_type]}
Quy hoạch: ${ZONING_TYPE_LABELS[check.zoning_type]}

=== THÔNG SỐ LÔ ĐẤT ===
Diện tích lô đất: ${check.land_area} m²
Mặt tiền: ${check.land_width} m
Chiều sâu: ${check.land_depth} m

=== THÔNG SỐ CÔNG TRÌNH DỰ KIẾN ===
Số tầng: ${check.floors}
Chiều cao tổng: ${check.total_height} m
Diện tích xây dựng (footprint): ${check.building_area} m²
Tổng diện tích sàn: ${check.total_floor_area} m²

=== KHOẢNG LÙI (m) ===
Mặt tiền: ${check.setback_front} m
Phía sau: ${check.setback_rear} m
Hông trái: ${check.setback_left} m
Hông phải: ${check.setback_right} m

=== PCCC & THÔNG GIÓ ===
Chiều rộng hành lang/lối thoát: ${check.corridor_width} m
Tỷ lệ cửa sổ/diện tích sàn: ${check.window_ratio}%

=== GHI CHÚ THÊM ===
${check.extra_notes || 'Không có'}

=== TIÊU CHUẨN ĐỐI CHIẾU (đã tính sẵn) ===
Khoảng lùi tối thiểu cho công trình ${check.floors} tầng (QCXDVN 01:2021):
  - Mặt tiền: ≥ ${setbackRule.front_min} m
  - Hông: ≥ ${setbackRule.side_min} m
  - Phía sau: ≥ ${setbackRule.rear_min} m
Mật độ xây dựng tối đa: ${maxDensity}% (hiện tại: ${actualDensity}%)
Hệ số sử dụng đất FAR tối đa: ${maxFAR} (hiện tại: ${actualFAR})
Chiều cao tối đa tham khảo: ${maxHeight} m
Chiều rộng hành lang tối thiểu (QCVN 06:2022): ≥ ${PCCC_RULES.corridor_width_min} m
Tỷ lệ cửa sổ tối thiểu (TCVN 4474): ≥ ${LIGHTING_RULES.window_ratio_min}%

=== YÊU CẦU PHÂN TÍCH ===
Kiểm tra toàn bộ 7 hạng mục: khoảng lùi mặt tiền, khoảng lùi hông, khoảng lùi sau, mật độ xây dựng, FAR, chiều cao, PCCC hành lang, thông gió chiếu sáng.
${imageBase64 ? 'Đã có ảnh mặt bằng đính kèm — phân tích thêm nếu phát hiện bất thường.' : ''}

Trả về JSON với cấu trúc CHÍNH XÁC sau:

{
  "overall_score": số_nguyên_0_đến_100,
  "compliance_summary": "Đoạn tóm tắt 2-3 câu cho kiến trúc sư về tình trạng tuân thủ chung và điểm quan trọng nhất cần sửa.",
  "violations": [
    {
      "category": "khoang_lui|mat_do|far|chieu_cao|pccc|thong_gio|khac",
      "severity": "error|warning|info",
      "title": "Tên vi phạm ngắn gọn",
      "description": "Mô tả chi tiết vi phạm",
      "standard_ref": "Tên tiêu chuẩn, điều khoản cụ thể",
      "current_value": "Giá trị KTS nhập",
      "required_value": "Giá trị tiêu chuẩn yêu cầu",
      "recommendation": "Hướng dẫn điều chỉnh cụ thể"
    }
  ],
  "passed_checks": ["Tên hạng mục đạt 1", "Tên hạng mục đạt 2"]
}

Chỉ liệt kê violations thực sự có vấn đề. Nếu hạng mục nào đạt thì đưa vào passed_checks.
Chỉ trả về JSON thuần túy.`

  const parts: Parameters<typeof model.generateContent>[0] = imageBase64
    ? [prompt, { inlineData: { mimeType: 'image/jpeg' as const, data: imageBase64 } }]
    : prompt

  const result = await model.generateContent(parts)
  const text = result.response.text().trim()
  const cleaned = text.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim()

  return JSON.parse(cleaned)
}
