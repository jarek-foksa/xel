
// @copyright
//   © 2016-2025 Jarosław Foksa
// @license
//   MIT License (check LICENSE.md for details)

import ColorSpace from "../node_modules/colorjs.io/src/ColorSpace.js";

import convertColor from "../node_modules/colorjs.io/src/to.js";
import isColorInGamut from "../node_modules/colorjs.io/src/inGamut.js";
import convertColorToGamut from "../node_modules/colorjs.io/src/toGamut.js";
import parseColor from "../node_modules/colorjs.io/src/parse.js";
import serializeColor from "../node_modules/colorjs.io/src/serialize.js";
import {normalize, toPrecision} from "../utils/math.js";

import a98rgb from "../node_modules/colorjs.io/src/spaces/a98rgb.js";
import hsl from "../node_modules/colorjs.io/src/spaces/hsl.js";
import hsluv from "../node_modules/colorjs.io/src/spaces/hsluv.js";
import hsv from "../node_modules/colorjs.io/src/spaces/hsv.js";
import hwb from "../node_modules/colorjs.io/src/spaces/hwb.js";
import lch from "../node_modules/colorjs.io/src/spaces/lch.js";
import lab from "../node_modules/colorjs.io/src/spaces/lab.js";
import okhsv from "../node_modules/colorjs.io/src/spaces/okhsv.js";
import okhsl from "../node_modules/colorjs.io/src/spaces/okhsl.js";
import oklab from "../node_modules/colorjs.io/src/spaces/oklab.js";
import oklch from "../node_modules/colorjs.io/src/spaces/oklch.js";
import p3 from "../node_modules/colorjs.io/src/spaces/p3.js";
import prophoto from "../node_modules/colorjs.io/src/spaces/prophoto.js";
import rec2020 from "../node_modules/colorjs.io/src/spaces/rec2020.js";
import srgb from "../node_modules/colorjs.io/src/spaces/srgb.js";
import srgbLinear from "../node_modules/colorjs.io/src/spaces/srgb-linear.js";
import xyzd50 from "../node_modules/colorjs.io/src/spaces/xyz-d50.js";
import xyzd65 from "../node_modules/colorjs.io/src/spaces/xyz-d65.js";
import xyzabsd65 from "../node_modules/colorjs.io/src/spaces/xyz-abs-d65.js";

let {isNaN} = Number;

