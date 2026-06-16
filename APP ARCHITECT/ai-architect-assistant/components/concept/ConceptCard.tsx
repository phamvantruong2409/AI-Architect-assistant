"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import type { Concept } from "@/types/concept";

export function ConceptCard({ concept }: { concept: Concept }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className="flex flex-col p-6">
      <div className="flex gap-1.5">
        {concept.colorPalette.map((c) => (
          <span
            key={c}
            className="h-4 w-4 rounded-full border border-border"
            style={{ backgroundColor: c }}
          />
        ))}
      </div>

      <h3 className="font-display mt-4 text-xl">{concept.name}</h3>
      <p className="mt-1 text-sm font-medium text-accent">{concept.tagline}</p>

      <p className="mt-3 text-sm text-foreground-soft">
        {expanded
          ? concept.description
          : `${concept.description.slice(0, 140)}${
              concept.description.length > 140 ? "…" : ""
            }`}
      </p>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {concept.style.map((s) => (
          <Badge key={s}>{s}</Badge>
        ))}
      </div>

      {expanded && (
        <div className="mt-4 space-y-3 text-sm">
          <div>
            <p className="font-medium text-foreground">Vật liệu gợi ý</p>
            <p className="mt-1 text-foreground-soft">
              {concept.materials.join(" · ")}
            </p>
          </div>
          <div>
            <p className="font-medium text-foreground">Công trình tham khảo</p>
            <p className="mt-1 text-foreground-soft">
              {concept.references.join(" · ")}
            </p>
          </div>
          <div>
            <p className="font-medium text-foreground">Vì sao phù hợp</p>
            <p className="mt-1 text-foreground-soft">{concept.reasoning}</p>
          </div>
        </div>
      )}

      <div className="mt-6 flex gap-2">
        <Button size="sm" className="flex-1">
          Chọn hướng này
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? "Thu gọn" : "Tìm hiểu thêm"}
        </Button>
      </div>
    </Card>
  );
}
