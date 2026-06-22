"use client";

import { useEffect, useRef } from "react";

export default function AutoLayoutPage() {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const send = (dark: boolean) => {
      iframeRef.current?.contentWindow?.postMessage({ type: "theme", dark }, "*");
    };

    const observer = new MutationObserver(() => {
      send(document.documentElement.classList.contains("dark"));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    return () => observer.disconnect();
  }, []);

  const onLoad = () => {
    const dark = document.documentElement.classList.contains("dark");
    iframeRef.current?.contentWindow?.postMessage({ type: "theme", dark }, "*");
  };

  return (
    <div className="h-[calc(100vh-4rem)]">
      <iframe
        ref={iframeRef}
        src="/tools/block-diagram.html"
        title="Tạo layout mặt bằng"
        className="h-full w-full border-0"
        onLoad={onLoad}
      />
    </div>
  );
}
