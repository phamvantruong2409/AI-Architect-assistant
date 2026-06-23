"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { startTask, dismissTask } from "@/lib/tasks";
import { useTask } from "@/hooks/useTasks";
import { MAX_IMAGE_BYTES, type CadPlan, type PlanAnalysis } from "@/lib/image-to-cad-types";
import { planToDxf } from "@/lib/dxf-writer";
import { ImageAnnotator, type ImageAnnotatorHandle } from "@/components/image-to-cad/ImageAnnotator";

function slugify(name: string): string {
  return (
    name
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/đ/g, "d")
      .replace(/Đ/g, "D")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase() || "mat-bang"
  );
}

interface EnvState {
  ready: boolean;
  hasAutocad: boolean;
  hasTemplate: boolean;
}

/** Nhãn tiếng Việt cho từng loại cấu kiện (hiển thị trong xem trước). */
const FEATURE_LABELS: Record<string, string> = {
  stairs: "Cầu thang",
  ramp: "Dốc",
  elevator: "Thang máy",
  void: "Thông tầng",
  planter: "Bồn cây",
  tree: "Cây",
  pond: "Hồ nước",
  column: "Cột",
};

/** Xem trước mặt bằng: tường dày, cửa, phòng, nội thất, cấu kiện. Lật trục Y cho đúng chiều. */
function PlanPreview({ plan }: { plan: CadPlan }) {
  const ext = Math.max(plan.width, plan.height, 1000);
  const pad = ext * 0.08;
  const fy = (y: number) => plan.height - y;
  const lw = ext / 250;

  // Khung bao gồm cả KHAY nội thất nằm phía trên mặt bằng (y > height).
  let minX = 0;
  let maxX = plan.width;
  let minY = 0;
  let maxY = plan.height;
  for (const f of [...plan.furniture, ...plan.features]) {
    const hw = Math.max(f.width, f.depth) / 2;
    minX = Math.min(minX, f.x - hw);
    maxX = Math.max(maxX, f.x + hw);
    minY = Math.min(minY, f.y - hw);
    maxY = Math.max(maxY, f.y + hw);
  }
  const top = plan.height - maxY; // mép trên trong toạ độ SVG (đã lật Y)
  const W = maxX - minX + pad * 2;
  const H = maxY - minY + pad * 2;

  return (
    <svg
      viewBox={`${minX - pad} ${top - pad} ${W} ${H}`}
      className="h-auto w-full rounded-card border border-border bg-white"
      style={{ aspectRatio: `${W} / ${H}` }}
    >
      {/* Phòng: nền nhạt + viền */}
      {plan.rooms.map((r, i) => (
        <polygon
          key={`r${i}`}
          points={r.points.map(([x, y]) => `${x},${fy(y)}`).join(" ")}
          fill="rgba(13,148,136,0.06)"
          stroke="#cbd5e1"
          strokeWidth={lw}
        />
      ))}
      {/* Tường: vẽ dày theo thickness */}
      {plan.walls.map((w, i) => (
        <line
          key={`w${i}`}
          x1={w.x1}
          y1={fy(w.y1)}
          x2={w.x2}
          y2={fy(w.y2)}
          stroke="#1f2937"
          strokeWidth={w.thickness > 0 ? w.thickness : lw}
          strokeLinecap="butt"
        />
      ))}
      {/* Cửa: cắt trắng + đánh dấu */}
      {plan.openings.map((op, i) => {
        const w = plan.walls[op.wallIndex];
        if (!w) return null;
        const len = Math.hypot(w.x2 - w.x1, w.y2 - w.y1) || 1;
        const dx = (w.x2 - w.x1) / len;
        const dy = (w.y2 - w.y1) / len;
        const ax = op.x - (dx * op.width) / 2;
        const ay = op.y - (dy * op.width) / 2;
        const bx = op.x + (dx * op.width) / 2;
        const by = op.y + (dy * op.width) / 2;
        return (
          <g key={`o${i}`}>
            <line
              x1={ax}
              y1={fy(ay)}
              x2={bx}
              y2={fy(by)}
              stroke="#ffffff"
              strokeWidth={w.thickness + 2}
              strokeLinecap="butt"
            />
            <line
              x1={ax}
              y1={fy(ay)}
              x2={bx}
              y2={fy(by)}
              stroke={op.kind === "door" ? "#2563eb" : "#0891b2"}
              strokeWidth={lw * 1.5}
            />
          </g>
        );
      })}
      {/* Nội thất: hình chữ nhật xoay */}
      {plan.furniture.map((f, i) => {
        const r = (f.rotation * Math.PI) / 180;
        const c = Math.cos(r);
        const s = Math.sin(r);
        const corners: [number, number][] = [
          [-f.width / 2, -f.depth / 2],
          [f.width / 2, -f.depth / 2],
          [f.width / 2, f.depth / 2],
          [-f.width / 2, f.depth / 2],
        ].map(([lx, ly]) => [f.x + lx * c - ly * s, f.y + lx * s + ly * c]);
        return (
          <polygon
            key={`f${i}`}
            points={corners.map(([x, y]) => `${x},${fy(y)}`).join(" ")}
            fill="rgba(217,119,6,0.10)"
            stroke="#d97706"
            strokeWidth={lw}
          />
        );
      })}
      {/* Cấu kiện: khung bao + ký hiệu + nhãn */}
      {plan.features.map((f, i) => {
        const r = (f.rotation * Math.PI) / 180;
        const c = Math.cos(r);
        const s = Math.sin(r);
        const corners: [number, number][] = [
          [-f.width / 2, -f.depth / 2],
          [f.width / 2, -f.depth / 2],
          [f.width / 2, f.depth / 2],
          [-f.width / 2, f.depth / 2],
        ].map(([lx, ly]) => [f.x + lx * c - ly * s, f.y + lx * s + ly * c]);
        const round = f.kind === "tree" || f.kind === "planter" || f.kind === "pond";
        const solid = f.kind === "column";
        const col = solid ? "#475569" : round ? "#16a34a" : "#7c3aed";
        const fs = ext / 55;
        return (
          <g key={`feat${i}`}>
            <polygon
              points={corners.map(([x, y]) => `${x},${fy(y)}`).join(" ")}
              fill={solid ? col : round ? "rgba(22,163,74,0.10)" : "rgba(124,58,237,0.10)"}
              stroke={col}
              strokeWidth={lw}
            />
            {f.kind === "tree" && (
              <circle cx={f.x} cy={fy(f.y)} r={Math.min(f.width, f.depth) / 2} fill="none" stroke={col} strokeWidth={lw} />
            )}
            {!solid && (
              <text x={f.x} y={fy(f.y)} fontSize={fs} textAnchor="middle" fill={col} style={{ fontWeight: 600 }}>
                {FEATURE_LABELS[f.kind] ?? f.kind}
              </text>
            )}
          </g>
        );
      })}
      {/* Nhãn phòng */}
      {plan.rooms.map((r, i) => {
        const cx = r.points.reduce((a, p) => a + p[0], 0) / r.points.length;
        const cy = r.points.reduce((a, p) => a + p[1], 0) / r.points.length;
        const fs = ext / 45;
        return (
          <text
            key={`t${i}`}
            x={cx}
            y={fy(cy)}
            fontSize={fs}
            textAnchor="middle"
            fill="#0f766e"
            style={{ fontWeight: 600 }}
          >
            {r.name.toUpperCase()}
            {r.area > 0 && (
              <tspan x={cx} dy={fs * 1.1} fontSize={fs * 0.8} fill="#6b7280">
                {r.area.toFixed(1)} m²
              </tspan>
            )}
          </text>
        );
      })}
    </svg>
  );
}

