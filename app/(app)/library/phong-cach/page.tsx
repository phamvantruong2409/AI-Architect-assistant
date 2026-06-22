import { LibraryLookup } from "@/components/library/LibraryLookup";

export default function PhongCachPage() {
  return (
    <LibraryLookup
      config={{
        category: "phong-cach",
        title: "Phong cách kiến trúc",
        subtitle:
          "Mô tả gu thẩm mỹ bạn hướng tới — AI tư vấn và đưa ra hình ảnh phong cách kiến trúc, nội thất tham khảo.",
        glyph: "🎨",
        glow: "from-violet-500/30 to-fuchsia-500/5",
        placeholder: "VD: Phòng khách Indochine ấm cúng, nhà phố hiện đại tối giản…",
        examples: [
          "Indochine",
          "Tối giản hiện đại",
          "Scandinavian",
          "Tân cổ điển",
        ],
      }}
    />
  );
}
