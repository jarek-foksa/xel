
// @copyright
//   © 2016-2024 Jarosław Foksa
// @license
//   MIT License (check LICENSE.md for details)

import DOMPurify from "../node_modules/dompurify/dist/purify.es.js";
import EventEmitter from "./event-emitter.js";

import {compareArrays} from "../utils/array.js";
import {convertColor, parseColor, serializeColor} from "../utils/color.js";
import {getIconset} from "../utils/icon.js";
import {FluentBundle, FluentResource, FluentNumber, FluentNone} from "../node_modules/@fluent/bundle/esm/index.js";
import {getOperatingSystemName} from "../utils/system.js";
import {getRelDisplayDate} from "../utils/time.js";

// @singleton
// @event themechange
// @event accentcolorchange
// @event iconsetschange
// @event localeschange
// @event configchange
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

  // @type string
  get locale() {
    return this.#localesIds[0] || "en";
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
      if (rule.type === 1 && rule.selectorText === "body") {
        let unparsedValue = rule.style.getPropertyValue("--preset-accent-colors");

        if (unparsedValue !== "") {
          let entries = unparsedValue.split(",").map($0 => $0.trim()).map($0 => $0.split(" "));
          colors = Object.fromEntries(entries);
          break;
        }
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
    let fallback = false;
    let format = "text";

    if (args.os === undefined) {
      args.os = getOperatingSystemName();
    }

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
      fallback = true;
    }
    // Sanitize the message if it contains markup
    else if (/<|&#?\w+;/.test(content)) {
      format = "html";
      content = DOMPurify.sanitize(content, {USE_PROFILES: {html: true}});
    }

    return {id, attribute, format, content, fallback};
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  getConfig(key, defaultValue = null) {
    let rawValue = localStorage.getItem(key);
    return (rawValue === null) ? defaultValue : JSON.parse(rawValue);
  }

  setConfig(key, value) {
    let beforeRawValue = localStorage.getItem(key);

    if (value === null) {
      delete localStorage[key];
    }
    else {
      localStorage.setItem(key, JSON.stringify(value));
    }

    let afterRawValue = localStorage.getItem(key);

    if (beforeRawValue !== afterRawValue) {
      this.dispatchEvent(new CustomEvent("configchange", {detail: {key, value, origin: "self"}}));
    }
  }

  clearConfig() {
    if (localStorage.length > 0) {
      let keys = Object.keys(localStorage);
      localStorage.clear();

      for (let key of keys) {
        this.dispatchEvent(new CustomEvent("configchange", {detail: {key, value: null, origin: "self"}}));
      }
    }
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  #theme = null;
  #accentColor = null;
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

    let {theme, accentColor, iconsets, locales} = this.#getSettings();

    this.#theme = theme;
    this.#accentColor = accentColor;
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

    // Observe localStorage for changes
    {
      window.addEventListener("storage", (event) => this.#onStorageChange(event));
    }
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  #onHeadChange(mutations) {
    let oldTheme = this.#theme;
    let oldAccentColor = this.#accentColor;
    let oldIconsets = this.#iconsets;
    let oldLocales = this.#locales;

    let {theme, accentColor, iconsets, locales} = this.#getSettings();

    this.#theme = theme;
    this.#accentColor = accentColor;
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

  // Fired only when storage is changed by OTHER app instance running in a separate tab or window.
  #onStorageChange(event) {
    if (event.storageArea === window.localStorage) {
      let key = event.key;
      let value = (event.newValue === null) ? null : JSON.parse(event.newValue);
      this.dispatchEvent(new CustomEvent("configchange", {detail: {key, value, origin: "other"}}));
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
      this.#themeStyleSheet.replaceSync(cssText);

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

      let ids = urls.map((url) => {
        if (url.startsWith("blob:")) {
          let lang = url.substring(url.lastIndexOf("#") + 1);
          return lang;
        }
        else {
          let fileName = url.substring(url.lastIndexOf("/") + 1);
          let lang = fileName.substring(0, fileName.indexOf("."));
          return lang;
        }
      });

      if (ids.length === 0) {
        ids.push("en");
      }

      let bundle = new FluentBundle([ids[0]], {
        useIsolating: false,
        functions: {
          RELDATETIME: (args = [], opts = {}) => {
            let date;

            if (args[0] instanceof FluentNumber) {
              date = new Date(args[0].value);
            }
            else if (typeof args[0] === "string") {
              date = new Date(parseInt(args[0]));
            }
            else {
              throw new TypeError("Invalid argument to RELDATETIME");
            }

            return getRelDisplayDate(date, new Date(), ids);
          }
        }
      });

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

    let color = convertColor(parseColor(serializedColor), "hsl");
    let [h, s, l] = color.coords;
    let rule = [...this.#themeStyleSheet.cssRules].reverse().find($0 => $0.type === 1 && $0.selectorText === "body");

    // @bugfix: https://github.com/LeaVerou/color.js/issues/328
    if (Number.isNaN(h)) {
      h = 0;
    }

    rule.style.setProperty("--accent-color-h", h);
    rule.style.setProperty("--accent-color-s", `${s}%`);
    rule.style.setProperty("--accent-color-l", `${l}%`);
    rule.style.setProperty("--accent-color-a", color.alpha);
  }

  #getSettings() {
    let themeMeta       = document.head.querySelector(`:scope > meta[name="xel-theme"]`);
    let accentColorMeta = document.head.querySelector(`:scope > meta[name="xel-accent-color"]`);
    let iconsetsMeta    = document.head.querySelector(`:scope > meta[name="xel-iconsets"]`);
    let localesMeta     = document.head.querySelector(`:scope > meta[name="xel-locales"]`);

    return {
      theme       : (themeMeta       && themeMeta.content       !== "") ? themeMeta.content       : null,
      accentColor : (accentColorMeta && accentColorMeta.content !== "") ? accentColorMeta.content : null,
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