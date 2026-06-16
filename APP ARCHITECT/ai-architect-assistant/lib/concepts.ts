import type { Concept, ProjectBrief } from "@/types/concept";

const TEMPLATES: Omit<Concept, "id">[] = [
  {
    name: "Nhiệt đới Hiện đại",
    tagline: "Thoáng, xanh, ứng xử tốt với khí hậu nóng ẩm",
    description:
      "Khối hình đơn giản, mái đua rộng và lam che nắng theo phương đứng giúp giảm nhiệt cho mặt tiền hướng Tây. Cây xanh được đưa vào các khoảng lùi và giếng trời, tạo vi khí hậu mát cho toàn nhà. Vật liệu thô mộc kết hợp kính lớn giúp không gian trong nhà luôn đủ sáng tự nhiên.",
    style: ["Nhiệt đới", "Hiện đại", "Xanh"],
    materials: ["Bê tông mài", "Gỗ composite", "Lam nhôm", "Kính Low-E"],
    colorPalette: ["#E7E0D5", "#A98B6C", "#6F7A5C", "#3A352E"],
    references: ["Vo Trong Nghia Architects", "Atelier Tho.A"],
    reasoning:
      "Phù hợp với khí hậu và ngân sách trung bình, đồng thời đáp ứng xu hướng sống xanh đang được khách hàng Việt ưa chuộng.",
  },
  {
    name: "Indochine Đương đại",
    tagline: "Hoài niệm Đông Dương trong ngôn ngữ tối giản",
    description:
      "Kết hợp các chi tiết gạch bông, cửa lá sách và mái ngói truyền thống với mặt bằng mở hiện đại. Tông màu trầm ấm tạo cảm giác sang trọng, gần gũi. Phù hợp cho gia chủ muốn lưu giữ bản sắc văn hoá trong một không gian sống tiện nghi.",
    style: ["Indochine", "Á Đông", "Sang trọng"],
    materials: ["Gạch bông gió", "Gỗ tự nhiên", "Đá marble", "Ngói đất nung"],
    colorPalette: ["#F2E9DC", "#C9A66B", "#7A4F3A", "#2E2A26"],
    references: ["La Residence Hue", "Công trình biệt thự Đông Dương Đà Lạt"],
    reasoning:
      "Tạo điểm khác biệt thẩm mỹ so với các thiết kế hiện đại đại trà, phù hợp nếu khách hàng đề cao yếu tố văn hoá và trải nghiệm.",
  },
  {
    name: "Tối giản Ấm áp",
    tagline: "Ít chi tiết, nhiều ánh sáng, vật liệu thật",
    description:
      "Đường nét kiến trúc được lược giản tối đa, tập trung vào tỷ lệ không gian và chất liệu thật như gỗ, đá, vải thô. Ánh sáng tự nhiên là yếu tố trang trí chính. Phù hợp cho các công trình có ngân sách hoàn thiện vừa phải nhưng vẫn cần cảm giác cao cấp.",
    style: ["Tối giản", "Wabi-sabi", "Ấm áp"],
    materials: ["Sơn vân bê tông", "Gỗ sồi", "Đá tự nhiên", "Vải lanh"],
    colorPalette: ["#F5F1EA", "#D8CCBE", "#9C8E7E", "#403A33"],
    references: ["Muji House", "Norm Architects"],
    reasoning:
      "Tối ưu chi phí thi công nhờ giảm chi tiết trang trí, đồng thời vẫn tạo cảm giác tinh tế nhờ chọn lọc vật liệu kỹ.",
  },
];

export function generateMockConcepts(brief: ProjectBrief): Concept[] {
  return TEMPLATES.map((t, i) => ({
    id: `${brief.type || "concept"}-${i}-${Date.now()}`,
    ...t,
  }));
}