ColorSpace.register(a98rgb);
ColorSpace.register(hsl);
ColorSpace.register(hsluv);
ColorSpace.register(hsv);
ColorSpace.register(hwb);
ColorSpace.register(lch);
ColorSpace.register(lab);
ColorSpace.register(okhsv);
ColorSpace.register(okhsl);
ColorSpace.register(oklab);
ColorSpace.register(oklch);
ColorSpace.register(p3);
ColorSpace.register(prophoto);
ColorSpace.register(rec2020);
ColorSpace.register(srgb);
ColorSpace.register(srgbLinear);
ColorSpace.register(xyzd50);
ColorSpace.register(xyzd65);
ColorSpace.register(xyzabsd65);

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// @type
//   format = "hex" || "hsl" || "hwb" || "rgb" || "color" || "oklch" || "oklab" || "lch" || "lab" || "hex-alt" ||
//            "hsl-alt" || "hwb-alt" || "rgb-alt" || "color-alt" || "oklch-alt" || "oklab-alt" || "lch-alt" || "lab-alt"
//   (format) => string
let prettySerializeColor = (color, format = "hex", precision = 3) => {
  if (color.spaceId === undefined) {
    color.spaceId = color.space.id;
  }

  // Hexadecimal, e.g."#bada5580" or "#BADA5580"
  if (format === "hex" || format === "hex-alt") {
    let value = serializeColor(convertColor(color, "srgb"), {format: "hex"});
    return (format === "hex-alt") ? value.toUpperCase() : value;
  }

  // HSL function, e.g. "hsl(74.4deg 64.3% 59.4% / 50%)" or "hsl(74.4 64.3% 59.4% / 0.5)"
  else if (format === "hsl" || format === "hsl-alt") {
    let [h, s, l] = convertColor(color, "hsl").coords;
    let a = color.alpha;

    if (h === null || isNaN(h)) {
      h = 0;
    }

    h = toPrecision(h, precision);
    s = toPrecision(s, precision);
    l = toPrecision(l, precision);

    if (format === "hsl") {
      a = toPrecision(a * 100, precision);
      return (a === 100) ? `hsl(${h}deg ${s}% ${l}%)` : `hsl(${h}deg ${s}% ${l}% / ${a}%)`;
    }
    else if (format === "hsl-alt") {
      a = toPrecision(a, precision);
      return (a === 1) ? `hsl(${h} ${s}% ${l}%)` : `hsl(${h} ${s}% ${l}% / ${a})`;
    }
  }

  // HWB function, e.g. "hwb(74.4deg 33.3% 14.5% / 50%)" or "hwb(74.4 33.3% 14.5% / 0.5)"
  else if (format === "hwb" || format === "hwb-alt") {
    let [h, w, b] = convertColor(color, "hwb").coords;
    let a = color.alpha;

    if (h === null || isNaN(h)) {
      h = 0;
    }

    h = toPrecision(h, precision);
    w = toPrecision(w, precision);
    b = toPrecision(b, precision);

    if (format === "hwb") {
      a = toPrecision(a * 100, precision);
      return (a === 100) ? `hwb(${h}deg ${w}% ${b}%)` : `hwb(${h}deg ${w}% ${b}% / ${a}%)`;
    }
    else if (format === "hwb-alt") {
      a = toPrecision(a, precision);
      return (a === 1) ? `hwb(${h} ${w}% ${b}%)` : `hwb(${h} ${w}% ${b}% / ${a})`;
    }
  }

  // RGB function e.g. "rgb(72.9% 85.5% 33.3% / 50%)" or "rgb(186 218 85 / 0.5)"
  else if (format === "rgb" || format === "rgb-alt") {
    let [r, g, b] = convertColor(color, "srgb").coords;
    let a = color.alpha;

    if (format === "rgb") {
      r = toPrecision(r * 100, precision);
      g = toPrecision(g * 100, precision);
      b = toPrecision(b * 100, precision);
      a = toPrecision(a * 100, precision);

      return (a === 100) ? `rgb(${r}% ${g}% ${b}%)` : `rgb(${r}% ${g}% ${b}% / ${a}%)`
    }
    else if (format === "rgb-alt") {
      r = toPrecision(r * 255, precision);
      g = toPrecision(g * 255, precision);
      b = toPrecision(b * 255, precision);
      a = toPrecision(a, precision);

      return (a === 1) ? `rgb(${r} ${g} ${b})` : `rgb(${r} ${g} ${b} / ${a})`;
    }
  }

  // Color function e.g. "color(srgb 72.9% 85.5% 33.3% / 50.2%)" or  "color(srgb 0.73 0.85 0.33 / 0.5)"
  else if (format === "color" || format === "color-alt") {
    if (["srgb", "srgb-linear", "a98rgb", "prophoto", "p3", "rec2020", "hsl", "hwb"].includes(color.spaceId)) {
      if (color.spaceId === "hsl" || color.spaceId === "hwb") {
        color = convertColor(color, "srgb");

        if (color.spaceId === undefined) {
          color.spaceId = color.space.id;
        }
      }

      let [r, g, b] = color.coords;
      let a = color.alpha;
      let space = normalizeColorSpaceName(color.spaceId, "css");

      if (format === "color") {
        r = toPrecision(r * 100, precision);
        g = toPrecision(g * 100, precision);
        b = toPrecision(b * 100, precision);
        a = toPrecision(a * 100, precision);

        return (a === 100) ? `color(${space} ${r}% ${g}% ${b}%)` : `color(${space} ${r}% ${g}% ${b}% / ${a}%)`;
      }
      else if (format === "color-alt") {
        r = toPrecision(r, precision);
        g = toPrecision(g, precision);
        b = toPrecision(b, precision);
        a = toPrecision(a, precision);

        return (a === 1) ? `color(${space} ${r} ${g} ${b})` : `color(${space} ${r} ${g} ${b} / ${a})`;
      }
    }
    else if (["xyz", "xyz-d50", "xyz-d65"].includes(color.spaceId)) {
      let [x, y, z] = color.coords;
      let a = color.alpha;
      let space = color.spaceId;

      if (format === "color") {
        x = toPrecision(x * 100, precision);
        y = toPrecision(y * 100, precision);
        z = toPrecision(z * 100, precision);
        a = toPrecision(a * 100, precision);

        if (space === "xyz") {
          space = "xyz-d65";
        }

        return (a === 100) ? `color(${space} ${x}% ${y}% ${z}%)` : `color(${space} ${x}% ${y}% ${z}% / ${a}%)`;
      }
      else if (format === "color-alt") {
        x = toPrecision(x, precision);
        y = toPrecision(y, precision);
        z = toPrecision(z, precision);
        a = toPrecision(a, precision);

        if (space === "xyz-d65") {
          space = "xyz";
        }

        return (a === 1) ? `color(${space} ${x} ${y} ${z})` : `color(${space} ${x} ${y} ${z} / ${a})`;
      }
    }
    else {
      throw new Error(`"Color in "${color.spaceId}" space can't be serialized to "${format}" format.`);
    }
  }

  // OKLCH function, e.g. "oklch(84% 40% 121deg / 50%)" or "oklch(0.84 0.16 121 / 0.5)"
  else if (format === "oklch" || format === "oklch-alt") {
    let [l, c, h] = convertColor(color, "oklch").coords;
    let a = color.alpha;

    if (format === "oklch") {
      l = toPrecision(l * 100, precision);
      c = toPrecision((c / 0.4) * 100, precision);
      h = toPrecision(h, precision);
      a = toPrecision(a * 100, precision);

      return (a === 100) ? `oklch(${l}% ${c}% ${h}deg)` : `oklch(${l}% ${c}% ${h}deg / ${a}%)`;
    }
    else if (format === "oklch-alt") {
      l = toPrecision(l, precision);
      c = toPrecision(c, precision);
      h = toPrecision(h, precision);
      a = toPrecision(a, precision);

      return (a === 1) ? `oklch(${l} ${c} ${h})` : `oklch(${l} ${c} ${h} / ${a})`;
    }
  }

  // OKLab function, e.g. "oklab(84% -25% 35% / 50%)" or "oklab(0.84 -0.1 0.14 / 0.5)"
  else if (format === "oklab" || format === "oklab-alt") {
    let [l, a, b] = convertColor(color, "oklab").coords;
    let alpha = color.alpha;

    if (format === "oklab") {
      l = toPrecision(l * 100, precision);
      a = toPrecision((a / 0.4) * 100, precision);
      b = toPrecision((b / 0.4) * 100, precision);
      alpha = toPrecision(alpha * 100, precision);

      return (alpha === 100) ? `oklab(${l}% ${a}% ${b}%)` : `oklab(${l}% ${a}% ${b}% / ${alpha}%)`;
    }
    else if (format === "oklab-alt") {
      l = toPrecision(l, precision);
      a = toPrecision(a, precision);
      b = toPrecision(b, precision);
      alpha = toPrecision(alpha, precision);

      return (alpha === 1) ? `oklab(${l} ${a} ${b})` : `oklab(${l} ${a} ${b} / ${alpha})`;
    }
  }

  // LCH function, e.g. "lch(82.8% 43.1% 113deg / 50%)" or "lch(82.8 64.7 113 / 0.5)"
  else if (format === "lch" || format === "lch-alt") {
    let [l, c, h] = convertColor(color, "lch").coords;
    let a = color.alpha;

    if (format === "lch") {
      l = toPrecision(l, precision);
      c = toPrecision((c / 150) * 100, precision);
      h = toPrecision(h, precision);
      a = toPrecision(a * 100, precision);

      return (a === 100) ? `lch(${l}% ${c}% ${h}deg)` : `lch(${l}% ${c}% ${h}deg / ${a}%)`;
    }
    else if (format === "lch-alt") {
      l = toPrecision(l, precision);
      c = toPrecision(c, precision);
      h = toPrecision(h, precision);
      a = toPrecision(a, precision);

      return (a === 1) ? `lch(${l} ${c} ${h})` : `lch(${l} ${c} ${h} / ${a})`;
    }
  }

  // Lab function, e.g. "lab(84% -25% 35% / 50%)" or "lab(0.84 -0.1 0.14 / 0.5)"
  else if (format === "lab" || format === "lab-alt") {
    let [l, a, b] = convertColor(color, "lab").coords;
    let alpha = color.alpha;

    if (format === "lab") {
      l = toPrecision(l, precision);
      a = toPrecision((a / 125) * 100, precision);
      b = toPrecision((b / 125) * 100, precision);
      alpha = toPrecision(alpha * 100, precision);

      return (alpha === 100) ? `lab(${l}% ${a}% ${b}%)` : `lab(${l}% ${a}% ${b}% / ${alpha}%)`;
    }
    else if (format === "lab-alt") {
      l = toPrecision(l, precision);
      a = toPrecision(a, precision);
      b = toPrecision(b, precision);
      alpha = toPrecision(alpha, precision);

      return (alpha === 1) ? `lab(${l} ${a} ${b})` : `lab(${l} ${a} ${b} / ${alpha})`;
    }
  }

  else {
    throw new Error(`Unknown color format "${format}".`);
  }
};

