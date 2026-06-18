"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

interface Suggestion {
  label: string;
  path: string;
}

export function ProjectsRootSettings() {
  const [storageRoot, setStorageRoot] = useState<string | null>(null);
  const [manualPath, setManualPath] = useState("");
  const [saving, setSaving] = useState(false);
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [pendingPath, setPendingPath] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/settings/storage-root")
      .then(async (res) => {
        if (!res.ok) throw new Error("Không thể tải thư mục lưu trữ");
        return res.json() as Promise<{ storageRoot: string }>;
      })
      .then((data) => {
        setStorageRoot(data.storageRoot);
        setManualPath(data.storageRoot);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Đã xảy ra lỗi");
      });

    fetch("/api/settings/browse")
      .then((res) => res.json())
      .then((data: { suggestions?: Suggestion[] }) => {
        if (data.suggestions) setSuggestions(data.suggestions);
      })
      .catch(() => {});
  }, []);

  function requestSave(newPath: string) {
    if (newPath === storageRoot) return;
    setPendingPath(newPath);
  }

  async function confirmSave(migrate: boolean) {
    if (!pendingPath) return;
    const targetPath = pendingPath;
    setPendingPath(null);
    setSaving(true);
    setError(null);
    try {
      const endpoint = migrate ? "/api/settings/migrate" : "/api/settings/storage-root";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storageRoot: targetPath }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Không thể lưu thư mục");
      setStorageRoot(data.storageRoot);
      setManualPath(data.storageRoot);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Đã xảy ra lỗi");
    } finally {
      setSaving(false);
    }
  }

  async function handlePickFolder() {
    if (typeof window !== "undefined" && window.electronAPI) {
      const selected = await window.electronAPI.selectFolder();
      if (selected) requestSave(selected);
      return;
    }

    setPicking(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/settings/browse?action=pick&initial=${encodeURIComponent(manualPath)}`
      );
      const data = await res.json();
      if (data.path) {
        setManualPath(data.path);
        requestSave(data.path);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể mở hộp thoại chọn thư mục");
    } finally {
      setPicking(false);
    }
  }

  return (
    <>
      <Card className="p-4">
        <h3 className="text-sm font-medium">Thư mục lưu trữ</h3>
        <p className="mt-1 text-xs text-foreground-soft">
          Các thư mục con như Thư viện, Dự án... sẽ được tạo và lưu trong thư mục này.
        </p>

        {suggestions.length > 0 && (
          <div className="mt-3">
            <p className="text-xs text-foreground-soft mb-1.5">Gợi ý nhanh</p>
            <div className="flex flex-wrap gap-1.5">
              {suggestions.map((s) => (
                <button
                  key={s.path}
                  type="button"
                  onClick={() => setManualPath(s.path)}
                  className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                    manualPath === s.path
                      ? "border-accent bg-accent/10 text-accent"
                      : "border-border text-foreground-soft hover:border-accent hover:text-foreground"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-stretch gap-2">
          <input
            value={manualPath}
            onChange={(e) => setManualPath(e.target.value)}
            className="min-w-[260px] flex-1 rounded-card border border-border bg-background px-3 py-2 text-sm"
            placeholder="VD: D:\AI Architect"
          />
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={picking || saving}
            onClick={handlePickFolder}
          >
            {picking ? "Đang mở..." : "Duyệt..."}
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={saving || picking || manualPath === storageRoot}
            onClick={() => requestSave(manualPath)}
          >
            {saving ? "Đang lưu..." : "Lưu"}
          </Button>
        </div>

        {storageRoot && (
          <p className="mt-2 text-xs text-foreground-soft">
            Hiện tại: <span className="font-mono text-foreground">{storageRoot}</span>
          </p>
        )}
        {storageRoot === null && !error && (
          <p className="mt-1 text-xs text-foreground-soft">Đang tải...</p>
        )}
        {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
      </Card>

      {pendingPath !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-background p-6 shadow-2xl">
            <h3 className="font-display text-base font-semibold text-foreground">
              Đổi thư mục lưu trữ
            </h3>
            <p className="mt-2 text-sm text-foreground-soft">
              Thư mục mới:{" "}
              <span className="font-mono text-xs text-foreground break-all">{pendingPath}</span>
            </p>
            <p className="mt-3 text-sm text-foreground">
              Bạn có muốn di chuyển toàn bộ dữ liệu dự án hiện có sang thư mục mới không?
            </p>
            <div className="mt-5 flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setPendingPath(null)}
                className="rounded-card px-4 py-2 text-sm font-medium text-foreground-soft hover:bg-surface-muted transition-colors"
              >
                Huỷ
              </button>
              <Button type="button" size="sm" variant="secondary" onClick={() => confirmSave(false)}>
                Không, chỉ đổi đường dẫn
              </Button>
              <Button type="button" size="sm" onClick={() => confirmSave(true)}>
                Có, di chuyển
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
