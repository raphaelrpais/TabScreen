const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const ROOT = path.resolve(__dirname, "..");
const ICON_DIR = path.join(ROOT, "assets", "icons");
const SIZES = [16, 32, 48, 128];

fs.mkdirSync(ICON_DIR, { recursive: true });

for (const size of SIZES) {
  const image = createImage(size, size);
  drawIcon(image, size);
  fs.writeFileSync(path.join(ICON_DIR, `icon-${size}.png`), encodePng(image));
}

function createImage(width, height) {
  return {
    width,
    height,
    data: new Uint8Array(width * height * 4)
  };
}

function drawIcon(image, size) {
  const scale = size / 128;
  const r = (value) => Math.round(value * scale);
  const radius = Math.max(2, r(18));

  clear(image);
  roundedRect(image, r(10), r(18), r(108), r(94), radius, [14, 24, 31, 255]);
  roundedRect(image, r(18), r(28), r(92), r(68), Math.max(1, r(8)), [21, 37, 47, 255]);
  roundedRect(image, r(19), r(29), r(90), r(66), Math.max(1, r(7)), [32, 54, 67, 255]);

  roundedRect(image, r(21), r(10), r(42), r(20), Math.max(1, r(7)), [111, 231, 207, 255]);
  roundedRect(image, r(20), r(17), r(88), r(8), Math.max(1, r(4)), [111, 231, 207, 255]);

  strokeCorner(image, r(30), r(42), r(20), r(20), Math.max(1, r(5)), [246, 244, 238, 255], "tl");
  strokeCorner(image, r(78), r(42), r(20), r(20), Math.max(1, r(5)), [246, 244, 238, 255], "tr");
  strokeCorner(image, r(30), r(72), r(20), r(20), Math.max(1, r(5)), [246, 244, 238, 255], "bl");
  strokeCorner(image, r(78), r(72), r(20), r(20), Math.max(1, r(5)), [246, 244, 238, 255], "br");

  triangle(image, [
    [r(57), r(51)],
    [r(57), r(79)],
    [r(81), r(65)]
  ], [111, 231, 207, 255]);
}

function clear(image) {
  image.data.fill(0);
}

function roundedRect(image, x, y, width, height, radius, color) {
  const x2 = x + width - 1;
  const y2 = y + height - 1;

  for (let py = y; py <= y2; py += 1) {
    for (let px = x; px <= x2; px += 1) {
      const cx = px < x + radius ? x + radius : px > x2 - radius ? x2 - radius : px;
      const cy = py < y + radius ? y + radius : py > y2 - radius ? y2 - radius : py;
      const dx = px - cx;
      const dy = py - cy;

      if (dx * dx + dy * dy <= radius * radius) {
        setPixel(image, px, py, color);
      }
    }
  }
}

function strokeCorner(image, x, y, width, height, thickness, color, corner) {
  const left = x;
  const right = x + width;
  const top = y;
  const bottom = y + height;

  if (corner.includes("t")) {
    rect(image, left, top, width, thickness, color);
  }
  if (corner.includes("b")) {
    rect(image, left, bottom - thickness, width, thickness, color);
  }
  if (corner.includes("l")) {
    rect(image, left, top, thickness, height, color);
  }
  if (corner.includes("r")) {
    rect(image, right - thickness, top, thickness, height, color);
  }
}

function rect(image, x, y, width, height, color) {
  for (let py = y; py < y + height; py += 1) {
    for (let px = x; px < x + width; px += 1) {
      setPixel(image, px, py, color);
    }
  }
}

function triangle(image, points, color) {
  const minX = Math.min(...points.map(([x]) => x));
  const maxX = Math.max(...points.map(([x]) => x));
  const minY = Math.min(...points.map(([, y]) => y));
  const maxY = Math.max(...points.map(([, y]) => y));

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      if (pointInTriangle(x + 0.5, y + 0.5, points)) {
        setPixel(image, x, y, color);
      }
    }
  }
}

function pointInTriangle(px, py, points) {
  const [a, b, c] = points;
  const area = edge(a, b, c);
  const s = edge(a, b, [px, py]) / area;
  const t = edge(b, c, [px, py]) / area;
  const u = edge(c, a, [px, py]) / area;

  return s >= 0 && t >= 0 && u >= 0;
}

function edge(a, b, c) {
  return (c[0] - a[0]) * (b[1] - a[1]) - (c[1] - a[1]) * (b[0] - a[0]);
}

function setPixel(image, x, y, color) {
  if (x < 0 || y < 0 || x >= image.width || y >= image.height) {
    return;
  }

  const index = (y * image.width + x) * 4;
  image.data[index] = color[0];
  image.data[index + 1] = color[1];
  image.data[index + 2] = color[2];
  image.data[index + 3] = color[3];
}

function encodePng(image) {
  const raw = Buffer.alloc((image.width * 4 + 1) * image.height);

  for (let y = 0; y < image.height; y += 1) {
    const rowStart = y * (image.width * 4 + 1);
    raw[rowStart] = 0;

    for (let x = 0; x < image.width; x += 1) {
      const source = (y * image.width + x) * 4;
      const target = rowStart + 1 + x * 4;
      raw[target] = image.data[source];
      raw[target + 1] = image.data[source + 1];
      raw[target + 2] = image.data[source + 2];
      raw[target + 3] = image.data[source + 3];
    }
  }

  const chunks = [
    chunk("IHDR", ihdr(image.width, image.height)),
    chunk("IDAT", zlib.deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0))
  ];

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    ...chunks
  ]);
}

function ihdr(width, height) {
  const data = Buffer.alloc(13);
  data.writeUInt32BE(width, 0);
  data.writeUInt32BE(height, 4);
  data[8] = 8;
  data[9] = 6;
  data[10] = 0;
  data[11] = 0;
  data[12] = 0;
  return data;
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type);
  const length = Buffer.alloc(4);
  const crc = Buffer.alloc(4);

  length.writeUInt32BE(data.length, 0);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);

  return Buffer.concat([length, typeBuffer, data, crc]);
}

function crc32(buffer) {
  let crc = 0xffffffff;

  for (const byte of buffer) {
    crc ^= byte;
    for (let index = 0; index < 8; index += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }

  return (crc ^ 0xffffffff) >>> 0;
}
