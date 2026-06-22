"use client";

import { useCallback, useEffect, useRef, useState, type ChangeEvent, type FormEvent, type KeyboardEvent } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import {
  ArchiveIcon,
  DocumentIcon,
  FolderIcon,
  ImageIcon,
  SpreadsheetIcon,
  VideoIcon,
  CubeIcon,
  PencilIcon,
  ExternalLinkIcon,
  TrashIcon,
  PlusIcon,
  BookIcon,
} from "@/components/layout/icons";
import type { LibraryEntry } from "@/lib/library-store";

const IMAGE_EXTS = new Set(["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg"]);
const SPREADSHEET_EXTS = new Set(["xls", "xlsx", "csv"]);
const ARCHIVE_EXTS = new Set(["zip", "rar", "7z"]);
const VIDEO_EXTS = new Set(["mp4", "mov", "avi", "mkv"]);
const MODEL_EXTS = new Set(["skp", "dwg", "dxf", "fbx", "obj", "3ds", "blend"]);

function EntryIcon({ entry }: { entry: LibraryEntry }) {
  if (entry.type === "folder") {
    return <FolderIcon className="h-7 w-7 text-accent" />;
  }
  const ext = entry.ext ?? "";
  if (SPREADSHEET_EXTS.has(ext)) return <SpreadsheetIcon className="h-7 w-7 text-foreground-soft" />;
  if (ARCHIVE_EXTS.has(ext)) return <ArchiveIcon className="h-7 w-7 text-foreground-soft" />;
  if (VIDEO_EXTS.has(ext)) return <VideoIcon className="h-7 w-7 text-foreground-soft" />;
  if (MODEL_EXTS.has(ext)) return <CubeIcon className="h-7 w-7 text-foreground-soft" />;
  if (IMAGE_EXTS.has(ext)) return <ImageIcon className="h-7 w-7 text-foreground-soft" />;
  return <DocumentIcon className="h-7 w-7 text-foreground-soft" />;
}

interface ContextMenuState {
  x: number;
  y: number;
  entry: LibraryEntry;
}

interface DroppedFile {
  file: File;
  relativePath: string;
}

