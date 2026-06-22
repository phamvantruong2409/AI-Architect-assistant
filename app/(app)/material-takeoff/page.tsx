"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { startTask, dismissTask } from "@/lib/tasks";
import { useTask } from "@/hooks/useTasks";
import {
  MAX_IMAGE_BYTES,
  buildBuyLink,
  type BBox,
  type TakeoffItem,
  type TakeoffResult,
} from "@/lib/material-takeoff-types";
import {
  loadSwatches,
  nearestSwatches,
  type SwatchItem,
} from "@/lib/swatch-library";

type Group = "material" | "furniture";

interface Row extends TakeoffItem {
  id: string;
  group: Group;
}

/** Kết quả xử lý ảnh của 1 mục: thumb hiển thị + crop gốc + màu + swatch khớp. */
interface ItemView {
  thumb: string; // ảnh hiển thị (swatch An Cường nếu khớp, không thì crop)
  crop: string; // crop từ ảnh render (giữ lại để xuất Excel khi không khớp)
  hex: string; // màu chủ đạo vùng vật liệu
  match: SwatchItem | null; // swatch An Cường khớp (chỉ gỗ CN)
  candidates: SwatchItem[]; // vài swatch gần nhất để đổi
}

/** Một ảnh đã bóc tách, lưu lại để gộp dự toán nhiều góc. */
interface Scene {
  id: string;
  label: string; // A, B, C... để ghi cột "Có ở ảnh"
  preview: string; // ảnh gốc (thumbnail trong danh sách)
  result: TakeoffResult;
  views: Record<string, ItemView>;
}

/** Một dòng sau khi gộp trùng giữa các ảnh. */
interface MergedRow {
  item: TakeoffItem;
  view?: ItemView; // ảnh minh hoạ (lấy từ mục đầu có ảnh trong cụm)
  scenes: string[]; // các nhãn ảnh chứa mục này
}

const THUMB_PX = 256;

/** Nhãn ảnh: A, B, C... rồi rớt về "Ảnh N" khi vượt 26. */
function sceneLabel(i: number): string {
  return i < 26 ? String.fromCharCode(65 + i) : `Ảnh ${i + 1}`;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("load fail"));
    img.src = src;
  });
}

/** Crop vuông giữa vùng box (chuẩn hoá 0–1000) từ ảnh gốc + lấy màu trung bình. */
function squareCrop(img: HTMLImageElement, box: BBox): { thumb: string; hex: string } {
  const W = img.naturalWidth || img.width;
  const H = img.naturalHeight || img.height;
  const [ymin, xmin, ymax, xmax] = box;
  const rx = (xmin / 1000) * W;
  const ry = (ymin / 1000) * H;
  const rw = ((xmax - xmin) / 1000) * W;
  const rh = ((ymax - ymin) / 1000) * H;
  const side = Math.max(1, Math.min(rw, rh));
  const cx = rx + (rw - side) / 2;
  const cy = ry + (rh - side) / 2;

  const canvas = document.createElement("canvas");
  canvas.width = THUMB_PX;
  canvas.height = THUMB_PX;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, cx, cy, side, side, 0, 0, THUMB_PX, THUMB_PX);

  const one = document.createElement("canvas");
  one.width = 1;
  one.height = 1;
  const octx = one.getContext("2d")!;
  octx.drawImage(img, cx, cy, side, side, 0, 0, 1, 1);
  const [r, g, b] = octx.getImageData(0, 0, 1, 1).data;
  const hex = "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");

  return { thumb: canvas.toDataURL("image/jpeg", 0.82), hex };
}

/** Tải 1 swatch (URL public) về dataURL vuông để hiển thị + nhúng Excel. */
async function swatchToDataUrl(url: string): Promise<string> {
  const img = await loadImage(url);
  const canvas = document.createElement("canvas");
  canvas.width = THUMB_PX;
  canvas.height = THUMB_PX;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0, THUMB_PX, THUMB_PX);
  return canvas.toDataURL("image/jpeg", 0.82);
}

/** Tách base64 + đuôi ảnh từ một dataURL để nhúng vào workbook ExcelJS. */
function dataUrlParts(d: string): { base64: string; extension: "jpeg" | "png" | "gif" } | null {
  const m = /^data:image\/(jpeg|jpg|png|gif);base64,(.+)$/i.exec(d);
  if (!m) return null;
  const ext = m[1].toLowerCase();
  return { base64: m[2], extension: ext === "jpg" ? "jpeg" : (ext as "jpeg" | "png" | "gif") };
}

function slugify(name: string): string {
  return (
    name
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/đ/g, "d")
      .replace(/Đ/g, "D")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase() || "du-toan"
  );
}

