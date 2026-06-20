// Tải binary Real-ESRGAN (ncnn-vulkan) + models vào vendor/realesrgan.
// Binary này quá nặng để commit vào git, nên tải riêng:  npm run fetch:realesrgan
// Sau đó electron-builder đóng gói nó qua "extraResources" (xem package.json).
//
// Nguồn: repo chính xinntao/Real-ESRGAN — bản này KÈM thư mục models/ (param+bin).
// Windows-only (dùng Expand-Archive của PowerShell để giải nén).

const fs = require("fs");
const path = require("path");
const https = require("https");
const { spawnSync } = require("child_process");

const URL =
  "https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.5.0/realesrgan-ncnn-vulkan-20220424-windows.zip";

const root = path.join(__dirname, "..");
const vendorBase = path.join(root, "vendor");
const vendorDir = path.join(vendorBase, "realesrgan");
const tmpZip = path.join(vendorBase, "realesrgan.zip");
const tmpExtract = path.join(vendorBase, "_extract");

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const get = (u) => {
      https
        .get(u, (res) => {
          if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            res.resume();
            return get(res.headers.location); // theo redirect của GitHub
          }
          if (res.statusCode !== 200) {
            reject(new Error(`Tải thất bại: HTTP ${res.statusCode}`));
            return;
          }
          const total = Number(res.headers["content-length"]) || 0;
          let done = 0;
          let lastPct = -1;
          res.on("data", (c) => {
            done += c.length;
            if (total) {
              const pct = Math.floor((done / total) * 100);
              if (pct !== lastPct) {
                lastPct = pct;
                process.stdout.write(`\rĐang tải… ${pct}%`);
              }
            }
          });
          res.pipe(file);
          file.on("finish", () => file.close(() => resolve()));
        })
        .on("error", reject);
    };
    get(url);
  });
}

// Tìm thư mục chứa realesrgan-ncnn-vulkan.exe (zip có thể bọc trong 1 thư mục con).
function findExeDir(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isFile() && entry.name === "realesrgan-ncnn-vulkan.exe") return dir;
    if (entry.isDirectory()) {
      const found = findExeDir(p);
      if (found) return found;
    }
  }
  return null;
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

async function main() {
  const exePath = path.join(vendorDir, "realesrgan-ncnn-vulkan.exe");
  const modelsPath = path.join(vendorDir, "models");
  if (fs.existsSync(exePath) && fs.existsSync(modelsPath)) {
    console.log("✓ Real-ESRGAN (kèm models) đã có sẵn tại", vendorDir);
    return;
  }

  // Dọn các lần tải lỗi trước đó.
  fs.rmSync(vendorDir, { recursive: true, force: true });
  fs.rmSync(tmpExtract, { recursive: true, force: true });
  fs.mkdirSync(vendorBase, { recursive: true });

  console.log("Tải Real-ESRGAN từ GitHub…");
  await download(URL, tmpZip);
  process.stdout.write("\n");

  console.log("Giải nén…");
  const r = spawnSync(
    "powershell",
    ["-NoProfile", "-Command", `Expand-Archive -LiteralPath '${tmpZip}' -DestinationPath '${tmpExtract}' -Force`],
    { stdio: "inherit" }
  );
  if (r.status !== 0) throw new Error("Giải nén thất bại (cần PowerShell trên Windows).");

  const exeDir = findExeDir(tmpExtract);
  if (!exeDir) throw new Error("Không tìm thấy realesrgan-ncnn-vulkan.exe trong gói tải về.");

  // Làm phẳng: copy nội dung thư mục chứa exe lên vendor/realesrgan.
  copyDir(exeDir, vendorDir);

  // Dọn rác.
  fs.rmSync(tmpZip, { force: true });
  fs.rmSync(tmpExtract, { recursive: true, force: true });

  if (!fs.existsSync(modelsPath)) {
    console.warn("⚠ Cảnh báo: không thấy thư mục models/ — engine có thể không chạy.");
  }
  console.log("✓ Xong. Engine Real-ESRGAN sẵn sàng tại", vendorDir);
}

main().catch((e) => {
  console.error("\nLỗi:", e.message);
  process.exit(1);
});
