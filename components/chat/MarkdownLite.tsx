import { Fragment } from "react";

function renderInline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return <Fragment key={i}>{part}</Fragment>;
  });
}

/** Renders a constrained subset of markdown: paragraphs, bold, and simple lists. */
export function MarkdownLite({ content }: { content: string }) {
  const blocks = content.split("\n\n");

  return (
    <div className="space-y-3">
      {blocks.map((block, i) => {
        const lines = block.split("\n").filter(Boolean);
        const isBulletList = lines.every((l) => /^[-*]\s/.test(l));
        const isNumberedList = lines.every((l) => /^\d+\.\s/.test(l));

        if (isBulletList) {
          return (
            <ul key={i} className="list-disc space-y-1 pl-5">
              {lines.map((l, j) => (
                <li key={j}>{renderInline(l.replace(/^[-*]\s/, ""))}</li>
              ))}
            </ul>
          );
        }

        if (isNumberedList) {
          return (
            <ol key={i} className="list-decimal space-y-1 pl-5">
              {lines.map((l, j) => (
                <li key={j}>{renderInline(l.replace(/^\d+\.\s/, ""))}</li>
              ))}
            </ol>
          );
        }

        return (
          <p key={i}>
            {lines.map((l, j) => (
              <Fragment key={j}>
                {j > 0 && <br />}
                {renderInline(l)}
              </Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}
