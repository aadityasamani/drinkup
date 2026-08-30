// Wraps the generated icon.png into a Windows .ico container.
// Windows Vista+ accepts PNG-compressed images inside ICO files,
// so we just need the ICONDIR header + ICONDIRENTRY + raw PNG bytes.
const fs = require('fs');
const path = require('path');

const iconsDir = path.join(__dirname, '..', 'src-tauri', 'icons');
const pngPath = path.join(iconsDir, 'icon.png');
const icoPath = path.join(iconsDir, 'icon.ico');

const png = fs.readFileSync(pngPath);

// Read width/height from the PNG IHDR chunk (big-endian, at offsets 16 and 20).
const width = png.readUInt32BE(16);
const height = png.readUInt32BE(20);

// ICONDIR: reserved(2)=0, type(2)=1 (icon), count(2)=1
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(1, 4);

// ICONDIRENTRY (16 bytes)
const entry = Buffer.alloc(16);
entry.writeUInt8(width >= 256 ? 0 : width, 0);   // 0 means 256
entry.writeUInt8(height >= 256 ? 0 : height, 1);
entry.writeUInt8(0, 2);                          // color count (0 = no palette)
entry.writeUInt8(0, 3);                          // reserved
entry.writeUInt16LE(1, 4);                       // color planes
entry.writeUInt16LE(32, 6);                      // bits per pixel
entry.writeUInt32LE(png.length, 8);              // size of image data
entry.writeUInt32LE(22, 12);                     // offset of image data (6 + 16)

fs.writeFileSync(icoPath, Buffer.concat([header, entry, png]));
console.log('wrote', icoPath, `(${width}x${height})`);
