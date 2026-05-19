const COLOR_NAME_MAP = {
  black: [0, 0, 0],
  white: [255, 255, 255],
  red: [255, 0, 0],
  green: [0, 128, 0],
  blue: [0, 0, 255],
  yellow: [255, 255, 0],
  magenta: [255, 0, 255],
  fuchsia: [255, 0, 255],
  cyan: [0, 255, 255],
  aqua: [0, 255, 255],
  gray: [128, 128, 128],
  grey: [128, 128, 128],
  lightgray: [211, 211, 211],
  lightgrey: [211, 211, 211],
  darkgray: [169, 169, 169],
  darkgrey: [169, 169, 169],
  navy: [0, 0, 128],
  maroon: [128, 0, 0],
  purple: [128, 0, 128],
  teal: [0, 128, 128],
  olive: [128, 128, 0],
  silver: [192, 192, 192],
  lime: [0, 255, 0],
  lightgreen: [144, 238, 144],
  orange: [255, 165, 0],
  pink: [255, 192, 203],
  brown: [165, 42, 42],
};

function parseHexColor(s) {
  s = s.trim();
  if (!s.startsWith("#")) return null;
  s = s.slice(1);
  if (s.length === 3) {
    return [
      parseInt(s[0] + s[0], 16),
      parseInt(s[1] + s[1], 16),
      parseInt(s[2] + s[2], 16),
    ];
  }
  if (s.length === 6) {
    return [
      parseInt(s.slice(0, 2), 16),
      parseInt(s.slice(2, 4), 16),
      parseInt(s.slice(4, 6), 16),
    ];
  }
  return null;
}

export function rgbFromNameOrHex(colorStr) {
  if (typeof colorStr !== "string") return null;
  const c = colorStr.trim().toLowerCase();
  const hex = parseHexColor(c);
  if (hex !== null) return hex;
  return COLOR_NAME_MAP[c] ?? null;
}

export function pickContrastColorFromRgb(rgb) {
  const [r, g, b] = rgb;
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
  return luminance >= 128 ? "black" : "white";
}

export function pickContrastColor(bgcolor) {
  const rgb = rgbFromNameOrHex(bgcolor);
  if (rgb === null) return "white";
  return pickContrastColorFromRgb(rgb);
}

export function averageRgbFromImageData(imageData) {
  const { data, width, height } = imageData;
  let r = 0;
  let g = 0;
  let b = 0;
  const n = width * height;
  if (n === 0) return [255, 255, 255];
  for (let i = 0; i < data.length; i += 4) {
    r += data[i];
    g += data[i + 1];
    b += data[i + 2];
  }
  return [Math.round(r / n), Math.round(g / n), Math.round(b / n)];
}