function readDirectoryEntries(reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> {
  return new Promise((resolve) => {
    const all: FileSystemEntry[] = [];
    function readBatch() {
      reader.readEntries((batch) => {
        if (batch.length === 0) {
          resolve(all);
        } else {
          all.push(...batch);
          readBatch();
        }
      });
    }
    readBatch();
  });
}

async function traverseEntry(entry: FileSystemEntry, basePath: string): Promise<DroppedFile[]> {
  if (entry.isFile) {
    return new Promise((resolve) => {
      (entry as FileSystemFileEntry).file((file) => resolve([{ file, relativePath: basePath + entry.name }]));
    });
  }
  if (entry.isDirectory) {
    const children = await readDirectoryEntries((entry as FileSystemDirectoryEntry).createReader());
    const nested = await Promise.all(children.map((child) => traverseEntry(child, `${basePath}${entry.name}/`)));
    return nested.flat();
  }
  return [];
}

export function LibraryBrowser() {
  const [currentPath, setCurrentPath] = useState("");
  const [entries, setEntries] = useState<LibraryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [folderPath, setFolderPath] = useState<string | null>(null);
  const [coverImagePath, setCoverImagePath] = useState<string | null>(null);
  const [coverUpdatedAt, setCoverUpdatedAt] = useState<number | undefined>(undefined);
  const [coverError, setCoverError] = useState<string | null>(null);
  const [uploadingCover, setUploadingCover] = useState(false);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const renameInputRef = useRef<HTMLInputElement>(null);

  const [newFolderName, setNewFolderName] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);

  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const dragCounter = useRef(0);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const lastSelectedIndex = useRef<number | null>(null);
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [marquee, setMarquee] = useState<{ startX: number; startY: number; x: number; y: number } | null>(null);
  const marqueeMoved = useRef(false);

  useEffect(() => {
    fetch("/api/library")
      .then((res) => res.json())
      .then((data) => {
        setFolderPath(typeof data?.folderPath === "string" ? data.folderPath : null);
        setCoverImagePath(typeof data?.coverImagePath === "string" ? data.coverImagePath : null);
        setCoverUpdatedAt(typeof data?.coverUpdatedAt === "number" ? data.coverUpdatedAt : undefined);
      })
      .catch(() => {});
  }, []);

  const loadEntries = useCallback((relPath: string) => {
    setLoading(true);
    setError(null);
    fetch(`/api/library/entries?path=${encodeURIComponent(relPath)}`)
      .then((res) => res.json())
      .then((data: LibraryEntry[]) => setEntries(data))
      .catch(() => setError("Không thể tải nội dung thư mục"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadEntries(currentPath);
    setSelected(new Set());
    lastSelectedIndex.current = null;
  }, [currentPath, loadEntries]);

  useEffect(() => {
    if (!contextMenu) return;
    function handleClick() {
      setContextMenu(null);
    }
    window.addEventListener("click", handleClick);
    window.addEventListener("scroll", handleClick, true);
    return () => {
      window.removeEventListener("click", handleClick);
      window.removeEventListener("scroll", handleClick, true);
    };
  }, [contextMenu]);

  useEffect(() => {
    if (renamingPath) {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    }
  }, [renamingPath]);

  useEffect(() => {
    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key !== "Delete") return;
      if (selected.size === 0) return;
      const target = event.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
      handleDeleteEntries(Array.from(selected));
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, currentPath]);

  async function handleOpenFolder() {
    await fetch("/api/library/open", { method: "POST" });
  }

  function triggerCoverPicker() {
    setCoverError(null);
    coverInputRef.current?.click();
  }

  async function handleCoverFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setUploadingCover(true);
    setCoverError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/library/cover", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Không thể đặt ảnh minh hoạ");

      setCoverImagePath(data.coverImagePath ?? null);
      setCoverUpdatedAt(data.coverUpdatedAt);
    } catch (err) {
      setCoverError(err instanceof Error ? err.message : "Đã xảy ra lỗi");
    } finally {
      setUploadingCover(false);
    }
  }

  async function handleOpenEntry(entry: LibraryEntry) {
    if (entry.type === "folder") {
      setCurrentPath(entry.path);
      return;
    }
    await fetch("/api/library/entries/open", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: entry.path }),
    });
  }

  function handleContextMenu(event: React.MouseEvent, entry: LibraryEntry, index: number) {
    event.preventDefault();
    if (!selected.has(entry.path)) {
      setSelected(new Set([entry.path]));
      lastSelectedIndex.current = index;
    }
    setContextMenu({ x: event.clientX, y: event.clientY, entry });
  }

  function toggleSelect(path: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }

  function selectRange(index: number) {
    const start = lastSelectedIndex.current ?? index;
    const [from, to] = start <= index ? [start, index] : [index, start];
    setSelected((prev) => {
      const next = new Set(prev);
      for (let i = from; i <= to; i++) {
        next.add(entries[i].path);
      }
      return next;
    });
  }

  function handleEntryClick(event: React.MouseEvent, entry: LibraryEntry, index: number) {
    if (event.ctrlKey || event.metaKey) {
      toggleSelect(entry.path);
      lastSelectedIndex.current = index;
      return;
    }
    if (event.shiftKey) {
      selectRange(index);
      lastSelectedIndex.current = index;
      return;
    }
    if (selected.size > 0) {
      setSelected(new Set());
    }
    handleOpenEntry(entry);
  }

  async function handleDeleteEntries(paths: string[]) {
    if (paths.length === 0) return;
    const label = paths.length === 1 ? (paths[0].split("/").pop() ?? paths[0]) : `${paths.length} mục đã chọn`;
    if (!window.confirm(`Xoá "${label}"? Hành động này không thể hoàn tác.`)) return;

    const res = await fetch("/api/library/entries/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paths }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Không thể xoá");
    }
    setSelected(new Set());
    loadEntries(currentPath);
  }

  function handleGridMouseDown(event: React.MouseEvent) {
    if (event.button !== 0) return;
    if ((event.target as HTMLElement).closest("[data-entry-card]")) return;

    marqueeMoved.current = false;
    const startX = event.clientX;
    const startY = event.clientY;
    setMarquee({ startX, startY, x: startX, y: startY });

    function handleMouseMove(moveEvent: MouseEvent) {
      marqueeMoved.current = true;
      setMarquee((prev) => (prev ? { ...prev, x: moveEvent.clientX, y: moveEvent.clientY } : prev));
    }

    function handleMouseUp(upEvent: MouseEvent) {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);

      if (marqueeMoved.current) {
        const rect = {
          left: Math.min(startX, upEvent.clientX),
          right: Math.max(startX, upEvent.clientX),
          top: Math.min(startY, upEvent.clientY),
          bottom: Math.max(startY, upEvent.clientY),
        };
        const next = new Set<string>();
        for (const entry of entries) {
          const el = cardRefs.current[entry.path];
          if (!el) continue;
          const box = el.getBoundingClientRect();
          const intersects =
            box.left < rect.right && box.right > rect.left && box.top < rect.bottom && box.bottom > rect.top;
          if (intersects) next.add(entry.path);
        }
        setSelected(next);
      } else {
        setSelected(new Set());
      }
      setMarquee(null);
    }

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  }

  function startRename(entry: LibraryEntry) {
    setRenamingPath(entry.path);
    setRenameValue(entry.name);
    setContextMenu(null);
  }

  async function submitRename(entry: LibraryEntry) {
    const name = renameValue.trim();
    if (!name || name === entry.name) {
      setRenamingPath(null);
      return;
    }

    const res = await fetch("/api/library/entries/rename", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: entry.path, name }),
    });
    const data = await res.json();
    setRenamingPath(null);
    if (!res.ok) {
      setError(data.error ?? "Không thể đổi tên");
      return;
    }
    loadEntries(currentPath);
  }

  function handleRenameKeyDown(event: KeyboardEvent<HTMLInputElement>, entry: LibraryEntry) {
    if (event.key === "Enter") {
      event.preventDefault();
      submitRename(entry);
    } else if (event.key === "Escape") {
      event.preventDefault();
      setRenamingPath(null);
    }
  }

  async function handleCreateFolder(event: FormEvent) {
    event.preventDefault();
    if (!newFolderName.trim()) return;

    setCreatingFolder(true);
    setCreateError(null);
    try {
      const res = await fetch("/api/library/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: currentPath, name: newFolderName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Không thể tạo thư mục");

      setEntries((prev) =>
        [...prev, data].sort((a, b) => {
          if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
          return a.name.localeCompare(b.name, "vi");
        })
      );
      setNewFolderName("");
      setShowCreateForm(false);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Đã xảy ra lỗi");
    } finally {
      setCreatingFolder(false);
    }
  }

  async function uploadFiles(files: DroppedFile[]) {
    if (files.length === 0) return;

    setUploading(true);
    setUploadError(null);
    try {
      const formData = new FormData();
      formData.append("path", currentPath);
      formData.append("count", String(files.length));
      files.forEach(({ file, relativePath }, index) => {
        formData.append(`file_${index}`, file);
        formData.append(`path_${index}`, relativePath);
      });

      const res = await fetch("/api/library/entries/upload", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error("Không thể tải file lên");
      loadEntries(currentPath);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Đã xảy ra lỗi");
    } finally {
      setUploading(false);
    }
  }

  function handleDragEnter(event: React.DragEvent) {
    event.preventDefault();
    if (!event.dataTransfer.types.includes("Files")) return;
    dragCounter.current += 1;
    setIsDragging(true);
  }

  function handleDragOver(event: React.DragEvent) {
    event.preventDefault();
  }

  function handleDragLeave(event: React.DragEvent) {
    event.preventDefault();
    dragCounter.current -= 1;
    if (dragCounter.current <= 0) {
      dragCounter.current = 0;
      setIsDragging(false);
    }
  }

  async function handleDrop(event: React.DragEvent) {
    event.preventDefault();
    dragCounter.current = 0;
    setIsDragging(false);

    const items = event.dataTransfer.items;
    const droppedEntries: FileSystemEntry[] = [];
    for (let i = 0; i < items.length; i++) {
      const entry = items[i].webkitGetAsEntry?.();
      if (entry) droppedEntries.push(entry);
    }

    if (droppedEntries.length > 0) {
      const results = await Promise.all(droppedEntries.map((entry) => traverseEntry(entry, "")));
      await uploadFiles(results.flat());
      return;
    }

    const files = Array.from(event.dataTransfer.files).map((file) => ({ file, relativePath: file.name }));
    await uploadFiles(files);
  }

  const breadcrumbSegments = currentPath ? currentPath.split("/") : [];
  const isRoot = currentPath === "";

  return (
    <div
      className="relative"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isDragging && (
        <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center rounded-card border-2 border-dashed border-accent bg-accent/10">
          <p className="text-sm font-medium text-accent">Thả file hoặc thư mục vào đây để tải lên</p>
        </div>
      )}

      {isRoot && (
        <div className="group relative mb-6 overflow-hidden rounded-card border border-border">
          {coverImagePath ? (
            <div
              className="h-44 w-full bg-cover bg-center sm:h-56"
              style={{ backgroundImage: `url(/api/local-file?source=library&v=${coverUpdatedAt ?? 0})` }}
            />
          ) : (
            <div className="flex h-44 w-full items-center justify-center bg-gradient-to-br from-[#cdd6c8] to-[#5b7f99] sm:h-56">
              <BookIcon className="h-12 w-12 text-white/70" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-5">
            <div>
              <h2 className="font-display text-2xl text-white">Thư viện</h2>
              <p className="mt-1 text-sm text-white/80">
                Tài liệu, mẫu vật liệu, quy chuẩn và tài nguyên hỗ trợ kiến trúc
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <input
                ref={coverInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleCoverFileChange}
              />
              <button
                type="button"
                onClick={triggerCoverPicker}
                disabled={uploadingCover}
                className="rounded-card border border-white/30 bg-black/30 px-3 py-1.5 text-xs font-medium text-white backdrop-blur transition-colors hover:bg-black/50"
              >
                {uploadingCover ? "Đang tải..." : "Đổi ảnh minh hoạ"}
              </button>
              <button
                type="button"
                onClick={handleOpenFolder}
                className="rounded-card border border-white/30 bg-black/30 px-3 py-1.5 text-xs font-medium text-white backdrop-blur transition-colors hover:bg-black/50"
              >
                Mở trong File Explorer
              </button>
            </div>
          </div>
        </div>
      )}

      {coverError && <p className="mb-2 text-xs text-red-500">{coverError}</p>}
      {uploading && <p className="mb-2 text-xs text-foreground-soft">Đang tải lên...</p>}
      {uploadError && <p className="mb-2 text-xs text-red-500">{uploadError}</p>}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1 text-sm">
          <button
            type="button"
            onClick={() => setCurrentPath("")}
            className={isRoot ? "font-medium text-foreground" : "font-medium text-accent hover:underline"}
          >
            {folderPath ?? "Thư viện"}
          </button>
          {breadcrumbSegments.map((segment, index) => {
            const segPath = breadcrumbSegments.slice(0, index + 1).join("/");
            const isLast = index === breadcrumbSegments.length - 1;
            return (
              <span key={segPath} className="flex items-center gap-1">
                <span className="text-foreground-soft">\</span>
                <button
                  type="button"
                  onClick={() => setCurrentPath(segPath)}
                  className={isLast ? "font-medium text-foreground" : "font-medium text-accent hover:underline"}
                >
                  {segment}
                </button>
              </span>
            );
          })}
        </div>

        <Button size="sm" variant="secondary" onClick={() => setShowCreateForm((v) => !v)}>
          <PlusIcon className="h-4 w-4" />
          Thư mục mới
        </Button>
      </div>

      {showCreateForm && (
        <Card className="mt-3 p-4">
          <form onSubmit={handleCreateFolder} className="flex flex-wrap items-end gap-3">
            <div className="min-w-[200px] flex-1">
              <label className="text-xs text-foreground-soft">Tên thư mục mới</label>
              <input
                value={newFolderName}
                onChange={(event) => setNewFolderName(event.target.value)}
                placeholder="VD: 01_Quy chuẩn xây dựng"
                className="mt-1 w-full rounded-card border border-border bg-background px-3 py-2 text-sm"
                autoFocus
              />
            </div>
            <Button type="submit" size="sm" disabled={creatingFolder}>
              {creatingFolder ? "Đang tạo..." : "Tạo thư mục"}
            </Button>
          </form>
          {createError && <p className="mt-2 text-xs text-red-500">{createError}</p>}
        </Card>
      )}

      {selected.size > 0 && (
        <div className="mt-3 flex items-center justify-between rounded-card border border-accent/40 bg-accent/10 px-3 py-2 text-sm">
          <span>Đã chọn {selected.size} mục</span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="text-foreground-soft hover:text-foreground"
            >
              Bỏ chọn
            </button>
            <button
              type="button"
              onClick={() => handleDeleteEntries(Array.from(selected))}
              className="flex items-center gap-1 font-medium text-red-500 hover:text-red-400"
            >
              <TrashIcon className="h-4 w-4" />
              Xoá
            </button>
          </div>
        </div>
      )}

      {error && <p className="mt-2 text-xs text-red-500">{error}</p>}

      <div
        className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6"
        onMouseDown={handleGridMouseDown}
      >
        {loading && <p className="text-sm text-foreground-soft">Đang tải...</p>}
        {!loading && entries.length === 0 && (
          <p className="text-sm text-foreground-soft">Thư mục này đang trống. Kéo & thả file vào đây để tải lên.</p>
        )}
        {entries.map((entry, index) => {
          const isImage = entry.type === "file" && entry.ext && IMAGE_EXTS.has(entry.ext);
          const isRenaming = renamingPath === entry.path;
          const isSelected = selected.has(entry.path);

          return (
            <div
              key={entry.path}
              ref={(el) => {
                cardRefs.current[entry.path] = el;
              }}
              data-entry-card
              className={cn(
                "group relative flex flex-col items-center gap-2 rounded-card border border-border bg-surface p-3 text-center transition-colors hover:border-accent/50",
                isSelected && "border-accent bg-accent/10"
              )}
              onContextMenu={(event) => handleContextMenu(event, entry, index)}
            >
              <button
                type="button"
                onClick={(event) => handleEntryClick(event, entry, index)}
                className="flex w-full flex-col items-center gap-2"
                title={entry.name}
              >
                {isImage ? (
                  <div
                    className="h-16 w-16 rounded-card bg-cover bg-center bg-surface-muted"
                    style={{
                      backgroundImage: `url(/api/local-file?source=library&path=${encodeURIComponent(entry.path)})`,
                    }}
                  />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-card bg-surface-muted">
                    <EntryIcon entry={entry} />
                  </div>
                )}

                {isRenaming ? (
                  <input
                    ref={renameInputRef}
                    value={renameValue}
                    onChange={(event) => setRenameValue(event.target.value)}
                    onKeyDown={(event) => handleRenameKeyDown(event, entry)}
                    onBlur={() => submitRename(entry)}
                    onClick={(event) => event.stopPropagation()}
                    className="w-full rounded border border-accent bg-background px-1 py-0.5 text-center text-xs"
                  />
                ) : (
                  <span className="line-clamp-2 w-full break-all text-xs font-medium">{entry.name}</span>
                )}
              </button>

              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  startRename(entry);
                }}
                className="absolute right-1.5 top-1.5 rounded-full bg-surface p-1 text-foreground-soft opacity-0 transition-opacity hover:text-accent group-hover:opacity-100"
                aria-label={`Đổi tên ${entry.name}`}
              >
                <PencilIcon className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>

      {marquee && (
        <div
          className="pointer-events-none fixed z-50 border border-accent bg-accent/10"
          style={{
            left: Math.min(marquee.startX, marquee.x),
            top: Math.min(marquee.startY, marquee.y),
            width: Math.abs(marquee.x - marquee.startX),
            height: Math.abs(marquee.y - marquee.startY),
          }}
        />
      )}

      {contextMenu && (
        <div
          className="fixed z-50 min-w-[140px] rounded-card border border-border bg-surface py-1 shadow-lg"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => {
              handleOpenEntry(contextMenu.entry);
              setContextMenu(null);
            }}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-surface-muted"
          >
            <ExternalLinkIcon className="h-4 w-4" />
            {contextMenu.entry.type === "folder" ? "Mở thư mục" : "Mở file"}
          </button>
          <button
            type="button"
            onClick={() => startRename(contextMenu.entry)}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-surface-muted"
          >
            <PencilIcon className="h-4 w-4" />
            Đổi tên
          </button>
          <button
            type="button"
            onClick={() => {
              const paths =
                selected.has(contextMenu.entry.path) && selected.size > 1
                  ? Array.from(selected)
                  : [contextMenu.entry.path];
              setContextMenu(null);
              handleDeleteEntries(paths);
            }}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-red-500 hover:bg-surface-muted"
          >
            <TrashIcon className="h-4 w-4" />
            Xoá{selected.has(contextMenu.entry.path) && selected.size > 1 ? ` (${selected.size})` : ""}
          </button>
        </div>
      )}
    </div>
  );
}
