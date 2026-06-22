const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  selectFolder: () => ipcRenderer.invoke("select-folder"),
  // Phiên bản app hiện tại (app.getVersion) — dùng để phát hiện vừa cập nhật.
  getAppVersion: () => ipcRenderer.invoke("app-version"),
  // Mở URL bằng trình duyệt mặc định của hệ thống (dùng cho đăng nhập Google).
  openExternal: (url) => ipcRenderer.invoke("open-external", url),
  // Nhận lại "code" khi trình duyệt quay về app qua deep link aiarchitect://
  onAuthCode: (callback) => {
    const handler = (_e, code) => callback(code);
    ipcRenderer.on("auth-code", handler);
    return () => ipcRenderer.removeListener("auth-code", handler);
  },

  // ── Upscale ảnh cục bộ bằng Real-ESRGAN (ncnn-vulkan) ──
  // Kiểm tra binary đã có trong app chưa.
  upscaleLocalAvailable: () => ipcRenderer.invoke("upscale-local-available"),
  // Chạy upscale: opts = { dataUrl, scale, tile, model } → trả về data URL PNG đã phóng to.
  upscaleLocal: (opts) => ipcRenderer.invoke("upscale-local", opts),
  // Theo dõi tiến trình (0..100). Trả về hàm hủy lắng nghe.
  onUpscaleProgress: (callback) => {
    const handler = (_e, percent) => callback(percent);
    ipcRenderer.on("upscale-progress", handler);
    return () => ipcRenderer.removeListener("upscale-progress", handler);
  },
});

// ---- Thanh tiến trình cập nhật (overlay tự chứa, hiển thị trên mọi trang) ----
(() => {
  let el = null;
  let barFill = null;
  let label = null;
  let hideTimer = null;

  function ensureUI() {
    if (el) return;
    el = document.createElement("div");
    el.id = "app-update-toast";
    el.style.cssText = [
      "position:fixed",
      "right:20px",
      "bottom:20px",
      "z-index:2147483647",
      "width:300px",
      "padding:14px 16px",
      "border-radius:14px",
      "background:rgba(17,24,39,0.92)",
      "color:#fff",
      "font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif",
      "box-shadow:0 10px 30px rgba(0,0,0,0.35)",
      "backdrop-filter:blur(8px)",
      "transform:translateY(140%)",
      "transition:transform .35s cubic-bezier(.22,1,.36,1)",
    ].join(";");

    label = document.createElement("div");
    label.style.cssText = "font-size:13px;font-weight:600;margin-bottom:10px;display:flex;align-items:center;gap:8px";
    label.textContent = "Đang tải bản cập nhật…";

    const track = document.createElement("div");
    track.style.cssText = "height:8px;border-radius:999px;background:rgba(255,255,255,0.18);overflow:hidden";

    barFill = document.createElement("div");
    barFill.style.cssText = [
      "height:100%",
      "width:0%",
      "border-radius:999px",
      "background:linear-gradient(90deg,#6366f1,#22d3ee)",
      "transition:width .25s ease",
    ].join(";");

    track.appendChild(barFill);
    el.appendChild(label);
    el.appendChild(track);
    document.body.appendChild(el);
  }

  function show() {
    ensureUI();
    if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
    requestAnimationFrame(() => { el.style.transform = "translateY(0)"; });
  }

  function hide(delay = 0) {
    if (!el) return;
    hideTimer = setTimeout(() => { el.style.transform = "translateY(140%)"; }, delay);
  }

  function fmtMB(bytes) {
    return (bytes / 1024 / 1024).toFixed(1);
  }

  ipcRenderer.on("update-status", (_e, data) => {
    if (!data) return;
    if (data.state === "available") {
      show();
      if (label) label.textContent = `Đang tải bản ${data.version}…`;
    } else if (data.state === "downloaded") {
      show();
      if (barFill) barFill.style.width = "100%";
      if (label) label.textContent = `Đã tải xong bản ${data.version} ✓`;
      hide(4000);
    } else if (data.state === "error") {
      hide(0);
    }
  });

  ipcRenderer.on("update-progress", (_e, p) => {
    if (!p) return;
    show();
    if (barFill) barFill.style.width = `${p.percent}%`;
    if (label) {
      const speed = p.bytesPerSecond ? ` · ${fmtMB(p.bytesPerSecond)} MB/s` : "";
      label.textContent = `Đang tải bản cập nhật ${p.percent}%${speed}`;
    }
  });
})();
