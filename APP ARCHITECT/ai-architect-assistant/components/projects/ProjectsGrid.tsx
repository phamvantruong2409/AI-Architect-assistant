"use client";

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import confetti from "canvas-confetti";
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
  const [folderMode, setFolderMode] = useState<"new" | "existing">("new");
  const [linkedFolder, setLinkedFolder] = useState("");
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [coverError, setCoverError] = useState<string | null>(null);
  const [uploadingCoverId, setUploadingCoverId] = useState<string | null>(null);
  const [projectsRoot, setProjectsRoot] = useState("");
  const [editingField, setEditingField] = useState<{ id: string; field: "name" | "type" } | null>(null);
  const [editingProgress, setEditingProgress] = useState<string | null>(null); // project id
  const [editingValue, setEditingValue] = useState("");
  const coverInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const editInputRef = useRef<HTMLInputElement>(null);

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
    if (folderMode === "existing" && !linkedFolder.trim()) {
      setFormError("Vui lòng chọn thư mục dự án");
      return;
    }

    setCreating(true);
    setFormError(null);
    try {
      const body: Record<string, string> = { name, type };
      if (folderMode === "existing" && linkedFolder.trim()) {
        body.folderPath = linkedFolder.trim();
      }
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Không thể tạo dự án");

      setProjects((prev) => [data, ...prev]);
      setName("");
      setType("");
      setFolderMode("new");
      setLinkedFolder("");
      setShowForm(false);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Đã xảy ra lỗi");
    } finally {
      setCreating(false);
    }
  }

  async function handlePickFolder() {
    const folder = await window.electronAPI?.selectFolder();
    if (folder) setLinkedFolder(folder);
  }

  async function handleDelete(id: string, name: string) {
    if (!window.confirm(`Xóa dự án "${name}"?\n\nThao tác này sẽ xóa vĩnh viễn toàn bộ thư mục và file bên trong. Không thể hoàn tác.`)) {
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
      const contentType = res.headers.get("content-type") ?? "";
      const data = contentType.includes("application/json") ? await res.json() : null;
      if (!res.ok) throw new Error(data?.error ?? "Không thể đặt ảnh bìa");

      setProjects((prev) => prev.map((project) => (project.id === id ? data : project)));
    } catch (error) {
      setCoverError(error instanceof Error ? error.message : "Đã xảy ra lỗi");
    } finally {
      setUploadingCoverId(null);
    }
  }

  function startEdit(id: string, field: "name" | "type", currentValue: string, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setEditingField({ id, field });
    setEditingValue(currentValue);
    setTimeout(() => editInputRef.current?.select(), 0);
  }

  async function handleProgressChange(id: string, value: number) {
    const prev = projects.find((p) => p.id === id)?.progress ?? 0;
    setProjects((all) => all.map((p) => p.id === id ? { ...p, progress: value } : p));
    if (value === 100 && prev < 100) fireConfetti();
    await fetch(`/api/projects/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ progress: value }),
    });
  }

  function fireConfetti() {
    const count = 180;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 9999 };
    const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;
    confetti({ ...defaults, particleCount: count * 0.25, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
    confetti({ ...defaults, particleCount: count * 0.25, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
    setTimeout(() => {
      confetti({ ...defaults, particleCount: count * 0.25, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
      confetti({ ...defaults, particleCount: count * 0.25, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
    }, 200);
  }

  async function commitEdit() {
    if (!editingField) return;
    const { id, field } = editingField;
    const value = editingValue.trim();
    setEditingField(null);
    if (!value) return;

    const project = projects.find((p) => p.id === id);
    if (!project || project[field] === value) return;

    const res = await fetch(`/api/projects/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value }),
    });
    if (res.ok) {
      const updated = await res.json();
      setProjects((prev) => prev.map((p) => (p.id === id ? updated : p)));
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

              {/* Folder mode toggle */}
              <div>
                <label className="text-xs font-medium text-foreground-soft">Thư mục dự án</label>
                <div className="mt-1.5 flex rounded-card border border-border overflow-hidden text-xs font-medium">
                  <button
                    type="button"
                    onClick={() => setFolderMode("new")}
                    className={`flex-1 py-2 transition-colors ${folderMode === "new" ? "bg-accent text-white" : "bg-surface-muted text-foreground-soft hover:text-foreground"}`}
                  >
                    Tạo thư mục mới
                  </button>
                  <button
                    type="button"
                    onClick={() => setFolderMode("existing")}
                    className={`flex-1 py-2 transition-colors ${folderMode === "existing" ? "bg-accent text-white" : "bg-surface-muted text-foreground-soft hover:text-foreground"}`}
                  >
                    Liên kết thư mục có sẵn
                  </button>
                </div>

                {folderMode === "new" && (
                  <p className="mt-2 text-xs text-foreground-soft">
                    Thư mục sẽ được tạo tại {projectsRoot || "..."}\&lt;tên dự án&gt;
                  </p>
                )}

                {folderMode === "existing" && (
                  <div className="mt-2 flex gap-2 items-center">
                    <div className="flex-1 min-w-0 rounded-card border border-border bg-surface-muted px-3 py-2 text-xs text-foreground truncate">
                      {linkedFolder || <span className="text-foreground-soft/50">Chưa chọn thư mục...</span>}
                    </div>
                    <button
                      type="button"
                      onClick={handlePickFolder}
                      className="shrink-0 rounded-card border border-border bg-surface-muted px-3 py-2 text-xs font-medium text-foreground-soft hover:text-foreground hover:bg-surface transition-colors"
                    >
                      Chọn...
                    </button>
                  </div>
                )}
              </div>

              {formError && <p className="text-xs text-red-500">{formError}</p>}
              <div className="flex gap-2 justify-end mt-1">
                <button
                  type="button"
                  onClick={() => { setShowForm(false); setFolderMode("new"); setLinkedFolder(""); }}
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
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-3 pb-3 pt-10 z-[2]">
                {editingField?.id === project.id && editingField.field === "name" ? (
                  <input
                    ref={editInputRef}
                    value={editingValue}
                    onChange={(e) => setEditingValue(e.target.value)}
                    onBlur={commitEdit}
                    onKeyDown={(e) => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") setEditingField(null); }}
                    onClick={(e) => e.stopPropagation()}
                    className="w-full rounded-full bg-white/20 backdrop-blur-md border border-white/30 px-2.5 py-0.5 text-sm font-semibold text-white outline-none"
                  />
                ) : (
                  <p
                    onClick={(e) => startEdit(project.id, "name", project.name, e)}
                    className="inline-block text-sm font-semibold text-white leading-snug bg-white/10 backdrop-blur-md rounded-full px-2.5 py-0.5 border border-white/10 cursor-text hover:bg-white/20 transition-colors"
                  >
                    {project.name}
                  </p>
                )}
                {editingField?.id === project.id && editingField.field === "type" ? (
                  <input
                    ref={editInputRef}
                    value={editingValue}
                    onChange={(e) => setEditingValue(e.target.value)}
                    onBlur={commitEdit}
                    onKeyDown={(e) => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") setEditingField(null); }}
                    onClick={(e) => e.stopPropagation()}
                    className="mt-1 block w-full rounded-full bg-white/20 border border-white/30 px-2 py-0.5 text-[10px] font-medium text-white outline-none"
                  />
                ) : (
                  <span
                    onClick={(e) => startEdit(project.id, "type", project.type, e)}
                    className="mt-1 inline-block text-[10px] font-medium text-white/70 bg-white/10 px-2 py-0.5 rounded-full border border-white/15 cursor-text hover:bg-white/20 transition-colors"
                  >
                    {project.type}
                  </span>
                )}
                {editingProgress === project.id ? (
                  <div className="mt-2" onClick={(e) => e.preventDefault()}>
                    <input
                      type="range" min={0} max={100} step={5}
                      value={project.progress}
                      onChange={(e) => handleProgressChange(project.id, Number(e.target.value))}
                      onBlur={() => setEditingProgress(null)}
                      onKeyDown={(e) => e.key === "Escape" && setEditingProgress(null)}
                      autoFocus
                      className="w-full accent-teal-400 h-1 cursor-pointer"
                    />
                    <p className="mt-1 text-[10px] text-white font-medium">{project.progress}%</p>
                  </div>
                ) : (
                  <div
                    className="mt-2 cursor-pointer"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setEditingProgress(project.id); }}
                    title="Click để chỉnh tiến độ"
                  >
                    <div className="h-1 overflow-hidden rounded-full bg-white/20">
                      <div className="h-full rounded-full bg-white/60 transition-all duration-300" style={{ width: `${project.progress}%` }} />
                    </div>
                    <p className="mt-1 text-[10px] text-white/50 hover:text-white/80 transition-colors">{project.progress}% hoàn thành ✎</p>
                  </div>
                )}
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
