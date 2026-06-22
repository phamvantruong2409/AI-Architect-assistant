import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import {
  BookIcon,
  DocumentIcon,
  ArchiveIcon,
  SpreadsheetIcon,
} from "@/components/layout/icons";

const categories = [
  {
    title: "Pháp luật",
    description:
      "Hỏi đáp về luật, nghị định, quy chuẩn (QCVN) liên quan đến xây dựng — đối chiếu thuvienphapluat.vn.",
    icon: BookIcon,
    href: "/docs/phap-luat",
    status: "live" as const,
  },
  {
    title: "Thuyết minh thiết kế",
    description: "Sinh thuyết minh dự án tự động từ concept đã chọn.",
    icon: DocumentIcon,
    href: "#",
    status: "soon" as const,
  },
  {
    title: "Bảng diện tích",
    description: "Tổng hợp diện tích sàn, công năng theo từng tầng.",
    icon: SpreadsheetIcon,
    href: "#",
    status: "soon" as const,
  },
  {
    title: "Giải trình kỹ thuật",
    description: "Hồ sơ giải trình kết cấu, PCCC, hạ tầng kỹ thuật.",
    icon: ArchiveIcon,
    href: "#",
    status: "soon" as const,
  },
];

export default function DocsPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <h1 className="font-display text-2xl">Tài liệu</h1>
      <p className="mt-2 text-sm text-foreground-soft">
        Trợ lý hồ sơ và tra cứu — hỗ trợ kiến trúc sư hoàn thiện phần văn bản
        của dự án.
      </p>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {categories.map((c) => {
          const content = (
            <Card
              className={
                "group relative flex h-full flex-col gap-3 p-5 transition-all duration-200" +
                (c.status === "live"
                  ? " hover:border-accent/40 hover:bg-surface-muted hover:-translate-y-0.5 hover:shadow-md"
                  : " opacity-70")
              }
            >
              <div className="flex items-start justify-between">
                <span className="flex h-10 w-10 items-center justify-center rounded-card bg-accent-soft text-accent">
                  <c.icon className="h-5 w-5" />
                </span>
                {c.status === "soon" && <Badge>Sắp có</Badge>}
              </div>
              <div>
                <h2 className="font-display text-lg">{c.title}</h2>
                <p className="mt-1 text-sm text-foreground-soft">
                  {c.description}
                </p>
              </div>
            </Card>
          );

          return c.status === "live" ? (
            <Link key={c.title} href={c.href}>
              {content}
            </Link>
          ) : (
            <div key={c.title}>{content}</div>
          );
        })}
      </div>
    </div>
  );
}
