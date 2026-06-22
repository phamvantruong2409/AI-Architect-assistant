import type { ComponentType, SVGProps } from "react";
import { HomeIcon, ChatIcon, FolderIcon, DocumentIcon, CubeIcon, BookIcon } from "./icons";

export interface NavItem {
  label: string;
  href: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
}

export const navItems: NavItem[] = [
  { label: "Trang chủ", href: "/dashboard", icon: HomeIcon },
  { label: "AI Chat", href: "/chat", icon: ChatIcon },
  { label: "Dự án", href: "/projects", icon: FolderIcon },
  { label: "Thư viện", href: "/library", icon: BookIcon },
  { label: "Tài liệu", href: "/docs", icon: DocumentIcon },
];
