
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
    return this._theme;
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
    return this._accentColor;
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
    return this._size;
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
    return this._iconset;
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
      if (this._themeReadyCalbacks === null) {
        resolve();
      }
      else {
        this._themeReadyCalbacks.push(resolve);
      }
    });
  }

  get whenIconsetReady() {
    return new Promise((resolve) => {
      if (this._iconsetReadyCalbacks === null) {
        resolve();
      }
      else {
        this._iconsetReadyCalbacks.push(resolve);
      }
    });
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  // @type CSSStyleSheet
  get themeStyleSheet() {
    return this._themeStyleSheet;
  }

  // @type SVGSVGElement
  get iconsetElement() {
    return this._iconsetElement;
  }

  // @type Object
  get presetAccentColors() {
    let colors = {};

    for (let rule of this._themeStyleSheet.cssRules) {
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

  _theme = null;
  _accentColor = null;
  _size = null;
  _iconset = null;

  _themeStyleSheet = new CSSStyleSheet();
  _iconsetElement = null;

  _themeReadyCalbacks = [];
  _iconsetReadyCalbacks = [];

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  constructor() {
    super();

    document.adoptedStyleSheets = [this._themeStyleSheet];

    let {theme, accentColor, size, iconset} = this._getSettings();

    this._theme = theme;
    this._accentColor = accentColor;
    this._size = size;
    this._iconset = iconset;

    // Load theme
    if (this._theme !== null) {
      this._loadTheme(this._theme);
    }

    // Load iconset
    if (this._iconset !== null) {
      this._loadIconset(this._iconset);
    }

    // Observe <head> for changes
    {
      let observer = new MutationObserver((mutations) => this._onHeadChange(mutations));
      observer.observe(document.head, {attributes: true, subtree: true});
    }
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  _onHeadChange(mutations) {
    let oldTheme = this._theme;
    let oldAccentColor = this._accentColor;
    let oldSize = this._size;
    let oldIconset = this._iconset;

    let {theme, accentColor, size, iconset} = this._getSettings();

    this._theme = theme;
    this._accentColor = accentColor;
    this._size = size;
    this._iconset = iconset;

    if (this._theme !== oldTheme) {
      this._loadTheme(this._theme).then(() => {
        this.dispatchEvent(new CustomEvent("themechange"));
      });
    }

    if (this._accentColor !== oldAccentColor) {
      this._updateThemeAccentColor();
      this.dispatchEvent(new CustomEvent("accentcolorchange"));
    }

    if (this._size !== oldSize) {
      this.dispatchEvent(new CustomEvent("sizechange"));
    }

    if (this._iconset !== oldIconset) {
      this._loadIconset(this._iconset).then(() => {
        this.dispatchEvent(new CustomEvent("iconsetchange"));
      });
    }
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  _fetchTheme(url) {
    return new Promise(async (resolve) => {
      let response = await fetch(url);
      let themeText = await response.text();

      for (let [importRuleURL, importRuleText] of this._getThemeImportRules(themeText)) {
        let importText = await this._fetchTheme(importRuleURL);
        themeText = themeText.replace(importRuleText, importText);
      }

      resolve(themeText);
    });
  }

  _loadTheme(url) {
    return new Promise(async (resolve) => {
      if (this._themeReadyCalbacks === null) {
        this._themeReadyCalbacks = [];
      }

      let cssText = await this._fetchTheme(url);
      await this._themeStyleSheet.replace(cssText);

      this._updateThemeAccentColor();
      this._updateTitlebarColor();

      if (this._themeReadyCalbacks !== null) {
        for (let callback of this._themeReadyCalbacks) {
          callback();
        }

        this._themeReadyCalbacks = null;
      }

      resolve();
    });
  }

  _loadIconset(url) {
    return new Promise(async (resolve) => {
      if (this._iconsetReadyCalbacks === null) {
        this._iconsetReadyCalbacks = [];
      }

      let iconsetElement = await getIconset(url);
      this._iconsetElement = iconsetElement;

      for (let callback of this._iconsetReadyCalbacks) {
        callback();
      }

      this._iconsetReadyCalbacks = null;
      resolve();
    });
  }

  async _updateTitlebarColor() {
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

  async _updateThemeAccentColor() {
    await this.whenThemeReady;
    let serializedColor = this._accentColor || this.presetAccentColors.blue;

    if (this.presetAccentColors[serializedColor]) {
      serializedColor = this.presetAccentColors[serializedColor];
    }

    let [h, s, l, a] = new ColorParser().parse(serializedColor, "hsla");
    let rule = [...this._themeStyleSheet.cssRules].reverse().find($0 => $0.type === 1 && $0.selectorText === "body");

    rule.styleMap.set("--accent-color-h", h);
    rule.styleMap.set("--accent-color-s", `${s}%`);
    rule.styleMap.set("--accent-color-l", `${l}%`);
    rule.styleMap.set("--accent-color-a", a);
  }

  _getSettings() {
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

  _getThemeImportRules(themeText) {
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
