/**
 * Cắt các trang catalog WC trong ../thuvienwc thành từng ô mặt bằng riêng,
 * nén nhẹ và lưu vào public/library/wc/<code>-<n>.jpg.
 * Mỗi trang là lưới đều cols×rows → cắt row-major (trái→phải, trên→xuống).
 *
 *   node scripts/build-wc-library.js
 */
const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const SRC_DIR = path.join(__dirname, "..", "..", "thuvienwc");
const OUT_DIR = path.join(__dirname, "..", "public", "library", "wc");

// Bản đồ trang → mã + lưới. Thứ tự ô khớp với catalog trong lib/wc-library.ts.
const SHEETS = [
  { src: "709507779_1284550667169118_5802521480350702004_n.jpg", code: "wc-01", cols: 2, rows: 4 },
  { src: "708223454_1284550670502451_520889243101667167_n.jpg", code: "wc-02", cols: 2, rows: 4 },
  { src: "708928025_1284550743835777_4228010873554124672_n.jpg", code: "wc-03", cols: 2, rows: 4 },
  { src: "709206442_1284550833835768_669922314325233827_n.jpg", code: "wc-04", cols: 2, rows: 4 },
  { src: "710478857_1284550757169109_3061739242946110677_n.jpg", code: "wc-05", cols: 2, rows: 4 },
  { src: "710478869_1284550800502438_4874945361127345412_n.jpg", code: "wc-06", cols: 2, rows: 4 },
  { src: "wc1.jpg", code: "wc-07", cols: 1, rows: 2 },
];

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  let total = 0;
  for (const sheet of SHEETS) {
    const srcPath = path.join(SRC_DIR, sheet.src);
    const meta = await sharp(srcPath).metadata();
    const cellW = Math.floor(meta.width / sheet.cols);
    const cellH = Math.floor(meta.height / sheet.rows);
    let n = 0;
    for (let r = 0; r < sheet.rows; r++) {
      for (let c = 0; c < sheet.cols; c++) {
        n++;
        const out = path.join(OUT_DIR, `${sheet.code}-${n}.jpg`);
        await sharp(srcPath)
          .extract({ left: c * cellW, top: r * cellH, width: cellW, height: cellH })
          .flatten({ background: "#ffffff" })
          .grayscale()
          .jpeg({ quality: 80, mozjpeg: true })
          .toFile(out);
        total++;
      }
    }
    console.log(`${sheet.code}: cắt ${n} ô (${cellW}x${cellH})`);
  }
  console.log(`Xong — ${total} mặt bằng tại ${OUT_DIR}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
