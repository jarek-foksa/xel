
// @copyright
//   © 2016-2021 Jarosław Foksa
// @license
//   GNU General Public License v3, Xel Commercial License v1 (check LICENSE.md for details)

import StringScanner from "./string-scanner.js";

import {isHexColorString, rgbToHsl, hslToRgb, rgbToHsv, hslToHsv} from "../utils/color.js";
import {normalize} from "../utils/math.js";

let {parseFloat, parseInt} = Number;

export default class ColorParser {
  // @doc http://www.w3.org/TR/css3-color/#svg-color
  //
  // A list of named colors and their corresponding RGB values.
  static _namedColors = {
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

  // @type (string, "rgba" || "hsla" || "hsva") => Array<number, number, number, number>
  //
  // Parse the given CSS color string into corresponding RGBA, HSLA or HSVA components.
  parse(colorString, outputModel = "rgba") {
    colorString = colorString.trim();

    let tokens = this._tokenize(colorString);
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

    else if (ColorParser._namedColors[colorString]) {
      rgbaComponents = [
        ColorParser._namedColors[colorString][0],
        ColorParser._namedColors[colorString][1],
        ColorParser._namedColors[colorString][2],
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

  // @type (string) => Array<{type: string, text: string}>
  //
  // Convert CSS color string into an array of tokens.
  // -----------------------------------
  // Token type    Sample token text
  // -----------------------------------
  // "FUNCTION"    "rgb(", "hsla("
  // "HEX"         "#000", "#bada55"
  // "NUMBER"      "100", ".2", "10.3234"
  // "PERCENTAGE"  "100%", "0.2%"
  // "CHAR"        ")", ","
  _tokenize(colorString) {
    let tokens = [];
    let scanner = new StringScanner(colorString.toLowerCase());

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
            let text = char + scanner.read(3);
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
  }
}