export default function ImageToAutocadPage() {
  const [preview, setPreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string>("image/jpeg");
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [analysisTitle, setAnalysisTitle] = useState<string>("");
  const [analysisNotes, setAnalysisNotes] = useState<string>("");
  const [plan, setPlan] = useState<CadPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [env, setEnv] = useState<EnvState | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportStage, setExportStage] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const annotatorRef = useRef<ImageAnnotatorHandle>(null);

  const describeTask = useTask("image2cad:describe");
  const describing = describeTask?.status === "running";
  const describePct = Math.round(describeTask?.progress ?? 0);

  const analyzeTask = useTask("image2cad:analyze");
  const loading = analyzeTask?.status === "running";
  const pct = Math.round(analyzeTask?.progress ?? 0);

  // Dò AutoCAD/template một lần.
  useEffect(() => {
    fetch("/api/image-to-cad/env")
      .then((r) => r.json())
      .then(setEnv)
      .catch(() => setEnv({ ready: false, hasAutocad: false, hasTemplate: false }));
  }, []);

  useEffect(() => {
    if (describeTask?.status === "done") {
      const r = describeTask.result as { analysis: PlanAnalysis; preview: string | null; mimeType: string };
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAnalysis(r.analysis.description);
      setAnalysisTitle(r.analysis.title);
      setAnalysisNotes(r.analysis.notes ?? "");
      if (r.preview) {
        setPreview(r.preview);
        setImageBase64(r.preview.split(",")[1] ?? null);
      }
      if (r.mimeType) setMimeType(r.mimeType);
      setError(null);
      dismissTask("image2cad:describe");
    } else if (describeTask?.status === "error") {
      setError(describeTask.error ?? "Phân tích mặt bằng thất bại");
      dismissTask("image2cad:describe");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [describeTask?.status]);

  useEffect(() => {
    if (analyzeTask?.status === "done") {
      const r = analyzeTask.result as { plan: CadPlan; preview: string | null; mimeType: string };
      // Giữ tiêu đề người dùng đã sửa ở bước phân tích (nếu có).
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPlan(analysisTitle.trim() ? { ...r.plan, title: analysisTitle.trim() } : r.plan);
      if (r.preview) {
        setPreview(r.preview);
        setImageBase64(r.preview.split(",")[1] ?? null);
      }
      if (r.mimeType) setMimeType(r.mimeType);
      setError(null);
      dismissTask("image2cad:analyze");
    } else if (analyzeTask?.status === "error") {
      setError(analyzeTask.error ?? "Dựng bản vẽ thất bại");
      dismissTask("image2cad:analyze");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analyzeTask?.status]);

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
    setPlan(null);
    setAnalysis(null);
    setAnalysisNotes("");
    setMimeType(file.type);
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setPreview(dataUrl);
      setImageBase64(dataUrl.split(",")[1] ?? null);
    };
    reader.readAsDataURL(file);
  }

  // BƯỚC 1 — AI phân tích "mặt bằng có gì" thành văn bản để người dùng sửa.
  async function handleDescribe() {
    if (!imageBase64) {
      setError("Vui lòng tải lên ảnh mặt bằng");
      return;
    }
    setError(null);
    setPlan(null);
    setAnalysis(null);
    setAnalysisNotes("");
    // Dán phẳng nét vẽ/chú thích của người dùng vào ảnh (nếu có) để AI đọc luôn.
    const annotated = await annotatorRef.current?.getAnnotated();
    const payload = {
      imageBase64: annotated?.base64 ?? imageBase64,
      mimeType: annotated?.mimeType ?? mimeType,
    };
    const curPreview = preview;
    const curMime = payload.mimeType;
    startTask({
      id: "image2cad:describe",
      type: "describe",
      label: "Đang phân tích mặt bằng…",
      route: "/image-to-autocad",
      fakeProgress: true,
      run: async () => {
        const res = await fetch("/api/image-to-cad/describe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Phân tích mặt bằng thất bại");
        return { analysis: json as PlanAnalysis, preview: curPreview, mimeType: curMime };
      },
    });
  }

  // BƯỚC 2 — Dựng bản vẽ hình học THEO bản phân tích (đã sửa) làm đề bài.
  async function handleBuild() {
    if (!imageBase64) {
      setError("Vui lòng tải lên ảnh mặt bằng");
      return;
    }
    setError(null);
    setPlan(null);
    const annotated = await annotatorRef.current?.getAnnotated();
    const payload = {
      imageBase64: annotated?.base64 ?? imageBase64,
      mimeType: annotated?.mimeType ?? mimeType,
      analysis: analysis ?? undefined,
    };
    const curPreview = preview;
    const curMime = payload.mimeType;
    startTask({
      id: "image2cad:analyze",
      type: "analyze",
      label: "Đang dựng bản vẽ…",
      route: "/image-to-autocad",
      fakeProgress: true,
      run: async () => {
        const res = await fetch("/api/image-to-cad/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Dựng bản vẽ thất bại");
        return { plan: json as CadPlan, preview: curPreview, mimeType: curMime };
      },
    });
  }

  async function exportDwg() {
    if (!plan) return;
    setExporting(true);
    setError(null);
    // Báo tiến trình theo từng giai đoạn (ước lượng thời gian) để người dùng biết
    // AutoCAD đang làm gì.
    const stages = [
      "Đang phân tích mặt bằng & tạo sinh lệnh AutoCAD…",
      "Đang khởi động AutoCAD nền (accoreconsole)…",
      "AutoCAD đang vẽ tường, cửa, nội thất & kích thước…",
      "Đang hatch tường & hoàn thiện bản vẽ…",
      "Đang lưu & tải file DWG về máy…",
    ];
    let si = 0;
    setExportStage(stages[0]);
    const timer = setInterval(() => {
      si = Math.min(si + 1, stages.length - 1);
      setExportStage(stages[si]);
    }, 6000);
    try {
      const res = await fetch("/api/image-to-cad/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(plan),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Xuất DWG thất bại");
      }
      setExportStage("Đang lưu & tải file DWG về máy…");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${slugify(plan.title)}.dwg`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Xuất DWG thất bại");
    } finally {
      clearInterval(timer);
      setExporting(false);
      setExportStage("");
    }
  }

  function downloadDxf() {
    if (!plan) return;
    const dxf = planToDxf(plan);
    const blob = new Blob([dxf], { type: "application/dxf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${slugify(plan.title)}.dxf`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-8 sm:px-6">
      <div>
        <h1 className="font-display text-2xl">Image to AutoCAD</h1>
        <p className="mt-1 text-sm text-foreground-soft">
          Tải ảnh MẶT BẰNG — AI <strong>phân tích mặt bằng có gì</strong> (bạn đọc &amp; sửa lại cho đúng), rồi dựng CAD{" "}
          <strong>theo đúng bản phân tích</strong>: nhận diện tường, cửa, phòng, nội thất &amp; kích thước, dùng AutoCAD
          vẽ thẳng lên template của bạn để xuất file <strong>DWG</strong> chuẩn kỹ thuật (tường 2 nét + hatch, cửa khoét
          tường, block nội thất, chữ tiếng Việt, đúng layer template).
        </p>
      </div>

      {env && (
        <div
          className={`rounded-card border px-4 py-2.5 text-xs ${
            env.ready
              ? "border-teal-500/30 bg-teal-500/10 text-teal-300"
              : "border-amber-500/30 bg-amber-500/10 text-amber-300"
          }`}
        >
          {env.ready ? (
            <>✓ AutoCAD đã sẵn sàng — xuất được DWG chuẩn trên template.</>
          ) : (
            <>
              ⚠ {!env.hasAutocad && "Chưa thấy AutoCAD trên máy. "}
              {!env.hasTemplate && "Chưa tìm thấy file template đóng gói. "}
              Bạn vẫn tải được DXF cơ bản (không cần AutoCAD); chỉ cần CÀI AutoCAD là app tự kết nối &amp; xuất DWG chuẩn
              (template đã tích hợp sẵn, không phải cấu hình gì).
            </>
          )}
        </div>
      )}

      <Card className="space-y-5 p-5 sm:p-6">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
        {preview ? (
          <div className="space-y-3">
            <ImageAnnotator ref={annotatorRef} src={preview} />
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
            <span className="text-3xl">📐</span>
            Bấm để tải ảnh mặt bằng (tối đa 8MB)
          </button>
        )}

        {error && (
          <div className="rounded-card border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <div className="flex justify-end">
          <Button onClick={handleDescribe} disabled={describing || loading || !imageBase64}>
            {describing ? `Đang phân tích... ${describePct}%` : analysis ? "↻ Phân tích lại" : "🔍 Phân tích mặt bằng"}
          </Button>
        </div>
      </Card>

      {describing && (
        <Card className="space-y-4 p-6">
          <ProgressBar percent={describePct} label="AI đang đọc ảnh & phân tích công năng từng phòng" />
        </Card>
      )}

      {/* BƯỚC TRUNG GIAN — bản phân tích văn bản, người dùng sửa trước khi dựng hình */}
      {analysis !== null && !describing && (
        <Card className="space-y-4 p-5 sm:p-6">
          <div>
            <h2 className="font-display text-lg">Bản phân tích mặt bằng</h2>
            <p className="mt-1 text-sm text-foreground-soft">
              AI mô tả mặt bằng đọc được từ ảnh. <strong>Hãy đọc &amp; sửa</strong> cho đúng ý (số phòng, tên, kích
              thước, cửa, nội thất) rồi bấm <strong>Dựng bản vẽ</strong> — AI sẽ vẽ CAD đúng theo mô tả này.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground-soft">Tiêu đề bản vẽ</label>
            <input
              type="text"
              value={analysisTitle}
              onChange={(e) => setAnalysisTitle(e.target.value)}
              className="w-full rounded-card border border-border bg-surface-muted px-3 py-2 text-sm outline-none focus:border-accent"
              placeholder="Vd: Mặt bằng nhà ống 5x12"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground-soft">Mô tả mặt bằng (sửa tự do)</label>
            <textarea
              value={analysis}
              onChange={(e) => setAnalysis(e.target.value)}
              rows={14}
              className="w-full resize-y rounded-card border border-border bg-surface-muted px-3 py-2 font-mono text-xs leading-relaxed outline-none focus:border-accent"
            />
          </div>

          {analysisNotes.trim() && (
            <div className="rounded-card border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-400">
              Ghi chú của AI: {analysisNotes}
            </div>
          )}

          <div className="flex justify-end">
            <Button onClick={handleBuild} disabled={loading || !analysis.trim()}>
              {loading ? `Đang dựng bản vẽ... ${pct}%` : "✨ Dựng bản vẽ"}
            </Button>
          </div>
        </Card>
      )}

      {loading && (
        <Card className="space-y-4 p-6">
          <ProgressBar percent={pct} label="AI đang dựng tường/cửa/phòng/nội thất theo bản phân tích" />
        </Card>
      )}

      {plan && !loading && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-xl">{plan.title}</h2>
              <p className="text-sm text-foreground-soft">
                {plan.walls.length} tường · {plan.openings.length} cửa · {plan.rooms.length} phòng ·{" "}
                {plan.furniture.length} nội thất · {plan.features.length} cấu kiện ·{" "}
                {plan.dimensions.length} kích thước · ~
                {(plan.width / 1000).toFixed(2)}×{(plan.height / 1000).toFixed(2)} m
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={exportDwg} disabled={exporting || !env?.ready}>
                {exporting ? "Đang xuất DWG…" : "⬇ Xuất DWG (AutoCAD)"}
              </Button>
              <Button variant="secondary" onClick={downloadDxf}>
                Tải DXF cơ bản
              </Button>
            </div>
          </div>

          {exporting && (
            <div className="flex items-center gap-3 rounded-card border border-teal-500/30 bg-teal-500/10 px-4 py-3 text-sm text-teal-200">
              <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-teal-300 border-t-transparent" />
              <span>{exportStage || "Đang xuất DWG…"}</span>
            </div>
          )}

          <Card className="p-4">
            <PlanPreview plan={plan} />
          </Card>

          {plan.notes?.trim() && (
            <div className="rounded-card border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-400">
              Ghi chú của AI: {plan.notes}
            </div>
          )}

          <p className="text-xs text-foreground-soft">
            Bản vẽ do AI ước lượng từ ảnh — kiểm tra lại tỉ lệ &amp; kích thước trong AutoCAD trước khi dùng cho hồ sơ.
            DWG xuất theo template (đơn vị mm). DXF cơ bản dùng khi máy không có AutoCAD (tường 1 nét, không hatch/nội
            thất).
          </p>
        </div>
      )}
    </div>
  );
}