export default function MaterialTakeoffPage() {
  const [preview, setPreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string>("image/jpeg");
  const [result, setResult] = useState<TakeoffResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [views, setViews] = useState<Record<string, ItemView>>({});
  const [library, setLibrary] = useState<SwatchItem[]>([]);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [exporting, setExporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Bóc tách chạy như TÁC VỤ NỀN → rời sang trang khác vẫn xong, quay lại đọc
  // tiến trình/kết quả live (kèm ảnh gốc để dựng lại thumbnail).
  const analyzeTask = useTask("takeoff:analyze");
  const loading = analyzeTask?.status === "running";
  const pct = Math.round(analyzeTask?.progress ?? 0);

  // Nạp thư viện swatch An Cường một lần (client, 0 API).
  useEffect(() => {
    loadSwatches().then(setLibrary).catch(() => {});
  }, []);

  // Tiêu thụ kết quả tác vụ nền: nạp result + dựng lại ảnh gốc (preview) để
  // crop thumbnail, kể cả khi quay lại trang sau khi rời đi giữa chừng.
  useEffect(() => {
    if (analyzeTask?.status === "done") {
      const r = analyzeTask.result as { result: TakeoffResult; preview: string | null; mimeType: string };
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResult(r.result);
      if (r.preview) {
        setPreview(r.preview);
        setImageBase64(r.preview.split(",")[1] ?? null);
      }
      if (r.mimeType) setMimeType(r.mimeType);
      setViews({});
      setError(null);
      dismissTask("takeoff:analyze");
    } else if (analyzeTask?.status === "error") {
      setError(analyzeTask.error ?? "Bóc tách thất bại");
      dismissTask("takeoff:analyze");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analyzeTask?.status]);

  const rows = useMemo<Row[]>(() => {
    if (!result) return [];
    return [
      ...result.materials.map((it, i) => ({ ...it, id: `m-${i}`, group: "material" as const })),
      ...result.furniture.map((it, i) => ({ ...it, id: `f-${i}`, group: "furniture" as const })),
    ];
  }, [result]);

  // Sau khi có danh sách: crop ảnh từ render cho từng mục; gỗ CN thì khớp swatch
  // An Cường gần nhất theo màu. Tất cả chạy ở client, KHÔNG gọi API tạo ảnh.
  useEffect(() => {
    if (rows.length === 0 || !preview) return;
    let cancelled = false;
    (async () => {
      let base: HTMLImageElement;
      try {
        base = await loadImage(preview);
      } catch {
        return;
      }
      for (const row of rows) {
        if (cancelled) return;
        const box: BBox = row.box ?? [0, 0, 1000, 1000];
        let view: ItemView;
        try {
          const { thumb: crop, hex } = squareCrop(base, box);
          if (row.group === "material" && row.isIndustrialWood && library.length > 0) {
            const candidates = nearestSwatches(library, hex, 6);
            const best = candidates[0] ?? null;
            let thumb = crop;
            if (best) {
              try {
                thumb = await swatchToDataUrl(best.url);
              } catch {
                /* giữ crop nếu lỗi tải swatch */
              }
            }
            view = { thumb, crop, hex, match: best, candidates };
          } else {
            view = { thumb: crop, crop, hex, match: null, candidates: [] };
          }
        } catch {
          continue;
        }
        if (cancelled) return;
        setViews((v) => ({ ...v, [row.id]: view }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [rows, library, preview]);

  async function changeMatch(rowId: string, swatch: SwatchItem) {
    let thumb = swatch.url;
    try {
      thumb = await swatchToDataUrl(swatch.url);
    } catch {
      /* dùng url trực tiếp nếu lỗi */
    }
    setViews((v) => (v[rowId] ? { ...v, [rowId]: { ...v[rowId], match: swatch, thumb } } : v));
  }

  /** Lưu ảnh đang xem vào danh sách gộp rồi dọn sạch để bóc tách ảnh góc khác. */
  function addAngle() {
    if (!result || !preview) return;
    setScenes((s) => [
      ...s,
      { id: `s${Date.now()}`, label: sceneLabel(s.length), preview, result, views },
    ]);
    setResult(null);
    setViews({});
    setPreview(null);
    setImageBase64(null);
    setError(null);
  }

  function removeScene(id: string) {
    setScenes((s) => s.filter((x) => x.id !== id));
  }

  function handleFile(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Vui lòng chọn một tệp ảnh");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setError("Ảnh quá lớn (tối đa 8MB). Vui lòng nén lại.");
      return;
    }
    setError(null);
    setResult(null);
    setViews({});
    setMimeType(file.type);
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setPreview(dataUrl);
      setImageBase64(dataUrl.split(",")[1] ?? null);
    };
    reader.readAsDataURL(file);
  }

  function handleAnalyze() {
    if (!imageBase64) {
      setError("Vui lòng tải lên ảnh cần bóc tách vật liệu");
      return;
    }
    setError(null);
    setResult(null);
    setViews({});

    const payload = { imageBase64, mimeType };
    const curPreview = preview;
    const curMime = mimeType;
    startTask({
      id: "takeoff:analyze",
      type: "analyze",
      label: "Đang bóc tách vật liệu…",
      route: "/material-takeoff",
      fakeProgress: true,
      run: async () => {
        const res = await fetch("/api/material-takeoff/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Bóc tách thất bại");
        // Trả kèm ảnh gốc để dựng lại thumbnail khi quay lại trang.
        return { result: json as TakeoffResult, preview: curPreview, mimeType: curMime };
      },
    });
  }

  /** Một mục phẳng (1 ảnh, 1 nhóm) trước khi gộp trùng. */
  type Entry = { uid: string; label: string; item: TakeoffItem; view?: ItemView };

  /** Gom cụm id → các dòng đã gộp (đại diện = mục đầu, ảnh = mục đầu có ảnh). */
  function mergeRows(entries: Entry[], clusters: string[][]): MergedRow[] {
    const byUid = new Map(entries.map((e) => [e.uid, e]));
    const out: MergedRow[] = [];
    for (const cluster of clusters) {
      const members = cluster.map((id) => byUid.get(id)).filter((m): m is Entry => !!m);
      if (members.length === 0) continue;
      out.push({
        item: members[0].item,
        view: members.find((m) => m.view)?.view,
        scenes: Array.from(new Set(members.map((m) => m.label))).sort(),
      });
    }
    return out;
  }

  async function exportExcel() {
    // Gộp các ảnh đã lưu + ảnh đang xem (chưa lưu) nếu có.
    const allScenes: Scene[] = [...scenes];
    if (result && preview) {
      allScenes.push({ id: "current", label: sceneLabel(scenes.length), preview, result, views });
    }
    if (allScenes.length === 0) return;

    setExporting(true);
    setError(null);
    try {
      const matEntries: Entry[] = [];
      const furEntries: Entry[] = [];
      for (const sc of allScenes) {
        sc.result.materials.forEach((it, i) =>
          matEntries.push({ uid: `${sc.id}:m-${i}`, label: sc.label, item: it, view: sc.views[`m-${i}`] }),
        );
        sc.result.furniture.forEach((it, i) =>
          furEntries.push({ uid: `${sc.id}:f-${i}`, label: sc.label, item: it, view: sc.views[`f-${i}`] }),
        );
      }

      const multi = allScenes.length > 1;
      let matClusters: string[][];
      let furClusters: string[][];
      if (multi) {
        // Khử trùng bằng AI: gom các mục cùng một vật giữa các góc ảnh.
        const res = await fetch("/api/material-takeoff/dedup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            materials: matEntries.map((e) => ({ id: e.uid, name: e.item.name, description: e.item.description })),
            furniture: furEntries.map((e) => ({ id: e.uid, name: e.item.name, description: e.item.description })),
          }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Gộp trùng thất bại");
        matClusters = json.materialClusters;
        furClusters = json.furnitureClusters;
      } else {
        matClusters = matEntries.map((e) => [e.uid]);
        furClusters = furEntries.map((e) => [e.uid]);
      }

      const mergedMat = mergeRows(matEntries, matClusters);
      const mergedFur = mergeRows(furEntries, furClusters);
      const title = allScenes[0].result.title;

      const ExcelJS = (await import("exceljs")).default;
      const wb = new ExcelJS.Workbook();
      const thin = { style: "thin" as const, color: { argb: "FF999999" } };
      const border = { top: thin, left: thin, bottom: thin, right: thin };

      const buildSheet = (
        sheetName: string,
        sectionTitle: string,
        rows: MergedRow[],
        nameHeader: string,
        tailHeaders: string[],
      ) => {
        const headers = [
          "STT", "Hình ảnh", nameHeader, "Mô tả",
          ...(multi ? ["Có ở ảnh"] : []),
          "Link mua", ...tailHeaders,
        ];
        const widths = [6, 14, 30, 46, ...(multi ? [12] : []), 12, 12, 10, 14];
        const ncol = headers.length;
        const linkCol = multi ? 6 : 5;

        const ws = wb.addWorksheet(sheetName);
        ws.columns = widths.slice(0, ncol).map((w) => ({ width: w }));

        ws.mergeCells(1, 1, 1, ncol);
        const t = ws.getCell(1, 1);
        t.value = sectionTitle;
        t.font = { bold: true, size: 14 };

        const headerRow = ws.getRow(2);
        headerRow.values = headers;
        headerRow.eachCell((c) => {
          c.font = { bold: true, color: { argb: "FFFFFFFF" } };
          c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0D9488" } };
          c.alignment = { vertical: "middle", horizontal: "center" };
          c.border = border;
        });

        rows.forEach((mr, i) => {
          const r = i + 3;
          const { item: it, view: v } = mr;
          const name = v?.match ? `${it.name} (An Cường: ${v.match.name})` : it.name;
          const row = ws.getRow(r);
          row.height = 66;
          row.getCell(1).value = i + 1;
          row.getCell(3).value = name;
          row.getCell(4).value = it.description;
          if (multi) row.getCell(5).value = mr.scenes.join(", ");
          row.getCell(linkCol).value = { text: "Link mua", hyperlink: buildBuyLink(it, v?.match?.name) };
          row.getCell(linkCol).font = { color: { argb: "FF0D9488" }, underline: true };
          for (let c = 1; c <= ncol; c++) {
            const cell = row.getCell(c);
            cell.border = border;
            cell.alignment = { vertical: "middle", horizontal: c === 1 ? "center" : "left", wrapText: true };
          }

          // Nhúng ảnh thật vào ô Hình ảnh (cột B, index 1 theo 0-based).
          const parts = v?.thumb ? dataUrlParts(v.thumb) : null;
          if (parts) {
            const id = wb.addImage(parts);
            ws.addImage(id, {
              tl: { col: 1.1, row: r - 1 + 0.1 },
              ext: { width: 80, height: 80 },
              editAs: "oneCell",
            });
          }
        });
      };

      buildSheet("Vật liệu", `${title} — Dự toán vật liệu`, mergedMat, "Tên vật liệu", ["Đơn giá", "m²", "Thành tiền"]);
      buildSheet("Đồ nội thất", `${title} — Dự toán đồ nội thất`, mergedFur, "Tên đồ nội thất", ["Số lượng", "Đơn giá", "Thành tiền"]);

      const buf = await wb.xlsx.writeBuffer();
      const blob = new Blob([buf], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `du-toan-${slugify(title)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Xuất Excel thất bại");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-8 sm:px-6">
      <div>
        <h1 className="font-display text-2xl">Bốc Vật liệu AI</h1>
        <p className="mt-1 text-sm text-foreground-soft">
          Tải ảnh render/thiết kế — AI nhận diện vật liệu &amp; đồ nội thất. Gỗ công nghiệp được khớp với thư viện mã màu An Cường; phần còn lại cắt ảnh minh hoạ trực tiếp. Có thể thêm nhiều góc ảnh của cùng không gian rồi xuất Excel gộp — AI tự gộp các mục trùng.
        </p>
      </div>

      <Card className="space-y-5 p-5 sm:p-6">
        <div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
          {preview ? (
            <div className="space-y-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview} alt="Ảnh tải lên" className="max-h-72 rounded-card border border-border object-contain" />
              <Button size="sm" variant="secondary" onClick={() => fileRef.current?.click()}>
                Đổi ảnh khác
              </Button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex w-full flex-col items-center justify-center gap-2 rounded-card border border-dashed border-border bg-surface-muted py-12 text-sm text-foreground-soft transition hover:border-accent hover:text-accent"
            >
              <span className="text-3xl">🖼️</span>
              Bấm để tải ảnh render/thiết kế (tối đa 8MB)
            </button>
          )}
        </div>

        {error && (
          <div className="rounded-card border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <div className="flex justify-end">
          <Button onClick={handleAnalyze} disabled={loading || !imageBase64}>
            {loading ? `Đang bóc tách... ${pct}%` : "✨ Bóc vật liệu"}
          </Button>
        </div>
      </Card>

      {scenes.length > 0 && (
        <Card className="space-y-4 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-display text-base text-accent">
              Ảnh đã thêm để gộp ({scenes.length})
            </h3>
            <Button size="sm" onClick={exportExcel} disabled={exporting}>
              {exporting ? "Đang gộp & xuất..." : `⬇ Xuất Excel gộp (${scenes.length + (result ? 1 : 0)} ảnh)`}
            </Button>
          </div>
          <div className="flex flex-wrap gap-3">
            {scenes.map((sc) => (
              <div key={sc.id} className="relative w-32 rounded-card border border-border p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={sc.preview} alt={`Ảnh ${sc.label}`} className="h-20 w-full rounded object-cover" />
                <div className="mt-1 text-xs font-medium">Ảnh {sc.label}</div>
                <div className="text-[11px] text-foreground-soft">
                  {sc.result.materials.length} vật liệu · {sc.result.furniture.length} nội thất
                </div>
                <button
                  type="button"
                  onClick={() => removeScene(sc.id)}
                  className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full border border-border bg-surface text-xs text-foreground-soft hover:text-red-400"
                  aria-label="Xoá ảnh này"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <p className="text-xs text-foreground-soft">
            Khi xuất, AI sẽ gộp các mục trùng nhau giữa các ảnh thành một dòng, cột “Có ở ảnh” cho biết mục đó xuất hiện ở những ảnh nào.
          </p>
        </Card>
      )}

      {loading && (
        <Card className="space-y-4 p-6">
          <ProgressBar percent={pct} label="AI đang đọc ảnh & bóc tách vật liệu" />
        </Card>
      )}

      {result && !loading && (
        <div className="space-y-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-xl">{result.title}</h2>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" onClick={addAngle}>
                ➕ Thêm góc khác
              </Button>
              <Button size="sm" variant="secondary" onClick={exportExcel} disabled={exporting}>
                {exporting
                  ? "Đang xuất..."
                  : scenes.length > 0
                    ? `⬇ Xuất Excel gộp (${scenes.length + 1} ảnh)`
                    : "⬇ Xuất Excel"}
              </Button>
            </div>
          </div>

          <TakeoffTable
            heading="Dự toán vật liệu"
            note="Bề mặt hoàn thiện — tính theo m². Gỗ công nghiệp khớp mã màu An Cường."
            rows={rows.filter((r) => r.group === "material")}
            views={views}
            onPick={changeMatch}
          />
          <TakeoffTable
            heading="Dự toán đồ nội thất"
            note="Đồ rời — tính theo cái. Ảnh cắt trực tiếp từ ảnh render."
            rows={rows.filter((r) => r.group === "furniture")}
            views={views}
            onPick={changeMatch}
          />

          <p className="text-xs text-foreground-soft">
            Gỗ CN khớp được mã An Cường thì link mở đúng sản phẩm; còn lại mở tìm kiếm. Cột Đơn giá, m², Số lượng trong Excel để bạn tự điền.
          </p>
        </div>
      )}
    </div>
  );
}

function TakeoffTable({
  heading,
  note,
  rows,
  views,
  onPick,
}: {
  heading: string;
  note: string;
  rows: Row[];
  views: Record<string, ItemView>;
  onPick: (rowId: string, swatch: SwatchItem) => void;
}) {
  if (rows.length === 0) {
    return (
      <Card className="p-5">
        <h3 className="font-display text-base text-accent">{heading}</h3>
        <p className="mt-2 text-sm text-foreground-soft">AI không nhận diện được mục nào ở nhóm này.</p>
      </Card>
    );
  }
  return (
    <Card className="overflow-hidden p-0">
      <div className="border-b border-border px-5 py-4">
        <h3 className="font-display text-base text-accent">{heading}</h3>
        <p className="text-xs text-foreground-soft">{note}</p>
      </div>
      <div className="divide-y divide-border">
        {rows.map((row) => {
          const v = views[row.id];
          return (
            <div key={row.id} className="grid grid-cols-[7rem_1fr_auto] items-start gap-4 px-5 py-4">
              <div className="h-24 w-24 overflow-hidden rounded-card border border-border bg-surface-muted">
                {v?.thumb ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={v.thumb} alt={row.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="h-full w-full animate-pulse bg-surface-muted" />
                )}
              </div>
              <div className="min-w-0">
                <p className="font-medium text-foreground">{row.name}</p>
                <p className="mt-0.5 text-sm text-foreground-soft">{row.description}</p>
                {v?.match && (
                  <div className="mt-2">
                    <p className="text-xs text-amber-400">An Cường: {v.match.name}</p>
                    {v.candidates.length > 1 && (
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {v.candidates.map((c) => (
                          <button
                            key={c.url}
                            type="button"
                            title={c.name}
                            onClick={() => onPick(row.id, c)}
                            className={`h-8 w-8 overflow-hidden rounded border ${
                              c.url === v.match?.url ? "border-accent ring-1 ring-accent" : "border-border"
                            }`}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={c.url} alt={c.name} className="h-full w-full object-cover" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
              <a
                href={buildBuyLink(row, v?.match?.name)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 whitespace-nowrap rounded-card border border-border px-3 py-2 text-xs font-medium text-accent transition hover:border-accent"
              >
                Link mua →
              </a>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
