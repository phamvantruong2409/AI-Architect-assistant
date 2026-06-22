import { execSync, spawnSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";

function getWindowsDrives(): string[] {
  try {
    const output = execSync("wmic logicaldisk get caption", { encoding: "utf-8", timeout: 3000 });
    return output
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => /^[A-Z]:$/.test(line));
  } catch {
    return ["C:"];
  }
}

function openFolderDialog(initial: string): string | null {
  const safePath = initial.replace(/'/g, "''");
  const script = [
    "Add-Type -AssemblyName System.Windows.Forms",
    "$owner = New-Object System.Windows.Forms.Form",
    "$owner.TopMost = $true",
    "$owner.WindowState = 'Minimized'",
    "$owner.ShowInTaskbar = $false",
    "$owner.Show()",
    "$dialog = New-Object System.Windows.Forms.FolderBrowserDialog",
    "$dialog.Description = 'Chon thu muc luu tru'",
    "$dialog.ShowNewFolderButton = $true",
    `$dialog.SelectedPath = '${safePath}'`,
    "$result = $dialog.ShowDialog($owner)",
    "$owner.Dispose()",
    "if ($result -eq [System.Windows.Forms.DialogResult]::OK) { Write-Output $dialog.SelectedPath }",
  ].join("; ");

  const tmpFile = path.join(os.tmpdir(), `ai-arch-browse-${Date.now()}.ps1`);
  try {
    fs.writeFileSync(tmpFile, script, "utf-8");
    const result = spawnSync("powershell", [
      "-NoProfile",
      "-sta",
      "-ExecutionPolicy", "Bypass",
      "-File", tmpFile,
    ], { encoding: "utf-8", timeout: 60000 });
    return result.stdout?.trim() || null;
  } catch {
    return null;
  } finally {
    try { fs.unlinkSync(tmpFile); } catch { /* ignore */ }
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const action = url.searchParams.get("action");
  const initial = url.searchParams.get("initial") ?? os.homedir();

  if (action === "pick") {
    const selected = openFolderDialog(initial);
    if (!selected) return Response.json({ cancelled: true });
    return Response.json({ path: selected });
  }

  const drives = getWindowsDrives();
  const suggestions = [
    { label: "Documents", path: `${os.homedir()}\\Documents\\AI Architect` },
    { label: "Desktop", path: `${os.homedir()}\\Desktop\\AI Architect` },
    ...drives.map((d) => ({ label: d, path: `${d}\\AI Architect` })),
  ].filter((s) => {
    try { return !!s.path; } catch { return false; }
  });

  return Response.json({ drives, suggestions, homedir: os.homedir() });
}
