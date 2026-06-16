"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import type { ProjectBrief } from "@/types/concept";

const BUILDING_TYPES = ["Nhà phố", "Biệt thự", "Căn hộ", "Văn phòng", "Nhà hàng", "Trường học"];
const BUDGETS = ["Dưới 1 tỷ", "1–3 tỷ", "3–5 tỷ", "Trên 5 tỷ"];
const STYLES = ["Hiện đại", "Nhiệt đới", "Tối giản", "Indochine", "Cổ điển", "Sang trọng"];

const fieldClass =
  "w-full rounded-card border border-border bg-surface px-3.5 py-2.5 text-sm text-foreground placeholder:text-foreground-soft/60 focus:border-accent/50 focus:outline-none";
const labelClass = "mb-1.5 block text-sm font-medium text-foreground";

export function BriefForm({
  onSubmit,
  loading,
}: {
  onSubmit: (brief: ProjectBrief) => void;
  loading?: boolean;
}) {
  const [type, setType] = useState(BUILDING_TYPES[0]);
  const [landArea, setLandArea] = useState("");
  const [floors, setFloors] = useState("");
  const [budget, setBudget] = useState(BUDGETS[1]);
  const [styles, setStyles] = useState<string[]>(["Hiện đại"]);
  const [description, setDescription] = useState("");

  const toggleStyle = (s: string) => {
    setStyles((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ type, landArea, floors, budget, styles, description });
      }}
      className="space-y-5"
    >
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Loại công trình</label>
          <select
            className={fieldClass}
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            {BUILDING_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass}>Ngân sách</label>
          <select
            className={fieldClass}
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
          >
            {BUDGETS.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass}>Diện tích đất (m²)</label>
          <input
            type="number"
            min={0}
            className={fieldClass}
            placeholder="VD: 80"
            value={landArea}
            onChange={(e) => setLandArea(e.target.value)}
          />
        </div>

        <div>
          <label className={labelClass}>Số tầng dự kiến</label>
          <input
            type="number"
            min={0}
            className={fieldClass}
            placeholder="VD: 3"
            value={floors}
            onChange={(e) => setFloors(e.target.value)}
          />
        </div>
      </div>

      <div>
        <label className={labelClass}>Phong cách mong muốn</label>
        <div className="flex flex-wrap gap-2">
          {STYLES.map((s) => {
            const active = styles.includes(s);
            return (
              <button
                key={s}
                type="button"
                onClick={() => toggleStyle(s)}
                className={cn(
                  "rounded-full border px-3.5 py-1.5 text-sm transition-colors",
                  active
                    ? "border-accent bg-accent-soft text-accent"
                    : "border-border text-foreground-soft hover:border-accent/40"
                )}
              >
                {s}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label className={labelClass}>Mô tả thêm từ khách hàng</label>
        <textarea
          rows={4}
          className={fieldClass}
          placeholder="VD: Gia đình 3 thế hệ, cần phòng thờ riêng, sân vườn nhỏ phía sau, ưu tiên nhiều ánh sáng tự nhiên..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      <Button type="submit" disabled={loading} className="w-full sm:w-auto">
        {loading ? "Đang tạo concept..." : "Sinh 3 hướng Concept"}
      </Button>
    </form>
  );
}
