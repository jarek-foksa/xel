
// @copyright
//   © 2016-2025 Jarosław Foksa
// @license
//   MIT License (check LICENSE.md for details)

import PTPage from "./pt-page.js";
import Xel from "../classes/xel.js";

import {html, css} from "../utils/template.js";

export default class PTSetupPageElement extends PTPage {
  static _shadowStyleSheet = css`
    h3 {
      margin-bottom: 0;
    }

    h3 strong {
      display: inline-block;
      vertical-align: middle;
      width: 35px;
      height: 35px;
      margin: 0 4px 4px 0;
      background: var(--accent-color);
      border-radius: 80px;
      color: white;
      font-size: 22px;
      font-weight: 500;
      line-height: 35px;
      text-align: center;
    }

    :host-context([data-theme="/themes/fluent-dark.css"]) {
      h3 > strong {
        color: var(--background-color);
      }
    }

    h3 span.optional {
      font-size: 20px;
      vertical-align: middle;
      opacity: 0.7;
    }

    #theme-select,
    #accent-preset-select,
    #icons-select,
    #locale-select {
      display: inline-block;
      vertical-align: middle;
      margin: 0 2px;
    }
  `;

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  #xelThemeChangeListener;
  #xelAccentColorChangeListener;
  #xelIconsChangeListener;
  #xelLocalesChangeListener;
  #themeSelectChangeListener;
  #accentPresetSelectChangeListener;
  #iconSelectChangeListener;
  #localeSelectChangeListener;

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  constructor() {
    super();
  }

  async connectedCallback() {
    super.connectedCallback();

    await this.#update();

    Xel.addEventListener("themechange", this.#xelThemeChangeListener = () => {
      this.#onXelThemeChange();
    });

    Xel.addEventListener("accentcolorchange", this.#xelAccentColorChangeListener = () => {
      this.#onXelAccentColorChange();
    });

    Xel.addEventListener("iconschange", this.#xelIconsChangeListener = () => {
      this.#onXelIconsChange();
    });

    Xel.addEventListener("localeschange", this.#xelLocalesChangeListener = () => {
      this.#onXelLocalesChange();
    });

    this._elements["theme-select"].addEventListener("change", this.#themeSelectChangeListener = () => {
      this.#onThemeSelectChange();
    });

    this._elements["accent-preset-select"].addEventListener("change", this.#accentPresetSelectChangeListener = () => {
      this.#onAccentPresetSelectChange();
    });

    this._elements["icons-select"].addEventListener("change", this.#iconSelectChangeListener = () => {
      this.#onIconsSelectChange();
    });

    this._elements["locale-select"].addEventListener("change", this.#localeSelectChangeListener = () => {
      this.#onLocaleSelectChange();
    });

    this._onReady();
  }

  disconnectedCallback() {
    Xel.removeEventListener("themechange", this.#xelThemeChangeListener);
    Xel.removeEventListener("accentcolorchange", this.#xelAccentColorChangeListener);
    Xel.removeEventListener("iconschange", this.#xelIconsChangeListener);
    Xel.removeEventListener("localeschange", this.#xelLocalesChangeListener);
    this._elements["theme-select"].removeEventListener("change", this.#themeSelectChangeListener);
    this._elements["accent-preset-select"].removeEventListener("change", this.#accentPresetSelectChangeListener);
    this._elements["icons-select"].removeEventListener("change", this.#iconSelectChangeListener);
    this._elements["locale-select"].removeEventListener("change", this.#localeSelectChangeListener);
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  #onXelThemeChange() {
    this.#update();
  }

  #onXelAccentColorChange() {
    this.#update();
  }

  #onXelIconsChange() {
    this.#update();
  }

  #onXelLocalesChange() {
    this.#update();
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  #onThemeSelectChange() {
    Xel.theme = `/themes/${this._elements["theme-select"].value}.css`;
  }

  #onAccentPresetSelectChange() {
    let value = this._elements["accent-preset-select"].value;
    Xel.accentColor = (value === "custom") ? Xel.presetAccentColors[Xel.accentColor] : value;
  }

  #onIconsSelectChange() {
    Xel.icons = [`/icons/${this._elements["icons-select"].value}.svg`];
  }

  #onLocaleSelectChange() {
    Xel.locales = [`/locales/${this._elements["locale-select"].value}.ftl`];
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  #update() {
    return new Promise(async (resolve) => {
      if (this._shadowRoot.childElementCount === 0) {
        let viewHTML = await (await fetch(`/docs/setup.html`)).text();
        this._shadowRoot.innerHTML = viewHTML;

        for (let element of this._shadowRoot.querySelectorAll("[id]")) {
          this._elements[element.id] = element;
        }
      }

      // Theme
      {
        let name = Xel.theme.substring(Xel.theme.lastIndexOf("/") + 1, Xel.theme.indexOf(".css"));
        let meta = `<meta name="xel-theme" content="node_modules/xel/themes/${name}.css">`;

        this._elements["theme-select"].value = name;
        this._elements["theme-code"].textContent = meta;
      }

      // Accent color
      {
        // Preset color
        if (Xel.presetAccentColors[Xel.accentColor]) {
          this._elements["accent-preset-select"].value = Xel.accentColor;
          this._elements["accent-code"].textContent = `<meta name="xel-accent-color" content="${Xel.accentColor}">`;
        }
        // Custom color
        else {
          this._elements["accent-preset-select"].value = "custom";
          this._elements["accent-code"].textContent = `<meta name="xel-accent-color" content="${Xel.accentColor}">`;
        }
      }

      // Icons
      {
        let iconsPath = Xel.icons[0];
        let iconsName = iconsPath.substring(iconsPath.lastIndexOf("/") + 1, iconsPath.lastIndexOf("."));
        let meta = `<meta name="xel-icons" content="node_modules/xel/icons/${iconsName}.svg">`;

        this._elements["icons-select"].value = iconsName;
        this._elements["icons-code"].textContent = meta;
      }

      // Locale
      {
        let localePath = Xel.locales[0];
        let localeName = localePath.substring(localePath.lastIndexOf("/") + 1, localePath.lastIndexOf("."));
        let meta = `<meta name="xel-locales" content="node_modules/xel/locales/${localeName}.ftl">`;

        this._elements["locale-select"].value = localeName;
        this._elements["locale-code"].textContent = meta;
      }

      this.#updateAccentColorMenu();
      resolve();
    });
  }

  #updateAccentColorMenu() {
    let itemsHTML = "";

    for (let [colorName, colorValue] of Object.entries(Xel.presetAccentColors)) {
      itemsHTML += `
        <x-menuitem value="${colorName}">
          <x-swatch value="${colorValue}"></x-swatch>
          <x-label><x-message href="#accent-color-${colorName}"></x-message></x-label>
        </x-menuitem>
      `;
    }

    itemsHTML += `
      <hr/>
      <x-menuitem value="custom">
        <x-icon href="/icons/portal.svg#color-wheel"></x-icon>
        <x-label>Custom</x-label>
      </x-menuitem>
    `;

    this._elements["accent-preset-menu"].innerHTML = itemsHTML;
    this._elements["accent-preset-select"].value = Xel.accentColor;
  }
}

customElements.define("pt-setuppage", PTSetupPageElement);
