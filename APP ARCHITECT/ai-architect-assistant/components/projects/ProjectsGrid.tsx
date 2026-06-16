"use client";

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { PlusIcon } from "@/components/layout/icons";
import type { RecentProject } from "@/lib/dashboard-data";

export function ProjectsGrid({ limit, title, viewAllHref }: { limit?: number; title: string; viewAllHref?: string }) {
  const [projects, setProjects] = useState<RecentProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState("");
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [coverError, setCoverError] = useState<string | null>(null);
  const [uploadingCoverId, setUploadingCoverId] = useState<string | null>(null);
  const [projectsRoot, setProjectsRoot] = useState("");
  const coverInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    fetch("/api/projects")
      .then((res) => res.json())
      .then((data: RecentProject[]) => setProjects(data))
      .finally(() => setLoading(false));

    fetch("/api/settings/projects-root")
      .then((res) => res.json())
      .then((data: { projectsRoot: string }) => setProjectsRoot(data.projectsRoot));
  }, []);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;

    setCreating(true);
    setFormError(null);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, type }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Không thể tạo dự án");

      setProjects((prev) => [data, ...prev]);
      setName("");
      setType("");
      setShowForm(false);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Đã xảy ra lỗi");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!window.confirm(`Xóa dự án "${name}" khỏi danh sách? (thư mục trên ổ đĩa sẽ được giữ lại)`)) {
      return;
    }

    const res = await fetch(`/api/projects/${id}`, { method: "DELETE" });
    if (res.ok) {
      setProjects((prev) => prev.filter((project) => project.id !== id));
    }
  }

  function triggerCoverPicker(id: string) {
    setCoverError(null);
    coverInputRefs.current[id]?.click();
  }

  async function handleCoverFileChange(id: string, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setUploadingCoverId(id);
    setCoverError(null);
    try {
      const formData = new FormData();
      formData.append("id", id);
      formData.append("file", file);

      const res = await fetch("/api/projects/cover", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Không thể đặt ảnh bìa");

      setProjects((prev) => prev.map((project) => (project.id === id ? data : project)));
    } catch (error) {
      setCoverError(error instanceof Error ? error.message : "Đã xảy ra lỗi");
    } finally {
      setUploadingCoverId(null);
    }
  }

  const visibleProjects = typeof limit === "number" ? projects.slice(0, limit) : projects;

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg">{title}</h2>
        {viewAllHref && (
          <Link href={viewAllHref} className="text-sm font-medium text-accent">
            Xem tất cả
          </Link>
        )}
      </div>

      {showForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setShowForm(false); }}
        >
          <div className="w-full max-w-md rounded-2xl border border-border bg-background p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-display text-base font-semibold text-foreground">Tạo dự án mới</h3>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="flex h-7 w-7 items-center justify-center rounded-full text-foreground-soft hover:bg-surface-muted hover:text-foreground transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleCreate} className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-medium text-foreground-soft">Tên dự án</label>
                <input
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="VD: Nhà phố Quận 7"
                  className="mt-1.5 w-full rounded-card border border-border bg-surface-muted px-3 py-2.5 text-sm text-foreground placeholder:text-foreground-soft/50 focus:border-accent focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-foreground-soft">Phong cách / loại</label>
                <input
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  placeholder="VD: Hiện đại"
                  className="mt-1.5 w-full rounded-card border border-border bg-surface-muted px-3 py-2.5 text-sm text-foreground placeholder:text-foreground-soft/50 focus:border-accent focus:outline-none"
                />
              </div>
              <p className="text-xs text-foreground-soft">
                Thư mục sẽ được tạo tại {projectsRoot || "..."}\&lt;tên dự án&gt;
              </p>
              {formError && <p className="text-xs text-red-500">{formError}</p>}
              <div className="flex gap-2 justify-end mt-1">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="rounded-card px-4 py-2 text-sm font-medium text-foreground-soft hover:bg-surface-muted transition-colors"
                >
                  Huỷ
                </button>
                <Button type="submit" size="sm" disabled={creating}>
                  {creating ? "Đang tạo..." : "Tạo dự án"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {coverError && <p className="mt-2 text-xs text-red-500">{coverError}</p>}

      <div className="mt-3 grid grid-cols-4 gap-3">
        {loading && <p className="text-sm text-foreground-soft col-span-full">Đang tải...</p>}
        {!loading &&
          visibleProjects.map((project) => (
            <Card key={project.id} className="group relative aspect-[4/3] overflow-hidden">
              {/* Background image or gradient */}
              {project.coverImagePath ? (
                <div
                  className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-105"
                  style={{
                    backgroundImage: `url(/api/local-file?id=${project.id}&v=${project.coverUpdatedAt ?? 0})`,
                  }}
                />
              ) : (
                <div className={`absolute inset-0 bg-gradient-to-br ${project.gradient} transition-transform duration-500 group-hover:scale-105`} />
              )}

              {/* Hover dim */}
              <div className="absolute inset-0 bg-black/20 opacity-0 transition-opacity group-hover:opacity-100" />

              {/* Bottom text overlay */}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-3 pb-3 pt-10">
                <p className="inline-block text-sm font-semibold text-white leading-snug bg-white/10 backdrop-blur-md rounded px-1.5 py-0.5 border border-white/10">{project.name}</p>
                <span className="mt-1 inline-block text-[10px] font-medium text-white/70 bg-white/10 px-2 py-0.5 rounded-full border border-white/15">
                  {project.type}
                </span>
                <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/20">
                  <div className="h-full rounded-full bg-white/60" style={{ width: `${project.progress}%` }} />
                </div>
                <p className="mt-1 text-[10px] text-white/50">{project.progress}% hoàn thành</p>
              </div>

              {/* Full-card link (behind action buttons) */}
              <Link href={`/projects/${project.id}`} className="absolute inset-0 z-[1]" />

              {/* Action buttons on hover */}
              <div className="absolute right-2 top-2 z-[2] flex flex-col gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                <button
                  type="button"
                  onClick={() => triggerCoverPicker(project.id)}
                  disabled={uploadingCoverId === project.id}
                  className="rounded-lg bg-black/60 px-2.5 py-1 text-[10px] font-medium text-white backdrop-blur-sm hover:bg-black/80 disabled:opacity-60"
                >
                  {uploadingCoverId === project.id ? "Đang tải..." : "Ảnh bìa"}
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(project.id, project.name)}
                  className="rounded-lg bg-black/60 px-2.5 py-1 text-[10px] font-medium text-red-400 backdrop-blur-sm hover:bg-black/80"
                >
                  Xóa
                </button>
              </div>

              <input
                ref={(el) => { coverInputRefs.current[project.id] = el; }}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => handleCoverFileChange(project.id, event)}
              />
            </Card>
          ))}

        {!loading && (
          <Card className="aspect-[4/3] overflow-hidden">
            <button
              type="button"
              onClick={() => setShowForm((value) => !value)}
              className="flex h-full w-full flex-col items-center justify-center gap-2 text-foreground-soft transition-colors hover:text-accent"
            >
              <PlusIcon className="h-7 w-7" />
              <span className="text-sm font-medium">Dự án mới</span>
            </button>
          </Card>
        )}
      </div>
    </div>
  );
}
