import type { AiModelId } from "@/lib/ai-models";

export type DossierDocType = "phuong_an" | "concept" | "xin_phep";
export type DossierLength = "ngan" | "tieu_chuan" | "chi_tiet";

export interface DossierFormData {
  projectName: string;
  buildingType: string;
  location: string;
  landArea: string;
  floorArea: string;
  floors: string;
  style: string;
  client: string;
  concept: string;
  materials: string;
  docType: DossierDocType;
  length: DossierLength;
  model: AiModelId;
}

export interface DossierSection {
  heading: string;
  content: string;
}

export interface DossierResult {
  title: string;
  sections: DossierSection[];
}

export const BUILDING_TYPES: string[] = [
  "Nhà phố",
  "Biệt thự",
  "Nhà vườn",
  "Chung cư / Căn hộ",
  "Văn phòng",
  "Resort / Khách sạn",
  "Nhà hàng / Café",
  "Công trình công cộng",
  "Nội thất",
  "Khác",
];

export const DOC_TYPE_OPTIONS: { value: DossierDocType; label: string; hint: string }[] = [
  { value: "phuong_an", label: "Phương án kiến trúc", hint: "Thuyết minh đầy đủ các giải pháp thiết kế" },
  { value: "concept", label: "Ý tưởng concept", hint: "Tập trung câu chuyện và tinh thần thiết kế" },
  { value: "xin_phep", label: "Hồ sơ xin phép", hint: "Văn phong pháp lý, bám quy chuẩn xây dựng" },
];

export const LENGTH_OPTIONS: { value: DossierLength; label: string }[] = [
  { value: "ngan", label: "Ngắn gọn" },
  { value: "tieu_chuan", label: "Tiêu chuẩn" },
  { value: "chi_tiet", label: "Chi tiết" },
];
