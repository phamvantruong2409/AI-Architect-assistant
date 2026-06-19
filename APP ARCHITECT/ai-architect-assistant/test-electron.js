const e = require("electron");
console.log("type:", typeof e);
console.log("val:", String(e).slice(0, 100));
if (e && typeof e === 'object' && e.app) {
  e.app.on("ready", () => { console.log("WORKS"); e.app.quit(); });
}
