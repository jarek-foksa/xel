
// @copyright
//   © 2016-2022 Jarosław Foksa
// @license
//   MIT License (check LICENSE.md for details)

import ColorParser from "./color-parser.js";
import EventEmitter from "./event-emitter.js";

import {getIconset} from "../utils/icon.js";

// @singleton
// @event themechange
// @event accentcolorchange
// @event sizechange
// @event iconsetchange
export default new class Xel extends EventEmitter {
  // @type string?
  //
  // URL to a CSS file with Xel theme definition.
  get theme() {
    return this.#theme;
  }
  set theme(value) {
    let metaElement = document.head.querySelector(`:scope > meta[name="xel-theme"]`);

    if (!metaElement) {
      metaElement = document.createElement("meta");
      metaElement.setAttribute("name", "xel-theme");
      document.head.append(metaElement);
    }

    metaElement.setAttribute("content", value);
  }

  // @type string
  //
  // Accent color.
  get accentColor() {
    return this.#accentColor;
  }
  set accentColor(value) {
    let meta = document.head.querySelector(`:scope > meta[name="xel-accent-color"]`);

    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "xel-accent-color");
      document.head.append(meta);
    }

    meta.setAttribute("content", value);
  }

  // @type "small" || "medium" || "large"
  //
  // Widgets size.
  get size() {
    return this.#size;
  }
  set size(value) {
    let meta = document.head.querySelector(`:scope > meta[name="xel-size"]`);

    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "xel-size");
      document.head.append(meta);
    }

    meta.setAttribute("content", value);
  }

  // @type string?
  //
  // URL to an SVG file with Xel iconset definition.
  get iconset() {
    return this.#iconset;
  }
  set iconset(url) {
    let metaElement = document.head.querySelector(`:scope > meta[name="xel-iconset"]`);

    if (!metaElement) {
      metaElement = document.createElement("meta");
      metaElement.setAttribute("name", "xel-iconset");
      document.head.append(metaElement);
    }

    metaElement.setAttribute("content", url);
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  get whenThemeReady() {
    return new Promise((resolve) => {
      if (this.#themeReadyCalbacks === null) {
        resolve();
      }
      else {
        this.#themeReadyCalbacks.push(resolve);
      }
    });
  }

  get whenIconsetReady() {
    return new Promise((resolve) => {
      if (this.#iconsetReadyCalbacks === null) {
        resolve();
      }
      else {
        this.#iconsetReadyCalbacks.push(resolve);
      }
    });
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  // @type CSSStyleSheet
  get themeStyleSheet() {
    return this.#themeStyleSheet;
  }

  // @type SVGSVGElement
  get iconsetElement() {
    return this.#iconsetElement;
  }

  // @type Object
  get presetAccentColors() {
    let colors = {};

    for (let rule of this.#themeStyleSheet.cssRules) {
      if (rule.type === 1 && rule.selectorText === "body" && rule.styleMap.has("--preset-accent-colors")) {
        let unparsedValue = rule.styleMap.get("--preset-accent-colors");

        if (unparsedValue && unparsedValue[0]) {
          let entries = unparsedValue[0].split(",").map($0 => $0.trim()).map($0 => $0.split(" "))
          colors = Object.fromEntries(entries);
        }

        break;
      }
    }

    return colors;
  }

  #theme = null;
  #accentColor = null;
  #size = null;
  #iconset = null;

  #themeStyleSheet = new CSSStyleSheet();
  #iconsetElement = null;

  #themeReadyCalbacks = [];
  #iconsetReadyCalbacks = [];

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  constructor() {
    super();

    document.adoptedStyleSheets = [this.#themeStyleSheet];

    let {theme, accentColor, size, iconset} = this.#getSettings();

    this.#theme = theme;
    this.#accentColor = accentColor;
    this.#size = size;
    this.#iconset = iconset;

    // Load theme
    if (this.#theme !== null) {
      this.#loadTheme(this.#theme);
    }

    // Load iconset
    if (this.#iconset !== null) {
      this.#loadIconset(this.#iconset);
    }

    // Observe <head> for changes
    {
      let observer = new MutationObserver((mutations) => this.#onHeadChange(mutations));
      observer.observe(document.head, {attributes: true, subtree: true});
    }
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  #onHeadChange(mutations) {
    let oldTheme = this.#theme;
    let oldAccentColor = this.#accentColor;
    let oldSize = this.#size;
    let oldIconset = this.#iconset;

    let {theme, accentColor, size, iconset} = this.#getSettings();

    this.#theme = theme;
    this.#accentColor = accentColor;
    this.#size = size;
    this.#iconset = iconset;

    if (this.#theme !== oldTheme) {
      this.#loadTheme(this.#theme).then(() => {
        this.dispatchEvent(new CustomEvent("themechange"));
      });
    }

    if (this.#accentColor !== oldAccentColor) {
      this.#updateThemeAccentColor();
      this.dispatchEvent(new CustomEvent("accentcolorchange"));
    }

    if (this.#size !== oldSize) {
      this.dispatchEvent(new CustomEvent("sizechange"));
    }

    if (this.#iconset !== oldIconset) {
      this.#loadIconset(this.#iconset).then(() => {
        this.dispatchEvent(new CustomEvent("iconsetchange"));
      });
    }
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  #fetchTheme(url) {
    return new Promise(async (resolve) => {
      let response = await fetch(url);
      let themeText = await response.text();

      for (let [importRuleURL, importRuleText] of this.#getThemeImportRules(themeText)) {
        let importText = await this.#fetchTheme(importRuleURL);
        themeText = themeText.replace(importRuleText, importText);
      }

      resolve(themeText);
    });
  }

  #loadTheme(url) {
    return new Promise(async (resolve) => {
      if (this.#themeReadyCalbacks === null) {
        this.#themeReadyCalbacks = [];
      }

      let cssText = await this.#fetchTheme(url);
      await this.#themeStyleSheet.replace(cssText);

      this.#updateThemeAccentColor();
      this.#updateTitlebarColor();

      if (this.#themeReadyCalbacks !== null) {
        for (let callback of this.#themeReadyCalbacks) {
          callback();
        }

        this.#themeReadyCalbacks = null;
      }

      resolve();
    });
  }

  #loadIconset(url) {
    return new Promise(async (resolve) => {
      if (this.#iconsetReadyCalbacks === null) {
        this.#iconsetReadyCalbacks = [];
      }

      let iconsetElement = await getIconset(url);
      this.#iconsetElement = iconsetElement;

      for (let callback of this.#iconsetReadyCalbacks) {
        callback();
      }

      this.#iconsetReadyCalbacks = null;
      resolve();
    });
  }

  async #updateTitlebarColor() {
    await this.whenThemeReady;

    let meta = document.head.querySelector(`meta[name="theme-color"]`);
    let titlebarColor = getComputedStyle(document.body).getPropertyValue("--titlebar-color").trim() || "auto";

    if (titlebarColor === "auto") {
      if (meta) {
        meta.remove();
      }
    }
    else {
      if (meta === null) {
        meta = document.createElement("meta");
        meta.setAttribute("name", "theme-color");
        document.head.append(meta);
      }

      meta.setAttribute("content", titlebarColor);
    }
  }

  async #updateThemeAccentColor() {
    await this.whenThemeReady;
    let serializedColor = this.#accentColor || this.presetAccentColors.blue;

    if (this.presetAccentColors[serializedColor]) {
      serializedColor = this.presetAccentColors[serializedColor];
    }

    let [h, s, l, a] = new ColorParser().parse(serializedColor, "hsla");
    let rule = [...this.#themeStyleSheet.cssRules].reverse().find($0 => $0.type === 1 && $0.selectorText === "body");

    rule.styleMap.set("--accent-color-h", h);
    rule.styleMap.set("--accent-color-s", `${s}%`);
    rule.styleMap.set("--accent-color-l", `${l}%`);
    rule.styleMap.set("--accent-color-a", a);
  }

  #getSettings() {
    let themeMeta       = document.head.querySelector(`:scope > meta[name="xel-theme"]`);
    let accentColorMeta = document.head.querySelector(`:scope > meta[name="xel-accent-color"]`);
    let sizeMeta        = document.head.querySelector(`:scope > meta[name="xel-size"]`);
    let iconsetMeta     = document.head.querySelector(`:scope > meta[name="xel-iconset"]`);

    return {
      theme       : (themeMeta       && themeMeta.content       !== "") ? themeMeta.content       : null,
      accentColor : (accentColorMeta && accentColorMeta.content !== "") ? accentColorMeta.content : null,
      size        : (sizeMeta        && sizeMeta.content        !== "") ? sizeMeta.content        : null,
      iconset     : (iconsetMeta     && iconsetMeta.content     !== "") ? iconsetMeta.content     : null,
    };
  }

  #getThemeImportRules(themeText) {
    let output = [];
    let currentIndex = -1;

    while (true) {
      let importStartIndex = themeText.indexOf("@import", currentIndex);

      if (importStartIndex > -1) {
        let importEndIndex = themeText.indexOf(";", importStartIndex);
        let pathStartIndex = 0;
        let pathEndIndex = themeText.indexOf(".css", importStartIndex) + ".css".length;
        let quoteIndex = themeText.indexOf(`'`, importStartIndex);
        let dblquoteIndex = themeText.indexOf(`"`, importStartIndex);

        if (quoteIndex > importStartIndex && quoteIndex < importEndIndex) {
          pathStartIndex = quoteIndex + 1;
        }
        else if (dblquoteIndex > importStartIndex && dblquoteIndex < importEndIndex) {
          pathStartIndex = dblquoteIndex + 1;
        }
        else {
          let urlStartIndex = themeText.indexOf("url(", importStartIndex);

          if (urlStartIndex > importStartIndex && urlStartIndex < importEndIndex) {
            pathStartIndex = urlStartIndex + "url(".length;
          }
        }

        let path = themeText.substring(pathStartIndex, pathEndIndex);

        output.push([path, themeText.substring(importStartIndex, importEndIndex+1)]);
        currentIndex = pathEndIndex;
      }
      else {
        break;
      }
    }

    return output;
  }
}
