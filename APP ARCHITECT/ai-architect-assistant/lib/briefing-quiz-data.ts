import type { QuizPair } from './briefing-types'

export const QUIZ_PAIRS: QuizPair[] = [
  {
    id: 'pair_living_1',
    question: 'Bạn muốn phòng khách của mình gần với không gian nào hơn?',
    imageA: {
      id: 'img_bac_au_1',
      url: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=800&q=80',
      alt: 'Phòng khách Bắc Âu sáng, tối giản',
      style: 'bac_au',
      tags: ['trắng', 'gỗ sáng', 'Scandinavian', 'tối giản', 'ánh sáng tự nhiên'],
    },
    imageB: {
      id: 'img_dong_duong_1',
      url: 'https://images.unsplash.com/photo-1600210492486-724fe5c67fb3?w=800&q=80',
      alt: 'Phòng khách ấm áp Đông Dương',
      style: 'dong_duong',
      tags: ['gỗ tối', 'xanh rêu', 'Indochine', 'ấm áp', 'đèn vàng'],
    },
  },
  {
    id: 'pair_bedroom_1',
    question: 'Phòng ngủ lý tưởng của bạn trông như thế nào?',
    imageA: {
      id: 'img_hien_dai_1',
      url: 'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=800&q=80',
      alt: 'Phòng ngủ hiện đại, tối giản',
      style: 'hien_dai',
      tags: ['xám', 'đen', 'Hiện đại', 'minimalist', 'ánh sáng gián tiếp'],
    },
    imageB: {
      id: 'img_co_dien_1',
      url: 'https://images.unsplash.com/photo-1616594039964-ae9021a400a0?w=800&q=80',
      alt: 'Phòng ngủ cổ điển ấm áp',
      style: 'co_dien',
      tags: ['kem', 'gỗ nâu', 'Cổ điển', 'ấm áp', 'đèn vàng ấm'],
    },
  },
  {
    id: 'pair_kitchen_1',
    question: 'Bếp và phòng ăn — bạn thích không gian nào?',
    imageA: {
      id: 'img_bac_au_2',
      url: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800&q=80',
      alt: 'Bếp Bắc Âu sáng trắng',
      style: 'bac_au',
      tags: ['trắng', 'thép không gỉ', 'Scandinavian', 'sáng', 'sạch sẽ'],
    },
    imageB: {
      id: 'img_nha_vuon_1',
      url: 'https://images.unsplash.com/photo-1565183997392-2f6f122e5912?w=800&q=80',
      alt: 'Bếp mở nhà vườn nhiều cây xanh',
      style: 'nha_vuon',
      tags: ['gạch thô', 'cây xanh', 'Nhiệt đới', 'mở', 'tự nhiên'],
    },
  },
  {
    id: 'pair_texture_1',
    question: 'Về chất liệu và bề mặt, bạn thích điều nào hơn?',
    imageA: {
      id: 'img_toi_gian_1',
      url: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=800&q=80',
      alt: 'Không gian bê tông và kính tối giản',
      style: 'toi_gian',
      tags: ['bê tông', 'kính', 'Tối giản', 'công nghiệp', 'lạnh'],
    },
    imageB: {
      id: 'img_dong_duong_2',
      url: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800&q=80',
      alt: 'Không gian gạch thủ công và mây tre',
      style: 'dong_duong',
      tags: ['gạch thủ công', 'mây tre', 'Đông Nam Á', 'thủ công', 'ấm'],
    },
  },
  {
    id: 'pair_outdoor_1',
    question: 'Không gian ngoài trời / ban công bạn mơ ước?',
    imageA: {
      id: 'img_nha_vuon_2',
      url: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&q=80',
      alt: 'Sân vườn nhiều cây xanh nhiệt đới',
      style: 'nha_vuon',
      tags: ['cây xanh', 'gỗ ngoài trời', 'Nhiệt đới', 'mát mẻ', 'tự nhiên'],
    },
    imageB: {
      id: 'img_hien_dai_2',
      url: 'https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?w=800&q=80',
      alt: 'Ban công hiện đại với bể bơi',
      style: 'hien_dai',
      tags: ['gạch đá', 'sạch', 'Hiện đại', 'sang trọng', 'tối giản'],
    },
  },
  {
    id: 'pair_lighting_1',
    question: 'Về ánh sáng, không gian nào khiến bạn cảm thấy thoải mái hơn?',
    imageA: {
      id: 'img_sang_1',
      url: 'https://images.unsplash.com/photo-1600210491892-03d54bc0c1e1?w=800&q=80',
      alt: 'Phòng đón nhiều ánh sáng ban ngày',
      style: 'bac_au',
      tags: ['ánh sáng tự nhiên', 'trắng', 'thoáng đãng', 'cửa sổ lớn'],
    },
    imageB: {
      id: 'img_am_1',
      url: 'https://images.unsplash.com/photo-1600607687644-aac4c3eac7f4?w=800&q=80',
      alt: 'Phòng ánh đèn vàng ấm áp buổi tối',
      style: 'co_dien',
      tags: ['đèn vàng ấm', 'tối', 'ấm cúng', 'riêng tư', 'sang trọng'],
    },
  },
]

export const STYLE_WEIGHTS: Record<string, string> = {
  bac_au: 'Bắc Âu',
  dong_duong: 'Đông Dương',
  hien_dai: 'Hiện Đại',
  co_dien: 'Cổ Điển',
  nha_vuon: 'Nhà Vườn',
  toi_gian: 'Tối Giản',
}

export function calculateStyleScores(
  selectedImages: { style: string }[]
): Record<string, number> {
  const counts: Record<string, number> = {}
  const total = selectedImages.length

  for (const img of selectedImages) {
    counts[img.style] = (counts[img.style] || 0) + 1
  }

  const scores: Record<string, number> = {}
  for (const [style, count] of Object.entries(counts)) {
    scores[style] = total > 0 ? count / total : 0
  }

  return scores
}
