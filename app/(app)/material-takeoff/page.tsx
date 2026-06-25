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

/** Số lượng (m² hoặc cái) + đơn giá người dùng nhập cho một mục. */
interface PriceRow {
  qty: number;
  price: number;
}

/** Khoá giá ổn định qua các lần gộp ảnh: theo nhóm + tên mục (đã chuẩn hoá). */
function priceKey(group: Group, name: string): string {
  return `${group}:${name.trim().toLowerCase()}`;
}

/** Định dạng tiền VND, bỏ phần lẻ. "" nếu 0/không hợp lệ. */
function formatVnd(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "";
  return n.toLocaleString("vi-VN") + " ₫";
}

/** Đọc số từ ô nhập (cho phép dấu phẩy/chấm ngăn cách), trả 0 nếu rỗng. */
function parseNum(s: string): number {
  const v = parseFloat(s.replace(/[^\d.,]/g, "").replace(/\./g, "").replace(",", "."));
  return Number.isFinite(v) ? v : 0;
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

// Độ phân giải ảnh crop/swatch. 768 để khi phóng to (lightbox ~600px) ảnh được
// THU NHỎ xuống (luôn nét hơn phóng lên); bảng (96px) và Excel (80px) không ảnh hưởng.
const THUMB_PX = 768;

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

/** Tỷ lệ nới biên box khi cắt ảnh để thấy thêm ngữ cảnh xung quanh (12% mỗi chiều). */
const CROP_PADDING = 0.12;

/**
 * Nới vùng box ra mỗi cạnh thêm `pad` lần kích thước box (để cắt rộng hơn cho dễ
 * nhìn), rồi KẸP trong biên ảnh. Trả về toạ độ pixel thật {x, y, w, h}.
 */
function paddedRect(
  box: BBox,
  W: number,
  H: number,
  pad: number,
): { x: number; y: number; w: number; h: number } {
  const [ymin, xmin, ymax, xmax] = box;
  let rx = (xmin / 1000) * W;
  let ry = (ymin / 1000) * H;
  let rw = ((xmax - xmin) / 1000) * W;
  let rh = ((ymax - ymin) / 1000) * H;
  // Nới đều 2 phía rồi kẹp trong [0, W]×[0, H].
  const dx = rw * pad;
  const dy = rh * pad;
  rx = Math.max(0, rx - dx);
  ry = Math.max(0, ry - dy);
  rw = Math.min(W - rx, rw + dx * 2);
  rh = Math.min(H - ry, rh + dy * 2);
  return { x: rx, y: ry, w: Math.max(1, rw), h: Math.max(1, rh) };
}

/** Crop vuông giữa vùng box (chuẩn hoá 0–1000) từ ảnh gốc + lấy màu trung bình. */
function squareCrop(img: HTMLImageElement, box: BBox): { thumb: string; hex: string } {
  const W = img.naturalWidth || img.width;
  const H = img.naturalHeight || img.height;

  // Vùng hiển thị: nới rộng ra để thấy ngữ cảnh; cắt vuông giữa vùng đã nới.
  const pr = paddedRect(box, W, H, CROP_PADDING);
  const side = Math.max(1, Math.min(pr.w, pr.h));
  const cx = pr.x + (pr.w - side) / 2;
  const cy = pr.y + (pr.h - side) / 2;

  const canvas = document.createElement("canvas");
  canvas.width = THUMB_PX;
  canvas.height = THUMB_PX;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, cx, cy, side, side, 0, 0, THUMB_PX, THUMB_PX);

  // Màu chủ đạo: lấy từ vùng box GỐC (chưa nới) để khớp swatch đúng màu vật liệu.
  const g0 = paddedRect(box, W, H, 0);
  const one = document.createElement("canvas");
  one.width = 1;
  one.height = 1;
  const octx = one.getContext("2d")!;
  octx.drawImage(img, g0.x, g0.y, g0.w, g0.h, 0, 0, 1, 1);
  const [r, g, b] = octx.getImageData(0, 0, 1, 1).data;
  const hex = "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");

  return { thumb: canvas.toDataURL("image/jpeg", 0.95), hex };
}

/**
 * Crop TRỌN vùng box từ ảnh gốc, GIỮ NGUYÊN độ phân giải & tỷ lệ thật của vùng đó
 * (không ép vuông, không thu nhỏ) — dùng cho lightbox để xem nét nhất có thể.
 * Trả về dataURL PNG (không nén thêm) để không mất chi tiết.
 */
