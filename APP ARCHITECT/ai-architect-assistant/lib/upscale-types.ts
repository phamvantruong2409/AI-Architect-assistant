// Kiểu dữ liệu dùng chung cho tính năng Upscale ảnh (Real-ESRGAN local + SUPIR cloud).

export type UpscaleEngine = "realesrgan" | "supir" | "seedvr2";

export const MAX_UPSCALE_BYTES = 10 * 1024 * 1024; // 10MB

export interface UpscaleEngineInfo {
  id: UpscaleEngine;
  label: string;
  badge: string; // "Local" | "Cloud"
  description: string;
  comingSoon?: boolean; // true = chưa bật, hiện "Đang phát triển"
  note?: string; // tooltip khi rê chuột (dùng cho engine đang phát triển)
}

export const UPSCALE_ENGINES: UpscaleEngineInfo[] = [
  {
    id: "realesrgan",
    label: "Real-ESRGAN x4plus",
    badge: "Local",
    description:
      "Chạy ngay trên máy bằng GPU/CPU — miễn phí, không cần mạng. Tốt nhất cho render kiến trúc, mặt phẳng, vật liệu.",
  },
  {
    id: "supir",
    label: "SUPIR (diffusion)",
    badge: "Cloud",
    description:
      "Chất lượng đỉnh, AI vẽ lại chi tiết phong phú. Chạy trên cloud (Replicate) — cần mạng và tốn lượt/credit.",
    comingSoon: true,
    note: "Ứng dụng SUPIR upscale đang phát triển — chất lượng đỉnh, chạy trên cloud (Replicate), mỗi ảnh tối đa ~5 phút.",
  },
  {
    id: "seedvr2",
    label: "SeedVR2 (diffusion)",
    badge: "Cloud",
    description:
      "Diffusion chất lượng cao, mạnh cho cả video. Chạy trên cloud (Replicate) — nhanh ~6 giây/ảnh, dùng được trên mọi máy. Cần REPLICATE_API_TOKEN.",
  },
];

export interface ComparisonRow {
  label: string;
  realesrgan: string;
  supir: string;
  seedvr2: string;
}

// Bảng so sánh 3 engine — hiển thị ngay trong trang Upscale để người dùng chọn đúng.
export const UPSCALE_COMPARISON: ComparisonRow[] = [
  {
    label: "Kiểu mô hình",
    realesrgan: "GAN — làm nét",
    supir: "Diffusion — vẽ lại chi tiết",
    seedvr2: "Diffusion — mạnh cho video",
  },
  {
    label: "Nơi chạy",
    realesrgan: "Local (trên máy)",
    supir: "Cloud (Replicate)",
    seedvr2: "Cloud (Replicate)",
  },
  {
    label: "Chi phí",
    realesrgan: "Miễn phí",
    supir: "~$0.41/ảnh (~2 ảnh/1 USD)",
    seedvr2: "~$0.008/ảnh (~128 ảnh/1 USD)",
  },
  {
    label: "VRAM tối thiểu",
    realesrgan: "~4GB",
    supir: "— (chạy cloud)",
    seedvr2: "— (chạy cloud)",
  },
  {
    label: "Tốc độ",
    realesrgan: "Nhanh (GAN nhanh hơn 10–20×)",
    supir: "Chậm (~5 phút/ảnh)",
    seedvr2: "Nhanh (~6 giây/ảnh, H100)",
  },
  {
    label: "Dung lượng nhúng app",
    realesrgan: "~45MB",
    supir: "0 (gọi API)",
    seedvr2: "0 (gọi API)",
  },
  {
    label: "Hợp nhất cho",
    realesrgan: "Render KTS, dùng hằng ngày",
    supir: "Ảnh cần chất lượng đỉnh",
    seedvr2: "Video / chi tiết cinema, mọi máy",
  },
];

// Mô hình Real-ESRGAN local (đi kèm binary ncnn-vulkan).
export const REALESRGAN_MODELS = [
  { id: "realesrgan-x4plus", label: "x4plus — ảnh thực / render (khuyến nghị)" },
  { id: "realesrgan-x4plus-anime", label: "x4plus-anime — ảnh vẽ / phẳng màu" },
  { id: "realesr-animevideov3", label: "animevideov3 — nhẹ, nhanh" },
] as const;

export type RealesrganModel = (typeof REALESRGAN_MODELS)[number]["id"];

export const UPSCALE_SCALES = [2, 3, 4] as const;
export type UpscaleScale = (typeof UPSCALE_SCALES)[number];

export interface LocalUpscaleOptions {
  dataUrl: string;
  scale: number;
  tile: number; // 0 = auto; số nhỏ (32/64/128) cho card yếu tránh tràn VRAM
  model: string;
}
