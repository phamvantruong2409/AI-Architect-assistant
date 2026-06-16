import type { Concept } from "@/types/concept";
import { ConceptCard } from "./ConceptCard";

export function ConceptGrid({ concepts }: { concepts: Concept[] }) {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {concepts.map((c) => (
        <ConceptCard key={c.id} concept={c} />
      ))}
    </div>
  );
}
