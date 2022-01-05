
// @copyright
//   © 2016-2022 Jarosław Foksa
// @license
//   MIT License (check LICENSE.md for details)

import ColorParser from "../classes/color-parser.js";

import {normalize} from "./math.js";

let {min, max, floor, pow, atan2, PI, sqrt} = Math;
let {parseFloat, parseInt} = Number;

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// @type (number, number, number) => [number, number, number]
// @src http://goo.gl/J9ra3
//
// Convert color from RGB to HSL space. R, G and B components on input must be in 0-255 range.
export let rgbToHsl = (r, g, b) => {
  r = r / 255;
  g = g / 255;
  b = b / 255;

  let maxValue = max(r, g, b);
  let minValue = min(r, g, b);

  let h;
  let s;
  let l;

  h = s = l = (maxValue + minValue) / 2;

  if (maxValue === minValue) {
    h = s = 0;
  }
  else {
    let d = maxValue - minValue;

    if (l > 0.5) {
      s = d / (2 - maxValue - minValue);
    }
    else {
      s = d / (maxValue + minValue);
    }

    if (maxValue === r) {
      let z;

      if (g < b) {
        z = 6;
      }
      else {
        z = 0;
      }

      h = (g - b) / d + z;
    }

    else if (maxValue === g) {
      h = (b - r) / d + 2;
    }

    else if (maxValue === b) {
      h = (r - g) / d + 4;
    }
  }

  h = normalize((h / 6) * 360, 0, 360, 0);
  s = normalize(s * 100, 0, 100, 1);
  l = normalize(l * 100, 0, 100, 1);

  return [h, s, l];
};

// @type (number, number, number) => [number, number, number]
// @src http://goo.gl/J9ra3
//
// Convert color from HSL to RGB space. Input H must be in 0-360 range, S and L must be in 0-100 range.
export let hslToRgb = (h, s, l) => {
  h = h / 360;
  s = s / 100;
  l = l / 100;

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

  r = normalize(255 * r, 0, 255, 0);
  g = normalize(255 * g, 0, 255, 0);
  b = normalize(255 * b, 0, 255, 0);

  return [r, g, b];
};

// @type (number, number, number) => [number, number, number]
// @src http://goo.gl/J9ra3
//
// Convert color from RGB to HSV space.
export let rgbToHsv = (r, g, b) => {
  r = r / 255;
  g = g / 255;
  b = b / 255;

  let maxValue = max(r, g, b);
  let minValue = min(r, g, b);

  let h = 0;
  let s = 0;
  let v = maxValue;
  let d = maxValue - minValue;

  if (maxValue === 0) {
    s = 0;
  }
  else {
    s = d / maxValue;
  }

  if (maxValue === minValue) {
    h = 0;
  }
  else {
    if (maxValue === r) {
      h = (g - b) / d + (g < b ? 6 : 0);
    }
    else if (maxValue === g) {
      h = (b - r) / d + 2;
    }
    else if (maxValue === b) {
      h = (r - g) / d + 4;
    }

    h = h / 6;
  }

  h = h * 360;
  s = s * 100;
  v = v * 100;

  return [h, s, v];
};

// @type (number, number, number) => [number, number, number]
// @src http://goo.gl/J9ra3
//
// Convert color from HSV to RGB space.
export let hsvToRgb = (h, s, v) => {
  h = h / 360;
  s = s / 100;
  v = v / 100;

  let i = floor(h * 6);
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

  r = r * 255;
  g = g * 255;
  b = b * 255;

  return [r, g, b];
};

// @type (number, number, number) => [number, number, number]
// @src http://ariya.blogspot.com/2008/07/converting-between-hsl-and-hsv.html
//
// Convert color from HSL to HSV space.
export let hslToHsv = (h, s, l) => {
  h = h / 360;
  s = s / 100;
  l = (l / 100) * 2;

  if (l <= 1) {
    s = s * l;
  }
  else {
    s = s * (2 - l);
  }

  let hh = h;
  let ss;
  let vv;

  if ((l + s) === 0) {
    ss = 0;
  }
  else {
    ss = (2 * s) / (l + s);
  }

  vv = (l + s) / 2;

  hh = 360 * hh;
  ss = max(0, min(1, ss)) * 100;
  vv = max(0, min(1, vv)) * 100;

  return [hh, ss, vv];
};

