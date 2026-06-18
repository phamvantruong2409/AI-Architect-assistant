"use client";

import { useEffect, useRef, useState } from "react";

type Mode = "youtube" | "file";

function extractYouTubeId(url: string): string | null {
  const match = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  );
  return match ? match[1] : null;
}

export function AmbientSound() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("youtube");

  const [urlInput, setUrlInput] = useState("");
  const [youtubeId, setYoutubeId] = useState<string | null>(null);
  const [urlError, setUrlError] = useState(false);
  const [ytPaused, setYtPaused] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const [fileName, setFileName] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(0.5);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const objectUrlRef = useRef<string | null>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  const isActive = youtubeId !== null || playing;

  // --- YouTube ---
  const handleYouTubeSubmit = () => {
    const id = extractYouTubeId(urlInput.trim());
    if (!id) { setUrlError(true); return; }
    setUrlError(false);
    audioRef.current?.pause();
    setPlaying(false);
    setFileName(null);
    setYoutubeId(id);
    setOpen(false);
  };

  const clearYouTube = () => {
    setYoutubeId(null);
    setUrlInput("");
    setYtPaused(false);
  };

  const toggleYtPlay = () => {
    if (!iframeRef.current) return;
    const func = ytPaused ? "playVideo" : "pauseVideo";
    iframeRef.current.contentWindow?.postMessage(
      JSON.stringify({ event: "command", func, args: "" }), "*"
    );
    setYtPaused(!ytPaused);
  };

  // --- File ---
  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    const url = URL.createObjectURL(file);
    objectUrlRef.current = url;
    if (!audioRef.current) audioRef.current = new Audio();
    audioRef.current.src = url;
    audioRef.current.loop = true;
    audioRef.current.volume = volume;
    audioRef.current.play();
    setFileName(file.name.replace(/\.[^.]+$/, ""));
    setPlaying(true);
    setYoutubeId(null);
    setUrlInput("");
    setOpen(false);
  };

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (playing) { audioRef.current.pause(); setPlaying(false); }
    else { audioRef.current.play(); setPlaying(true); }
  };

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  useEffect(() => () => {
    audioRef.current?.pause();
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
  }, []);

  return (
    <>
      {/* ── YouTube iframe luôn tồn tại khi đang phát, không bị unmount khi đóng popup ── */}
      {youtubeId && (
        <div style={{ position: "fixed", left: "-9999px", top: 0, width: "320px", height: "180px", pointerEvents: "none" }}>
          <iframe
            src={`https://www.youtube.com/embed/${youtubeId}?autoplay=1&loop=1&playlist=${youtubeId}&rel=0&modestbranding=1&enablejsapi=1`}
            allow="autoplay; encrypted-media"
            ref={iframeRef}
            style={{ width: "100%", height: "100%", border: "none" }}
          />
        </div>
      )}

      <div className="relative" ref={popupRef}>
        {/* Popup */}
        {open && (
          <div className="absolute bottom-12 right-0 w-64 rounded-2xl border border-border bg-surface shadow-xl overflow-hidden">
            {/* Tab bar */}
            <div className="flex border-b border-border">
              {(["youtube", "file"] as Mode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`flex-1 py-2.5 text-[11px] font-medium transition-colors ${
                    mode === m
                      ? "text-foreground border-b-2 border-teal-500 -mb-px"
                      : "text-foreground-soft hover:text-foreground"
                  }`}
                >
                  {m === "youtube" ? "▶ YouTube" : "🎵 File MP3"}
                </button>
              ))}
            </div>

            <div className="p-3.5">
              {/* YouTube tab */}
              {mode === "youtube" && (
                <div className="space-y-2.5">
                  {!youtubeId ? (
                    <>
                      <p className="text-[10px] text-foreground-soft">Dán link YouTube vào đây</p>
                      <div className="flex gap-1.5">
                        <input
                          type="text"
                          value={urlInput}
                          onChange={(e) => { setUrlInput(e.target.value); setUrlError(false); }}
                          onKeyDown={(e) => e.key === "Enter" && handleYouTubeSubmit()}
                          placeholder="https://youtube.com/watch?v=..."
                          className={`flex-1 min-w-0 rounded-lg border bg-surface-muted px-2.5 py-1.5 text-xs text-foreground placeholder:text-foreground-soft/50 outline-none focus:border-teal-500 transition-colors ${
                            urlError ? "border-red-500" : "border-border"
                          }`}
                        />
                        <button
                          onClick={handleYouTubeSubmit}
                          className="rounded-lg bg-teal-500 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-teal-400 transition-colors shrink-0"
                        >
                          Phát
                        </button>
                      </div>
                      {urlError && <p className="text-[10px] text-red-400">Link không hợp lệ</p>}
                    </>
                  ) : (
                    <>
                      {/* Thumbnail + đang phát */}
                      <div className="relative rounded-xl overflow-hidden aspect-video">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={`https://img.youtube.com/vi/${youtubeId}/mqdefault.jpg`}
                          alt="thumbnail"
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center gap-2">
                          {/* Play/Pause button */}
                          <button
                            onClick={toggleYtPlay}
                            className="flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white hover:bg-teal-500/80 transition-colors"
                          >
                            {ytPaused ? (
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                            ) : (
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                            )}
                          </button>
                          {/* Indicator */}
                          {!ytPaused && (
                            <div className="flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1">
                              <span className="flex gap-0.5">
                                {[0, 1, 2].map((i) => (
                                  <span key={i} className="block w-0.5 bg-teal-400 rounded-full animate-pulse" style={{ height: "10px", animationDelay: `${i * 0.15}s` }} />
                                ))}
                              </span>
                              <span className="text-[10px] text-white font-medium">Đang phát</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={clearYouTube}
                        className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-border py-1.5 text-[11px] text-foreground-soft hover:text-foreground hover:border-foreground-soft transition-colors"
                      >
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                        Đổi video
                      </button>
                    </>
                  )}
                </div>
              )}

              {/* File tab */}
              {mode === "file" && (
                <div className="space-y-2.5">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex w-full items-center gap-2 rounded-xl border border-dashed border-border bg-surface-muted px-3 py-2.5 text-xs text-foreground-soft hover:border-teal-500/50 hover:text-foreground transition-colors"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                      <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                    </svg>
                    <span className="truncate">{fileName ?? "Chọn file MP3..."}</span>
                  </button>
                  <input ref={fileInputRef} type="file" accept="audio/*" className="hidden" onChange={handleFile} />

                  {fileName && (
                    <>
                      <button
                        onClick={togglePlay}
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-teal-500/15 border border-teal-500/30 py-2 text-xs text-teal-500 hover:bg-teal-500/25 transition-colors"
                      >
                        {playing ? (
                          <><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>Tạm dừng</>
                        ) : (
                          <><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>Phát</>
                        )}
                      </button>
                      <div className="flex items-center gap-2">
                        <svg className="h-3 w-3 shrink-0 text-foreground-soft" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/></svg>
                        <input type="range" min="0" max="1" step="0.05" value={volume} onChange={(e) => setVolume(Number(e.target.value))} className="w-full accent-teal-500 h-1" />
                        <svg className="h-3.5 w-3.5 shrink-0 text-foreground-soft" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Trigger button */}
        <button
          onClick={() => setOpen(!open)}
          aria-label="Nhạc nền"
          className={`flex h-10 w-10 items-center justify-center rounded-full border transition-all duration-300 hover:scale-110 ${
            isActive
              ? "bg-teal-500/15 border-teal-500/40 text-teal-500"
              : "bg-surface border-border text-foreground-soft hover:text-foreground"
          }`}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {isActive ? (
              <><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></>
            ) : (
              <><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></>
            )}
          </svg>
        </button>
      </div>
    </>
  );
}