function fullBoxCrop(img: HTMLImageElement, box: BBox): string {
  const W = img.naturalWidth || img.width;
  const H = img.naturalHeight || img.height;
  // Nới rộng hơn (18%) cho lightbox để thấy rõ vật trong ngữ cảnh xung quanh.
  const p = paddedRect(box, W, H, 0.18);
  const rx = Math.round(p.x);
  const ry = Math.round(p.y);
  const rw = Math.max(1, Math.round(p.w));
  const rh = Math.max(1, Math.round(p.h));

  const canvas = document.createElement("canvas");
  canvas.width = rw;
  canvas.height = rh;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, rx, ry, rw, rh, 0, 0, rw, rh);
  return canvas.toDataURL("image/png");
}

/** Tải 1 swatch (URL public) về dataURL vuông để hiển thị + nhúng Excel. */
async function swatchToDataUrl(url: string): Promise<string> {
  const img = await loadImage(url);
  const canvas = document.createElement("canvas");
  canvas.width = THUMB_PX;
  canvas.height = THUMB_PX;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, THUMB_PX, THUMB_PX);
  return canvas.toDataURL("image/jpeg", 0.95);
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
  // Đơn giá & số lượng người dùng nhập, khoá theo nhóm + tên mục (bền qua gộp ảnh).
  const [prices, setPrices] = useState<Record<string, PriceRow>>({});
  const fileRef = useRef<HTMLInputElement>(null);

  function updatePrice(group: Group, name: string, patch: Partial<PriceRow>) {
    const key = priceKey(group, name);
    setPrices((p) => {
      const cur: PriceRow = p[key] ?? { qty: 0, price: 0 };
      return { ...p, [key]: { ...cur, ...patch } };
    });
  }

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
        group: Group,
        sheetName: string,
        sectionTitle: string,
        rows: MergedRow[],
        nameHeader: string,
        qtyHeader: string,
      ) => {
        // Thứ tự cột cuối thống nhất 2 sheet: <Số lượng/m²>, Đơn giá, Thành tiền.
        const tailHeaders = [qtyHeader, "Đơn giá (₫)", "Thành tiền (₫)"];
        const headers = [
          "STT", "Hình ảnh", nameHeader, "Mô tả",
          ...(multi ? ["Có ở ảnh"] : []),
          "Link mua", ...tailHeaders,
        ];
        const widths = [6, 14, 30, 40, ...(multi ? [12] : []), 12, 10, 16, 18];
        const ncol = headers.length;
        const linkCol = multi ? 6 : 5;
        // 3 cột cuối: qty, đơn giá, thành tiền.
        const qtyCol = ncol - 2;
        const priceCol = ncol - 1;
        const totalCol = ncol;

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

        const moneyFmt = '#,##0';
        rows.forEach((mr, i) => {
          const r = i + 3;
          const { item: it, view: v } = mr;
          const name = v?.match ? `${it.name} (An Cường: ${v.match.name})` : it.name;
          const pr = prices[priceKey(group, it.name)] ?? { qty: 0, price: 0 };
          const row = ws.getRow(r);
          row.height = 66;
          row.getCell(1).value = i + 1;
          row.getCell(3).value = name;
          row.getCell(4).value = it.description;
          if (multi) row.getCell(5).value = mr.scenes.join(", ");
          row.getCell(linkCol).value = { text: "Link mua", hyperlink: buildBuyLink(it, v?.match?.name) };
          row.getCell(linkCol).font = { color: { argb: "FF0D9488" }, underline: true };

          // Số lượng / đơn giá: điền số người dùng đã nhập (0 → để trống cho dễ sửa).
          if (pr.qty > 0) row.getCell(qtyCol).value = pr.qty;
          if (pr.price > 0) row.getCell(priceCol).value = pr.price;
          // Thành tiền = công thức để Excel tự tính lại khi user sửa số.
          const qCell = ws.getCell(r, qtyCol).address;
          const pCell = ws.getCell(r, priceCol).address;
          row.getCell(totalCol).value = { formula: `${qCell}*${pCell}` };
          row.getCell(priceCol).numFmt = moneyFmt;
          row.getCell(totalCol).numFmt = moneyFmt;

          for (let c = 1; c <= ncol; c++) {
            const cell = row.getCell(c);
            cell.border = border;
            const isNum = c === 1 || c >= qtyCol;
            cell.alignment = { vertical: "middle", horizontal: isNum ? "center" : "left", wrapText: true };
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

        // Dòng TỔNG CỘNG: SUM cột thành tiền.
        if (rows.length > 0) {
          const totalRowIdx = rows.length + 3;
          const tr = ws.getRow(totalRowIdx);
          ws.mergeCells(totalRowIdx, 1, totalRowIdx, totalCol - 1);
          const label = tr.getCell(1);
          label.value = "TỔNG CỘNG";
          label.font = { bold: true };
          label.alignment = { vertical: "middle", horizontal: "right" };
          const firstData = ws.getCell(3, totalCol).address;
          const lastData = ws.getCell(rows.length + 2, totalCol).address;
          const sumCell = tr.getCell(totalCol);
          sumCell.value = { formula: `SUM(${firstData}:${lastData})` };
          sumCell.font = { bold: true };
          sumCell.numFmt = moneyFmt;
          for (let c = 1; c <= totalCol; c++) tr.getCell(c).border = border;
        }
      };

      buildSheet("material", "Vật liệu", `${title} — Dự toán vật liệu`, mergedMat, "Tên vật liệu", "Khối lượng (m²)");
      buildSheet("furniture", "Đồ nội thất", `${title} — Dự toán đồ nội thất`, mergedFur, "Tên đồ nội thất", "Số lượng (cái)");

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
            qtyLabel="Khối lượng (m²)"
            rows={rows.filter((r) => r.group === "material")}
            views={views}
            prices={prices}
            sourceImage={preview}
            onPick={changeMatch}
            onPrice={updatePrice}
          />
          <TakeoffTable
            heading="Dự toán đồ nội thất"
            note="Đồ rời — tính theo cái. Ảnh cắt trực tiếp từ ảnh render."
            qtyLabel="Số lượng (cái)"
            rows={rows.filter((r) => r.group === "furniture")}
            views={views}
            prices={prices}
            sourceImage={preview}
            onPick={changeMatch}
            onPrice={updatePrice}
          />

          <p className="text-xs text-foreground-soft">
            Nhập <strong>khối lượng/số lượng</strong> và <strong>đơn giá</strong> ngay trên bảng — thành tiền &amp; tổng cộng tự tính, và được điền sẵn vào Excel khi xuất (kèm công thức để sửa tiếp). Gỗ CN khớp mã An Cường thì link mở đúng sản phẩm; còn lại mở tìm kiếm.
          </p>
        </div>
      )}
    </div>
  );
}