// @type (string, "css" || "color.js") => string
let normalizeColorSpaceName = (space, format = "css") => {
  if (format === "css") {
    if (space === "p3") {
      space = "display-p3";
    }
    else if (space === "a98rgb") {
      space = "a98-rgb";
    }
    else if (space === "prophoto") {
      space = "prophoto-rgb";
    }
  }
  else if (format === "color.js") {
    if (space === "display-p3") {
      space = "p3";
    }
    else if (space === "a98-rgb") {
      space = "a98rgb";
    }
    else if (space === "prophoto-rgb") {
      space = "prophoto";
    }
  }

  if (space === "xyz") {
    space = "xyz-d65";
  }

  return space;
};

// @src http://goo.gl/J9ra3
// @type (number, number, number) => [number, number, number]
//
// Perform fast conversion from HSV to RGB color model.
// All numbers are in 0-1 range.
let hsvToRgb = (h, s, v) => {
  let i = Math.floor(h * 6);
  let f = (h * 6) - i;
  let p = v * (1 - s);
  let q = v * (1 - (f * s));
  let t = v * (1 - (1 - f) * s);

  let r = 0;
  let g = 0;
  let b = 0;

  if (i % 6 === 0) {
    r = v;
    g = t;
    b = p;
  }
  else if (i % 6 === 1) {
    r = q;
    g = v;
    b = p;
  }
  else if (i % 6 === 2) {
    r = p;
    g = v;
    b = t;
  }
  else if (i % 6 === 3) {
    r = p;
    g = q;
    b = v;
  }
  else if (i % 6 === 4) {
    r = t;
    g = p;
    b = v;
  }
  else if (i % 6 === 5) {
    r = v;
    g = p;
    b = q;
  }

  return [r, g, b];
};

