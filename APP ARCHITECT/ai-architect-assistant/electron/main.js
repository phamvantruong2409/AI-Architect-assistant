const { app, BrowserWindow, ipcMain, dialog, shell } = require("electron");
const path = require("path");
const fs = require("fs");
const os = require("os");
const net = require("net");
const http = require("http");
const { spawn } = require("child_process");

let mainWindow;
let serverProcess;
let APP_URL = "";
let pendingAuthCode = null; // code nhận qua deep link trước khi renderer sẵn sàng

const DEEP_LINK_SCHEME = "aiarchitect"; // aiarchitect://auth/callback?code=...

// Đăng ký app làm trình xử lý mặc định cho scheme aiarchitect://
// (để trình duyệt sau khi đăng nhập Google quay về được đúng app này).
if (process.defaultApp) {
  // Chạy dev: electron . → cần truyền đường dẫn entry để OS gọi lại đúng.
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient(DEEP_LINK_SCHEME, process.execPath, [path.resolve(process.argv[1])]);
  }
} else {
  app.setAsDefaultProtocolClient(DEEP_LINK_SCHEME);
}

// Lấy "code" từ một URL deep link rồi chuyển cho renderer (hoặc giữ lại nếu chưa sẵn sàng).
function handleAuthDeepLink(url) {
  if (!url || typeof url !== "string" || !url.startsWith(`${DEEP_LINK_SCHEME}://`)) return;
  let code = null;
  try {
    code = new URL(url).searchParams.get("code");
  } catch {
    // URL hỏng → bỏ qua
  }
  if (!code) return;
  logToFile(`deep-link nhận code (đăng nhập Google)`);

  if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents) {
    mainWindow.webContents.send("auth-code", code);
    if (mainWindow.isMinimized()) mainWindow.restore();
    if (!mainWindow.isVisible()) mainWindow.show();
    mainWindow.focus();
  } else {
    pendingAuthCode = code; // gửi lại khi renderer tải xong
  }
}

// Tìm URL aiarchitect:// trong danh sách tham số dòng lệnh (Windows nhận deep link qua argv).
function findDeepLink(argv) {
  return (argv || []).find((a) => typeof a === "string" && a.startsWith(`${DEEP_LINK_SCHEME}://`));
}

function logToFile(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  try {
    const dir = app.getPath("userData");
    fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(path.join(dir, "app.log"), line);
  } catch {
    // userData chưa sẵn sàng → ghi tạm vào thư mục tạm hệ thống để còn chẩn đoán
    try {
      fs.appendFileSync(path.join(os.tmpdir(), "ai-architect-startup.log"), line);
    } catch {
      // chịu thua, nhưng không làm app crash
    }
  }
}

process.on("uncaughtException", (err) => logToFile(`UNCAUGHT ${err && err.stack ? err.stack : err}`));
process.on("unhandledRejection", (err) => logToFile(`UNHANDLED_REJECTION ${err && err.stack ? err.stack : err}`));

app.on("child-process-gone", (_e, details) => {
  logToFile(`child-process-gone type=${details.type} reason=${details.reason} exitCode=${details.exitCode}`);
});

// ── Next.js server cục bộ ────────────────────────────────────────────────
// App KHÔNG nạp web Vercel nữa. Toàn bộ dữ liệu (dự án, thư viện, cài đặt)
// lưu trên ổ đĩa người dùng (~/Documents/AI Architect), nên các API route
// dùng filesystem chỉ chạy được khi server Next chạy NGAY TRÊN MÁY này.
// Ở đây ta khởi động bản build "standalone" đã đóng gói rồi nạp localhost.

function findFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

function resolveServerEntry() {
  // Đã đóng gói: standalone nằm trong resources/ (extraResources).
  // Dev (electron .): dùng .next/standalone ở gốc project.
  const packaged = path.join(process.resourcesPath, "standalone", "server.js");
  const dev = path.join(__dirname, "..", ".next", "standalone", "server.js");
  return app.isPackaged ? packaged : dev;
}

function waitForServer(baseUrl, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const ping = () => {
      const req = http.get(baseUrl, (res) => {
        res.resume();
        resolve();
      });
      req.on("error", () => {
        if (Date.now() > deadline) reject(new Error("Server cục bộ không phản hồi kịp"));
        else setTimeout(ping, 250);
      });
    };
    ping();
  });
}