// @type (number, number, number) => [number, number, number]
// @src http://ariya.blogspot.com/2008/07/converting-between-hsl-and-hsv.html
//
// Convert color from HSV to HSL space.
export let hsvToHsl = (h, s, v) => {
  h = h / 360;
  s = s / 100;
  v = v / 100;

  let hh = h;
  let ll = (2 - s) * v;
  let ss = s * v;

  if (ll <= 1) {
    if (ll === 0) {
      ss = 0;
    }
    else {
      ss = ss / ll;
    }
  }
  else if (ll === 2) {
    ss = 0;
  }
  else {
    ss = ss / (2 - ll);
  }

  ll = ll / 2;

  hh = 360 * hh;
  ss = max(0, min(1, ss)) * 100;
  ll = max(0, min(1, ll)) * 100;

  return [hh, ss, ll];
};

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// @type
//   components = Array<number, number, number, number>
//   inputModel = "rgba" || "hsla" || "hsva"
//   outputFormat = "rgb" || "rgba" || "rgb%" || "rgba%" || "hex" || "hsl" || "hsla"
//   (components, inputModel, outputFormat) => string
export let serializeColor = (components, inputModel = "rgba", outputFormat = "hex") => {
  let string = null;

  // RGB(A) output
  if (["rgb", "rgba", "rgb%", "rgba%", "hex"].includes(outputFormat)) {
    let r;
    let g;
    let b;
    let a;

    if (inputModel === "rgba") {
      [r, g, b, a] = components;
    }
    else if (inputModel === "hsla") {
      [r, g, b] = hslToRgb(...components);
      a = components[3];
    }
    else if (inputModel === "hsva") {
      [r, g, b] = hsvToRgb(...components);
      a = components[3];
    }

    if (outputFormat === "rgb%" || outputFormat === "rgba%") {
      r = normalize((r/255) * 100, 0, 100, 1);
      g = normalize((g/255) * 100, 0, 100, 1);
      b = normalize((b/255) * 100, 0, 100, 1);
      a = normalize(a, 0, 1, 2);
    }
    else {
      r = normalize(r, 0, 255, 0);
      g = normalize(g, 0, 255, 0);
      b = normalize(b, 0, 255, 0);
      a = normalize(a, 0, 1, 2);
    }

    if (outputFormat === "rgb") {
      string = `rgb(${r}, ${g}, ${b})`;
    }
    else if (outputFormat === "rgba") {
      string = `rgba(${r}, ${g}, ${b}, ${a})`;
    }
    else if (outputFormat === "rgb%") {
      string = `rgb(${r}%, ${g}%, ${b}%)`;
    }
    else if (outputFormat === "rgba%") {
      string = `rgb(${r}%, ${g}%, ${b}%, ${a})`;
    }
    else if (outputFormat === "hex") {
      let hexRed   = r.toString(16);
      let hexGreen = g.toString(16);
      let hexBlue  = b.toString(16);

      if (hexRed.length === 1) {
        hexRed = "0" + hexRed;
      }
      if (hexGreen.length === 1) {
        hexGreen = "0" + hexGreen;
      }
      if (hexBlue.length === 1) {
        hexBlue = "0" + hexBlue;
      }

      string = "#" + hexRed + hexGreen + hexBlue;
    }
  }

  // HSL(A) space
  else if (outputFormat === "hsl" || outputFormat === "hsla") {
    let h;
    let s;
    let l;
    let a;

    if (inputModel === "hsla") {
      [h, s, l, a] = components;
    }
    else if (inputModel === "hsva") {
      [h, s, l] = hsvToHsl(...components);
      a = components[3];
    }
    else if (inputModel === "rgba") {
      [h, s, l] = rgbToHsl(...components);
      a = components[3];
    }

    h = normalize(h, 0, 360, 0);
    s = normalize(s, 0, 100, 1);
    l = normalize(l, 0, 100, 1);
    a = normalize(a, 0, 1, 2);

    if (outputFormat === "hsl") {
      string = `hsl(${h}, ${s}%, ${l}%)`;
    }
    else if (outputFormat === "hsla") {
      string = `hsla(${h}, ${s}%, ${l}%, ${a})`;
    }
  }

  return string;
};

// @type (string, "rgb" || "rgba" || "rgb%" || "rgba%" || "hex" || "hsl" || "hsla") => string
export let formatColorString = (colorString, format) => {
  let model = format.startsWith("hsl") ? "hsla" : "rgba";
  let components = new ColorParser().parse(colorString, model);
  let formattedColorString = serializeColor(components, model, format);
  return formattedColorString;
};

// @type (string) => boolean
//
// Check if string represents a valid hex color, e.g. "#fff", "#bada55".
export let isHexColorString = (string) => {
  string = string.toLowerCase();

  if (string[0] !== "#") {
    return false;
  }
  else if (string.length !== 4 && string.length !== 7) {
    return false;
  }
  else {
    string = string.substring(1); // get rid of "#"
  }

  let hexDigits = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "a", "b", "c", "d", "e", "f"];

  for (let digit of string) {
    if (!hexDigits.includes(digit)) {
      return false;
    }
  }

  return true;
};

// @type (string) => boolean
//
// Check if string contains valid CSS3 color, e.g. "blue", "#fff", "rgb(50, 50, 100)".
export let isValidColorString = (string) => {
  try {
    new ColorParser().parse(string);
  }
  catch (error) {
    return false;
  }

  return true;
};

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// @type () => string
//
// Get blob URL for color wheel image (HSV spectrum) used by the color pickers.
export let getColorWheelImageURL = () => {
  return new Promise((resolve) => {
    if (getColorWheelImageURL.url) {
      resolve(getColorWheelImageURL.url);
    }
    else if (getColorWheelImageURL.callbacks) {
      getColorWheelImageURL.callbacks.push(resolve);
    }
    else {
      getColorWheelImageURL.callbacks = [resolve];

      let size = 300;
      let canvas = document.createElement("canvas");
      let context = canvas.getContext("2d");
      let imageData = context.createImageData(size, size);
      let data = imageData.data;
      let radius = size / 2;
      let i = 0;

      canvas.width = size;
      canvas.height = size;

      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          let rx = x - radius;
          let ry = y - radius;
          let d = pow(rx, 2) + pow(ry, 2);

          let h = ((atan2(ry, rx) + PI) / (PI * 2)) * 360;
          let s = (sqrt(d) / radius) * 100;

          let [r, g, b] = hsvToRgb(h, s, 100);
          let a = (d > pow(radius, 2)) ? 0 : 255;

          data[i++] = r;
          data[i++] = g;
          data[i++] = b;
          data[i++] = a;
        }
      }

      context.putImageData(imageData, 0, 0);

      canvas.toBlob((blob) => {
        getColorWheelImageURL.url = URL.createObjectURL(blob);

        for (let callback of getColorWheelImageURL.callbacks) {
          callback(getColorWheelImageURL.url);
        }
      });
    }
  });
}
