/**
 * Xử lý ảnh căn hộ/nhà trọ trong ../thuviennhatro-canho:
 *  - cắt sát mặt bằng (trim viền trắng; vài ảnh có tiêu đề/logo → cắt tay trước)
 *  - chuyển ĐEN TRẮNG (grayscale)
 *  - nén nhẹ → public/library/canho/<code>.jpg
 *
 *   node scripts/build-canho-library.js
 */
const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const SRC_DIR = path.join(__dirname, "..", "..", "thuviennhatro-canho");
const OUT_DIR = path.join(__dirname, "..", "public", "library", "canho");

// pre: vùng cắt tay (loại tiêu đề/logo) trước khi trim — theo % để khỏi phụ thuộc px.
const ITEMS = [
  { src: "a7d1e22f93f0f299c161d06c87c2cd27.jpg", code: "ch-01" },
  { src: "e6241f4b11d86021684939fa346513a8.jpg", code: "ch-02" },
  { src: "6226a154d117ff98e6c222eef8798f22.jpg", code: "ch-03", pre: { top: 0.10, bottom: 0.11 } },
  { src: "b1e754b97f905f8d5f3f9ac8b4e3d7ed.jpg", code: "ch-04", pre: { top: 0.09, bottom: 0.07 } },
  { src: "f6fa9b5396e52608cb8df5e9879d24c9.jpg", code: "ch-05" },
  { src: "05aff724bfd34347be24f0e489709800.jpg", code: "ch-06" },
  { src: "8e8b3c502621b93feabe3353295f2364.jpg", code: "ch-07" },
  { src: "1200ce1b8f4d075281433d5c3aec4a1a.jpg", code: "ch-08" },
  { src: "ac199089f2b248aa590892f2cb57d5bc.jpg", code: "ch-09" },
];

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  for (const it of ITEMS) {
    const srcPath = path.join(SRC_DIR, it.src);
    let img = sharp(srcPath);
    const meta = await img.metadata();

    // Cắt tay bỏ tiêu đề/logo nếu cần.
    if (it.pre) {
      const top = Math.round(meta.height * (it.pre.top ?? 0));
      const bottom = Math.round(meta.height * (it.pre.bottom ?? 0));
      img = sharp(
        await img
          .extract({ left: 0, top, width: meta.width, height: meta.height - top - bottom })
          .toBuffer(),
      );
    }

    const out = path.join(OUT_DIR, `${it.code}.jpg`);
    await img
      .trim({ threshold: 12 }) // cắt sát mép mặt bằng
      .grayscale() // đen trắng
      .resize({ width: 1000, withoutEnlargement: true })
      .jpeg({ quality: 82, mozjpeg: true })
      .toFile(out);

    const m2 = await sharp(out).metadata();
    console.log(`${it.code}: ${m2.width}x${m2.height}`);
  }
  console.log(`Xong tại ${OUT_DIR}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
