"use client";

import { useState } from "react";
import { BriefForm } from "./BriefForm";
import { ConceptGrid } from "./ConceptGrid";
import { GEMINI_MODELS } from "@/lib/gemini-models";
import { useChatModel } from "@/hooks/useChatModel";
import { useFakeProgress } from "@/hooks/useFakeProgress";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { recordAiCall, markRateLimited, estimateTokens } from "@/lib/ai-usage";
import type { Concept, ProjectBrief } from "@/types/concept";

export function ConceptGenerator() {
  const [model, setModel] = useChatModel(GEMINI_MODELS);
  const [concepts, setConcepts] = useState<Concept[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pct = useFakeProgress(loading);

  const handleSubmit = async (brief: ProjectBrief) => {
    setLoading(true);
    setError(null);
    setConcepts(null);
    try {
      const res = await fetch("/api/concept/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brief, model }),
      });
      const json = await res.json();
      if (!res.ok) {
        if (json.code === "QUOTA_EXCEEDED") markRateLimited(model);
        throw new Error(json.error || "Sinh concept thất bại");
      }
      const result = json.concepts as Concept[];
      recordAiCall(model, estimateTokens(brief.description) + estimateTokens(JSON.stringify(result)));
      setConcepts(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sinh concept thất bại");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-10 px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl">
          <h2 className="font-display text-2xl">Nhập brief dự án</h2>
          <p className="mt-1 text-sm text-foreground-soft">
            Mô tả ngắn về công trình — trợ lý sẽ đề xuất 3 hướng phong cách kèm
            vật liệu và bảng màu gợi ý.
          </p>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-foreground-soft">
            Model AI
          </label>
          <select
            className="rounded-card border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-accent/50 focus:outline-none"
            value={model}
            onChange={(e) => setModel(e.target.value as typeof model)}
          >
            {GEMINI_MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <BriefForm onSubmit={handleSubmit} loading={loading} />

      {error && (
        <div className="rounded-card border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {loading && (
        <div className="space-y-5">
          <ProgressBar percent={pct} label="AI đang sinh concept" />
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-72 animate-pulse rounded-card border border-border bg-surface-muted"
              />
            ))}
          </div>
        </div>
      )}

      {concepts && !loading && (
        <div>
          <h2 className="font-display text-2xl">3 hướng concept gợi ý</h2>
          <p className="mt-1 text-sm text-foreground-soft">
            Chọn một hướng để tiếp tục trò chuyện và phát triển sâu hơn.
          </p>
          <div className="mt-6">
            <ConceptGrid concepts={concepts} />
          </div>
        </div>
      )}
    </div>
  );
}
