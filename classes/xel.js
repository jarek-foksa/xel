
/**
 * @copyright 2016-2025 Jarosław Foksa
 * @license MIT (check LICENSE.md for details)
 */

import DOMPurify from "../node_modules/dompurify/dist/purify.es.mjs";
import EventEmitter from "./event-emitter.js";

import {compareArrays} from "../utils/array.js";
import {getMaterialCSSColorVariables, isValidColorString} from "../utils/color.js"
import {getIcons} from "../utils/icon.js";
import {FluentBundle, FluentResource, FluentNumber} from "../node_modules/@fluent/bundle/esm/index.js";
import {getOperatingSystemName} from "../utils/system.js";
import {getRelDisplayDate} from "../utils/time.js";

/**
 * @singleton
 * @fires themechange
 * @fires iconschange
 * @fires localeschange
 * @fires configchange
 * @fires accentcolorchange
 */
export default new class Xel extends EventEmitter {
  /**
   * URL to a CSS file with Xel theme definition.
   *
   * @type {string | null}
   */
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

  /**
   * URLs to SVG files with icons.
   *
   * @type {Array<string>}
   */
  get icons() {
    return [...this.#icons];
  }
  set icons(urls) {
    let metaElement = document.head.querySelector(`:scope > meta[name="xel-icons"]`);

    if (!metaElement) {
      // @legacy
      {
        metaElement = document.head.querySelector(`:scope > meta[name="xel-iconsets"]`);

        if (metaElement) {
          console.warn(`<meta name="xel-iconsets"> has been deprecated. Please use <meta name="xel-icons"> instead.`);
        }
      }

      if (!metaElement) {
        metaElement = document.createElement("meta");
        metaElement.setAttribute("name", "xel-icons");
        document.head.append(metaElement);
      }
    }

    metaElement.setAttribute("content", urls.join(", "));
  }

  /**
   * URLs to files with localizations.
   * Each file name should consist from ISO 639 language code (e.g. "en"), optionally followed by "-" and ISO 3166
   * territory, e.g. "en", "en-US" or "en-GB".
   *
   * @type {Array<string>}
   */
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

  /**
   * @type {string}
   */
  get locale() {
    return this.#localesIds[0] || "en";
  }

  /**
   * Accent color.
   *
   * @type {string}
   */
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

  /**
   * Specifies the storage area to be used for reading and writing the config
   *
   * @type {Storage}
   * @default localStorage
   */
  get configStorage() {
    return this.#configStorage;
  }
  set configStorage(storage) {
    this.#configStorage = storage;
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

  get whenIconsReady() {
    return new Promise((resolve) => {
      if (this.#iconsReadyCalbacks === null) {
        resolve();
      }
      else {
        this.#iconsReadyCalbacks.push(resolve);
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

  /**
   * @type {CSSStyleSheet}
   */
  get themeStyleSheet() {
    return this.#themeStyleSheet;
  }

  /**
   * @type {Object.<string, string>}
   */
  get presetAccentColors() {
    let colors = {};

    for (let rule of this.#themeStyleSheet.cssRules) {
      if (rule.type === 1 && rule.selectorText === ":root") {
        let unparsedValue = rule.style.getPropertyValue("--preset-accent-colors");

        if (unparsedValue !== "") {
          let entries = unparsedValue.split(",").map($0 => $0.trim());

          for (let entry of entries) {
            let displayName = entry.substring(0, entry.indexOf(" "));
            let value = entry.substring(entry.indexOf(" ") + 1).trim();
            colors[displayName] = value;
          }

          break;
        }
      }
    }

    return colors;
  }

  /**
   * @type {"none" | "titlecase"}
   */
  get autocapitalize() {
    return this.#autocapitalize;
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  /**
   * Get an icon matching the given selector.
   * Selector consists from "#", followed by the icon ID.
   * Should be called after Xel.whenIconsReady.
   *
   * @type {(selector: string) => SVGSymbolElement}
   */
  queryIcon(selector) {
    selector = (selector.startsWith("#") === false) ? "#" + selector : selector;

    let icon = null;

    for (let iconsElement of this.#iconsElements) {
      let matchedIcon = iconsElement.querySelector(selector);

      if (matchedIcon) {
        icon = matchedIcon;
        break;
      }
    }

    return icon;
  }

  /**
   * Get a localized message matching the given selector and args.
   * Selector consists from "#", followed by the message ID, optionally followed by a dot (.) and the message attribute.
   * Should be called after Xel.whenLocalesReady.
   *
   * @type {(selector: string, args?: Object.<string, any>) => {id: string, attribute?: string, format: string, content: string, fallback: boolean}}
   */
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
          if (Array.isArray(message.value)) {
            for (let part of message.value) {
              if (part.type === "select") {
                if (args[part.selector.name] === undefined) {
                  args[part.selector.name] = "unknown";
                }
              }
            }
          }

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

  /**
   * @type {(key: string, defaultValue?: any) => any}
   */
  getConfig(key, defaultValue = null) {
    let rawValue = this.#configStorage.getItem(key);
    return (rawValue === null) ? defaultValue : JSON.parse(rawValue);
  }

  /**
   * @type {(key: string, value: any) => void}
   */
  setConfig(key, value) {
    let beforeRawValue = this.#configStorage.getItem(key);

    if (value === null) {
      delete this.#configStorage[key];
    }
    else {
      this.#configStorage.setItem(key, JSON.stringify(value));
    }

    let afterRawValue = this.#configStorage.getItem(key);

    if (beforeRawValue !== afterRawValue) {
      this.dispatchEvent(new CustomEvent("configchange", {detail: {key, value, origin: "self"}}));
    }
  }

  /**
   * @type {() => void}
   */
  clearConfig() {
    if (this.#configStorage.length > 0) {
      let keys = Object.keys(this.#configStorage);
      this.#configStorage.clear();

      for (let key of keys) {
        this.dispatchEvent(new CustomEvent("configchange", {detail: {key, value: null, origin: "self"}}));
      }
    }
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  #theme = null;
  #accentColor = null;
  #icons = [];
  #locales = [];
  #localesIds = [];
  #autocapitalize = "none";

  #themeStyleSheet = new CSSStyleSheet();
  #iconsElements = [];
  #localesBundle = null;
  #configStorage = localStorage;

  #themeReadyCallbacks = [];
  #iconsReadyCalbacks = [];
  #localesReadyCallbacks = [];

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  constructor() {
    super();

    document.adoptedStyleSheets = [this.#themeStyleSheet];

    let {theme, accentColor, icons, locales} = this.#getSettings();

    this.#theme = theme;
    this.#accentColor = accentColor;
    this.#icons = icons;
    this.#locales = locales;

    this.#localesIds = this.#locales.map((locale) => {
      let fileName = locale.substring(locale.lastIndexOf("/") + 1);
      return fileName.substring(0, fileName.indexOf("."));
    });

    // Load theme
    if (this.#theme !== null) {
      this.#loadTheme(this.#theme);
    }

    // Load icons
    if (this.#icons.length > 0) {
      this.#loadIcons(this.#icons);
    }

    // Load locales
    if (this.#locales.length > 0) {
      this.#loadLocales(this.#locales);
    }

    // Observe <head> for changes
    {
      let observer = new MutationObserver(() => this.#onHeadChange());
      observer.observe(document.head, {attributes: true, subtree: true});
    }

    // Observe config storage for changes
    {
      window.addEventListener("storage", (event) => this.#onStorageChange(event));
    }
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  #onHeadChange() {
    let oldTheme = this.#theme;
    let oldAccentColor = this.#accentColor;
    let oldIcons = this.#icons;
    let oldLocales = this.#locales;

    let {theme, accentColor, icons, locales} = this.#getSettings();

    this.#theme = theme;
    this.#accentColor = accentColor;
    this.#icons = icons;
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
      this.#updateThemeColors();
      this.dispatchEvent(new CustomEvent("accentcolorchange"));
    }

    if (compareArrays(this.#icons, oldIcons, true) === false) {
      this.#loadIcons(this.#icons).then(() => {
        this.dispatchEvent(new CustomEvent("iconschange"));

        // @legacy
        this.dispatchEvent(new CustomEvent("iconsetschange"));
      });
    }

    if (compareArrays(this.#locales, oldLocales, true) === false) {
      this.#loadLocales(this.#locales).then(() => {
        this.dispatchEvent(new CustomEvent("localeschange"));
      });
    }
  }

  // Fired only when storage is changed in another tab, window or iframe with the same origin
  #onStorageChange(event) {
    if (event.storageArea === this.#configStorage) {
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
        // Resolve relative importRuleURL
        if (importRuleURL.startsWith(".")) {
          if (!url.startsWith(".") && !url.startsWith("blob:") && !url.startsWith("data:")) {
            let baseURL =  "https://xel-toolkit.org" + url;
            importRuleURL = new URL(importRuleURL, baseURL).pathname;
          }
        }

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
      this.#updateThemeColors();

      if (this.#themeReadyCallbacks !== null) {
        for (let callback of this.#themeReadyCallbacks) {
          callback();
        }

        this.#themeReadyCallbacks = null;
      }

      resolve();
    });
  }

  #loadIcons(urls) {
    return new Promise(async (resolve) => {
      if (this.#iconsReadyCalbacks === null) {
        this.#iconsReadyCalbacks = [];
      }

      this.#iconsElements = [];

      for (let url of urls) {
        let iconsElement = await getIcons(url);
        this.#iconsElements.push(iconsElement);
      }

      for (let callback of this.#iconsReadyCalbacks) {
        callback();
      }

      this.#iconsReadyCalbacks = null;
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
          RELDATETIME: (args = []) => {
            let date;

            if (args[0] instanceof FluentNumber) {
              date = new Date(args[0].value);
            }
            else if (typeof args[0] === "string") {
              date = new Date(Number.parseInt(args[0]));
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
      let computedStyle = getComputedStyle(document.documentElement);
      this.#autocapitalize = computedStyle.getPropertyValue("--autocapitalize").trim() || "none";
    }
    else {
      this.#autocapitalize = "none";
    }
  }

  async #updateThemeColors() {
    await this.whenThemeReady;

    let color = this.#accentColor || this.presetAccentColors.blue;
    let resolvedColor = this.presetAccentColors[color] ? this.presetAccentColors[color] : color;
    let themeID = "";

    let rootRules =  [...this.#themeStyleSheet.cssRules].filter((rule) => {
      return rule.type === 1 && rule.selectorText === ":root";
    });

    // Determine theme ID
    for (let rule of rootRules) {
      let value = rule.style.getPropertyValue("--theme-id");

      if (value !== "") {
        themeID = value;
      }
    }

    // Set "--accent-color" CSS property on :root
    rootRules.at(-1).style.setProperty(
      "--accent-color",
      themeID.includes("material") ? "var(--material-primary-color)" : resolvedColor
    );

    // Set "--material-<colorName>" CSS properties on :root
    if (themeID.includes("material")) {
      let materialColors = getMaterialCSSColorVariables(
        resolvedColor,
        themeID.includes("-dark"),
        color === "gray"
      );

      for (let [propertyName, value] of Object.entries(materialColors)) {
        rootRules.at(-1).style.setProperty(propertyName, value);
      }
    }

    // Set <meta name="theme-color">
    {
      let meta = document.head.querySelector(`meta[name="theme-color"]`);
      let computedStyle = getComputedStyle(document.documentElement);
      let titlebarColor = computedStyle.getPropertyValue("--titlebar-color").trim() || "auto";

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
  }

  #getSettings() {
    let themeMeta       = document.head.querySelector(`:scope > meta[name="xel-theme"]`);
    let accentColorMeta = document.head.querySelector(`:scope > meta[name="xel-accent-color"]`);
    let iconsMeta       = document.head.querySelector(`:scope > meta[name="xel-icons"]`);
    let localesMeta     = document.head.querySelector(`:scope > meta[name="xel-locales"]`);

    // @legacy
    if (!iconsMeta) {
      iconsMeta = document.head.querySelector(`:scope > meta[name="xel-iconsets"]`);

      if (iconsMeta) {
        console.warn(
          `<meta name="xel-iconsets"> has been deprecated in in Xel 0.27.0. Please use <meta name="xel-icons"> instead.`
        );
      }
    }

    let theme = null;
    let accentColor = null;
    let icons = [];
    let locales = [];

    if (themeMeta && themeMeta.content !== "") {
      theme = themeMeta.content;
    }
    if (accentColorMeta && accentColorMeta.content !== "") {
      if (isValidColorString(accentColorMeta.content)) {
        accentColor = accentColorMeta.content;
      }
      else {
        accentColor = "#000";
      }
    }
    if (iconsMeta) {
      icons = iconsMeta.content.split(",").map(l => l.trim()).filter(l => l !== "");
    }
    if (localesMeta) {
      locales = localesMeta.content.split(",").map(l => l.trim()).filter(l => l !== "");
    }

    return {theme, accentColor, icons, locales};
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

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  /** @deprecated */
  get iconsets() {
    console.warn(`"Xel.iconsets" has been deprecated in Xel 0.27.0. Please use "Xel.icons" instead.`);
    return this.icons;
  }
  set iconsets(iconsets) {
    console.warn(`"Xel.iconsets" has been deprecated in Xel 0.27.0. Please use "Xel.icons" instead.`);
    this.icons = iconsets;
  }

  /** @deprecated */
  get whenIconsetsReady() {
    console.warn(`"Xel.whenIconsetsReady" has been deprecated in Xel 0.27.0. Please use "Xel.whenIconsReady" instead.`);
    return this.whenIconsReady;
  }
}
