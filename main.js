const { app, BrowserWindow, ipcMain, dialog, shell } = require("electron");
const { autoUpdater } = require("electron-updater");
const path = require("path");
const fs = require("fs");

// App desktop chỉ là vỏ nạp web đã deploy trên Vercel. Mọi khoá bí mật
// (Supabase service role, Gemini) nằm trên server Vercel — KHÔNG đóng gói
// vào .exe, nên phát hành cho người dùng vẫn an toàn.
const APP_URL = process.env.APP_URL || "https://ai-architect-assistant.vercel.app";

let mainWindow;

// Ghi log ra file để chẩn đoán lỗi trên máy người dùng (không có DevTools).
// File nằm ở %APPDATA%\AI Architect Assistant\app.log
function logToFile(msg) {
  try {
    const line = `[${new Date().toISOString()}] ${msg}\n`;
    fs.appendFileSync(path.join(app.getPath("userData"), "app.log"), line);
  } catch {
    // không ghi được log thì bỏ qua, không làm app crash
  }
}

// Bắt mọi tiến trình con chết (GPU, utility, renderer) — nguyên nhân màn trắng.
app.on("child-process-gone", (_e, details) => {
  logToFile(`child-process-gone type=${details.type} reason=${details.reason} exitCode=${details.exitCode}`);
});

function createSplashWindow() {
  // Đọc logo từ trong asar (electron/) và nhúng base64 để hiện ngay lập tức.
  let logoSrc = "";
  try {
    const buf = fs.readFileSync(path.join(__dirname, "logoiconhinhtron.png"));
    logoSrc = `data:image/png;base64,${buf.toString("base64")}`;
  } catch {
    // logo không tìm thấy — splash vẫn hiện, chỉ không có ảnh
  }

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
    *{margin:0;padding:0;box-sizing:border-box;}
    body{
      background:#050B14;
      display:flex;align-items:center;justify-content:center;
      height:100vh;
      user-select:none;-webkit-user-select:none;
    }
    img{width:120px;height:120px;object-fit:contain;}
  </style></head><body>
    ${logoSrc ? `<img src="${logoSrc}" alt="AI Architect" draggable="false"/>` : ""}
  </body></html>`;

  const splash = new BrowserWindow({
    width: 260,
    height: 260,
    frame: false,
    transparent: false,
    backgroundColor: "#050B14",
    center: true,
    resizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  });

  splash.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  return splash;
}

function createWindow(splash) {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: "#050B14",
    icon: path.join(__dirname, "icon.ico"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Web Vercel có favicon riêng sẽ ghi đè icon cửa sổ — giữ lại logo tròn của app.
  mainWindow.webContents.on("page-favicon-updated", () => {
    mainWindow.setIcon(path.join(__dirname, "icon.ico"));
  });

  // Mở link ngoài (target=_blank) bằng trình duyệt hệ thống, không mở trong app.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  const reveal = () => {
    if (!mainWindow || mainWindow.isDestroyed() || mainWindow.isVisible()) return;
    mainWindow.show();
    if (splash && !splash.isDestroyed()) splash.destroy();
  };

  // Hiện cửa sổ ngay khi sẵn sàng vẽ — không chờ web tải xong.
  mainWindow.once("ready-to-show", reveal);
  // An toàn: dù mạng treo, luôn hiện cửa sổ sau 6s (kèm trang đang tải/lỗi)
  // để app KHÔNG bao giờ chạy ẩn vô hình.
  setTimeout(reveal, 6000);

  let retryCount = 0;

  logToFile(`--- App khởi động, đang nạp ${APP_URL} ---`);

  mainWindow.webContents.on("did-finish-load", () => {
    logToFile("did-finish-load OK");
    retryCount = 0; // tải thành công → reset bộ đếm thử lại
    reveal();
    setupAutoUpdate();
  });

  // Log mã HTTP của lần điều hướng chính (200 = OK, 4xx/5xx = lỗi server).
  mainWindow.webContents.on("did-navigate", (_e, url, httpResponseCode) => {
    logToFile(`did-navigate code=${httpResponseCode} url=${url}`);
  });

  // Bắt lỗi JS trong renderer (level 3 = error).
  mainWindow.webContents.on("console-message", (_e, level, message, line, sourceId) => {
    if (level >= 2) logToFile(`renderer-console lvl=${level} ${message} @ ${sourceId}:${line}`);
  });

  mainWindow.webContents.on("unresponsive", () => logToFile("renderer UNRESPONSIVE"));

  const showErrorPage = () => {
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
      body{background:#050B14;color:#e7e5e4;font-family:Segoe UI,system-ui,sans-serif;
        display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;gap:16px;text-align:center;padding:24px;}
      h1{font-size:18px;font-weight:600} p{color:#a8a29e;max-width:420px;line-height:1.5}
      button{margin-top:8px;padding:10px 20px;border:0;border-radius:10px;background:#e7e5e4;color:#1c1917;font-size:14px;font-weight:600;cursor:pointer}
    </style></head><body>
      <h1>Không kết nối được</h1>
      <p>Ứng dụng cần internet để hoạt động. Kiểm tra kết nối mạng rồi thử lại.</p>
      <button onclick="location.href='${APP_URL}'">Thử lại</button>
    </body></html>`;
    mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    reveal();
  };

  // Mất mạng / không tải được web. errorCode -3 (ERR_ABORTED) là do điều hướng
  // bị huỷ, không phải lỗi thật → bỏ qua. Mạng lúc khởi động có thể chưa sẵn
  // sàng (Wi-Fi đang kết nối) nên tự thử lại vài lần trước khi báo lỗi.
  mainWindow.webContents.on("did-fail-load", (_e, errorCode, errorDesc, validatedURL, isMainFrame) => {
    logToFile(`did-fail-load code=${errorCode} desc=${errorDesc} mainFrame=${isMainFrame} url=${validatedURL}`);
    if (!isMainFrame || errorCode === -3) return;
    if (retryCount < 3) {
      retryCount++;
      setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed()) mainWindow.loadURL(APP_URL);
      }, 1500 * retryCount);
      return;
    }
    showErrorPage();
  });

  // Renderer bị crash (đây là nguyên nhân hiện trang trắng "This page couldn't
  // load" của Chromium). Tự nạp lại thay vì để màn hình lỗi mặc định.
  mainWindow.webContents.on("render-process-gone", (_e, details) => {
    logToFile(`render-process-gone reason=${details.reason} exitCode=${details.exitCode}`);
    if (details.reason === "clean-exit") return;
    if (retryCount < 3) {
      retryCount++;
      mainWindow.loadURL(APP_URL);
    } else {
      showErrorPage();
    }
  });

  mainWindow.loadURL(APP_URL);
}

