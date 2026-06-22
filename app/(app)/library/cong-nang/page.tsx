import { LibraryLookup } from "@/components/library/LibraryLookup";

export default function CongNangPage() {
  return (
    <LibraryLookup
      config={{
        category: "cong-nang",
        title: "MB Công năng",
        subtitle:
          "Mô tả không gian bạn cần (WC, căn hộ, nhà trọ…) — AI tư vấn bố trí và đưa ra các mặt bằng công năng tham khảo phù hợp.",
        glyph: "📐",
        glow: "from-teal-500/30 to-cyan-500/5",
        placeholder: "VD: WC 2.6 x 1.5m có tắm đứng • căn hộ studio 30m² có ban công…",
        examples: [
          "WC nhỏ 2m²",
          "WC có bồn tắm",
          "Căn hộ studio 30m²",
          "Căn hộ 1 phòng ngủ có ban công",
        ],
      }}
    />
  );
}
