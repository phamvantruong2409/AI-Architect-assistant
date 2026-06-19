export interface QuickAction {
  label: string;
  description: string;
  href: string;
  icon: "chat" | "wand" | "layers" | "image" | "document" | "archive";
  cta: string;
}

export const quickActions: QuickAction[] = [
  {
    label: "AI Chat",
    description: "Trao đổi, hỏi đáp về kiến trúc – nội thất",
    href: "/chat",
    icon: "chat",
    cta: "Bắt đầu chat",
  },
  {
    label: "Lưu trữ Prompt",
    description: "Cất giữ prompt kèm ảnh, lưu vĩnh viễn",
    href: "/prompt-library",
    icon: "archive",
    cta: "Mở kho",
  },
  {
    label: "Ảnh → Prompt",
    description: "Đưa ảnh vào, AI đọc ngược ra prompt tái tạo",
    href: "/image-to-prompt",
    icon: "image",
    cta: "Trích prompt",
  },
  {
    label: "Sơ đồ khối AI",
    description: "Bố cục mặt bằng thông minh",
    href: "/auto-layout",
    icon: "layers",
    cta: "Tạo layout",
  },
  {
    label: "Render AI",
    description: "Render ảnh 3D chất lượng cao",
    href: "/review",
    icon: "image",
    cta: "Render ngay",
  },
  {
    label: "Thuyết minh AI",
    description: "Hỗ trợ viết thuyết minh, bóc tách vật tư",
    href: "/dossier",
    icon: "document",
    cta: "Viết thuyết minh",
  },
];

export interface RecentProject {
  id: string;
  name: string;
  type: string;
  progress: number;
  gradient: string;
  folderPath?: string;
  coverImagePath?: string;
  coverUpdatedAt?: number;
}

export const recentProjects: RecentProject[] = [
  {
    id: "villa-da-lat",
    name: "Villa Đà Lạt",
    type: "Nhiệt đới hiện đại",
    progress: 70,
    gradient: "from-[#d9c7a8] to-[#8a7559]",
  },
  {
    id: "cafe-nhat-ban",
    name: "Café Nhật Bản",
    type: "Tối giản",
    progress: 45,
    gradient: "from-[#cdd6c8] to-[#7d8b76]",
  },
  {
    id: "resort-phu-quoc",
    name: "Resort Phú Quốc",
    type: "Nhiệt đới",
    progress: 90,
    gradient: "from-[#f0ddd1] to-[#b1592f]",
  },
  {
    id: "nha-pho-3-tang",
    name: "Nhà phố 3 tầng",
    type: "Hiện đại",
    progress: 30,
    gradient: "from-[#e4ded3] to-[#a9a096]",
  },
];

export interface RecentChat {
  id: string;
  title: string;
  time: string;
}

export const recentChats: RecentChat[] = [
  { id: "1", title: "Vật liệu chống nóng mặt tiền Tây", time: "5 phút trước" },
  { id: "2", title: "Concept Villa Đà Lạt — hướng 2", time: "1 giờ trước" },
  { id: "3", title: "Quy định khoảng lùi nhà phố", time: "Hôm qua" },
  { id: "4", title: "Bảng màu Resort Phú Quốc", time: "2 ngày trước" },
];

export interface NewsItem {
  id: string;
  title: string;
  time: string;
}

export const newsItems: NewsItem[] = [
  {
    id: "1",
    title: "Mới: Sinh Prompt Render cho D5 sắp ra mắt",
    time: "Giai đoạn 2",
  },
  {
    id: "2",
    title: "Cập nhật thuật ngữ QCVN 01:2021 trong Chat AI",
    time: "Tuần này",
  },
  {
    id: "3",
    title: "Mẹo: Dùng Sinh Concept để so sánh 3 hướng phong cách",
    time: "Hướng dẫn",
  },
];

export interface StudioTool {
  name: string;
  icon: "cube" | "layers" | "wand" | "image" | "pencil";
  iconSrc?: string;
  href?: string;
}

export const studioTools: StudioTool[] = [
  { name: "Portfolio", icon: "image", iconSrc: "/images/studio/logoport.png", href: "/portfolio" },
  { name: "Pháp lý AI", icon: "layers", href: "/studio/regulatory" },
  { name: "Kiến thức AI", icon: "cube", href: "/studio/knowledge" },
  { name: "Nhiệm vụ thiết kế", icon: "pencil", href: "/studio/briefing" },
  { name: "Sắp ra mắt", icon: "wand" },
];
