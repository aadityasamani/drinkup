// Generates the tray icon: a small blue water droplet with a shine.
const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

const SIZE = 64;
const png = new PNG({ width: SIZE, height: SIZE });

// Droplet geometry in a 32x32 design space: apex at (16, 2.5),
// bulb is a circle centered at (16, 19) with radius 10.5.
const cx = 16, cy = 19, r = 10.5, apex = 2.5;

function coverage(px, py) {
  const dx = px - cx;
  const d = Math.hypot(dx, py - cy);
  let a = 0;
  if (d <= r) a = Math.min(1, r - d + 0.5);
  if (py < cy) {
    const t = (py - apex) / (cy - apex);
    if (t > 0 && t <= 1) {
      const half = r * Math.sin(t * Math.PI / 2); // convex taper to the apex
      const m = half - Math.abs(dx) + 0.5;
      if (m > 0) a = Math.max(a, Math.min(1, m));
    }
  }
  return Math.max(0, Math.min(1, a));
}

for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    // 2x2 supersampling for smoother edges.
    let a = 0;
    for (const oy of [0.25, 0.75]) {
      for (const ox of [0.25, 0.75]) {
        a += coverage((x + ox) / 2, (y + oy) / 2);
      }
    }
    a = Math.min(1, a / 4 * 2); // average over the 4 samples (in design space)

    const i = (SIZE * y + x) << 2;
    if (a <= 0) { png.data[i + 3] = 0; continue; }

    // Vertical gradient: light blue -> deep blue.
    const t = Math.max(0, Math.min(1, (y / 2 - apex) / (32 - apex)));
    let R = Math.round(124 + (47 - 124) * t);
    let G = Math.round(199 + (143 - 199) * t);
    let B = Math.round(255 + (224 - 255) * t);

    // Shine blob near the upper-left of the bulb.
    const sd = Math.hypot(x / 2 + 0.25 - 11.5, y / 2 + 0.25 - 13);
    if (sd < 3) {
      const k = (1 - sd / 3) * 0.65;
      R = Math.round(R + (255 - R) * k);
      G = Math.round(G + (255 - G) * k);
      B = Math.round(B + (255 - B) * k);
    }

    png.data[i] = R;
    png.data[i + 1] = G;
    png.data[i + 2] = B;
    png.data[i + 3] = Math.round(a * 255);
  }
}

const outDir = path.join(__dirname, '..', 'src-tauri', 'icons');
fs.mkdirSync(outDir, { recursive: true });
const file = path.join(outDir, 'icon.png');
fs.writeFileSync(file, PNG.sync.write(png));
console.log('wrote', file);