async function startLocalServer() {
  const serverEntry = resolveServerEntry();
  if (!fs.existsSync(serverEntry)) {
    logToFile(`KHÔNG tìm thấy server standalone tại ${serverEntry}. Chạy "npm run build:electron" trước.`);
    throw new Error("Thiếu bản build standalone của Next.js");
  }

  const port = await findFreePort();
  const serverDir = path.dirname(serverEntry);

  // Chạy server.js bằng chính Node có sẵn trong Electron (ELECTRON_RUN_AS_NODE)
  // — máy người dùng không cần cài Node.
  serverProcess = spawn(process.execPath, [serverEntry], {
    cwd: serverDir,
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
      NODE_ENV: "production",
      PORT: String(port),
      HOSTNAME: "127.0.0.1",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  serverProcess.stdout.on("data", (d) => logToFile(`[server] ${String(d).trim()}`));
  serverProcess.stderr.on("data", (d) => logToFile(`[server-err] ${String(d).trim()}`));
  serverProcess.on("exit", (code, signal) => {
    logToFile(`server thoát code=${code} signal=${signal}`);
    serverProcess = null;
  });

  APP_URL = `http://127.0.0.1:${port}`;
  await waitForServer(APP_URL, 30000);
  logToFile(`Server cục bộ sẵn sàng tại ${APP_URL}`);
  return APP_URL;
}

function stopLocalServer() {
  if (serverProcess && !serverProcess.killed) {
    try {
      serverProcess.kill();
    } catch {
      // process có thể đã thoát
    }
    serverProcess = null;
  }
}

function createSplashWindow() {
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
    width: 1920,
    height: 1080,
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

  mainWindow.webContents.on("page-favicon-updated", () => {
    mainWindow.setIcon(path.join(__dirname, "icon.ico"));
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  const reveal = () => {
    if (!mainWindow || mainWindow.isDestroyed() || mainWindow.isVisible()) return;
    mainWindow.maximize(); // mở chiếm trọn màn hình (1920x1080 trở lên vẫn full)
    mainWindow.show();
    if (splash && !splash.isDestroyed()) splash.destroy();
  };

  mainWindow.once("ready-to-show", reveal);
  setTimeout(reveal, 6000);

  let retryCount = 0;

  logToFile(`--- App khởi động, đang nạp ${APP_URL} ---`);

  mainWindow.webContents.on("did-finish-load", () => {
    logToFile("did-finish-load OK");
    retryCount = 0;
    reveal();
    setupAutoUpdate();
    // Nếu có code đăng nhập đến trước khi renderer sẵn sàng → gửi lại bây giờ.
    if (pendingAuthCode) {
      mainWindow.webContents.send("auth-code", pendingAuthCode);
      pendingAuthCode = null;
    }
  });

  mainWindow.webContents.on("did-navigate", (_e, url, httpResponseCode) => {
    logToFile(`did-navigate code=${httpResponseCode} url=${url}`);
  });

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
      <h1>Không khởi động được ứng dụng</h1>
      <p>Máy chủ nội bộ chưa sẵn sàng. Thử khởi động lại ứng dụng, nếu vẫn lỗi hãy cài đặt lại.</p>
      <button onclick="location.reload()">Thử lại</button>
    </body></html>`;
    mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    reveal();
  };

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

// Mở URL (đăng nhập Google) bằng trình duyệt mặc định của hệ thống.
ipcMain.handle("open-external", async (_e, url) => {
  if (typeof url === "string" && /^https?:\/\//.test(url)) {
    await shell.openExternal(url);
    return true;
  }
  return false;
});

let autoUpdateInitialized = false;
function setupAutoUpdate() {
  if (!app.isPackaged) return;
  if (autoUpdateInitialized) return; // chỉ chạy 1 lần, tránh đăng ký handler lặp khi trang nạp lại
  autoUpdateInitialized = true;

  const { autoUpdater } = require("electron-updater");
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  const sendToUI = (channel, payload) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(channel, payload);
    }
  };

  autoUpdater.on("update-available", (info) => {
    sendToUI("update-status", { state: "available", version: info.version });
  });

  autoUpdater.on("download-progress", (p) => {
    const percent = Math.round(p.percent);
    // Thanh tiến trình trên icon ở taskbar Windows (0..1)
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setProgressBar(percent / 100);
    }
    sendToUI("update-progress", {
      percent,
      transferred: p.transferred,
      total: p.total,
      bytesPerSecond: p.bytesPerSecond,
    });
  });

  autoUpdater.on("update-downloaded", async (info) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setProgressBar(-1); // tắt thanh tiến trình ở taskbar
    }
    sendToUI("update-status", { state: "downloaded", version: info.version });
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
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setProgressBar(-1);
    }
    sendToUI("update-status", { state: "error" });
  });

  autoUpdater.checkForUpdates().catch((err) => console.error("checkForUpdates failed:", err));
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", (_e, argv) => {
    // Windows: deep link đăng nhập tới khi app đang chạy → nằm trong argv của lần mở thứ 2.
    const link = findDeepLink(argv);
    if (link) {
      handleAuthDeepLink(link);
      return;
    }
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      if (!mainWindow.isVisible()) mainWindow.show();
      mainWindow.focus();
    }
  });

  // macOS: deep link tới qua sự kiện open-url.
  app.on("open-url", (_e, url) => handleAuthDeepLink(url));

  app.whenReady().then(async () => {
    logToFile(`>>> app ready. packaged=${app.isPackaged} userData=${app.getPath("userData")}`);
    // Trường hợp app được mở MỚI bằng deep link (chưa chạy sẵn): code nằm trong argv.
    const firstLink = findDeepLink(process.argv);
    if (firstLink) handleAuthDeepLink(firstLink);
    const splash = createSplashWindow();
    try {
      await startLocalServer();
    } catch (err) {
      logToFile(`Khởi động server cục bộ thất bại: ${err && err.message}`);
      APP_URL = APP_URL || "about:blank";
    }
    createWindow(splash);
  });
}

app.on("before-quit", stopLocalServer);

app.on("window-all-closed", () => {
  stopLocalServer();
  app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
