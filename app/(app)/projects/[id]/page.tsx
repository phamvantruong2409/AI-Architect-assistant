"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EntryGrid } from "@/components/projects/EntryGrid";
import type { RecentProject } from "@/lib/dashboard-data";

export default function ProjectDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [project, setProject] = useState<RecentProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    fetch(`/api/projects/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error("not-found");
        return res.json();
      })
      .then((projectData) => setProject(projectData))
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleOpenFolder() {
    await fetch("/api/projects/open", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <p className="text-sm text-foreground-soft">Đang tải...</p>
      </div>
    );
  }

  if (notFound || !project) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <p className="text-sm text-foreground-soft">Không tìm thấy dự án.</p>
        <Link href="/dashboard" className="mt-2 inline-block text-sm font-medium text-accent">
          Về Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <Link href="/dashboard" className="text-sm font-medium text-accent">
        ← Dashboard
      </Link>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl">{project.name}</h1>
          <Badge className="mt-2">{project.type}</Badge>
          {project.folderPath && (
            <p className="mt-2 text-xs text-foreground-soft">{project.folderPath}</p>
          )}
        </div>
        <Button variant="secondary" size="sm" onClick={handleOpenFolder}>
          Mở trong File Explorer
        </Button>
      </div>

      <div className="mt-6">
        <h2 className="font-display text-lg">Nội dung thư mục</h2>
        <p className="mt-1 text-xs text-foreground-soft">
          Nhấp để mở, chuột phải hoặc bấm icon bút để đổi tên.
        </p>

        <div className="mt-3">
          <EntryGrid projectId={id} />
        </div>
      </div>
    </div>
  );
}
