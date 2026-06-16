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

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  });
  mainWindow.webContents.session.clearCache().then(() => {
    mainWindow.loadURL(`http://127.0.0.1:${PORT}`);
  });
}

ipcMain.handle("select-folder", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ["openDirectory", "createDirectory"],
  });
  return result.canceled ? null : result.filePaths[0];
});

app.whenReady().then(() => {
  startServer();
  waitForServer(createWindow);
});

app.on("window-all-closed", () => {
  if (serverProcess) serverProcess.kill();
  app.quit();
});
