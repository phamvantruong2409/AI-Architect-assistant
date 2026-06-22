import { LibraryLookup } from "@/components/library/LibraryLookup";

export default function CauTaoPage() {
  return (
    <LibraryLookup
      config={{
        category: "cau-tao",
        title: "Chi tiết cấu tạo",
        subtitle:
          "Hỏi về chi tiết cấu tạo bạn cần — AI tư vấn và đưa ra bản vẽ kỹ thuật, chi tiết tham khảo.",
        glyph: "🛠️",
        glow: "from-amber-500/30 to-orange-500/5",
        placeholder: "VD: Chi tiết cấu tạo sàn vệ sinh chống thấm, ban công, mái dốc…",
        examples: [
          "Chống thấm sàn WC",
          "Cấu tạo ban công",
          "Chi tiết mái dốc",
          "Lan can kính",
        ],
      }}
    />
  );
}
