
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
import hct from "../node_modules/colorjs.io/src/spaces/hct.js";
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
ColorSpace.register(hct);
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

// @src: https://github.com/material-components/material-components-android/blob/master/docs/theming/Color.md
// @src: https://android.googlesource.com/platform/frameworks/support/+/refs/heads/androidx-main/compose/material3/material3/src/androidMain/kotlin/androidx/compose/material3/DynamicTonalPalette.android.kt
const MATERIAL_COLORS = [
  // Color name                  Light [palette, tone]   Dark [palette, tone]
  ["primary",                    ["primary",        40], ["primary",        80]],
  ["on-primary",                 ["greyscale",     100], ["primary",        20]],
  ["primary-container",          ["primary",        90], ["primary",        30]],
  ["on-primary-container",       ["primary",        10], ["primary",        90]],
  ["primary-inverse",            ["primary",        80], ["primary",        40]],
  ["primary-fixed",              ["primary",        90], ["primary",        90]],
  ["primary-fixed-dim",          ["primary",        80], ["primary",        80]],
  ["on-primary-fixed",           ["primary",        10], ["primary",        10]],
  ["on-primary-fixed-variant",   ["primary",        30], ["primary",        30]],
  ["secondary",                  ["secondary",      40], ["secondary",      80]],
  ["on-secondary",               ["greyscale",     100], ["secondary",      20]],
  ["secondary-container",        ["secondary",      90], ["secondary",      30]],
  ["on-secondary-container",     ["secondary",      10], ["secondary",      90]],
  ["secondary-fixed",            ["secondary",      90], ["secondary",      90]],
  ["secondary-fixed-dim",        ["secondary",      80], ["secondary",      80]],
  ["on-secondary-fixed",         ["secondary",      10], ["secondary",      10]],
  ["on-secondary-fixed-variant", ["secondary",      30], ["secondary",      30]],
  ["tertiary",                   ["tertiary",       40], ["tertiary",       80]],
  ["on-tertiary",                ["greyscale",     100], ["tertiary",       20]],
  ["tertiary-container",         ["tertiary",       90], ["tertiary",       30]],
  ["on-tertiary-container",      ["tertiary",       10], ["tertiary",       90]],
  ["tertiary-fixed",             ["tertiary",       90], ["tertiary",       90]],
  ["tertiary-fixed-dim",         ["tertiary",       80], ["tertiary",       80]],
  ["on-tertiary-fixed",          ["tertiary",       10], ["tertiary",       10]],
  ["on-tertiary-fixed-variant",  ["tertiary",       30], ["tertiary",       30]],
  ["error",                      ["error",          40], ["error",          80]],
  ["on-error",                   ["greyscale",     100], ["error",          20]],
  ["error-container",            ["error",          90], ["error",          30]],
  ["on-error-container",         ["error",          10], ["error",          90]],
  ["outline",                    ["neutralVariant", 50], ["neutralVariant", 60]],
  ["outline-variant",            ["neutralVariant", 80], ["neutralVariant", 30]],
  ["background",                 ["neutral",        98], ["neutral",         6]],
  ["on-background",              ["neutral",        10], ["neutral",        90]],
  ["surface",                    ["neutral",        98], ["neutral",         6]],
  ["on-surface",                 ["neutral",        10], ["neutral",        90]],
  ["surface-variant",            ["neutralVariant", 90], ["neutralVariant", 30]],
  ["on-surface-variant",         ["neutralVariant", 30], ["neutralVariant", 80]],
  ["surface-inverse",            ["neutral",        20], ["neutral",        90]],
  ["on-surface-inverse",         ["neutral",        95], ["neutral",        20]],
  ["surface-bright",             ["neutral",        98], ["neutral",        24]],
  ["surface-dim",                ["neutral",        87], ["neutral",         6]],
  ["surface-container",          ["neutral",        94], ["neutral",        12]],
  ["surface-container-low",      ["neutral",        96], ["neutral",        10]],
  ["surface-container-lowest",   ["greyscale",     100], ["neutral",         4]],
  ["surface-container-high",     ["neutral",        92], ["neutral",        17]],
  ["surface-container-highest",  ["neutral",        90], ["neutral",        22]],
  ["scrim",                      ["greyscale",       0], ["greyscale",        0]],
];

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// @doc
//   https://medium.com/@iam_riyas/f490ef2fdee5
//   https://m3.material.io/styles/color/system/how-the-system-works
//   https://material-foundation.github.io/material-theme-builder/
// @type
//   (string, boolean) => Object
export let getMaterialCSSColorVariables = (serializedAccentColor, dark = false, grayscale = false) => {
  let accentColor = convertColor(parseColor(serializedAccentColor), "hct");
  let materialColors = {};

  for (let colorDesc of MATERIAL_COLORS) {
    let [palette, tone] = dark ? colorDesc[2] : colorDesc[1];
    let [h, c, t] = accentColor.coords;

    if (grayscale) {
      palette = "greyscale";
    }

    if (palette === "primary") {
      c = Math.max(48, c);
      t = tone;
    }
    else if (palette === "secondary") {
      c = 16;
      t = tone;
    }
    else if (palette === "tertiary") {
      h += 60;
      c = 24;
      t = tone;
    }
    else if (palette === "neutral") {
      c = 4;
      t = tone;
    }
    else if (palette === "neutralVariant") {
      c = 8;
      t = tone;
    }
    else if (palette === "error") {
      h = 25;
      c = 84;
      t = tone;
    }
    else if (palette === "greyscale") {
      h = 0;
      c = 0;
      t = tone;
    }

    let color = convertColor({space: "hct", coords: [h, c, t]}, "oklch");
    materialColors[`--material-${colorDesc[0]}-color`] = serializeColor(color, "oklch");
  }

  return materialColors;
};

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
  isColorInGamut,
  isValidColorString
};
