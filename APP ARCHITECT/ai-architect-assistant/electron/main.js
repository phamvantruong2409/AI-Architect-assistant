const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");
const http = require("http");

const PORT = 3456;

let serverProcess;
let mainWindow;

function loadEnvLocal(envPath) {
  const env = {};
  if (!fs.existsSync(envPath)) return env;
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    env[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
  }
  return env;
}

function startServer() {
  const standaloneDir = path.join(process.resourcesPath, "standalone");
  const serverFile = path.join(standaloneDir, "server.js");
  const envFile = path.join(standaloneDir, ".env.local");

  serverProcess = spawn(process.execPath, [serverFile], {
    cwd: standaloneDir,
    env: {
      ...process.env,
      ...loadEnvLocal(envFile),
      PORT: String(PORT),
      HOSTNAME: "127.0.0.1",
      NODE_ENV: "production",
      ELECTRON_RUN_AS_NODE: "1",
    },
    stdio: "ignore",
  });
}

function waitForServer(callback) {
  const tryConnect = () => {
    const req = http.get(`http://127.0.0.1:${PORT}`, () => callback());
    req.on("error", () => setTimeout(tryConnect, 300));
  };
  tryConnect();
}

function createSplashWindow() {
  // Đọc logo từ filesystem và nhúng thẳng vào HTML dưới dạng base64
  // để không cần file I/O sau khi HTML load — xuất hiện ngay lập tức
  const logoPath = app.isPackaged
    ? path.join(process.resourcesPath, "standalone", "public", "images", "logodark.png")
    : path.join(__dirname, "..", "public", "images", "logodark.png");

  let logoSrc = "";
  try {
    const buf = fs.readFileSync(logoPath);
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

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  });

  mainWindow.loadURL(`http://127.0.0.1:${PORT}`);
}

ipcMain.handle("select-folder", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ["openDirectory", "createDirectory"],
  });
  return result.canceled ? null : result.filePaths[0];
});

// Khởi động server ngay khi main.js load — song song với Electron init
// thay vì chờ app.whenReady() mới bắt đầu, tiết kiệm 2-4 giây
startServer();

app.whenReady().then(() => {
  const splash = createSplashWindow();

  waitForServer(() => {
    createWindow();

    mainWindow.webContents.once("did-finish-load", () => {
      mainWindow.show();
      splash.destroy();
    });
  });
});

app.on("window-all-closed", () => {
  if (serverProcess) serverProcess.kill();
  app.quit();
});
