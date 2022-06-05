
// @copyright
//   © 2016-2022 Jarosław Foksa
// @license
//   MIT License (check LICENSE.md for details)

import ColorParser from "./color-parser.js";
import DOMPurify from "../node_modules/dompurify/dist/purify.es.js";
import EventEmitter from "./event-emitter.js";

import {compareArrays} from "../utils/array.js";
import {getIconset} from "../utils/icon.js";
import {FluentBundle, FluentResource} from "../node_modules/@fluent/bundle/esm/index.js";

// @singleton
// @event themechange
// @event accentcolorchange
// @event sizechange
// @event iconsetschange
// @event localeschange
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

  // @type Array<string>
  //
  // URLs to an SVG files with icons.
  get iconsets() {
    return [...this.#iconsets];
  }
  set iconsets(urls) {
    let metaElement = document.head.querySelector(`:scope > meta[name="xel-iconsets"]`);

    if (!metaElement) {
      metaElement = document.createElement("meta");
      metaElement.setAttribute("name", "xel-iconsets");
      document.head.append(metaElement);
    }

    metaElement.setAttribute("content", urls.join(", "));
  }

  // @type Array<string>
  //
  // URLs to files with localizations.
  // Each file name should consist from ISO 639 language code (e.g. "en"), optionally followed by "-" and ISO 3166
  // territory, e.g. "en", "en-US" or "en-GB".
  get locales() {
    return [...this.#locales];
  }
  set locales(urls) {
    let metaElement = document.head.querySelector(`:scope > meta[name="xel-locales"]`);

    if (!metaElement) {
      metaElement = document.createElement("meta");
      metaElement.setAttribute("name", "xel-locales");
      document.head.append(metaElement);
    }

    metaElement.setAttribute("content", urls.join(", "));
  }

  // @type Array<string>
  //
  // An array of locale identifier currently in use, e.g. ["en-US", "en"]
  get localesIds() {
    return this.#localesIds;
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  get whenThemeReady() {
    return new Promise((resolve) => {
      if (this.#themeReadyCallbacks === null) {
        resolve();
      }
      else {
        this.#themeReadyCallbacks.push(resolve);
      }
    });
  }

  get whenIconsetsReady() {
    return new Promise((resolve) => {
      if (this.#iconsetsReadyCalbacks === null) {
        resolve();
      }
      else {
        this.#iconsetsReadyCalbacks.push(resolve);
      }
    });
  }

  get whenLocalesReady() {
    return new Promise((resolve) => {
      if (this.#localesReadyCallbacks === null) {
        resolve();
      }
      else {
        this.#localesReadyCallbacks.push(resolve);
      }
    });
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  // @type CSSStyleSheet
  get themeStyleSheet() {
    return this.#themeStyleSheet;
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

  // @type "none" || "titlecase"
  get autocapitalize() {
    return this.#autocapitalize;
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  // @type (string) => SVGSymbolElement
  //
  // Get an icon matching the given selector.
  // Selector consists from "#", followed by the icon ID.
  // Should be called after Xel.whenIconsetsReady.
  queryIcon(selector) {
    selector = (selector.startsWith("#") === false) ? "#" + selector : selector;

    let icon = null;

    for (let iconsetElement of this.#iconsetElements) {
      let matchedIcon = iconsetElement.querySelector(selector);

      if (matchedIcon) {
        icon = matchedIcon;
        break;
      }
    }

    return icon;
  }

  // @type (string, Object) => {id:string, attribute:string?, format:string, content:string}
  //
  // Get a localized message matching the given selector and args.
  // Selector consists from "#", followed by the message ID, optionally followed by a dot (.) and the message attribute.
  // Should be called after Xel.whenLocalesReady.
  queryMessage(selector, args = {}) {
    selector = selector.startsWith("#") ? selector.substring(1) : selector;

    let [id, attribute] = selector.split(".");
    let message = this.#localesBundle.getMessage(id);
    let content = null;
    let format = "text";

    if (attribute === undefined) {
      attribute = null;
    }

    if (message) {
      if (attribute === null) {
        if (message.value) {
          content = this.#localesBundle.formatPattern(message.value, args);
        }
      }
      else {
        if (message.attributes?.[attribute]) {
          content = this.#localesBundle.formatPattern(message.attributes[attribute], args);
        }
      }
    }

    // Show fallback text if the message was not found
    if (content === null) {
      content = (attribute === null) ? id : `${id}.${attribute}`;
    }
    // Sanitize the message if it contains markup
    else if (/<|&#?\w+;/.test(content)) {
      format = "html";
      content = DOMPurify.sanitize(content, {USE_PROFILES: {html: true}});
    }

    return {id, attribute, format, content};
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  #theme = null;
  #accentColor = null;
  #size = null;
  #iconsets = [];
  #locales = [];
  #localesIds = [];
  #autocapitalize = "none";

  #themeStyleSheet = new CSSStyleSheet();
  #iconsetElements = [];
  #localesBundle = null;

  #themeReadyCallbacks = [];
  #iconsetsReadyCalbacks = [];
  #localesReadyCallbacks = [];

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  constructor() {
    super();

    document.adoptedStyleSheets = [this.#themeStyleSheet];

    let {theme, accentColor, size, iconsets, locales} = this.#getSettings();

    this.#theme = theme;
    this.#accentColor = accentColor;
    this.#size = size;
    this.#iconsets = iconsets;
    this.#locales = locales;

    this.#localesIds = this.#locales.map((locale) => {
      let fileName = locale.substring(locale.lastIndexOf("/") + 1);
      return fileName.substring(0, fileName.indexOf("."));
    });

    // Load theme
    if (this.#theme !== null) {
      this.#loadTheme(this.#theme);
    }

    // Load iconsets
    if (this.#iconsets.length > 0) {
      this.#loadIconsets(this.#iconsets);
    }

    // Load locales
    if (this.#locales.length > 0) {
      this.#loadLocales(this.#locales);
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
    let oldIconsets = this.#iconsets;
    let oldLocales = this.#locales;

    let {theme, accentColor, size, iconsets, locales} = this.#getSettings();

    this.#theme = theme;
    this.#accentColor = accentColor;
    this.#size = size;
    this.#iconsets = iconsets;
    this.#locales = locales;

    this.#localesIds = this.#locales.map((locale) => {
      let fileName = locale.substring(locale.lastIndexOf("/") + 1);
      return fileName.substring(0, fileName.indexOf("."));
    });

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

    if (compareArrays(this.#iconsets, oldIconsets, true) === false) {
      this.#loadIconsets(this.#iconsets).then(() => {
        this.dispatchEvent(new CustomEvent("iconsetschange"));
      });
    }

    if (compareArrays(this.#locales, oldLocales, true) === false) {
      this.#loadLocales(this.#locales).then(() => {
        this.dispatchEvent(new CustomEvent("localeschange"));
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
      if (this.#themeReadyCallbacks === null) {
        this.#themeReadyCallbacks = [];
      }

      let cssText = await this.#fetchTheme(url);
      await this.#themeStyleSheet.replace(cssText);

      this.#updateAutocapitlizeProperty();
      this.#updateThemeAccentColor();
      this.#updateTitlebarColor();

      if (this.#themeReadyCallbacks !== null) {
        for (let callback of this.#themeReadyCallbacks) {
          callback();
        }

        this.#themeReadyCallbacks = null;
      }

      resolve();
    });
  }

  #loadIconsets(urls) {
    return new Promise(async (resolve) => {
      if (this.#iconsetsReadyCalbacks === null) {
        this.#iconsetsReadyCalbacks = [];
      }

      this.#iconsetElements = [];

      for (let url of urls) {
        let iconsetElement = await getIconset(url);
        this.#iconsetElements.push(iconsetElement);
      }

      for (let callback of this.#iconsetsReadyCalbacks) {
        callback();
      }

      this.#iconsetsReadyCalbacks = null;
      resolve();
    });
  }

  #loadLocales(urls) {
    return new Promise(async (resolve) => {
      if (this.#localesReadyCallbacks === null) {
        this.#localesReadyCallbacks = [];
      }

      let ids = [];

      if (urls.length > 0) {
        let fileName = urls[0].substring(urls[0].lastIndexOf("/") + 1);
        ids.push(fileName.substring(0, fileName.indexOf(".")));
      }
      else {
        ids.push("en");
      }

      let bundle = new FluentBundle(ids, {useIsolating: false});

      for (let i = urls.length-1; i >= 0; i -= 1) {
        let url = urls[i];
        let source = await (await fetch(url)).text();
        let resource = new FluentResource(source);
        let errors = bundle.addResource(resource, {allowOverrides: true});

        // Syntax errors are per-message and don't break the whole resource
        if (errors.length) {
          console.info("Found localization syntax errors", errors);
        }
      }

      this.#localesBundle = bundle;
      this.#updateAutocapitlizeProperty();

      for (let callback of this.#localesReadyCallbacks) {
        callback();
      }

      this.#localesReadyCallbacks = null;
      resolve();
    });
  }

  #updateAutocapitlizeProperty() {
    if (this.#localesBundle?.locales[0]?.startsWith("en")) {
      this.#autocapitalize = getComputedStyle(document.body).getPropertyValue("--autocapitalize").trim() || "none";
    }
    else {
      this.#autocapitalize = "none";
    }
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
    let iconsetsMeta    = document.head.querySelector(`:scope > meta[name="xel-iconsets"]`);
    let localesMeta     = document.head.querySelector(`:scope > meta[name="xel-locales"]`);

    return {
      theme       : (themeMeta       && themeMeta.content       !== "") ? themeMeta.content       : null,
      accentColor : (accentColorMeta && accentColorMeta.content !== "") ? accentColorMeta.content : null,
      size        : (sizeMeta        && sizeMeta.content        !== "") ? sizeMeta.content        : null,
      iconsets    : iconsetsMeta ? iconsetsMeta.content.split(",").map(l => l.trim()).filter(l => l !== "") : [],
      locales     : localesMeta  ?  localesMeta.content.split(",").map(l => l.trim()).filter(l => l !== "") : []
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
