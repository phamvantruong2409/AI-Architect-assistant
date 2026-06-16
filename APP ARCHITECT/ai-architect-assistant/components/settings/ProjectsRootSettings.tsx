"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

export function ProjectsRootSettings() {
  const [storageRoot, setStorageRoot] = useState<string | null>(null);
  const [manualPath, setManualPath] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasElectronAPI, setHasElectronAPI] = useState(false);

  useEffect(() => {
    setHasElectronAPI(typeof window !== "undefined" && !!window.electronAPI);
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
  }, []);

  async function saveStorageRoot(path: string) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/settings/storage-root", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storageRoot: path }),
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
    if (!window.electronAPI) return;
    const selected = await window.electronAPI.selectFolder();
    if (selected) await saveStorageRoot(selected);
  }

  return (
    <Card className="p-4">
      <h3 className="text-sm font-medium">Thư mục lưu trữ</h3>
      <p className="mt-1 text-xs text-foreground-soft">
        Các thư mục con như Thư viện, Dự án... sẽ được tạo và lưu mặc định trong thư mục này. Đây
        chỉ là đường dẫn lưu trữ, không phải tải file lên ứng dụng.
      </p>

      <div className="mt-3 flex flex-wrap items-stretch gap-2">
        <input
          value={manualPath}
          onChange={(event) => setManualPath(event.target.value)}
          className="min-w-[260px] flex-1 rounded-card border border-border bg-background px-3 py-2 text-sm"
          placeholder="VD: D:\\AI Architect"
          readOnly={hasElectronAPI}
        />
        {hasElectronAPI ? (
          <Button type="button" size="sm" disabled={saving} onClick={handlePickFolder}>
            Mở
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            disabled={saving || manualPath === storageRoot}
            onClick={() => saveStorageRoot(manualPath)}
          >
            Lưu
          </Button>
        )}
      </div>
      {storageRoot === null && <p className="mt-1 text-xs text-foreground-soft">Đang tải...</p>}

      {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
    </Card>
  );
}
