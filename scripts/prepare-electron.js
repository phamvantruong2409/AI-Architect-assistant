const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const standaloneDir = path.join(root, ".next", "standalone");

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

copyDir(path.join(root, ".next", "static"), path.join(standaloneDir, ".next", "static"));
copyDir(path.join(root, "public"), path.join(standaloneDir, "public"));

// Next's file tracing misses runtime chunks that compiled route bundles load
// dynamically at request time (e.g. app-route-turbo.runtime.prod.js), causing
// every API route to crash with a 500 in the standalone build. Copy the full
// compiled next-server directory to ensure all runtimes are present.
copyDir(
  path.join(root, "node_modules", "next", "dist", "compiled", "next-server"),
  path.join(standaloneDir, "node_modules", "next", "dist", "compiled", "next-server")
);

const envSrc = path.join(root, ".env.local");
if (fs.existsSync(envSrc)) {
  fs.copyFileSync(envSrc, path.join(standaloneDir, ".env.local"));
}

console.log("Electron standalone bundle prepared at:", standaloneDir);
