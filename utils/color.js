
// @copyright
//   © 2016-2017 Jarosław Foksa

"use strict";

{
  let {normalize, round} = Xel.utils.math;
  let {min, max, floor} = Math;
  let {parseFloat, parseInt} = Number;

  // @info
  //   A list of named colors and their corresponding RGB values.
  // @doc
  //   http://www.w3.org/TR/css3-color/#svg-color
  let namedColors = {
                          // R,   G,   B
    aliceblue:            [240, 248, 255],
    antiquewhite:         [250, 235, 215],
    aqua:                 [  0, 255, 255],
    aquamarine:           [127, 255, 212],
    azure:                [240, 255, 255],
    beige:                [245, 245, 220],
    bisque:               [255, 228, 196],
    black:                [  0,   0   ,0],
    blanchedalmond:       [255, 235, 205],
    blue:                 [  0,   0, 255],
    blueviolet:           [138,  43, 226],
    brown:                [165,  42,  42],
    burlywood:            [222, 184, 135],
    cadetblue:            [ 95, 158, 160],
    chartreuse:           [127, 255,   0],
    chocolate:            [210, 105,  30],
    coral:                [255, 127,  80],
    cornflowerblue:       [100, 149, 237],
    cornsilk:             [255, 248, 220],
    crimson:              [220,  20,  60],
    cyan:                 [  0, 255, 255],
    darkblue:             [  0,   0, 139],
    darkcyan:             [  0, 139, 139],
    darkgoldenrod:        [184, 134,  11],
    darkgray:             [169, 169, 169],
    darkgreen:            [  0, 100,   0],
    darkgrey:             [169, 169, 169],
    darkkhaki:            [189, 183, 107],
    darkmagenta:          [139,   0, 139],
    darkolivegreen:       [ 85, 107,  47],
    darkorange:           [255, 140,   0],
    darkorchid:           [153,  50, 204],
    darkred:              [139,   0,   0],
    darksalmon:           [233, 150, 122],
    darkseagreen:         [143, 188, 143],
    darkslateblue:        [ 72,  61, 139],
    darkslategray:        [ 47,  79,  79],
    darkslategrey:        [ 47,  79,  79],
    darkturquoise:        [  0, 206, 209],
    darkviolet:           [148,   0, 211],
    deeppink:             [255,  20, 147],
    deepskyblue:          [  0, 191, 255],
    dimgray:              [105, 105, 105],
    dimgrey:              [105, 105, 105],
    dodgerblue:           [ 30, 144, 255],
    firebrick:            [178,  34,  34],
    floralwhite:          [255, 250, 240],
    forestgreen:          [ 34, 139,  34],
    fuchsia:              [255,   0, 255],
    gainsboro:            [220, 220, 220],
    ghostwhite:           [248, 248, 255],
    gold:                 [255, 215,   0],
    goldenrod:            [218, 165,  32],
    gray:                 [128, 128, 128],
    green:                [  0, 128,   0],
    greenyellow:          [173, 255,  47],
    grey:                 [128, 128, 128],
    honeydew:             [240, 255, 240],
    hotpink:              [255, 105, 180],
    indianred:            [205,  92,  92],
    indigo:               [ 75,   0, 130],
    ivory:                [255, 255, 240],
    khaki:                [240, 230, 140],
    lavender:             [230, 230, 250],
    lavenderblush:        [255, 240, 245],
    lawngreen:            [124, 252,   0],
    lemonchiffon:         [255, 250, 205],
    lightblue:            [173, 216, 230],
    lightcoral:           [240, 128, 128],
    lightcyan:            [224, 255, 255],
    lightgoldenrodyellow: [250, 250, 210],
    lightgray:            [211, 211, 211],
    lightgreen:           [144, 238, 144],
    lightgrey:            [211, 211, 211],
    lightpink:            [255, 182, 193],
    lightsalmon:          [255, 160, 122],
    lightseagreen:        [32,  178, 170],
    lightskyblue:         [135, 206, 250],
    lightslategray:       [119, 136, 153],
    lightslategrey:       [119, 136, 153],
    lightsteelblue:       [176, 196, 222],
    lightyellow:          [255, 255, 224],
    lime:                 [  0, 255,   0],
    limegreen:            [ 50, 205,  50],
    linen:                [250, 240, 230],
    magenta:              [255,   0 ,255],
    maroon:               [128,   0,   0],
    mediumaquamarine:     [102, 205, 170],
    mediumblue:           [  0,   0, 205],
    mediumorchid:         [186,  85, 211],
    mediumpurple:         [147, 112, 219],
    mediumseagreen:       [ 60, 179, 113],
    mediumslateblue:      [123, 104, 238],
    mediumspringgreen:    [  0, 250, 154],
    mediumturquoise:      [ 72, 209, 204],
    mediumvioletred:      [199,  21, 133],
    midnightblue:         [ 25,  25, 112],
    mintcream:            [245, 255, 250],
    mistyrose:            [255, 228, 225],
    moccasin:             [255, 228, 181],
    navajowhite:          [255, 222, 173],
    navy:                 [  0,   0, 128],
    oldlace:              [253, 245, 230],
    olive:                [128, 128,   0],
    olivedrab:            [107, 142,  35],
    orange:               [255, 165,   0],
    orangered:            [255,  69,   0],
    orchid:               [218, 112, 214],
    palegoldenrod:        [238, 232, 170],
    palegreen:            [152, 251, 152],
    paleturquoise:        [175, 238, 238],
    palevioletred:        [219, 112, 147],
    papayawhip:           [255, 239, 213],
    peachpuff:            [255, 218, 185],
    peru:                 [205, 133,  63],
    pink:                 [255, 192, 203],
    plum:                 [221, 160, 221],
    powderblue:           [176, 224, 230],
    purple:               [128,   0, 128],
    red:                  [255,   0,   0],
    rosybrown:            [188, 143, 143],
    royalblue:            [ 65, 105, 225],
    saddlebrown:          [139,  69,  19],
    salmon:               [250, 128, 114],
    sandybrown:           [244, 164,  96],
    seagreen:             [46,  139,  87],
    seashell:             [255, 245, 238],
    sienna:               [160,  82,  45],
    silver:               [192, 192, 192],
    skyblue:              [135, 206, 235],
    slateblue:            [106,  90, 205],
    slategray:            [112, 128, 144],
    slategrey:            [112, 128, 144],
    snow:                 [255, 250, 250],
    springgreen:          [  0, 255, 127],
    steelblue:            [ 70, 130, 180],
    tan:                  [210, 180, 140],
    teal:                 [  0, 128, 128],
    thistle:              [216, 191, 216],
    tomato:               [255,  99,  71],
    turquoise:            [ 64, 224, 208],
    violet:               [238, 130, 238],
    wheat:                [245, 222, 179],
    white:                [255, 255, 255],
    whitesmoke:           [245, 245, 245],
    yellow:               [255, 255,   0],
    yellowgreen:          [154, 205,  50]
  };

  // @info
  //   Convert color from RGB to HSL space. R, G and B components on input must be in 0-255 range.
  // @src
  //   http://goo.gl/J9ra3
  // @type
  //   (number, number, number) => [number, number, number]
  let rgbToHsl = (r, g, b) => {
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

  // @info
  //   Convert color from HSL to RGB space. Input H must be in 0-360 range, S and L must be in
  //   0-100 range.
  // @src
  //   http://goo.gl/J9ra3
  // @type
  //   (number, number, number) => [number, number, number]
  let hslToRgb = (h, s, l) => {
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

  // @info
  //   Convert color from RGB to HSV space.
  // @src
  //   http://goo.gl/J9ra3
  // @type
  //   (number, number, number) => [number, number, number]
  let rgbToHsv = (r, g, b) => {
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

  // @info
  //   Convert color from HSV to RGB space.
  // @src
  //   http://goo.gl/J9ra3
  // @type
  //   (number, number, number) => [number, number, number]
  let hsvToRgb = (h, s, v) => {
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

  // @info
  //   Convert color from HSL to HSV space.
  // @src
  //   http://ariya.blogspot.com/2008/07/converting-between-hsl-and-hsv.html
  // @type
  //   (number, number, number) => [number, number, number]
  let hslToHsv = (h, s, l) => {
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

  // @info
  //   Convert color from HSV to HSL space.
  // @src
  //   http://ariya.blogspot.com/2008/07/converting-between-hsl-and-hsv.html
  // @type
  //   (number, number, number) => [number, number, number]
  let hsvToHsl = (h, s, v) => {
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

  // @info
  //   Parse given CSS color string into corresponding RGBA, HSLA or HSVA components.
  // @type
  //   outputModel = "rgba" || "hsla" || "hsva"
  //   components = Array<number, number, number, number>
  //   (string, outputModel) => components
  let parseColor = (colorString, outputModel = "rgba") => {
    colorString = colorString.trim();

    let tokens = tokenizeColor(colorString);
    let rgbaComponents = null;
    let hslaComponents = null;

    // RGB, e.g. rgb(100, 100, 100)

    if (
      tokens.length === 7 &&
      tokens[0].text === "rgb(" &&
      tokens[1].type === "NUM" &&
      tokens[2].text === "," &&
      tokens[3].type === "NUM" &&
      tokens[4].text === "," &&
      tokens[5].type === "NUM" &&
      tokens[6].text === ")"
    ) {
      rgbaComponents = [
        parseFloat(tokens[1].text),
        parseFloat(tokens[3].text),
        parseFloat(tokens[5].text),
        1,
      ];
    }

    // RGB with percentages, e.g. rgb(50%, 50%, 50%)

    else if (
      tokens.length === 7 &&
      tokens[0].text === "rgb(" &&
      tokens[1].type === "PERCENTAGE" &&
      tokens[2].text === "," &&
      tokens[3].type === "PERCENTAGE" &&
      tokens[4].text === "," &&
      tokens[5].type === "PERCENTAGE" &&
      tokens[6].text === ")"
    ) {
      rgbaComponents = [
        (parseFloat(tokens[1].text)/100) * 255,
        (parseFloat(tokens[3].text)/100) * 255,
        (parseFloat(tokens[5].text)/100) * 255,
        1,
      ];
    }

    // RGBA, e.g. rgba(100, 100, 100, 0.5)

    else if (
      tokens.length === 9 &&
      tokens[0].text === "rgba(" &&
      tokens[1].type === "NUM" &&
      tokens[2].text === "," &&
      tokens[3].type === "NUM" &&
      tokens[4].text === "," &&
      tokens[5].type === "NUM" &&
      tokens[6].text === "," &&
      tokens[7].type === "NUM" &&
      tokens[8].text === ")"
    ) {
      rgbaComponents = [
        parseFloat(tokens[1].text),
        parseFloat(tokens[3].text),
        parseFloat(tokens[5].text),
        parseFloat(tokens[7].text),
      ];
    }

    // RGBA with percentages, e.g. rgba(50%, 50%, 50%, 0.5)

    else if (
      tokens.length === 9 &&
      tokens[0].text === "rgb(" &&
      tokens[1].type === "PERCENTAGE" &&
      tokens[2].text === "," &&
      tokens[3].type === "PERCENTAGE" &&
      tokens[4].text === "," &&
      tokens[5].type === "PERCENTAGE" &&
      tokens[6].text === ","&&
      tokens[7].type === "NUM" &&
      tokens[8].text === ")"
    ) {
      rgbaComponents = [
        (parseFloat(tokens[1].text)/100) * 255,
        (parseFloat(tokens[3].text)/100) * 255,
        (parseFloat(tokens[5].text)/100) * 255,
        parseFloat(tokens[7].text),
      ];
    }

    // HSL, e.g. hsl(360, 100%, 100%)

    else if (
      tokens.length === 7 &&
      tokens[0].text === "hsl(" &&
      tokens[1].type === "NUM" &&
      tokens[2].text === "," &&
      tokens[3].type === "PERCENTAGE" &&
      tokens[4].text === "," &&
      tokens[5].type === "PERCENTAGE" &&
      tokens[6].text === ")"
    ) {
      hslaComponents = [
        parseFloat(tokens[1].text),
        parseFloat(tokens[3].text),
        parseFloat(tokens[5].text),
        1,
      ];
    }

    // HSLA, e.g. hsla(360, 100%, 100%, 1)

    else if (
      tokens.length === 9 &&
      tokens[0].text === "hsla(" &&
      tokens[1].type === "NUM" &&
      tokens[2].text === "," &&
      tokens[3].type === "PERCENTAGE" &&
      tokens[4].text === "," &&
      tokens[5].type === "PERCENTAGE" &&
      tokens[6].text === "," &&
      tokens[7].type === "NUM" &&
      tokens[8].text === ")"
    ) {
      hslaComponents = [
        parseFloat(tokens[1].text),
        parseFloat(tokens[3].text),
        parseFloat(tokens[5].text),
        parseFloat(tokens[7].text),
      ];
    }

    // HEX, e.g. "#fff"

    else if (tokens[0].type === "HEX" && tokens[1] === undefined) {
      let hexString = tokens[0].text.substring(1); // get rid of leading "#"

      let hexRed;
      let hexGreen;
      let hexBlue;

      if (hexString.length === 3) {
        hexRed   = hexString[0] + hexString[0];
        hexGreen = hexString[1] + hexString[1];
        hexBlue  = hexString[2] + hexString[2];
      }
      else {
        hexRed   = hexString[0] + hexString[1];
        hexGreen = hexString[2] + hexString[3];
        hexBlue  = hexString[4] + hexString[5];
      }

      rgbaComponents = [
        parseInt(hexRed, 16),
        parseInt(hexGreen, 16),
        parseInt(hexBlue, 16),
        1,
      ];
    }

    // Named color, e.g. "white"

    else if (namedColors[colorString]) {
      rgbaComponents = [
        namedColors[colorString][0],
        namedColors[colorString][1],
        namedColors[colorString][2],
        1,
      ];
    }

    // Finalize

    if (rgbaComponents) {
      let [r, g, b, a] = rgbaComponents;

      r = normalize(r, 0, 255, 0);
      g = normalize(g, 0, 255, 0);
      b = normalize(b, 0, 255, 0);
      a = normalize(a, 0, 1, 2);

      if (outputModel === "hsla") {
        let [h, s, l] = rgbToHsl(r, g, b);
        return [h, s, l, a];
      }
      else if (outputModel === "hsva") {
        let [h, s, v] = rgbToHsv(r, g, b);
        return [h, s, v, a];
      }
      else {
        return [r, g, b, a];
      }
    }
    else if (hslaComponents) {
      let [h, s, l, a] = hslaComponents;

      h = normalize(h, 0, 360, 0);
      s = normalize(s, 0, 100, 1);
      l = normalize(l, 0, 100, 1);
      a = normalize(a, 0, 1, 2);

      if (outputModel === "hsla") {
        return [h, s, l, a];
      }
      else if (outputModel === "hsva") {
        let [hh, ss, vv] = hslToHsv(h, s, l);
        return [hh, ss, vv, a];
      }
      else {
        let [r, g, b] = hslToRgb(h, s, l);
        return [r, g, b, a];
      }
    }
    else {
      throw new Error(`Invalid color string: "${colorString}"`);
      return null;
    }
  }

  // @type
  //   components = Array<number, number, number, number>
  //   inputModel = "rgba" || "hsla" || "hsva"
  //   outputFormat = "rgb" || "rgba" || "rgb%" || "rgba%" || "hex" || "hsl" || "hsla"
  //   (components, inputModel, outputFormat) => string
  let serializeColor = (components, inputModel = "rgba", outputFormat = "hex") => {
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

  // @info
  //   Convert CSS color string into an array of tokens.
  //   -----------------------------------
  //   Token type    Sample token text
  //   -----------------------------------
  //   "FUNCTION"    "rgb(", "hsla("
  //   "HEX"         "#000", "#bada55"
  //   "NUMBER"      "100", ".2", "10.3234"
  //   "PERCENTAGE"  "100%", "0.2%"
  //   "CHAR"        ")", ","
  // @type
  //   type Token = {type: string, text: string}
  //   (string) => Array<Token>
  let tokenizeColor = (cssText) => {
    let StringScanner = Xel.classes.StringScanner;

    let tokens = [];
    let scanner = new StringScanner(cssText.toLowerCase());

    while (scanner.peek() !== null) {
      let char = scanner.read();

      (() => {
        // FUNCTION
        if (char === "r" || char === "h") {
          let text = char;

          if (char + scanner.peek(3) === "rgb(") {
            text += scanner.read(3);
          }
          else if (char + scanner.peek(4) === "rgba(") {
            text += scanner.read(4);
          }
          else if (char + scanner.peek(3) === "hsl(") {
            text += scanner.read(3);
          }
          else if (char + scanner.peek(4) === "hsla(") {
            text += scanner.read(4);
          }

          if (text !== char) {
            tokens.push({type: "FUNCTION", text: text});
            return;
          }
        }

        // HEX
        if (char === "#") {
          if (isHexColorString(char + scanner.peek(6))) {
            let text = char + scanner.read(6);
            tokens.push({type: "HEX", text: text});
            return;
          }

          else if (isHexColorString(char + scanner.peek(3))) {
            text = char + scanner.read(3);
            tokens.push({type: "HEX", text: text});
            return;
          }
        }

        // NUMBER
        // PERCENTAGE
        if (["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "-"].includes(char)) {
          let text = char;

          while (true) {
            if (["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "."].includes(scanner.peek())) {
              text += scanner.read();
            }
            else {
              break;
            }
          }

          if (scanner.peek() === "%") {
            text += scanner.read();
            tokens.push({type: "PERCENTAGE", text: text});
          }
          else {
            tokens.push({type: "NUM", text: text});
          }

          return;
        }

        // S
        if (/\u0009|\u000a|\u000c|\u000d|\u0020/.test(char)) {
          // Don't tokenize whitespace as it's meaningless
          return;
        }

        // CHAR
        tokens.push({type: "CHAR", text: char});
        return;
      })();
    }

    return tokens;
  };

  // @type
  //   format = "rgb" || "rgba" || "rgb%" || "rgba%" || "hex" || "hsl" || "hsla"
  //   (string, format) => string
  let formatColorString = (colorString, format) => {
    let model = format.startsWith("hsl") ? "hsla" : "rgba";
    let components = parseColor(colorString, model);
    let formattedColorString = serializeColor(components, model, format);
    return formattedColorString;
  };

  // @info
  //   Check if string represents a valid hex color, e.g. "#fff", "#bada55".
  // @type
  //   (string) => boolean
  let isHexColorString = (string) => {
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

  // @info
  //   Check if string contains valid CSS3 color, e.g. "blue", "#fff", "rgb(50, 50, 100)".
  // @type
  //   (string) => boolean
  let isValidColorString = (string) => {
    try {
      parseColor(string);
    }
    catch (error) {
      return false;
    }

    return true;
  };

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  // @info
  //   Creates HSV spectrum wheel image used by the color pickers.
  let generateWheelSpectrumImage = (size) => {
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
    window.open(canvas.toDataURL("image/png"));
  };

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  Xel.utils.color = {
    rgbToHsl, hslToRgb, rgbToHsv, hsvToRgb, hslToHsv, hsvToHsl,
    parseColor, serializeColor, formatColorString, isHexColorString, isValidColorString,
    generateWheelSpectrumImage
  };
}