ipcMain.handle("select-folder", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ["openDirectory", "createDirectory"],
  });
  return result.canceled ? null : result.filePaths[0];
});

// Tự động kiểm tra cập nhật từ GitHub Releases. Khi mở app, nếu có bản mới
// hơn, electron-updater tải ngầm; tải xong sẽ hỏi người dùng cài & khởi động lại.
function setupAutoUpdate() {
  if (!app.isPackaged) return; // chỉ chạy ở bản đã đóng gói

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("update-downloaded", async (info) => {
    const { response } = await dialog.showMessageBox(mainWindow, {
      type: "info",
      buttons: ["Cập nhật & khởi động lại", "Để sau"],
      defaultId: 0,
      cancelId: 1,
      title: "Đã có phiên bản mới",
      message: `Phiên bản mới ${info.version} đã sẵn sàng.`,
      detail: "Bấm cập nhật để cài ngay, hoặc để sau — bản mới sẽ tự cài khi bạn thoát ứng dụng.",
    });
    if (response === 0) {
      setImmediate(() => autoUpdater.quitAndInstall());
    }
  });

  autoUpdater.on("error", (err) => {
    console.error("Auto-update error:", err);
  });

  autoUpdater.checkForUpdates().catch((err) => console.error("checkForUpdates failed:", err));
}

// Chỉ cho phép một bản chạy. Nếu mở lần 2 (hoặc double-click khi app đang
// chạy ẩn/treo), focus lại cửa sổ cũ thay vì mở thêm tiến trình.
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      if (!mainWindow.isVisible()) mainWindow.show();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    const splash = createSplashWindow();
    createWindow(splash);
  });
}

app.on("window-all-closed", () => {
  app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