function TakeoffTable({
  heading,
  note,
  qtyLabel,
  rows,
  views,
  prices,
  sourceImage,
  onPick,
  onPrice,
}: {
  heading: string;
  note: string;
  qtyLabel: string;
  rows: Row[];
  views: Record<string, ItemView>;
  prices: Record<string, PriceRow>;
  /** Ảnh render GỐC (full-res) để crop lại vùng box khi phóng to cho nét. */
  sourceImage: string | null;
  onPick: (rowId: string, swatch: SwatchItem) => void;
  onPrice: (group: Group, name: string, patch: Partial<PriceRow>) => void;
}) {
  // Ảnh đang xem phóng to (lightbox). null = đóng. (Hook phải đứng trước mọi return.)
  const [zoom, setZoom] = useState<{ src: string; name: string } | null>(null);

  /**
   * Mở lightbox cho 1 mục. Ưu tiên crop TRỌN vùng box từ ảnh gốc full-res
   * (nét nhất). Mục khớp swatch An Cường hoặc thiếu ảnh gốc → dùng thumb sẵn có.
   */
  async function openZoom(row: Row, v: ItemView | undefined) {
    const fallback = v?.thumb ?? "";
    // Khớp swatch An Cường: ảnh là swatch, không có "gốc" nào nét hơn.
    if (v?.match || !sourceImage || !row.box) {
      if (fallback) setZoom({ src: fallback, name: row.name });
      return;
    }
    try {
      const img = await loadImage(sourceImage);
      setZoom({ src: fullBoxCrop(img, row.box), name: row.name });
    } catch {
      if (fallback) setZoom({ src: fallback, name: row.name });
    }
  }

  if (rows.length === 0) {
    return (
      <Card className="p-5">
        <h3 className="font-display text-base text-accent">{heading}</h3>
        <p className="mt-2 text-sm text-foreground-soft">AI không nhận diện được mục nào ở nhóm này.</p>
      </Card>
    );
  }

  // Tổng tiền nhóm = Σ (qty × đơn giá) theo số liệu đang nhập.
  const total = rows.reduce((sum, row) => {
    const pr = prices[priceKey(row.group, row.name)];
    return sum + (pr ? pr.qty * pr.price : 0);
  }, 0);

  const priceInput =
    "w-24 rounded border border-border bg-surface-muted px-2 py-1 text-right text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring";

  return (
    <Card className="overflow-hidden p-0">
      <div className="border-b border-border px-5 py-4">
        <h3 className="font-display text-base text-accent">{heading}</h3>
        <p className="text-xs text-foreground-soft">{note}</p>
      </div>
      <div className="divide-y divide-border">
        {rows.map((row) => {
          const v = views[row.id];
          const pr = prices[priceKey(row.group, row.name)] ?? { qty: 0, price: 0 };
          const lineTotal = pr.qty * pr.price;
          return (
            <div key={row.id} className="grid grid-cols-[6rem_1fr_auto] items-start gap-4 px-5 py-4">
              {v?.thumb ? (
                <button
                  type="button"
                  onClick={() => openZoom(row, v)}
                  title="Bấm để phóng to"
                  className="group relative h-24 w-24 overflow-hidden rounded-card border border-border bg-surface-muted transition-colors hover:border-accent"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={v.thumb} alt={row.name} className="h-full w-full object-cover" />
                  <span className="absolute inset-0 flex items-center justify-center bg-black/40 text-lg text-white opacity-0 transition-opacity group-hover:opacity-100">
                    🔍
                  </span>
                </button>
              ) : (
                <div className="h-24 w-24 overflow-hidden rounded-card border border-border bg-surface-muted">
                  <div className="h-full w-full animate-pulse bg-surface-muted" />
                </div>
              )}
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
                <a
                  href={buildBuyLink(row, v?.match?.name)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
                >
                  Link mua →
                </a>
              </div>

              {/* Cột nhập đơn giá → thành tiền tự tính */}
              <div className="flex flex-col items-end gap-1.5 text-xs">
                <label className="flex items-center gap-2 text-foreground-soft">
                  <span className="w-28 text-right">{qtyLabel}</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    className={priceInput}
                    value={pr.qty ? String(pr.qty) : ""}
                    placeholder="0"
                    onChange={(e) => onPrice(row.group, row.name, { qty: parseNum(e.target.value) })}
                  />
                </label>
                <label className="flex items-center gap-2 text-foreground-soft">
                  <span className="w-28 text-right">Đơn giá (₫)</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    className={priceInput}
                    value={pr.price ? pr.price.toLocaleString("vi-VN") : ""}
                    placeholder="0"
                    onChange={(e) => onPrice(row.group, row.name, { price: parseNum(e.target.value) })}
                  />
                </label>
                <div className="mt-0.5 flex items-center gap-2">
                  <span className="w-28 text-right text-foreground-soft">Thành tiền</span>
                  <span className="w-24 text-right font-semibold text-foreground">
                    {lineTotal > 0 ? formatVnd(lineTotal) : "—"}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-end gap-3 border-t border-border bg-surface-muted px-5 py-3">
        <span className="text-sm text-foreground-soft">Tổng cộng {heading.toLowerCase()}:</span>
        <span className="font-display text-lg text-accent">{total > 0 ? formatVnd(total) : "—"}</span>
      </div>

      {zoom && (
        <div
          className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-3 bg-black/80 p-6"
          onClick={() => setZoom(null)}
        >
          <button
            type="button"
            onClick={() => setZoom(null)}
            className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-lg text-white transition-colors hover:bg-white/20"
            title="Đóng"
          >
            ✕
          </button>
          {/* Ảnh crop full-res từ gốc: hiển thị theo kích thước thật, chỉ co lại nếu vượt màn hình (không phóng lên → giữ nét). */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={zoom.src}
            alt={zoom.name}
            className="max-h-[85vh] max-w-[92vw] rounded-card object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          <p className="text-sm text-white/80">{zoom.name}</p>
        </div>
      )}
    </Card>
  );
}
