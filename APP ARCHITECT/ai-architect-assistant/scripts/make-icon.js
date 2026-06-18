const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const SRC = path.join(__dirname, "..", "public", "images", "logoiconhinhtron.png");
const OUT_DIR = path.join(__dirname, "..", "build");
const OUT = path.join(OUT_DIR, "icon.ico");
const SIZES = [16, 32, 48, 64, 128, 256];

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const pngBuffers = await Promise.all(
    SIZES.map((size) =>
      sharp(SRC)
        .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer()
    )
  );

  const headerSize = 6 + 16 * SIZES.length;
  let offset = headerSize;
  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(SIZES.length, 4); // image count

  SIZES.forEach((size, i) => {
    const entryOffset = 6 + i * 16;
    const buf = pngBuffers[i];
    header.writeUInt8(size === 256 ? 0 : size, entryOffset + 0); // width
    header.writeUInt8(size === 256 ? 0 : size, entryOffset + 1); // height
    header.writeUInt8(0, entryOffset + 2); // color count
    header.writeUInt8(0, entryOffset + 3); // reserved
    header.writeUInt16LE(1, entryOffset + 4); // planes
    header.writeUInt16LE(32, entryOffset + 6); // bit count
    header.writeUInt32LE(buf.length, entryOffset + 8); // bytes in resource
    header.writeUInt32LE(offset, entryOffset + 12); // image offset
    offset += buf.length;
  });

  fs.writeFileSync(OUT, Buffer.concat([header, ...pngBuffers]));
  console.log("Icon written to", OUT);
}

main();
