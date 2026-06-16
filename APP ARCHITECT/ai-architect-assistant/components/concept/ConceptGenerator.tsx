"use client";

import { useState } from "react";
import { BriefForm } from "./BriefForm";
import { ConceptGrid } from "./ConceptGrid";
import { generateMockConcepts } from "@/lib/concepts";
import type { Concept, ProjectBrief } from "@/types/concept";

export function ConceptGenerator() {
  const [concepts, setConcepts] = useState<Concept[] | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = (brief: ProjectBrief) => {
    setLoading(true);
    setConcepts(null);
    setTimeout(() => {
      setConcepts(generateMockConcepts(brief));
      setLoading(false);
    }, 1200);
  };

  return (
    <div className="mx-auto max-w-5xl space-y-10 px-4 py-8 sm:px-6">
      <div className="max-w-2xl">
        <h2 className="font-display text-2xl">Nhập brief dự án</h2>
        <p className="mt-1 text-sm text-foreground-soft">
          Mô tả ngắn về công trình — trợ lý sẽ đề xuất 3 hướng phong cách kèm
          vật liệu và bảng màu gợi ý.
        </p>
      </div>

      <BriefForm onSubmit={handleSubmit} loading={loading} />

      {loading && (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-72 animate-pulse rounded-card border border-border bg-surface-muted"
            />
          ))}
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
