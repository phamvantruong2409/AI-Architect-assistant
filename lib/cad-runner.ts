// Runner: nhận CadPlan → tạo sinh AutoLISP (lib/cad-lisp) → chạy accoreconsole (AutoCAD
// chạy nền) TRÊN template của người dùng → lưu ra DWG → trả buffer. Chỉ chạy Windows
// (vì cần AutoCAD). Mọi script .scr viết THUẦN ASCII (tiếng Việt qua (chr) trong LISP).

import { execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { planToLisp } from "@/lib/cad-lisp";
import { resolveBlocksDir } from "@/lib/cad-blocks";
import type { CadPlan } from "@/lib/image-to-cad-types";
import { getAcadAccorePath, getCadTemplatePath } from "@/lib/settings-store";

const execFileAsync = promisify(execFile);

/** Đường dẫn mặc định template (máy phát triển). Người dùng nên đặt trong Cài đặt. */
const DEFAULT_TEMPLATE = "D:/3. KIEN TRUC AI/CAD/A3 AiArcAssis.dwg";

/** Tên file template ĐÓNG GÓI theo app (đặt trong public/cad-templates). */
const BUNDLED_TEMPLATE = "A3 AiArcAssis.dwg";

/**
 * Dò template ĐÓNG GÓI sẵn trong app (public/cad-templates). Ở dev cwd = gốc app; bản
 * Electron standalone cwd = thư mục standalone (đã copy 'public'); thêm dự phòng cạnh
 * module & resourcesPath. Nhờ vậy người dùng KHÔNG phải tự chọn template. Trả null nếu
 * không thấy (vd build thiếu file).
 */
function resolveBundledTemplate(): string | null {
  const candidates = [
    path.join(process.cwd(), "public", "cad-templates", BUNDLED_TEMPLATE),
    path.join(process.cwd(), "cad-templates", BUNDLED_TEMPLATE),
    path.join(__dirname, "..", "public", "cad-templates", BUNDLED_TEMPLATE),
    path.join(__dirname, "..", "..", "public", "cad-templates", BUNDLED_TEMPLATE),
  ];
  const res = process.env["RESOURCES_PATH"] || (process as { resourcesPath?: string }).resourcesPath;
  if (res) candidates.push(path.join(res, "standalone", "public", "cad-templates", BUNDLED_TEMPLATE));
  for (const c of candidates) {
    try {
      if (fs.existsSync(c)) return c;
    } catch {
      /* bỏ qua */
    }
  }
  return null;
}

/** Dò accoreconsole.exe: ưu tiên cấu hình, sau đó các bản AutoCAD đã cài. */
export function detectAccore(): string | null {
  const configured = getAcadAccorePath();
  if (configured && fs.existsSync(configured)) return configured;

  const roots = [
    process.env["ProgramFiles"] || "C:/Program Files",
    process.env["ProgramW6432"] || "C:/Program Files",
  ];
  const found: string[] = [];
  for (const root of roots) {
    const autodesk = path.join(root, "Autodesk");
    let dirs: string[] = [];
    try {
      dirs = fs.readdirSync(autodesk);
    } catch {
      continue;
    }
    for (const d of dirs) {
      if (!/^AutoCAD/i.test(d)) continue;
      const exe = path.join(autodesk, d, "accoreconsole.exe");
      if (fs.existsSync(exe)) found.push(exe);
    }
  }
  // Bản mới nhất trước (sắp theo tên giảm dần → "AutoCAD 2024" > "AutoCAD 2022").
  found.sort((a, b) => b.localeCompare(a));
  return found[0] ?? null;
}

/** Đường dẫn template: cấu hình người dùng → template ĐÓNG GÓI → mặc định máy dev. */
export function resolveTemplate(): string | null {
  const configured = getCadTemplatePath();
  if (configured && fs.existsSync(configured)) return configured;
  const bundled = resolveBundledTemplate();
  if (bundled) return bundled;
  if (fs.existsSync(DEFAULT_TEMPLATE)) return DEFAULT_TEMPLATE;
  return null;
}

export interface ExportEnv {
  accore: string | null;
  template: string | null;
  ready: boolean;
}

export function checkExportEnv(): ExportEnv {
  const accore = detectAccore();
  const template = resolveTemplate();
  return { accore, template, ready: Boolean(accore && template) };
}

export interface ExportResult {
  dwg: Buffer;
  log: string;
}

/** Đường dẫn dạng forward-slash cho LISP/script. */
function fwd(p: string): string {
  return p.replace(/\\/g, "/");
}

/**
 * Tạo sinh DWG từ mặt bằng. Ném lỗi tiếng Việt nếu thiếu AutoCAD/template hoặc chạy hỏng.
 */
export async function exportPlanToDwg(plan: CadPlan): Promise<ExportResult> {
  const accore = detectAccore();
  if (!accore) {
    throw new Error(
      "Không tìm thấy AutoCAD (accoreconsole.exe) trên máy. Hãy cài AutoCAD hoặc khai báo đường dẫn trong Cài đặt."
    );
  }
  const template = resolveTemplate();
  if (!template) {
    throw new Error(
      "Chưa có file template .dwg. Vào Cài đặt để chọn file template (vd A3 AiArcAssis.dwg)."
    );
  }

  const work = fs.mkdtempSync(path.join(os.tmpdir(), "ai-cad-"));
  const scrPath = path.join(work, "draw.scr");
  const outPath = path.join(work, "output.dwg");

  const lisp = planToLisp(plan, resolveBlocksDir());
  const scr =
    lisp +
    "\n" +
    '(command "_.ZOOM" "_E")\n' +
    `(command "_.SAVEAS" "2018" "${fwd(outPath)}")\n` +
    '(command "_.QUIT" "_N")\n';
  // ASCII thuần (tiếng Việt đã mã hoá qua (chr) trong LISP).
  fs.writeFileSync(scrPath, scr, "ascii");

  let raw: Buffer = Buffer.alloc(0);
  try {
    const { stdout } = await execFileAsync(accore, ["/i", template, "/s", scrPath], {
      timeout: 180_000,
      maxBuffer: 16 * 1024 * 1024,
      windowsHide: true,
      encoding: "buffer",
    });
    raw = stdout as unknown as Buffer;
  } catch (err) {
    // accore đôi khi trả mã thoát ≠ 0 do "Function cancelled" lúc QUIT — bỏ qua nếu
    // file đầu ra vẫn được tạo.
    raw = ((err as { stdout?: Buffer })?.stdout as Buffer) ?? Buffer.alloc(0);
  }
  // accoreconsole in stdout dạng wide-char (mỗi ký tự ASCII kèm 1 byte 0x00). Bỏ NUL
  // để đọc được thông điệp lỗi (vd "Unknown command ...").
  const log = Buffer.from(raw.filter((b) => b !== 0)).toString("latin1");

  if (!fs.existsSync(outPath)) {
    // Trích phần đuôi log (nơi lỗi xuất hiện) để người dùng/nhà phát triển biết NGUYÊN
    // NHÂN thật thay vì thông báo chung chung.
    const tail = log.replace(/\s+/g, " ").trim().slice(-400);
    throw new Error(
      "AutoCAD không tạo được file DWG. Kiểm tra template & quyền ghi." +
        (tail ? ` (AutoCAD: …${tail})` : "")
    );
  }
  const dwg = fs.readFileSync(outPath);

  // Dọn thư mục tạm (không chặn nếu lỗi).
  try {
    fs.rmSync(work, { recursive: true, force: true });
  } catch {
    /* bỏ qua */
  }

  return { dwg, log };
}