// @src https://drafts.csswg.org/css-color/#hwb-to-rgb
// @type (number, number, number) => [number, number, number]
//
// Perform fast conversion from HWB to RGB color model.
// All numbers are in 0-1 range.
let hwbToRgb = (hue, white, black) => {
    if (white + black >= 1) {
      let gray = white / (white + black);
      return [gray, gray, gray];
    }

    let rgb = hslToRgb(hue, 1, 0.5);

    for (let i = 0; i < 3; i++) {
      rgb[i] *= (1 - white - black);
      rgb[i] += white;
    }

    return rgb;
};

// @src http://goo.gl/J9ra3
// @type (number, number, number) => [number, number, number]
//
// Perform fast conversion from HSL to RGB color model.
// All numbers are in 0-1 range.
let hslToRgb = (h, s, l) => {
  let r;
  let g;
  let b;

  if (s === 0) {
    r = g = b = l;
  }
  else {
    let hue2rgb = (p, q, t) => {
      if (t < 0) {
        t += 1;
      }
      if (t > 1) {
        t -= 1;
      }
      if (t < 1/6) {
        return p + (q - p) * 6 * t;
      }
      if (t < 1/2) {
        return q;
      }
      if (t < 2/3) {
        return p + (q - p) * (2/3 - t) * 6;
      }

      return p;
    };

    let q;
    let p;

    if (l < 0.5) {
      q = l * (1 + s);
    }
    else {
      q = l + s - l * s;
    }

    p = 2 * l - q;

    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }

  return [r, g, b];
};

// @type (string) => boolean
//
// Check if string contains valid CSS3 color, e.g. "blue", "#fff", "rgb(50, 50, 100)".
let isValidColorString = (string) => {
  try {
    parseColor(string);
  }
  catch (error) {
    return false;
  }

  return true;
};

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export {
  parseColor,
  convertColor,
  convertColorToGamut,
  serializeColor,
  prettySerializeColor,
  normalizeColorSpaceName,
  hsvToRgb,
  hwbToRgb,
  hslToRgb,
  isColorInGamut,
  isValidColorString
};
